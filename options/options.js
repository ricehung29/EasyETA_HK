// EasyETA_HK Options Page Script

// State
let state = {
    rules: [],
    favorites: [],
    timeslots: [],
    folders: [],
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

    // Folders
    foldersList: document.getElementById('foldersList'),
    addFolderBtn: document.getElementById('addFolderBtn'),

    // Settings
    settingDarkMode: document.getElementById('setting-dark-mode'),
    settingAutoRefresh: document.getElementById('setting-auto-refresh'),

    // Data
    exportAllBtn: document.getElementById('exportAllBtn'),
    importFile: document.getElementById('importFile'),
    importBtn: document.getElementById('importBtn'),
    clearAllBtn: document.getElementById('clearAllBtn'),
    storageInfo: document.getElementById('storageInfo'),

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
    renderFolders();
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
    state.folders = await Storage.getFolders() || [];
    
    // Create default folder if none exist
    if (state.folders.length === 0) {
        state.folders = [{
            id: 'default',
            name: 'My Favourite',
            color: '#007AFF',
            favoritesCount: 0,
            isDefault: true
        }];
        await Storage.saveFolders(state.folders);
    }
    
    updateFolderCounts();
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

    // Folders
    elements.addFolderBtn.addEventListener('click', () => openFolderEditor());

    // Modal
    elements.closeBtns.forEach(btn => btn.addEventListener('click', closeRuleEditor));
    elements.ruleEditor.addEventListener('click', (e) => {
        if (e.target === elements.ruleEditor) closeRuleEditor();
    });

    // Data
    elements.exportAllBtn.addEventListener('click', handleExport);
    elements.importBtn.addEventListener('click', handleImport);
    elements.clearAllBtn.addEventListener('click', handleClearAll);

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
            elements.settingDarkMode.classList.add('active');
            document.body.classList.add('dark-mode');
        }

        elements.settingDarkMode.addEventListener('click', (e) => {
            const isActive = e.target.classList.contains('active');
            if (isActive) {
                e.target.classList.remove('active');
                document.body.classList.remove('dark-mode');
                localStorage.setItem('theme', 'light');
            } else {
                e.target.classList.add('active');
                document.body.classList.add('dark-mode');
                localStorage.setItem('theme', 'dark');
            }
        });
    }

    // Auto Refresh Toggle Logic
    if (elements.settingAutoRefresh) {
        // Check saved preference (default true)
        const savedAutoRefresh = localStorage.getItem('autoRefresh');
        if (savedAutoRefresh === 'false') {
            elements.settingAutoRefresh.classList.remove('active');
        }

        elements.settingAutoRefresh.addEventListener('click', (e) => {
            const isActive = e.target.classList.contains('active');
            if (isActive) {
                e.target.classList.remove('active');
                localStorage.setItem('autoRefresh', 'false');
            } else {
                e.target.classList.add('active');
                localStorage.setItem('autoRefresh', 'true');
            }
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
        const folderOptions = state.folders.map(folder => 
            `<option value="${folder.id}" ${fav.folder === folder.id ? 'selected' : ''}>${escapeHtml(folder.name)}</option>`
        ).join('');
        
        return `
        <div class="list-item">
            <div class="list-content">
                <div class="list-title">${fav.route} <span style="font-weight:400; font-size:13px; color:var(--text-secondary);">to ${escapeHtml(fav.dest)}</span></div>
                <div class="list-subtitle">${escapeHtml(fav.stopName)}</div>
                <div style="margin-top: 4px;">
                    <select class="form-select folder-select" data-id="${fav.id}" style="font-size: 12px; padding: 2px 6px; width: auto;">
                        <option value="" ${!fav.folder ? 'selected' : ''}>No Folder</option>
                        ${folderOptions}
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
    container.querySelectorAll('.folder-select').forEach(select => {
        select.addEventListener('change', (e) => {
            handleUpdateFavoriteFolder(e.target.dataset.id, e.target.value);
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

async function handleUpdateFavoriteFolder(id, folderId) {
    const fav = state.favorites.find(f => f.id === id);
    if (fav) {
        fav.folder = folderId;
        await Storage.saveFavorites(state.favorites);
        // Update folder counts
        updateFolderCounts();
        renderFolders();
    }
}

function updateFolderCounts() {
    state.folders.forEach(folder => {
        folder.favoritesCount = state.favorites.filter(fav => fav.folder === folder.id).length;
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
                <p>No timeslots defined</p>
                <small>Timeslots define when your favorites should show ETAs in the popup.</small>
            </div>
        `;
        return;
    }

    container.innerHTML = state.timeslots.map(slot => {
        const daysDisplay = slot.days ? slot.days.map(day => 
            day.charAt(0).toUpperCase() + day.slice(1)
        ).join(', ') : 'All Days';
        
        return `
        <div class="list-item">
            <div class="list-content">
                <div class="list-title">${escapeHtml(slot.name)}</div>
                <div class="list-subtitle">${daysDisplay} • ${slot.startTime} - ${slot.endTime}</div>
            </div>
            <div class="list-trailing">
                <button class="btn-secondary timeslot-edit-btn" data-timeslot-id="${slot.id}">Edit</button>
                ${!slot.isDefault ? `<button class="btn-danger timeslot-delete-btn" data-timeslot-id="${slot.id}">Delete</button>` : ''}
            </div>
        </div>
    `}).join('');

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
    const selectedDays = slot ? (slot.days || []) : ['monday'];
    
    const title = slot ? 'Edit Timeslot' : 'Add Timeslot';
    const isDefault = slot ? slot.isDefault : false;
    
    const daysOfWeek = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    
    // Create modal HTML using options.css structure
    const modalHtml = `
        <div class="modal-content">
            <div class="modal-header">
                <h3 class="modal-title">${title}</h3>
                <button class="close-btn" id="timeslotCloseBtn">&times;</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label>Name:</label>
                    <input type="text" id="timeslotName" value="${escapeHtml(name)}" placeholder="e.g., Work Commute" ${isDefault ? 'readonly' : ''}>
                </div>
                <div class="form-group">
                    <label>Days of Week:</label>
                    <div class="days-selector">
                        ${daysOfWeek.map(day => `
                            <label class="day-checkbox">
                                <input type="checkbox" value="${day}" ${selectedDays.includes(day) ? 'checked' : ''} ${isDefault ? 'disabled' : ''}>
                                ${day.charAt(0).toUpperCase() + day.slice(1)}
                            </label>
                        `).join('')}
                    </div>
                </div>
                <div class="form-group">
                    <label>Start Time:</label>
                    <input type="time" id="timeslotStart" value="${startTime}">
                </div>
                <div class="form-group">
                    <label>End Time:</label>
                    <input type="time" id="timeslotEnd" value="${endTime}">
                </div>
                ${isDefault ? '<div class="form-note">This is a default timeslot. Only time range can be edited.</div>' : ''}
            </div>
            <div class="modal-footer">
                <button class="btn-secondary" id="timeslotCancelBtn">Cancel</button>
                <button class="btn-primary" id="timeslotSaveBtn" data-slot-id="${slotId || ''}">Save</button>
            </div>
        </div>
    `;
    
    const modal = document.createElement('div');
    modal.id = 'timeslotModal';
    modal.className = 'modal';
    modal.innerHTML = modalHtml;
    document.body.appendChild(modal);
    
    // Show modal
    modal.style.display = 'flex';
    
    // Attach event listeners
    modal.querySelector('#timeslotCloseBtn').addEventListener('click', closeTimeslotEditor);
    modal.querySelector('#timeslotCancelBtn').addEventListener('click', closeTimeslotEditor);
    modal.querySelector('#timeslotSaveBtn').addEventListener('click', () => {
        const saveBtn = modal.querySelector('#timeslotSaveBtn');
        const slotId = saveBtn.dataset.slotId;
        if (slotId) {
            updateTimeslot(slotId);
        } else {
            createTimeslot();
        }
    });
    
    // Focus on appropriate input
    setTimeout(() => {
        if (!isDefault) {
            modal.querySelector('#timeslotName').focus();
        } else {
            modal.querySelector('#timeslotStart').focus();
        }
    }, 100);
}

function closeTimeslotEditor() {
    const modal = document.getElementById('timeslotModal');
    if (modal) {
        modal.style.display = 'none';
        modal.remove();
    }
}

async function createTimeslot() {
    const name = document.getElementById('timeslotName').value.trim();
    const startTime = document.getElementById('timeslotStart').value;
    const endTime = document.getElementById('timeslotEnd').value;
    
    // Get selected days
    const selectedDays = Array.from(document.querySelectorAll('.days-selector input:checked')).map(cb => cb.value);
    
    if (!name || !startTime || !endTime || selectedDays.length === 0) {
        alert('Please fill in all fields and select at least one day');
        return;
    }
    
    // Check for duplicate timeslots (same days and overlapping time)
    const hasConflict = state.timeslots.some(slot => {
        if (!slot.days) return false;
        const overlappingDays = slot.days.filter(day => selectedDays.includes(day));
        if (overlappingDays.length === 0) return false;
        
        // Check time overlap
        const slotStart = slot.startTime;
        const slotEnd = slot.endTime;
        return (startTime < slotEnd && endTime > slotStart);
    });
    
    if (hasConflict) {
        alert('This timeslot conflicts with an existing one. Timeslots cannot overlap on the same days.');
        return;
    }
    
    const newSlot = {
        id: Date.now().toString(),
        name,
        days: selectedDays,
        startTime,
        endTime
    };
    
    state.timeslots.push(newSlot);
    await Storage.saveTimeslots(state.timeslots);
    renderTimeslots();
    closeTimeslotEditor();
    chrome.runtime.sendMessage({ action: 'refreshTimeslots' });
}

async function updateTimeslot(id) {
    const name = document.getElementById('timeslotName').value.trim();
    const startTime = document.getElementById('timeslotStart').value;
    const endTime = document.getElementById('timeslotEnd').value;
    
    // Get selected days
    const selectedDays = Array.from(document.querySelectorAll('.days-selector input:checked')).map(cb => cb.value);
    
    if (!name || !startTime || !endTime || selectedDays.length === 0) {
        alert('Please fill in all fields and select at least one day');
        return;
    }
    
    const slot = state.timeslots.find(s => s.id === id);
    if (slot) {
        // Check for conflicts with other timeslots (excluding this one)
        const hasConflict = state.timeslots.some(otherSlot => {
            if (otherSlot.id === id || !otherSlot.days) return false;
            const overlappingDays = otherSlot.days.filter(day => selectedDays.includes(day));
            if (overlappingDays.length === 0) return false;
            
            // Check time overlap
            const slotStart = otherSlot.startTime;
            const slotEnd = otherSlot.endTime;
            return (startTime < slotEnd && endTime > slotStart);
        });
        
        if (hasConflict) {
            alert('This timeslot conflicts with an existing one. Timeslots cannot overlap on the same days.');
            return;
        }
        
        slot.name = name;
        if (!slot.isDefault) {
            slot.days = selectedDays;
        }
        slot.startTime = startTime;
        slot.endTime = endTime;
        await Storage.saveTimeslots(state.timeslots);
        renderTimeslots();
        closeTimeslotEditor();
        chrome.runtime.sendMessage({ action: 'refreshTimeslots' });
    }
}

async function deleteTimeslot(id) {
    if (confirm('Delete this timeslot?')) {
        state.timeslots = state.timeslots.filter(s => s.id !== id);
        await Storage.saveTimeslots(state.timeslots);
        renderTimeslots();
        chrome.runtime.sendMessage({ action: 'refreshTimeslots' });
    }
}

// --- FOLDER MANAGEMENT ---

function renderFolders() {
    const container = elements.foldersList;
    
    if (state.folders.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <p>No folders created</p>
                <small>Create folders to organize your favorites into categories.</small>
            </div>
        `;
        return;
    }

    container.innerHTML = state.folders.map(folder => `
        <div class="folder-item" style="background: linear-gradient(135deg, ${folder.color}15, ${folder.color}08); border-left: 4px solid ${folder.color};">
            <div class="folder-header">
                <div class="folder-icon" style="color: ${folder.color};">📁</div>
                <div class="folder-info">
                    <div class="folder-name">${escapeHtml(folder.name)}</div>
                    <div class="folder-count">${folder.favoritesCount || 0} favorites</div>
                    ${folder.timeslotId ? `<div class="folder-timeslot">Timeslot: ${state.timeslots.find(slot => slot.id === folder.timeslotId)?.name || folder.timeslotId}</div>` : '<div class="folder-timeslot">No specific timeslot</div>'}
                </div>
                ${!folder.isDefault ? `
                <div class="folder-actions">
                    <button class="btn-secondary folder-edit-btn" data-folder-id="${folder.id}">Edit</button>
                    <button class="btn-danger folder-delete-btn" data-folder-id="${folder.id}">Delete</button>
                </div>
                ` : ''}
            </div>
        </div>
    `).join('');

    // Attach event listeners
    container.querySelectorAll('.folder-edit-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const folderId = btn.dataset.folderId;
            openFolderEditor(folderId);
        });
    });

    container.querySelectorAll('.folder-delete-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const folderId = btn.dataset.folderId;
            deleteFolder(folderId);
        });
    });
}

function openFolderEditor(folderId = null) {
    const folder = folderId ? state.folders.find(f => f.id === folderId) : null;
    
    const name = folder ? folder.name : '';
    const color = folder ? folder.color : '#007AFF';
    const timeslotId = folder ? folder.timeslotId || '' : '';
    
    const timeslotOptions = [
        `<option value="">No specific time</option>`,
        ...state.timeslots.map(slot => 
            `<option value="${slot.id}" ${timeslotId === slot.id ? 'selected' : ''}>${escapeHtml(slot.name)}</option>`
        )
    ].join('');
    
    const title = folder ? 'Edit Folder' : 'Add Folder';
    
    // Create modal HTML using options.css structure
    const modalHtml = `
        <div class="modal-content">
            <div class="modal-header">
                <h3 class="modal-title">${title}</h3>
                <button class="close-btn" id="folderCloseBtn">&times;</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label>Name:</label>
                    <input type="text" id="folderName" value="${escapeHtml(name)}" placeholder="e.g., Work Routes">
                </div>
                <div class="form-group">
                    <label>Color:</label>
                    <input type="color" id="folderColor" value="${color}">
                </div>
                <div class="form-group">
                    <label>Timeslot:</label>
                    <select id="folderTimeslot" class="form-select">
                        ${timeslotOptions}
                    </select>
                    <small class="form-help">Favorites in this folder will appear during this timeslot</small>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn-secondary" id="folderCancelBtn">Cancel</button>
                <button class="btn-primary" id="folderSaveBtn" data-folder-id="${folderId || ''}">Save</button>
            </div>
        </div>
    `;
    
    const modal = document.createElement('div');
    modal.id = 'folderModal';
    modal.className = 'modal';
    modal.innerHTML = modalHtml;
    document.body.appendChild(modal);
    
    // Show modal
    modal.style.display = 'flex';
    
    // Attach event listeners
    modal.querySelector('#folderCloseBtn').addEventListener('click', closeFolderEditor);
    modal.querySelector('#folderCancelBtn').addEventListener('click', closeFolderEditor);
    modal.querySelector('#folderSaveBtn').addEventListener('click', () => {
        const saveBtn = modal.querySelector('#folderSaveBtn');
        const folderId = saveBtn.dataset.folderId;
        if (folderId) {
            updateFolder(folderId);
        } else {
            createFolder();
        }
    });
    
    // Focus on name input
    setTimeout(() => {
        modal.querySelector('#folderName').focus();
    }, 100);
}

function closeFolderEditor() {
    const modal = document.getElementById('folderModal');
    if (modal) {
        modal.style.display = 'none';
        modal.remove();
    }
}

async function createFolder() {
    const name = document.getElementById('folderName').value.trim();
    const color = document.getElementById('folderColor').value;
    const timeslotId = document.getElementById('folderTimeslot').value;
    
    if (!name) {
        alert('Please enter a folder name');
        return;
    }
    
    const newFolder = {
        id: Date.now().toString(),
        name,
        color,
        favoritesCount: 0,
        timeslotId
    };
    
    state.folders.push(newFolder);
    await Storage.saveFolders(state.folders);
    renderFolders();
    closeFolderEditor();
    
    // Notify popup to refresh folders
    chrome.runtime.sendMessage({ action: 'refreshFolders' });
}

async function updateFolder(id) {
    const name = document.getElementById('folderName').value.trim();
    const color = document.getElementById('folderColor').value;
    const timeslotId = document.getElementById('folderTimeslot').value;
    
    if (!name) {
        alert('Please enter a folder name');
        return;
    }
    
    const folder = state.folders.find(f => f.id === id);
    if (folder) {
        folder.name = name;
        folder.color = color;
        folder.timeslotId = timeslotId;
        await Storage.saveFolders(state.folders);
        renderFolders();
        closeFolderEditor();
        
        // Notify popup to refresh folders
        chrome.runtime.sendMessage({ action: 'refreshFolders' });
    }
}

async function deleteFolder(id) {
    if (confirm('Delete this folder? Favorites in this folder will be moved to "No Folder".')) {
        // Remove the folder
        state.folders = state.folders.filter(f => f.id !== id);
        
        // Move favorites from this folder to "No Folder"
        state.favorites.forEach(fav => {
            if (fav.folder === id) {
                fav.folder = '';
            }
        });
        
        await Storage.saveFolders(state.folders);
        await Storage.saveFavorites(state.favorites);
        renderFolders();
        renderFavorites();
        
        // Notify popup to refresh folders
        chrome.runtime.sendMessage({ action: 'refreshFolders' });
    }
}

async function handleDeleteFavorite(id) {
    if (confirm('Remove this favorite stop?')) {
        state.favorites = state.favorites.filter(f => f.id !== id);
        await Storage.saveFavorites(state.favorites);
        renderFavorites();
    }
}
