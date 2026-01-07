// EasyETA_HK Options Page Script

// State
let state = {
    rules: [],
    favorites: [],
    timeslots: [],
    customTabs: [],
    wizard: {
        step: 1,
        data: {
            route: null,
            bound: null,
            serviceType: '1',
            stop: null,
            stopName: null,
            stopSeq: null,
            triggerType: 'eta', // eta or arriving
            triggerValue: 5,
            days: [1,2,3,4,5],
            startTime: '08:00',
            endTime: '09:00',
            name: null
        }
    }
};

// DOM Elements
const elements = {
    navTabs: document.querySelectorAll('.nav-tab'),
    tabPanes: document.querySelectorAll('.tab-pane'),
    
    // Rules
    rulesList: document.getElementById('rulesList'),
    addRuleBtn: document.getElementById('addRuleBtn'),
    ruleEditor: document.getElementById('ruleEditor'),
    closeBtns: document.querySelectorAll('.close-btn'),
    
    // Favorites
    favoritesList: document.getElementById('favoritesListAdmin'),
    addFavouriteBtn: document.getElementById('addFavouriteBtn'),

    // Timeslots
    timeslotsList: document.getElementById('timeslotsList'),
    addTimeslotBtn: document.getElementById('addTimeslotBtn'),

    // Custom Tabs
    customTabsList: document.getElementById('customTabsList'),
    addCustomTabBtn: document.getElementById('addCustomTabBtn'),

    // Settings
    settingDarkMode: document.getElementById('setting-dark-mode'),
    settingAutoRefresh: document.getElementById('setting-auto-refresh'),

    // Data
    exportAllBtn: document.getElementById('exportAllBtn'),
    importFile: document.getElementById('importFile'),
    importBtn: document.getElementById('importBtn'),
    clearAllBtn: document.getElementById('clearAllBtn'),
    storageInfo: document.getElementById('storageInfo'),
    testNotificationBtn: document.getElementById('testNotificationBtn'),

    // Wizard
    wizardSteps: document.querySelectorAll('.wizard-step'),
    progressSteps: document.querySelectorAll('.wizard-progress .step'),
    prevStepBtn: document.getElementById('prevStepBtn'),
    nextStepBtn: document.getElementById('nextStepBtn'),
    finishStepBtn: document.getElementById('finishStepBtn'),
    
    // Wizard Inputs
    routeSearchInput: document.getElementById('routeSearchInput'),
    routeResults: document.getElementById('routeResults'),
    routeDirectionSelect: document.getElementById('routeDirectionSelect'),
    routeStopSelect: document.getElementById('routeStopSelect'),
    
    stopIdInput: document.getElementById('stopIdInput'),
    stopSearchBtn: document.getElementById('stopSearchBtn'),
    stopRoutesList: document.getElementById('stopRoutesList'),
};

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    await loadData();
    setupEventListeners();
    setupWizard();
    renderRules();
    renderFavorites();
    renderTimeslots();
    renderCustomTabs();
    updateStorageInfo();
});

// Listen for messages from popup to refresh favourites
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'refreshFavourites') {
        loadData().then(() => {
            renderFavorites();
        });
    }
});

async function loadData() {
    state.rules = await Storage.getRules() || [];
    state.favorites = await Storage.getFavorites() || [];
    state.timeslots = await Storage.getTimeslots() || [];
    state.customTabs = await Storage.getCustomTabs() || [];
    updateCustomTabCounts();
}

function openRuleWizard() {
    state.wizard.step = 1;
    state.wizard.data = { days: [1,2,3,4,5], startTime:'08:00', endTime:'09:00', triggerType:'eta', triggerValue:5 }; // Reset
    updateWizardUI();
    elements.ruleEditor.classList.remove('hidden');
    
    // UI Resets
    elements.routeSearchInput.value = '';
    elements.routeResults.classList.add('hidden');
    document.getElementById('route-dir-selection').classList.add('hidden');
    elements.stopIdInput.value = '';
    document.getElementById('stop-routes-list').innerHTML = '';
}

function closeRuleEditor() {
    elements.ruleEditor.classList.add('hidden');
    state.wizard.step = 1; // Reset wizard
}

function setupEventListeners() {
    // Navigation
    elements.navTabs.forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });

    // Rules
    elements.addRuleBtn.addEventListener('click', () => openRuleWizard());
    
    // Favorites
    elements.addFavouriteBtn.addEventListener('click', () => {
        // Open the popup
        chrome.action.openPopup();
    });

    // Timeslots
    elements.addTimeslotBtn.addEventListener('click', () => openTimeslotEditor());

    // Custom Tabs
    elements.addCustomTabBtn.addEventListener('click', () => openCustomTabEditor());

    // Modal
    elements.closeBtns.forEach(btn => btn.addEventListener('click', closeRuleEditor));
    elements.ruleEditor.addEventListener('click', (e) => {
        if (e.target === elements.ruleEditor) closeRuleEditor();
    });

    // Data
    elements.exportAllBtn.addEventListener('click', handleExport);
    elements.importBtn.addEventListener('click', handleImport);
    elements.clearAllBtn.addEventListener('click', handleClearAll);
    elements.testNotificationBtn.addEventListener('click', handleTestNotification);

    // Settings
    setupSettings();
}

function setupSettings() {
    // Clear data button
    elements.clearAllBtn.addEventListener('click', async () => {
        if (confirm("Type 'DELETE' to confirm clearing all data.")) {
            const check = prompt("Type 'DELETE' to confirm clearing all data.");
            if (check === 'DELETE') {
                await chrome.storage.local.clear();
                alert('All data cleared.');
                location.reload();
            }
        }
    });

    // Dark Mode Toggle Logic
    if (elements.settingDarkMode) {
        // Check saved preference
        if (localStorage.getItem('theme') === 'dark') {
            elements.settingDarkMode.checked = true;
            document.body.classList.add('dark-mode');
        }

        elements.settingDarkMode.addEventListener('change', (e) => {
            if (e.target.checked) {
                document.body.classList.add('dark-mode');
                localStorage.setItem('theme', 'dark');
            } else {
                document.body.classList.remove('dark-mode');
                localStorage.setItem('theme', 'light');
            }
        });
    }

    // Auto Refresh Toggle Logic
    if (elements.settingAutoRefresh) {
        // Check saved preference (default true)
        const savedAutoRefresh = localStorage.getItem('autoRefresh');
        if (savedAutoRefresh === 'false') {
            elements.settingAutoRefresh.checked = false;
        }

        elements.settingAutoRefresh.addEventListener('change', (e) => {
            localStorage.setItem('autoRefresh', e.target.checked);
        });
    }
}

function switchTab(tabName) {
    elements.navTabs.forEach(tab => {
        tab.classList.toggle('active', tab.dataset.tab === tabName);
    });
    elements.tabPanes.forEach(pane => {
        pane.classList.toggle('active', pane.id === `${tabName}Tab`);
    });
}

// --- WIZARD LOGIC ---

function setupWizard() {
    // Buttons
    elements.prevStepBtn.addEventListener('click', () => changeWizardStep(-1));
    elements.nextStepBtn.addEventListener('click', () => changeWizardStep(1));
    elements.finishStepBtn.addEventListener('click', handleSaveRule);

    // Step 1: Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const type = e.target.dataset.targetType;
            // Update UI
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            
            document.querySelectorAll('.target-view').forEach(v => v.classList.add('hidden'));
            if(type === 'route') document.getElementById('target-route-view').classList.remove('hidden');
            else document.getElementById('target-stop-view').classList.remove('hidden');
        });
    });

    // Step 1: Route Search
    let searchDebounce;
    elements.routeSearchInput.addEventListener('input', (e) => {
        clearTimeout(searchDebounce);
        searchDebounce = setTimeout(async () => {
            const query = e.target.value;
            if(query.length < 1) {
                elements.routeResults.innerHTML = '';
                elements.routeResults.classList.add('hidden');
                return;
            }
            const results = await API.searchRoutes(query);
            renderRouteResults(results);
        }, 300);
    });

    // Step 1: Direction Change
    elements.routeDirectionSelect.addEventListener('change', async (e) => {
        const bound = e.target.value;
        state.wizard.data.bound = bound;
        await loadStopsForWizard(state.wizard.data.route, bound);
    });

    // Step 1: Stop Change
    elements.routeStopSelect.addEventListener('change', (e) => {
        const stopId = e.target.value;
        const selectedOption = e.target.options[e.target.selectedIndex];
        
        state.wizard.data.stop = stopId;
        state.wizard.data.stopName = selectedOption.text;
        state.wizard.data.stopSeq = selectedOption.dataset.seq;
        
        validateStep1();
    });
    
    // Step 1: Stop ID Search (By Stop Tab)
    elements.stopSearchBtn.addEventListener('click', async () => {
        const stopId = elements.stopIdInput.value.trim().toUpperCase();
        if(!stopId) return;
        
        const container = document.getElementById('stop-routes-list');
        container.innerHTML = '<div style="padding:10px;">Searching...</div>';
        container.classList.remove('hidden');
        
        // Fetch all routes for this stop using existing API method which returns route list
        const etas = await API.getETA(stopId); // This returns ETA list which contains route info
        
        // Extract unique routes
        const routesMap = new Map();
        etas.forEach(e => {
            const key = `${e.route}-${e.dir}`;
            if(!routesMap.has(key)) {
                routesMap.set(key, {
                    route: e.route,
                    dest: e.dest_tc || e.dest_en,
                    bound: e.dir,
                    service_type: e.service_type,
                    seq: e.seq 
                });
            }
        });
        
        if(routesMap.size === 0) {
            container.innerHTML = '<div style="padding:10px;">No routes found at this stop ID</div>';
            return;
        }

        container.innerHTML = '';
        routesMap.forEach(r => {
            const el = document.createElement('div');
            el.className = 'result-item';
            el.innerHTML = `<b>${r.route}</b> to ${r.dest}`;
            el.addEventListener('click', () => {
                 // Select this route/stop combo
                 state.wizard.data.route = r.route;
                 state.wizard.data.bound = r.bound;
                 state.wizard.data.serviceType = r.service_type;
                 state.wizard.data.stop = stopId;
                 state.wizard.data.stopSeq = r.seq;
                 state.wizard.data.stopName = stopId; // Should fetch name if possible, for now ID
                 
                 // Highlight
                 document.querySelectorAll('#stop-routes-list .result-item').forEach(i => i.classList.remove('selected'));
                 el.classList.add('selected');
                 
                 validateStep1();
            });
            container.appendChild(el);
        });
    });
}

function renderRouteResults(routes) {
    const list = elements.routeResults;
    list.innerHTML = '';
    list.classList.remove('hidden');
    
    if(routes.length === 0) {
        list.innerHTML = '<div style="padding:10px;">No routes found</div>';
        return;
    }

    // Filter unique route numbers only for initial selection
    const seen = new Set();
    routes.forEach(r => {
        if(seen.has(r.route)) return;
        seen.add(r.route);
        
        const item = document.createElement('div');
        item.className = 'result-item';
        item.textContent = `Route ${r.route}`;
        item.addEventListener('click', async () => {
            // Select Route
            state.wizard.data.route = r.route;
            elements.routeSearchInput.value = r.route;
            list.classList.add('hidden');
            
            // Show Direction
            document.getElementById('route-dir-selection').classList.remove('hidden');
            
            // Populate Direction Dropdown (We need to fetch variants or just assume O/I)
            // Let's assume standard variants for now or fetch.
            // Simplified: Just Outbound/Inbound options, and we try to fetch stops.
            const dirSelect = elements.routeDirectionSelect;
            dirSelect.innerHTML = `
                <option value="">Select Direction</option>
                <option value="O">Outbound (to ${r.dest_tc})</option>
                <option value="I">Inbound (to ${r.orig_tc})</option>
            `;
        });
        list.appendChild(item);
    });
}

async function loadStopsForWizard(route, bound) {
    const stopSelect = elements.routeStopSelect;
    stopSelect.innerHTML = '<option>Loading stops...</option>';
    stopSelect.disabled = true;

    try {
        const stops = await API.getRouteStops(route, bound, '1');
        stopSelect.innerHTML = '<option value="">Select a stop</option>';
        
        stops.forEach(stop => {
            const name = stop.stopInfo?.name_tc || stop.stopInfo?.name_en || stop.stop;
            const opt = document.createElement('option');
            opt.value = stop.stop;
            opt.text = name;
            opt.dataset.seq = stop.seq;
            stopSelect.appendChild(opt);
        });
        
        stopSelect.disabled = false;
    } catch(e) {
        stopSelect.innerHTML = '<option>Error loading stops</option>';
    }
}

function closeRuleEditor() {
    elements.ruleEditor.classList.add('hidden');
    state.wizard.step = 1; // Reset wizard
}

function changeWizardStep(delta) {
    const newStep = state.wizard.step + delta;
    if(newStep < 1 || newStep > 3) return;
    
    // Capture data from current step before moving
    if(state.wizard.step === 2) {
        const triggerType = document.querySelector('input[name="triggerType"]:checked').value;
        state.wizard.data.triggerType = triggerType;
        if(triggerType === 'eta') {
            state.wizard.data.triggerValue = parseInt(document.getElementById('triggerMinutes').value);
        }
    }
    if(state.wizard.step === 3) {
        // ... (Captured in Save)
    }

    state.wizard.step = newStep;
    updateWizardUI();
}

function updateWizardUI() {
    const step = state.wizard.step;
    
    // Show/Hide Steps
    elements.wizardSteps.forEach(el => el.classList.add('hidden'));
    document.getElementById(`step-${step}`).classList.remove('hidden');
    
    // Update Progress
    elements.progressSteps.forEach(el => {
        const s = parseInt(el.dataset.step);
        el.classList.toggle('active', s === step);
    });

    // Buttons
    elements.prevStepBtn.classList.toggle('hidden', step === 1);
    elements.nextStepBtn.classList.toggle('hidden', step === 3);
    elements.finishStepBtn.classList.toggle('hidden', step !== 3);
    
    // Validate Next Button
    validateStep();
}

function validateStep() {
    let isValid = false;
    if(state.wizard.step === 1) {
        isValid = !!(state.wizard.data.route && state.wizard.data.stop);
    } else if (state.wizard.step === 2) {
        isValid = true; // Defaults selected
    } else {
        isValid = true;
    }
    elements.nextStepBtn.disabled = !isValid;
    elements.finishStepBtn.disabled = !isValid;
}

function validateStep1() {
    validateStep();
}

async function handleSaveRule() {
    // Capture Final Step Data
    const startTime = document.getElementById('startTime').value;
    const endTime = document.getElementById('endTime').value;
    const days = [];
    document.querySelectorAll('.days-selector input:checked').forEach(cb => {
        days.push(parseInt(cb.value));
    });
    const customName = document.getElementById('finalRuleName').value.trim();

    // Construct Rule Object
    const d = state.wizard.data;
    const conditionText = d.triggerType === 'eta' 
        ? `< ${d.triggerValue} mins` 
        : 'Arriving';
        
    const ruleName = customName || `${d.route} @ ${d.stopName}`;
    const fullCondition = `${conditionText} (${startTime}-${endTime})`;

    const newRule = {
        id: Date.now().toString(),
        name: ruleName,
        condition: fullCondition,
        enabled: true,
        createdAt: new Date().toISOString(),
        config: {
            ...d,
            startTime,
            endTime,
            days
        }
    };

    state.rules.push(newRule);
    await Storage.saveRules(state.rules);
    
    renderRules();
    closeRuleEditor();
}

// --- STANDARD RULES (Delete, Render) ---
function renderRules() {
    const container = elements.rulesList;
    if (state.rules.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <p>📋 No rules created yet</p>
                <small>Create rules to get automated notifications</small>
            </div>`;
        return;
    }

    container.innerHTML = state.rules.map(rule => `
        <div class="list-item">
            <div class="list-content">
                <div class="list-title">${escapeHtml(rule.name)}</div>
                <div class="list-subtitle">${escapeHtml(rule.condition || 'No condition')}</div>
            </div>
            <div class="list-trailing">
                <button class="btn-danger delete-rule-btn" data-id="${rule.id}">Delete</button>
            </div>
        </div>
    `).join('');

    container.querySelectorAll('.delete-rule-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            handleDeleteRule(e.target.dataset.id);
        });
    });
}

async function handleDeleteRule(id) {
    if (!confirm('Delete this rule?')) return;
    state.rules = state.rules.filter(r => r.id !== id);
    await Storage.saveRules(state.rules);
    renderRules();
    updateStorageInfo();
}

// Reuse other functions from before...
function renderFavorites() { /* ... same ... */
    const container = elements.favoritesList;
    if (state.favorites.length === 0) {
        container.innerHTML = `<div class="empty-state"><p>No favorites saved</p></div>`;
        return;
    }
    container.innerHTML = state.favorites.map(fav => {
        const customTabOptions = state.customTabs.map(tab => 
            `<option value="${tab.id}" ${fav.customTab === tab.id ? 'selected' : ''}>${escapeHtml(tab.name)}</option>`
        ).join('');
        
        return `
        <div class="list-item">
            <div class="list-content">
                <div class="list-title">${fav.route} <span style="font-weight:400; font-size:13px; color:var(--text-secondary);">to ${escapeHtml(fav.dest)}</span></div>
                <div class="list-subtitle">${escapeHtml(fav.stopName)}</div>
                <div style="margin-top: 4px; display: flex; gap: 8px;">
                    <select class="form-select time-select" data-id="${fav.id}" style="font-size: 12px; padding: 2px 6px; width: auto;">
                        <option value="all" ${fav.preferredTime === 'all' || !fav.preferredTime ? 'selected' : ''}>All Day</option>
                        <option value="morning" ${fav.preferredTime === 'morning' ? 'selected' : ''}>Morning</option>
                        <option value="afternoon" ${fav.preferredTime === 'afternoon' ? 'selected' : ''}>Afternoon</option>
                        <option value="evening" ${fav.preferredTime === 'evening' ? 'selected' : ''}>Evening</option>
                    </select>
                    <select class="form-select tab-select" data-id="${fav.id}" style="font-size: 12px; padding: 2px 6px; width: auto;">
                        <option value="all" ${fav.customTab === 'all' || !fav.customTab ? 'selected' : ''}>No Tab</option>
                        ${customTabOptions}
                    </select>
                </div>
            </div>
            <div class="list-trailing">
                 <button class="btn-danger delete-fav-btn" data-id="${fav.id}">Remove</button>
            </div>
        </div>
    `}).join('');
     container.querySelectorAll('.delete-fav-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            handleDeleteFavorite(e.target.dataset.id);
        });
    });
    container.querySelectorAll('.time-select').forEach(select => {
        select.addEventListener('change', (e) => {
            handleUpdateFavoriteTime(e.target.dataset.id, e.target.value);
        });
    });
    container.querySelectorAll('.tab-select').forEach(select => {
        select.addEventListener('change', (e) => {
            handleUpdateFavoriteTab(e.target.dataset.id, e.target.value);
        });
    });
}

// ... Data handlers (Export/Import/Clear) ... 
function handleExport() { /* Same implementation */ 
    const data = { rules: state.rules, favorites: state.favorites, exportedAt: new Date().toISOString(), version: '1.0.0' };
    const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `easyeta-backup-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}
async function handleImport() { /* Same implementation */ 
    const file = elements.importFile.files[0];
    if (!file) { alert('Please select a JSON file first'); return; }
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = JSON.parse(e.target.result);
            if (data.rules && Array.isArray(data.rules)) await Storage.saveRules(data.rules);
            if (data.favorites && Array.isArray(data.favorites)) await Storage.saveFavorites(data.favorites);
            alert('Import successful! Reloading page...');
            location.reload();
        } catch (err) { alert('Error parsing file: ' + err.message); }
    };
    reader.readAsText(file);
}
async function handleClearAll() { /* Same implementation */ 
     const check = prompt("Type 'DELETE' to confirm clearing all data.");
    if (check === 'DELETE') { await chrome.storage.local.clear(); alert('All data cleared.'); location.reload(); }
}async function handleTestNotification() {
    // Send a test notification
    const testAction = {
        type: 'notification',
        title: 'EasyETA Test Notification',
        message: 'This is a test notification from EasyETA_HK. If you see this, notifications are working!',
        sound: true,
        priority: 'normal'
    };
    
    const testContext = {
        currentTime: {
            hour: new Date().getHours(),
            minute: new Date().getMinutes(),
            day: new Date().getDay()
        }
    };
    
    // Call the background script to show the notification
    chrome.runtime.sendMessage({
        action: 'testNotification',
        notificationAction: testAction,
        context: testContext
    });
}async function updateStorageInfo() { /* Same implementation */ 
    const bytes = await new Promise(resolve => chrome.storage.local.getBytesInUse(null, resolve));
    elements.storageInfo.textContent = `${(bytes / 1024).toFixed(2)} KB used by EasyETA`;
}
function escapeHtml(text) { if (!text) return ''; return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;"); }

async function handleUpdateFavoriteTime(id, time) {
    const fav = state.favorites.find(f => f.id === id);
    if (fav) {
        fav.preferredTime = time;
        await Storage.saveFavorites(state.favorites);
    }
}

async function handleUpdateFavoriteTab(id, tabId) {
    const fav = state.favorites.find(f => f.id === id);
    if (fav) {
        fav.customTab = tabId;
        await Storage.saveFavorites(state.favorites);
        // Update tab counts
        updateCustomTabCounts();
        renderCustomTabs();
    }
}

function updateCustomTabCounts() {
    state.customTabs.forEach(tab => {
        tab.favoritesCount = state.favorites.filter(fav => fav.customTab === tab.id).length;
    });
}

async function handleDeleteFavorite(id) {
    if (confirm('Remove this favorite stop?')) {
        state.favorites = state.favorites.filter(f => f.id !== id);
        await Storage.saveFavorites(state.favorites);
        renderFavorites();
        updateStorageInfo();
        
        // Notify popup to refresh
        chrome.runtime.sendMessage({ action: 'refreshFavourites' });
    }
}

// --- TIMESLOT MANAGEMENT ---

function renderTimeslots() {
    const container = elements.timeslotsList;
    
    if (state.timeslots.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <p>No custom timeslots defined</p>
                <small>Timeslots are used to categorize your favorites by time of day.</small>
            </div>
        `;
        return;
    }

    container.innerHTML = state.timeslots.map(slot => `
        <div class="list-item">
            <div class="list-content">
                <div class="list-title">${escapeHtml(slot.name)}</div>
                <div class="list-subtitle">${slot.startTime} - ${slot.endTime}</div>
            </div>
            <div class="list-trailing">
                <button class="btn-secondary timeslot-edit-btn" data-timeslot-id="${slot.id}">Edit</button>
                <button class="btn-danger timeslot-delete-btn" data-timeslot-id="${slot.id}">Delete</button>
            </div>
        </div>
    `).join('');

    // Attach event listeners
    container.querySelectorAll('.timeslot-edit-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const slotId = btn.dataset.timeslotId;
            openTimeslotEditor(slotId);
        });
    });

    container.querySelectorAll('.timeslot-delete-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const slotId = btn.dataset.timeslotId;
            deleteTimeslot(slotId);
        });
    });
}

function openTimeslotEditor(slotId = null) {
    const slot = slotId ? state.timeslots.find(s => s.id === slotId) : null;
    
    const name = slot ? slot.name : '';
    const startTime = slot ? slot.startTime : '08:00';
    const endTime = slot ? slot.endTime : '09:00';
    
    const title = slot ? 'Edit Timeslot' : 'Add Timeslot';
    const action = slot ? `updateTimeslot('${slotId}')` : 'createTimeslot()';
    
    // Create modal HTML
    const modalHtml = `
        <div class="modal-backdrop timeslot-modal-backdrop"></div>
        <div class="modal-dialog">
            <h3 class="modal-title">${title}</h3>
            <div class="modal-body">
                <div class="form-group">
                    <label>Name:</label>
                    <input type="text" id="timeslotName" value="${escapeHtml(name)}" placeholder="e.g., Morning Commute">
                </div>
                <div class="form-group">
                    <label>Start Time:</label>
                    <input type="time" id="timeslotStart" value="${startTime}">
                </div>
                <div class="form-group">
                    <label>End Time:</label>
                    <input type="time" id="timeslotEnd" value="${endTime}">
                </div>
            </div>
            <div class="modal-actions">
                <button class="btn-secondary timeslot-cancel-btn">Cancel</button>
                <button class="btn-primary timeslot-save-btn" data-slot-id="${slotId || ''}">Save</button>
            </div>
        </div>
    `;
    
    const modal = document.createElement('div');
    modal.id = 'timeslotModal';
    modal.className = 'modal';
    modal.innerHTML = modalHtml;
    document.body.appendChild(modal);
    
    // Attach event listeners
    modal.querySelector('.timeslot-modal-backdrop').addEventListener('click', closeTimeslotEditor);
    modal.querySelector('.timeslot-cancel-btn').addEventListener('click', closeTimeslotEditor);
    modal.querySelector('.timeslot-save-btn').addEventListener('click', () => {
        const saveBtn = modal.querySelector('.timeslot-save-btn');
        const slotId = saveBtn.dataset.slotId;
        if (slotId) {
            updateTimeslot(slotId);
        } else {
            createTimeslot();
        }
    });
    
    setTimeout(() => modal.classList.add('active'), 10);
}

function closeTimeslotEditor() {
    const modal = document.getElementById('timeslotModal');
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => modal.remove(), 300);
    }
}

async function createTimeslot() {
    const name = document.getElementById('timeslotName').value.trim();
    const startTime = document.getElementById('timeslotStart').value;
    const endTime = document.getElementById('timeslotEnd').value;
    
    if (!name || !startTime || !endTime) {
        alert('Please fill in all fields');
        return;
    }
    
    const newSlot = {
        id: Date.now().toString(),
        name,
        startTime,
        endTime
    };
    
    state.timeslots.push(newSlot);
    await Storage.saveTimeslots(state.timeslots);
    renderTimeslots();
    closeTimeslotEditor();
}

async function updateTimeslot(id) {
    const name = document.getElementById('timeslotName').value.trim();
    const startTime = document.getElementById('timeslotStart').value;
    const endTime = document.getElementById('timeslotEnd').value;
    
    if (!name || !startTime || !endTime) {
        alert('Please fill in all fields');
        return;
    }
    
    const slot = state.timeslots.find(s => s.id === id);
    if (slot) {
        slot.name = name;
        slot.startTime = startTime;
        slot.endTime = endTime;
        await Storage.saveTimeslots(state.timeslots);
        renderTimeslots();
        closeTimeslotEditor();
    }
}

async function deleteTimeslot(id) {
    if (confirm('Delete this timeslot?')) {
        state.timeslots = state.timeslots.filter(s => s.id !== id);
        await Storage.saveTimeslots(state.timeslots);
        renderTimeslots();
    }
}

// --- CUSTOM TABS MANAGEMENT ---

function renderCustomTabs() {
    const container = elements.customTabsList;
    
    if (state.customTabs.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <p>No custom tabs defined</p>
                <small>Create custom tabs to organize your favorites into categories.</small>
            </div>
        `;
        return;
    }

    container.innerHTML = state.customTabs.map(tab => `
        <div class="list-item">
            <div class="list-content">
                <div class="list-title">${escapeHtml(tab.name)}</div>
                <div class="list-subtitle">${tab.favoritesCount || 0} favorites</div>
            </div>
            <div class="list-trailing">
                <button class="btn-secondary custom-tab-edit-btn" data-tab-id="${tab.id}">Edit</button>
                <button class="btn-danger custom-tab-delete-btn" data-tab-id="${tab.id}">Delete</button>
            </div>
        </div>
    `).join('');

    // Attach event listeners
    container.querySelectorAll('.custom-tab-edit-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.dataset.tabId;
            openCustomTabEditor(tabId);
        });
    });

    container.querySelectorAll('.custom-tab-delete-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.dataset.tabId;
            deleteCustomTab(tabId);
        });
    });
}

function openCustomTabEditor(tabId = null) {
    const tab = tabId ? state.customTabs.find(t => t.id === tabId) : null;
    
    const name = tab ? tab.name : '';
    const color = tab ? tab.color : '#007AFF';
    
    const title = tab ? 'Edit Tab' : 'Add Tab';
    
    // Create modal HTML
    const modalHtml = `
        <div class="modal-backdrop custom-tab-modal-backdrop"></div>
        <div class="modal-dialog">
            <h3 class="modal-title">${title}</h3>
            <div class="modal-body">
                <div class="form-group">
                    <label>Name:</label>
                    <input type="text" id="customTabName" value="${escapeHtml(name)}" placeholder="e.g., Work Routes">
                </div>
                <div class="form-group">
                    <label>Color:</label>
                    <input type="color" id="customTabColor" value="${color}">
                </div>
            </div>
            <div class="modal-actions">
                <button class="btn-secondary custom-tab-cancel-btn">Cancel</button>
                <button class="btn-primary custom-tab-save-btn" data-tab-id="${tabId || ''}">Save</button>
            </div>
        </div>
    `;
    
    const modal = document.createElement('div');
    modal.id = 'customTabModal';
    modal.className = 'modal';
    modal.innerHTML = modalHtml;
    document.body.appendChild(modal);
    
    // Attach event listeners
    modal.querySelector('.custom-tab-modal-backdrop').addEventListener('click', closeCustomTabEditor);
    modal.querySelector('.custom-tab-cancel-btn').addEventListener('click', closeCustomTabEditor);
    modal.querySelector('.custom-tab-save-btn').addEventListener('click', () => {
        const saveBtn = modal.querySelector('.custom-tab-save-btn');
        const tabId = saveBtn.dataset.tabId;
        if (tabId) {
            updateCustomTab(tabId);
        } else {
            createCustomTab();
        }
    });
    
    setTimeout(() => modal.classList.add('active'), 10);
}

function closeCustomTabEditor() {
    const modal = document.getElementById('customTabModal');
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => modal.remove(), 300);
    }
}

async function createCustomTab() {
    const name = document.getElementById('customTabName').value.trim();
    const color = document.getElementById('customTabColor').value;
    
    if (!name) {
        alert('Please enter a tab name');
        return;
    }
    
    const newTab = {
        id: Date.now().toString(),
        name,
        color,
        favoritesCount: 0
    };
    
    state.customTabs.push(newTab);
    await Storage.saveCustomTabs(state.customTabs);
    renderCustomTabs();
    closeCustomTabEditor();
}

async function updateCustomTab(id) {
    const name = document.getElementById('customTabName').value.trim();
    const color = document.getElementById('customTabColor').value;
    
    if (!name) {
        alert('Please enter a tab name');
        return;
    }
    
    const tab = state.customTabs.find(t => t.id === id);
    if (tab) {
        tab.name = name;
        tab.color = color;
        await Storage.saveCustomTabs(state.customTabs);
        renderCustomTabs();
        closeCustomTabEditor();
    }
}

async function deleteCustomTab(id) {
    if (confirm('Delete this custom tab? Favorites in this tab will be moved to "All".')) {
        // Remove the tab
        state.customTabs = state.customTabs.filter(t => t.id !== id);
        
        // Move favorites from this tab to "all"
        state.favorites.forEach(fav => {
            if (fav.customTab === id) {
                fav.customTab = 'all';
            }
        });
        
        await Storage.saveCustomTabs(state.customTabs);
        await Storage.saveFavorites(state.favorites);
        renderCustomTabs();
        renderFavorites();
    }
}

async function handleDeleteFavorite(id) {
    if (confirm('Remove this favorite stop?')) {
        state.favorites = state.favorites.filter(f => f.id !== id);
        await Storage.saveFavorites(state.favorites);
        renderFavorites();
    }
}
