// Background Service Worker
// Handles alarms, notifications, and rule evaluation

importScripts('../scripts/storage.js', '../scripts/api.js', '../scripts/rule-engine.js');

// Initialize on installation
chrome.runtime.onInstalled.addListener(async (details) => {
    try {
        console.log('EasyETA_HK installed:', details.reason);

        if (details.reason === 'install') {
            // First-time installation
            await initializeExtension();
            console.log('EasyETA_HK installed! Click the extension icon to use.');
        } else if (details.reason === 'update') {
            // Extension updated
            console.log('Extension updated to version', chrome.runtime.getManifest().version);
        }
    } catch (error) {
        console.error('Error during extension installation:', error);
    }
});

// Handle action (toolbar icon) clicks — no-op, popup is defined in manifest
// Initialize extension with default data
async function initializeExtension() {
    const defaults = {
        favorites: [],
        rules: [],
        settings: Storage.getDefaultSettings(),
        recent: [],
        stats: {
            totalNotifications: 0,
            rulesTriggered: 0,
            lastUpdate: new Date().toISOString()
        }
    };
    
    const existing = await chrome.storage.local.get(null);
    const missing = Object.fromEntries(Object.entries(defaults).filter(([key]) => existing[key] === undefined));
    if (Object.keys(missing).length) await Storage.setMultiple(missing);
    console.log('Extension initialized with defaults');
}

// Listen for alarm events
chrome.alarms.onAlarm.addListener(async (alarm) => {
    try {
        console.log('Alarm triggered:', alarm.name);
        
        if (alarm.name === 'checkRules') {
            await checkAllRules();
        }
    } catch (error) {
        console.error('Error handling alarm:', error);
    }
});

// Set up periodic rule checking
async function setupRuleChecking() {
    // Chrome alarms have a minimum practical period of one minute.
    chrome.alarms.create('checkRules', { periodInMinutes: 1 });
}

// Check all active rules
async function checkAllRules() {
    const rules = await Storage.getRules();
    const activeRules = rules.filter(rule => rule.enabled);
    
    for (const rule of activeRules) {
        await evaluateRule(rule.id);
    }
}

// Evaluate a specific rule
async function evaluateRule(ruleId) {
    const rules = await Storage.getRules();
    const rule = rules.find(r => r.id === ruleId);
    
    if (!rule || !rule.enabled) {
        return;
    }
    
    try {
        // Build context for rule evaluation
        const context = await buildEvaluationContext(rule);
        
        // ETA thresholds are edge-triggered; legacy time rules use the shared evaluator.
        let shouldTrigger = rule.thresholdMinutes == null ? await RuleEngine.evaluate(rule, context) : false;
        if (rule.thresholdMinutes != null) {
            const current = context.eta?.next;
            const t = `${String(context.currentTime.hour).padStart(2, '0')}:${String(context.currentTime.minute).padStart(2, '0')}`;
            const scheduled = !rule.schedule || (rule.schedule.days.includes(context.currentTime.day) && t >= rule.schedule.startTime && t <= rule.schedule.endTime);
            shouldTrigger = scheduled && Number.isFinite(current) && current <= rule.thresholdMinutes &&
                !(Number.isFinite(rule.lastEtaMinutes) && rule.lastEtaMinutes <= rule.thresholdMinutes);
            rule.lastEtaMinutes = current;
            await Storage.saveRules(rules);
        }

        if (shouldTrigger) {
            await triggerRuleActions(rule, context);
            
            // Update rule stats
            rule.lastTriggered = new Date().toISOString();
            rule.triggerCount = (rule.triggerCount || 0) + 1;
            await Storage.saveRules(rules);
        }
    } catch (error) {
        console.error(`Error evaluating rule ${ruleId}:`, error);
    }
}

// Build context for rule evaluation
async function buildEvaluationContext(rule) {
    const now = new Date();
    
    const context = {
        currentTime: {
            hour: now.getHours(),
            minute: now.getMinutes(),
            day: now.getDay(), // 0 = Sunday, 1 = Monday, etc.
            date: now.getDate(),
            month: now.getMonth(),
            year: now.getFullYear(),
            timestamp: now.getTime()
        },
        eta: null,
        weather: null, // Can be added later with weather API
        rule: rule
    };
    
    if (rule.stopId && rule.provider && rule.route) {
        try {
            const variant = { _provider: rule.provider, route: rule.route, dir: rule.dir,
                service_type: rule.service_type, route_id: rule.route_id, region: rule.region };
            const etas = await API.getStopRouteEtas(rule.stopId, variant);
            context.eta = { all: etas, next: etas[0]?.minutes ?? null,
                second: etas[1]?.minutes ?? null, third: etas[2]?.minutes ?? null,
                time: etas[0]?.time || null, raw: etas };
        } catch (error) { console.error('Error fetching ETA for rule:', error); }
    }
    
    return context;
}

// Trigger rule actions (notifications, etc.)
async function triggerRuleActions(rule, context) {
    console.log('Triggering actions for rule:', rule.name);
    
    // Process each action
    const actions = rule.actions || [{
        type: 'notification',
        title: rule.name || 'Bus Alert',
        message: rule.message || 'Your bus is arriving soon!',
        sound: rule.sound !== false
    }];
    
    for (const action of actions) {
        try {
            await executeAction(action, context);
        } catch (error) {
            console.error('Error executing action:', error);
        }
    }
    
    // Update stats
    const stats = await Storage.get('stats') || {};
    stats.totalNotifications = (stats.totalNotifications || 0) + 1;
    stats.rulesTriggered = (stats.rulesTriggered || 0) + 1;
    stats.lastUpdate = new Date().toISOString();
    await Storage.set('stats', stats);
}

// Execute a single action
async function executeAction(action, context) {
    switch (action.type) {
        case 'notification':
            await showNotification(action, context);
            break;
            
        case 'badge':
            await updateBadge(action, context);
            break;
            
        default:
            console.warn('Unknown action type:', action.type);
    }
}

// Show notification
async function showNotification(action, context) {
    // Replace template variables in title and message
    const title = replaceTemplateVars(action.title, context);
    const message = replaceTemplateVars(action.message, context);
    
    // Determine notification type based on available data
    let notificationType = 'basic';
    let items = [];
    
    // If we have multiple ETAs, use list type
    if (context.eta && context.eta.all && context.eta.all.length > 1) {
        notificationType = 'list';
        items = context.eta.all.slice(0, 3).map((eta, index) => ({
            title: `Bus ${index + 1}`,
            message: eta
        }));
    }
    
    const notificationOptions = {
        type: notificationType,
        iconUrl: chrome.runtime.getURL('icons/icon128.png'),
        title: title,
        message: message,
        contextMessage: 'EasyETA_HK - Hong Kong Bus Tracker',
        priority: action.priority === 'high' ? 2 : 0,
        requireInteraction: action.priority === 'high',
        isClickable: true,  // Keep notification until user interacts
        eventTime: Date.now()  // Timestamp for the notification
    };
    
    // Add buttons for better user interaction
    notificationOptions.buttons = [
        {
            title: 'Open EasyETA',
            iconUrl: '../icons/icon16.png'
        }
    ];
    
    // Create unique notification ID
    const notificationId = `notification-${Date.now()}`;
    
    // Show notification
    await chrome.notifications.create(
        notificationId,
        notificationOptions
    );
    
    // Play sound if enabled
    const settings = await Storage.getSettings();
    // Chrome notification sound is controlled by the operating system.
    
    return notificationId;
}

// Update extension badge
async function updateBadge(action, context) {
    const text = replaceTemplateVars(action.text, context);

    await chrome.action.setBadgeText({ text: String(text).slice(0, 4) });
    await chrome.action.setBadgeBackgroundColor({ color: '#FF4747' });
}

// Replace template variables in strings
function replaceTemplateVars(template, context) {
    if (!template) return '';
    
    return template.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
        // Support nested paths like {{eta.next}}
        const value = path.split('.').reduce((obj, key) => obj?.[key], context);
        return value !== undefined ? value : match;
    });
}

// Handle notification events
chrome.notifications.onClicked.addListener((notificationId) => {
    try {
        console.log('Notification clicked:', notificationId);
        
        // Open popup when notification is clicked
        chrome.action.openPopup();
        
        // Clear the notification
        chrome.notifications.clear(notificationId);
    } catch (error) {
        console.error('Error handling notification click:', error);
    }
});

chrome.notifications.onClosed.addListener((notificationId, byUser) => {
    try {
        console.log('Notification closed:', notificationId, 'by user:', byUser);
        
        // Could add analytics or other logic here
    } catch (error) {
        console.error('Error handling notification close:', error);
    }
});

chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
    try {
        console.log('Notification button clicked:', notificationId, 'button:', buttonIndex);
        
        if (buttonIndex === 0) {
            // Open popup when "Open EasyETA" button is clicked
            chrome.action.openPopup();
        }
        
        // Clear the notification
        chrome.notifications.clear(notificationId);
    } catch (error) {
        console.error('Error handling notification button click:', error);
    }
});

// Handle messages from popup or options page
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Message received:', request);
    
    switch (request.action) {
        case 'testNotification':
            showNotification(request.notificationAction, request.context).then(notificationId => {
                sendResponse({ success: true, notificationId });
            }).catch(error => {
                sendResponse({ success: false, error: error.message });
            });
            return true; // Keep channel open for async response
            
        case 'evaluateRule':
            evaluateRule(request.ruleId).then(() => {
                sendResponse({ success: true });
            });
            return true; // Keep channel open for async response
            
        case 'testRule':
            testRule(request.rule).then(result => {
                sendResponse(result);
            });
            return true;
            
        case 'refreshETA':
            refreshETA(request.stopId).then(eta => {
                sendResponse({ eta });
            });
            return true;
            
        default:
            sendResponse({ error: 'Unknown action' });
    }
});

// Test a rule without saving it
async function testRule(rule) {
    try {
        const context = await buildEvaluationContext(rule);
        const result = await RuleEngine.evaluate(rule, context);
        
        return {
            success: true,
            shouldTrigger: result,
            context: context
        };
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

// Refresh ETA for a stop
async function refreshETA(stopId) {
    try {
        const etas = await API.getETA(stopId);
        return etas;
    } catch (error) {
        console.error('Error refreshing ETA:', error);
        return [];
    }
}

// Start rule checking when service worker starts
try {
    setupRuleChecking();
} catch (error) {
    console.error('Failed to setup rule checking:', error);
}

console.log('EasyETA_HK service worker loaded');
