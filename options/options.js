// EasyETA_HK Options Page Script

// State
let state = {
    favorites: [],
    folders: []
};

// DOM Elements
const elements = {
    navTabs: document.querySelectorAll('.nav-tab'),
    tabPanes: document.querySelectorAll('.tab-pane'),
    
    // Folders & Favorites (combined)
    foldersAndFavoritesList: document.getElementById('foldersAndFavoritesList'),
    addFavouriteBtn: document.getElementById('addFavouriteBtn'),

    // Folders
    addFolderBtn: document.getElementById('addFolderBtn'),

    // Settings
    settingDarkMode: document.getElementById('setting-dark-mode'),
    settingAutoRefresh: document.getElementById('setting-auto-refresh'),

    // Data
    exportAllBtn: document.getElementById('exportAllBtn'),
    importFile: document.getElementById('importFile'),
    importBtn: document.getElementById('importBtn'),
    clearAllBtn: document.getElementById('clearAllBtn'),
    storageInfo: document.getElementById('storageInfo')
};

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    await I18n.init();
    await loadData();
    setupEventListeners();
    renderFoldersAndFavorites();
    updateStorageInfo();
    setupLanguageSwitcher();
    applyI18nToDocument();
});

// Listen for messages from popup to refresh favourites
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'refreshFavourites') {
        loadData().then(() => {
            renderFoldersAndFavorites();
        });
    }
});

async function loadData() {
    state.favorites = await Storage.getFavorites() || [];
    state.folders = await Storage.getFolders() || [];
    
    // Migrate old folders with timeslotId to new timeslot object
    const timeslots = await Storage.getTimeslots() || [];
    state.folders.forEach(folder => {
        if (folder.timeslotId && !folder.timeslot) {
            const slot = timeslots.find(s => s.id === folder.timeslotId);
            if (slot) {
                folder.timeslot = { days: slot.days, startTime: slot.startTime, endTime: slot.endTime };
            }
            delete folder.timeslotId;
        }
    });
    
    // Migrate folders to have priority values
    let needsPriorityMigration = false;
    state.folders.forEach((folder, index) => {
        if (typeof folder.priority !== 'number') {
            folder.priority = index + 1;
            needsPriorityMigration = true;
        }
    });
    
    // Save migrated folders
    if (needsPriorityMigration) {
        await Storage.saveFolders(state.folders);
    }
    
    // Create default folder if none exist
    if (state.folders.length === 0) {
        state.folders = [{
            id: 'default',
            name: 'My Favourite',
            color: '#007AFF',
            favoritesCount: 0,
            timeslot: null, // No specific timeslot by default
            isDefault: true
        }];
        await Storage.saveFolders(state.folders);
    }
    
    updateFolderCounts();
}

function timeslotsOverlap(slot1, slot2) {
    if (!slot1 || !slot2) return false;
    const days1 = new Set(slot1.days);
    const days2 = new Set(slot2.days);
    const commonDays = [...days1].filter(day => days2.has(day));
    if (commonDays.length === 0) return false;
    // If they share days, check time overlap
    const start1 = slot1.startTime;
    const end1 = slot1.endTime;
    const start2 = slot2.startTime;
    const end2 = slot2.endTime;
    return start1 < end2 && start2 < end1;
}
function generateTimeOptions(selectedValue) {
    const times = [];
    for (let hour = 0; hour < 24; hour++) {
        for (let minute = 0; minute < 60; minute += 30) {
            const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
            times.push(time);
        }
    }
    let options = times.map(time => `<option value="${time}" ${time === selectedValue ? 'selected' : ''}>${time}</option>`).join('');
    options += `<option value="custom" ${selectedValue === 'custom' ? 'selected' : ''}>Custom...</option>`;
    return options;
}

function timeToAngle(time) {
    const [hour, minute] = time.split(':').map(Number);
    const angle = ((hour % 12) + minute / 60) * 30;
    return angle;
}

function updateClockMarkers() {
    const startTime = document.getElementById('folderStartTime').value;
    const endTime = document.getElementById('folderEndTime').value;
    const startAngle = timeToAngle(startTime);
    const endAngle = timeToAngle(endTime);
    const startMarker = document.getElementById('startMarker');
    const endMarker = document.getElementById('endMarker');
    if (startMarker) startMarker.style.transform = `translateX(-50%) rotate(${startAngle}deg)`;
    if (endMarker) endMarker.style.transform = `translateX(-50%) rotate(${endAngle}deg)`;
}

function populatePerDayTimes(modal, currentTimeslot) {
    const container = modal.querySelector('.per-day-times');
    const checkedDays = Array.from(modal.querySelectorAll('#folderDaysContainer input:checked')).map(cb => cb.value);
    container.innerHTML = checkedDays.map(day => `
        <div class="per-day-item">
            <span class="day-name">${day.charAt(0).toUpperCase() + day.slice(1)}</span>
            <select class="per-day-start" data-day="${day}">
                ${generateTimeOptions(currentTimeslot && currentTimeslot.perday && currentTimeslot.perday[day] ? currentTimeslot.perday[day].start : '08:00')}
            </select>
            <span class="time-separator">to</span>
            <select class="per-day-end" data-day="${day}">
                ${generateTimeOptions(currentTimeslot && currentTimeslot.perday && currentTimeslot.perday[day] ? currentTimeslot.perday[day].end : '18:00')}
            </select>
        </div>
    `).join('');
}

// Custom modal for alerts
function showCustomModal({ title, message, confirmText = 'OK', cancelText, onConfirm, onCancel }) {
    // Remove existing modal if any
    const existingModal = document.getElementById('customModal');
    if (existingModal) {
        existingModal.remove();
    }

    const modalHtml = `
        <div id="customModal" class="modal" style="display: flex;">
            <div class="modal-content" style="max-width: 400px;">
                <div class="modal-header">
                    <h3 class="modal-title">${title}</h3>
                </div>
                <div class="modal-body">
                    <p style="margin: 0; line-height: 1.5;">${message}</p>
                </div>
                <div class="modal-footer">
                    ${cancelText ? `<button class="btn-secondary" id="modalCancelBtn">${cancelText}</button>` : ''}
                    <button class="btn-primary" id="modalConfirmBtn">${confirmText}</button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const modal = document.getElementById('customModal');

    // Event listeners
    document.getElementById('modalConfirmBtn').addEventListener('click', () => {
        modal.remove();
        if (onConfirm) onConfirm();
    });

    const cancelBtn = document.getElementById('modalCancelBtn');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            modal.remove();
            if (onCancel) onCancel();
        });
    }

    // Close on backdrop click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
            if (onCancel) onCancel();
        }
    });
}

// Check for timeslot conflicts
function checkTimeslotConflicts(newTimeslot, excludeFolderId = null) {
    if (!newTimeslot) return [];

    const conflicts = [];

    state.folders.forEach(folder => {
        if (excludeFolderId && folder.id === excludeFolderId) return;
        if (!folder.timeslot) return;

        const conflictDetails = {
            folderName: folder.name,
            folderColor: folder.color,
            conflictingTimeslots: []
        };

        if (newTimeslot.perday && folder.timeslot.perday) {
            // Both are per-day - check each day
            Object.keys(newTimeslot.perday).forEach(day => {
                const newDayTimes = newTimeslot.perday[day];
                const existingDayTimes = folder.timeslot.perday[day];
                if (existingDayTimes &&
                    newDayTimes.start < existingDayTimes.end &&
                    existingDayTimes.start < newDayTimes.end) {
                    conflictDetails.conflictingTimeslots.push({
                        day: day.charAt(0).toUpperCase() + day.slice(1),
                        newTimeslot: `${newDayTimes.start}-${newDayTimes.end}`,
                        existingTimeslot: `${existingDayTimes.start}-${existingDayTimes.end}`
                    });
                }
            });
        } else if (!newTimeslot.perday && !folder.timeslot.perday) {
            // Both are regular timeslots - check day overlap
            const newDays = new Set(newTimeslot.days);
            const existingDays = new Set(folder.timeslot.days);
            const commonDays = [...newDays].filter(day => existingDays.has(day));
            if (commonDays.length > 0) {
                // Check time overlap
                if (newTimeslot.startTime < folder.timeslot.endTime &&
                    folder.timeslot.startTime < newTimeslot.endTime) {
                    conflictDetails.conflictingTimeslots.push({
                        days: commonDays.map(d => d.charAt(0).toUpperCase() + d.slice(1)).join(', '),
                        newTimeslot: `${newTimeslot.startTime}-${newTimeslot.endTime}`,
                        existingTimeslot: `${folder.timeslot.startTime}-${folder.timeslot.endTime}`
                    });
                }
            }
        } else {
            // Mixed types - simplified check (could be improved)
            // For now, just warn about potential conflicts
            conflictDetails.conflictingTimeslots.push({
                type: 'mixed',
                description: 'Different timeslot types may conflict'
            });
        }

        if (conflictDetails.conflictingTimeslots.length > 0) {
            conflicts.push(conflictDetails);
        }
    });

    return conflicts;
}

function setupEventListeners() {
    // Navigation
    elements.navTabs.forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });

    // Favorites
    elements.addFavouriteBtn.addEventListener('click', () => {
        // Open the popup
        chrome.action.openPopup();
    });

    // Folders
    elements.addFolderBtn.addEventListener('click', () => openFolderEditor());

    // Folder Priority Management
    const managePriorityBtn = document.getElementById('manageFolderPriorityBtn');
    if (managePriorityBtn) {
        managePriorityBtn.addEventListener('click', manageFolderPriority);
    }

    // Data
    elements.exportAllBtn.addEventListener('click', handleExport);
    elements.importBtn.addEventListener('click', handleImport);
    elements.clearAllBtn.addEventListener('click', handleClearAll);

    // Settings
    setupSettings();
}

function setupSettings() {
    // Dark Mode Toggle Logic (shared via chrome.storage.sync with popup)
    if (elements.settingDarkMode) {
        chrome.storage.sync.get('theme', (result) => {
            const theme = result.theme || 'light';
            if (theme === 'dark') {
                elements.settingDarkMode.classList.add('active');
                document.body.classList.add('dark-mode');
            }
        });

        elements.settingDarkMode.addEventListener('click', (e) => {
            const isActive = e.target.classList.contains('active');
            if (isActive) {
                e.target.classList.remove('active');
                document.body.classList.remove('dark-mode');
                chrome.storage.sync.set({ theme: 'light' });
            } else {
                e.target.classList.add('active');
                document.body.classList.add('dark-mode');
                chrome.storage.sync.set({ theme: 'dark' });
            }
        });
    }

    // Auto Refresh Toggle Logic (shared via chrome.storage.sync with popup)
    if (elements.settingAutoRefresh) {
        chrome.storage.sync.get('autoRefresh', (result) => {
            const saved = result.autoRefresh;
            if (saved === false) {
                elements.settingAutoRefresh.classList.remove('active');
            }
        });

        elements.settingAutoRefresh.addEventListener('click', (e) => {
            const isActive = e.target.classList.contains('active');
            chrome.storage.sync.set({ autoRefresh: !isActive });
            if (isActive) {
                e.target.classList.remove('active');
            } else {
                e.target.classList.add('active');
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

function renderFoldersAndFavorites() {
    const container = elements.foldersAndFavoritesList;

    // Update folder counts first
    updateFolderCounts();

    // Get favorites not in any folder
    const unassignedFavorites = state.favorites.filter(fav => !fav.folder);

    if (state.folders.length === 0 && unassignedFavorites.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <p>No folders or favorites created yet</p>
                <small>Create folders to organize your favorites into categories.</small>
            </div>
        `;
        return;
    }

    let html = '';

    // Render folders with their favorites
    state.folders.forEach(folder => {
        const folderFavorites = state.favorites.filter(fav => fav.folder === folder.id);

        html += `
        <div class="folder-item" style="background: linear-gradient(135deg, ${folder.color}15, ${folder.color}08); border-left: 4px solid ${folder.color};">
            <div class="folder-header">
                <div class="folder-icon" style="color: ${folder.color};"><svg class="icon icon-lg" viewBox="0 0 24 24"><use href="../icons/sprite.svg#icon-folder"/></svg></div>
                <div class="folder-info">
                    <div class="folder-name">${escapeHtml(folder.name)}</div>
                    <div class="folder-count">${folder.favoritesCount || 0} favorites</div>
                    <div class="folder-timeslot">${getFolderTimeslotDisplay(folder.timeslot)}</div>
                </div>
                ${!folder.isDefault ? `
                <div class="folder-actions">
                    <button class="btn-secondary folder-edit-btn" data-folder-id="${folder.id}">Edit</button>
                    <button class="btn-danger folder-delete-btn" data-folder-id="${folder.id}">Delete</button>
                </div>
                ` : ''}
            </div>
        `;

        // Render favorites in this folder
        if (folderFavorites.length > 0) {
            html += '<div class="folder-favorites">';
            folderFavorites.forEach(fav => {
                html += `
                <div class="favorite-item">
                    <div class="list-content">
                        <div class="list-title">${fav.route} to ${escapeHtml(fav.dest)}</div>
                        <div class="list-subtitle">${escapeHtml(fav.stopName)} (${fav.stopId})</div>
                    </div>
                    <div class="list-trailing">
                        <button class="btn-secondary edit-fav-btn" data-id="${fav.id}">Edit</button>
                    </div>
                </div>
                `;
            });
            html += '</div>';
        }

        html += '</div>';
    });

    // Render unassigned favorites
    if (unassignedFavorites.length > 0) {
        html += `
        <div class="unassigned-favorites">
            <div class="unassigned-header">
                <div class="folder-icon" style="color: var(--text-secondary);"><svg class="icon icon-lg" viewBox="0 0 24 24"><use href="../icons/sprite.svg#icon-file"/></svg></div>
                <div class="folder-info">
                    <div class="folder-name">Unassigned Favorites</div>
                    <div class="folder-count">${unassignedFavorites.length} favorites</div>
                </div>
            </div>
            <div class="folder-favorites">
        `;

        unassignedFavorites.forEach(fav => {
            html += `
            <div class="favorite-item">
                <div class="list-content">
                    <div class="list-title">${fav.route} to ${escapeHtml(fav.dest)}</div>
                    <div class="list-subtitle">${escapeHtml(fav.stopName)} (${fav.stopId})</div>
                </div>
                <div class="list-trailing">
                    <button class="btn-secondary edit-fav-btn" data-id="${fav.id}">Edit</button>
                </div>
            </div>
            `;
        });

        html += '</div></div>';
    }

    container.innerHTML = html;

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

    container.querySelectorAll('.edit-fav-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            handleEditFavorite(e.target.dataset.id);
        });
    });
}

// ... Data handlers (Export/Import/Clear) ... 
function handleExport() {
    const data = { favorites: state.favorites, folders: state.folders, exportedAt: new Date().toISOString(), version: '1.0.0' };
    const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `easyeta-backup-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}
async function handleImport() {
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
async function handleClearAll() {
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
}

async function updateStorageInfo() {
    const bytes = await new Promise(resolve => chrome.storage.local.getBytesInUse(null, resolve));
    elements.storageInfo.textContent = `${(bytes / 1024).toFixed(2)} KB used by EasyETA`;
}
function escapeHtml(text) { if (!text) return ''; return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;"); }

function updateFolderCounts() {
    state.folders.forEach(folder => {
        folder.favoritesCount = state.favorites.filter(fav => fav.folder === folder.id).length;
    });
}

async function handleEditFavorite(id) {
    const fav = state.favorites.find(f => f.id === id);
    if (!fav) return;

    // Create modal HTML
    const folderOptions = state.folders.map(folder =>
        `<option value="${folder.id}" ${fav.folder === folder.id ? 'selected' : ''}>${escapeHtml(folder.name)}</option>`
    ).join('');

    const modalHtml = `
        <div id="favoriteModal" class="modal" style="display: flex;">
            <div class="modal-content" style="max-width: 400px;">
                <div class="modal-header">
                    <h3 class="modal-title">Edit Favorite</h3>
                    <button class="close-btn" id="favoriteCloseBtn">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="favorite-info" style="margin-bottom: 20px; padding: 15px; background: rgba(0,0,0,0.05); border-radius: 8px;">
                        <div style="font-weight: 600; margin-bottom: 5px;">${fav.route} to ${escapeHtml(fav.dest)}</div>
                        <div style="color: var(--text-secondary); font-size: 14px;">${escapeHtml(fav.stopName)}</div>
                    </div>

                    <div class="form-group">
                        <label for="favoriteFolderSelect" style="display: block; margin-bottom: 8px; font-weight: 500;">Folder:</label>
                        <select id="favoriteFolderSelect" class="form-select" style="width: 100%;">
                            <option value="" ${!fav.folder ? 'selected' : ''}>No Folder</option>
                            ${folderOptions}
                        </select>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn-danger" id="favoriteDeleteBtn">Remove Favorite</button>
                    <div style="flex: 1;"></div>
                    <button class="btn-secondary" id="favoriteCancelBtn">Cancel</button>
                    <button class="btn-primary" id="favoriteSaveBtn">Save Changes</button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const modal = document.getElementById('favoriteModal');

    // Event listeners
    document.getElementById('favoriteCloseBtn').addEventListener('click', () => modal.remove());
    document.getElementById('favoriteCancelBtn').addEventListener('click', () => modal.remove());

    document.getElementById('favoriteSaveBtn').addEventListener('click', async () => {
        const newFolderId = document.getElementById('favoriteFolderSelect').value;
        fav.folder = newFolderId || undefined;
        await Storage.saveFavorites(state.favorites);
        updateFolderCounts();
        renderFoldersAndFavorites();
        modal.remove();

        // Notify popup to refresh
        chrome.runtime.sendMessage({ action: 'refreshFavourites' });
    });

    document.getElementById('favoriteDeleteBtn').addEventListener('click', async () => {
        if (confirm('Remove this favorite stop?')) {
            state.favorites = state.favorites.filter(f => f.id !== id);
            await Storage.saveFavorites(state.favorites);
            updateFolderCounts();
            renderFoldersAndFavorites();
            modal.remove();

            // Notify popup to refresh
            chrome.runtime.sendMessage({ action: 'refreshFavourites' });
        }
    });

    // Close on backdrop click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

// --- FOLDER MANAGEMENT ---

function getFolderTimeslotDisplay(timeslot) {
    if (!timeslot) {
        return `<span class="timeslot-none">${I18n.t('timeslot.none')}</span>`;
    }

    if (timeslot.perday) {
        // For per-day timeslots, calculate the maximum time range
        const dayEntries = Object.entries(timeslot.perday);
        
        if (dayEntries.length === 0) {
            return `<span class="timeslot-none">${I18n.t('timeslot.no_config')}</span>`;
        }
        
        // Find the earliest start time and latest end time across all days
        let earliestStart = '23:59';
        let latestEnd = '00:00';
        
        dayEntries.forEach(([, times]) => {
            if (times.start < earliestStart) earliestStart = times.start;
            if (times.end > latestEnd) latestEnd = times.end;
        });
        
        const dayNames = dayEntries.map(([day]) => day.charAt(0).toUpperCase() + day.slice(1, 3));
        
        return `<div class="timeslot-display">
            <div class="timeslot-text">${dayNames.join(', ')}: ${earliestStart} - ${latestEnd} ${I18n.t('timeslot.max_range')}</div>
            <div class="timeslot-visual">${createTimeslotVisual(earliestStart, latestEnd)}</div>
        </div>`;
    } else {
        // Single timeslot
        const dayNames = timeslot.days.map(day => {
            const dayMap = { 'monday': 'Mon', 'tuesday': 'Tue', 'wednesday': 'Wed', 'thursday': 'Thu', 'friday': 'Fri', 'saturday': 'Sat', 'sunday': 'Sun' };
            return dayMap[day] || day.charAt(0).toUpperCase() + day.slice(1, 3);
        });
        return `<div class="timeslot-display">
            <div class="timeslot-text">${dayNames.join(', ')}: ${timeslot.startTime} - ${timeslot.endTime}</div>
            <div class="timeslot-visual">${createTimeslotVisual(timeslot.startTime, timeslot.endTime)}</div>
        </div>`;
    }
}

function createTimeslotVisual(startTime, endTime) {
    if (!startTime || !endTime) {
        return '<div class="timeslot-bar empty"></div>';
    }

    // Convert times to minutes since midnight
    const startMinutes = timeToMinutes(startTime);
    const endMinutes = timeToMinutes(endTime);
    const totalMinutes = 24 * 60;

    // Calculate position and width as percentages
    const startPercent = (startMinutes / totalMinutes) * 100;
    const widthPercent = ((endMinutes - startMinutes) / totalMinutes) * 100;

    return `<div class="timeslot-bar">
        <div class="timeslot-fill" style="left: ${startPercent}%; width: ${widthPercent}%"></div>
    </div>`;
}

function timeToMinutes(time) {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
}



function openFolderEditor(folderId = null) {
    const folder = folderId ? state.folders.find(f => f.id === folderId) : null;
    
    const name = folder ? folder.name : '';
    const color = folder ? folder.color : '#007AFF';
    const currentTimeslot = folder ? folder.timeslot : null;
    
    const daysCheckboxes = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map(day => {
        // Check if day is selected in regular timeslot or exists in per-day timeslot
        const isChecked = (currentTimeslot && currentTimeslot.days && currentTimeslot.days.includes(day)) ||
                         (currentTimeslot && currentTimeslot.perday && currentTimeslot.perday[day]);
        return `
        <label class="day-checkbox">
            <input type="checkbox" value="${day}" ${isChecked ? 'checked' : ''}>
            <span class="day-label">${day.charAt(0).toUpperCase() + day.slice(1)}</span>
        </label>
        `;
    }).join('');
    
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
                    <label>Days:</label>
                    <div id="folderDaysContainer">
                        ${daysCheckboxes}
                    </div>
                </div>
                <div class="form-group toggle-group">
                    <label for="usePerDayTimes">Use different times per day</label>
                    <div class="toggle-container">
                        <span class="toggle-label toggle-label-off">OFF</span>
                        <button type="button" id="usePerDayTimes" class="toggle-btn">
                            <span class="toggle-slider"></span>
                        </button>
                        <span class="toggle-label toggle-label-on">ON</span>
                    </div>
                </div>
                <div id="perDayTimesContainer" style="display:none;">
                    <div class="per-day-times">
                        <!-- Populated dynamically -->
                    </div>
                </div>
                <div class="form-group" id="singleTimeGroup">
                    <label>Time Range:</label>
                    <div class="time-range-selector">
                        <div class="time-inputs">
                            <select id="folderStartTime">
                                ${generateTimeOptions(currentTimeslot ? currentTimeslot.startTime : '08:00')}
                            </select>
                            <input type="time" id="customStartTime" style="display:none; margin-left: 10px;">
                            <span class="time-separator">to</span>
                            <select id="folderEndTime">
                                ${generateTimeOptions(currentTimeslot ? currentTimeslot.endTime : '18:00')}
                            </select>
                            <input type="time" id="customEndTime" style="display:none; margin-left: 10px;">
                        </div>
                    </div>
                </div>
                <small class="form-help">Favorites in this folder will appear during the selected days and time range</small>
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
    
    // Update clock markers
    updateClockMarkers();
    
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
    
    // Update clock markers on time change
    modal.querySelector('#folderStartTime').addEventListener('change', updateClockMarkers);
    modal.querySelector('#folderEndTime').addEventListener('change', updateClockMarkers);
    
    // Toggle custom time inputs
    function toggleCustomTime(selectId, inputId) {
        const select = modal.querySelector(selectId);
        const input = modal.querySelector(inputId);
        select.addEventListener('change', function() {
            if (this.value === 'custom') {
                input.style.display = 'inline-block';
                input.focus();
            } else {
                input.style.display = 'none';
            }
        });
    }
    toggleCustomTime('#folderStartTime', '#customStartTime');
    toggleCustomTime('#folderEndTime', '#customEndTime');
    
    // Toggle per-day times
    const toggleBtn = modal.querySelector('#usePerDayTimes');
    // Set initial state based on current timeslot
    if (currentTimeslot && currentTimeslot.perday) {
        toggleBtn.classList.add('active');
    }
    
    // Initialize display state based on toggle
    const isActive = toggleBtn.classList.contains('active');
    const singleGroup = modal.querySelector('#singleTimeGroup');
    const perDayContainer = modal.querySelector('#perDayTimesContainer');
    if (isActive) {
        singleGroup.style.display = 'none';
        perDayContainer.style.display = 'block';
        populatePerDayTimes(modal, currentTimeslot);
    }
    
    toggleBtn.addEventListener('click', function() {
        this.classList.toggle('active');
        const isActive = this.classList.contains('active');
        const singleGroup = modal.querySelector('#singleTimeGroup');
        const perDayContainer = modal.querySelector('#perDayTimesContainer');
        if (isActive) {
            singleGroup.style.display = 'none';
            perDayContainer.style.display = 'block';
            populatePerDayTimes(modal, currentTimeslot);
        } else {
            singleGroup.style.display = 'block';
            perDayContainer.style.display = 'none';
        }
    });
    
    // Live update per-day times when days change
    const dayCheckboxes = modal.querySelectorAll('#folderDaysContainer input[type="checkbox"]');
    dayCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            if (toggleBtn.classList.contains('active')) {
                populatePerDayTimes(modal, currentTimeslot);
            }
        });
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
    const days = Array.from(document.querySelectorAll('#folderDaysContainer input:checked')).map(cb => cb.value);
    const usePerDay = document.getElementById('usePerDayTimes').classList.contains('active');
    
    if (!name) {
        showCustomModal({
            title: 'Missing Information',
            message: 'Please enter a folder name.',
            confirmText: 'OK'
        });
        return;
    }
    
    let timeslot = null;
    if (days.length > 0) {
        if (usePerDay) {
            timeslot = { perday: {} };
            days.forEach(day => {
                const startSelect = document.querySelector(`.per-day-start[data-day="${day}"]`);
                const endSelect = document.querySelector(`.per-day-end[data-day="${day}"]`);
                const start = startSelect.value === 'custom' ? document.getElementById('customStartTime').value : startSelect.value;
                const end = endSelect.value === 'custom' ? document.getElementById('customEndTime').value : endSelect.value;
                timeslot.perday[day] = { start, end };
            });
        } else {
            const startSelect = document.getElementById('folderStartTime');
            const endSelect = document.getElementById('folderEndTime');
            const startTime = startSelect.value === 'custom' ? document.getElementById('customStartTime').value : startSelect.value;
            const endTime = endSelect.value === 'custom' ? document.getElementById('customEndTime').value : endSelect.value;
            timeslot = { days, startTime, endTime };
        }
    }
    
    // Check for timeslot conflicts
    const conflicts = checkTimeslotConflicts(timeslot);
    if (conflicts.length > 0) {
        let conflictMessage = '<div class="conflict-details">';
        conflicts.forEach(conflict => {
            conflictMessage += `<strong style="color: ${conflict.folderColor};">${conflict.folderName}</strong>`;
            conflict.conflictingTimeslots.forEach(slot => {
                if (slot.day) {
                    conflictMessage += `<br>• ${slot.day}: ${slot.newTimeslot} overlaps with ${slot.existingTimeslot}`;
                } else if (slot.days) {
                    conflictMessage += `<br>• ${slot.days}: ${slot.newTimeslot} overlaps with ${slot.existingTimeslot}`;
                } else if (slot.type === 'mixed') {
                    conflictMessage += `<br>• ${slot.description}`;
                }
            });
        });
        conflictMessage += '</div>';
        conflictMessage += '<em>You can manage folder priority order in Settings to control which folder appears first when conflicts occur.</em><br><br>Do you want to save anyway?';

        showCustomModal({
            title: 'Timeslot Conflict',
            message: conflictMessage,
            confirmText: 'Save Anyway',
            cancelText: 'Cancel',
            onConfirm: async () => {
                await saveNewFolder(name, color, timeslot);
            }
        });
        return;
    }
    
    await saveNewFolder(name, color, timeslot);
}

async function saveNewFolder(name, color, timeslot) {
    // Get the highest priority number and add 1
    const maxPriority = state.folders.length > 0 ? Math.max(...state.folders.map(f => f.priority || 0)) : 0;
    
    const newFolder = {
        id: Date.now().toString(),
        name,
        color,
        favoritesCount: 0,
        timeslot,
        priority: maxPriority + 1
    };
    
    state.folders.push(newFolder);
    await Storage.saveFolders(state.folders);
    renderFoldersAndFavorites();
    closeFolderEditor();
    
    // Notify popup to refresh folders
    chrome.runtime.sendMessage({ action: 'refreshFolders' });
}

async function updateFolder(id) {
    const name = document.getElementById('folderName').value.trim();
    const color = document.getElementById('folderColor').value;
    const days = Array.from(document.querySelectorAll('#folderDaysContainer input:checked')).map(cb => cb.value);
    const usePerDay = document.getElementById('usePerDayTimes').classList.contains('active');
    
    if (!name) {
        showCustomModal({
            title: 'Missing Information',
            message: 'Please enter a folder name.',
            confirmText: 'OK'
        });
        return;
    }
    
    let timeslot = null;
    if (days.length > 0) {
        if (usePerDay) {
            timeslot = { perday: {} };
            days.forEach(day => {
                const startSelect = document.querySelector(`.per-day-start[data-day="${day}"]`);
                const endSelect = document.querySelector(`.per-day-end[data-day="${day}"]`);
                const start = startSelect.value === 'custom' ? document.getElementById('customStartTime').value : startSelect.value;
                const end = endSelect.value === 'custom' ? document.getElementById('customEndTime').value : endSelect.value;
                timeslot.perday[day] = { start, end };
            });
        } else {
            const startSelect = document.getElementById('folderStartTime');
            const endSelect = document.getElementById('folderEndTime');
            const startTime = startSelect.value === 'custom' ? document.getElementById('customStartTime').value : startSelect.value;
            const endTime = endSelect.value === 'custom' ? document.getElementById('customEndTime').value : endSelect.value;
            timeslot = { days, startTime, endTime };
        }
    }
    
    // Check for timeslot conflicts
    const conflicts = checkTimeslotConflicts(timeslot, id);
    if (conflicts.length > 0) {
        let conflictMessage = '<div class="conflict-details">';
        conflicts.forEach(conflict => {
            conflictMessage += `<strong style="color: ${conflict.folderColor};">${conflict.folderName}</strong>`;
            conflict.conflictingTimeslots.forEach(slot => {
                if (slot.day) {
                    conflictMessage += `<br>• ${slot.day}: ${slot.newTimeslot} overlaps with ${slot.existingTimeslot}`;
                } else if (slot.days) {
                    conflictMessage += `<br>• ${slot.days}: ${slot.newTimeslot} overlaps with ${slot.existingTimeslot}`;
                } else if (slot.type === 'mixed') {
                    conflictMessage += `<br>• ${slot.description}`;
                }
            });
        });
        conflictMessage += '</div>';
        conflictMessage += '<em>You can manage folder priority order in Settings to control which folder appears first when conflicts occur.</em><br><br>Do you want to save anyway?';

        showCustomModal({
            title: 'Timeslot Conflict',
            message: conflictMessage,
            confirmText: 'Save Anyway',
            cancelText: 'Cancel',
            onConfirm: async () => {
                await saveUpdatedFolder(id, name, color, timeslot);
            }
        });
        return;
    }
    
    await saveUpdatedFolder(id, name, color, timeslot);
}

async function saveUpdatedFolder(id, name, color, timeslot) {
    const folder = state.folders.find(f => f.id === id);
    if (folder) {
        folder.name = name;
        folder.color = color;
        folder.timeslot = timeslot;
        await Storage.saveFolders(state.folders);
        renderFoldersAndFavorites();
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
        renderFoldersAndFavorites();
        
        // Notify popup to refresh folders
        chrome.runtime.sendMessage({ action: 'refreshFolders' });
    }
}

function manageFolderPriority() {
    // Sort folders by priority for display
    const sortedFolders = [...state.folders].sort((a, b) => (a.priority || 0) - (b.priority || 0));
    
    const folderItems = sortedFolders.map(folder => `
        <div class="priority-item" data-folder-id="${folder.id}" draggable="true" style="background: linear-gradient(135deg, ${folder.color}15, ${folder.color}08); border-left: 4px solid ${folder.color};">
            <div class="priority-drag-handle">⋮⋮</div>
            <div class="priority-content">
                <div class="priority-icon" style="color: ${folder.color};"><svg class="icon icon-lg" viewBox="0 0 24 24"><use href="../icons/sprite.svg#icon-folder"/></svg></div>
                <div class="priority-info">
                    <div class="priority-name">${escapeHtml(folder.name)}</div>
                    <div class="priority-count">${folder.favoritesCount || 0} favorites</div>
                </div>
            </div>
            <div class="priority-controls">
                <button class="priority-btn priority-up" ${folder.priority === 1 ? 'disabled' : ''}><svg class="icon icon-sm" viewBox="0 0 24 24"><use href="../icons/sprite.svg#icon-arrow-up"/></svg></button>
                <button class="priority-btn priority-down" ${folder.priority === sortedFolders.length ? 'disabled' : ''}><svg class="icon icon-sm" viewBox="0 0 24 24"><use href="../icons/sprite.svg#icon-arrow-down"/></svg></button>
            </div>
        </div>
    `).join('');
    
    const modalHtml = `
        <div id="priorityModal" class="modal" style="display: flex;">
            <div class="modal-content" style="max-width: 500px;">
                <div class="modal-header">
                    <h3 class="modal-title">Folder Priority Order</h3>
                    <button class="close-btn" id="priorityCloseBtn">&times;</button>
                </div>
                <div class="modal-body">
                    <p style="margin-bottom: 16px; color: var(--text-secondary); font-size: 14px;">
                        Drag or use arrows to reorder folders. Higher priority folders appear first when <strong>timeslots</strong> overlap.
                    </p>
                    <div id="priorityList" class="priority-list">
                        ${folderItems}
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn-secondary" id="priorityCancelBtn">Cancel</button>
                    <button class="btn-primary" id="prioritySaveBtn">Save Order</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const modal = document.getElementById('priorityModal');
    
    // Event listeners
    document.getElementById('priorityCloseBtn').addEventListener('click', () => modal.remove());
    document.getElementById('priorityCancelBtn').addEventListener('click', () => modal.remove());
    
    document.getElementById('prioritySaveBtn').addEventListener('click', async () => {
        // Update priorities based on current order
        const priorityItems = Array.from(document.querySelectorAll('.priority-item'));
        priorityItems.forEach((item, index) => {
            const folderId = item.dataset.folderId;
            const folder = state.folders.find(f => f.id === folderId);
            if (folder) {
                folder.priority = index + 1;
            }
        });
        
        await Storage.saveFolders(state.folders);
        renderFoldersAndFavorites();
        
        // Notify popup to refresh folders
        chrome.runtime.sendMessage({ action: 'refreshFolders' });
        
        modal.remove();
        
        showCustomModal({
            title: 'Priority Updated',
            message: 'Folder priority order has been saved.',
            confirmText: 'OK'
        });
    });
    
    // Up/Down button handlers
    modal.addEventListener('click', (e) => {
        if (e.target.classList.contains('priority-up') || e.target.classList.contains('priority-down')) {
            const item = e.target.closest('.priority-item');
            const list = document.getElementById('priorityList');
            const items = Array.from(list.children);
            const currentIndex = items.indexOf(item);
            
            if (e.target.classList.contains('priority-up') && currentIndex > 0) {
                // Move up
                list.insertBefore(item, items[currentIndex - 1]);
            } else if (e.target.classList.contains('priority-down') && currentIndex < items.length - 1) {
                // Move down
                list.insertBefore(items[currentIndex + 1], item);
            }
            
            // Update button states
            updatePriorityButtons();
        }
    });
    
    // Drag and drop functionality
    let draggedElement = null;
    
    modal.addEventListener('dragstart', (e) => {
        if (e.target.classList.contains('priority-item')) {
            draggedElement = e.target;
            e.target.style.opacity = '0.5';
            e.dataTransfer.effectAllowed = 'move';
        }
    });
    
    modal.addEventListener('dragend', (e) => {
        if (e.target.classList.contains('priority-item')) {
            e.target.style.opacity = '';
            draggedElement = null;
        }
    });
    
    modal.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        
        const afterElement = getDragAfterElement(document.getElementById('priorityList'), e.clientY);
        const draggable = document.querySelector('.priority-item[style*="opacity: 0.5"]');
        
        if (afterElement == null) {
            document.getElementById('priorityList').appendChild(draggable);
        } else {
            document.getElementById('priorityList').insertBefore(draggable, afterElement);
        }
    });
    
    modal.addEventListener('drop', (e) => {
        e.preventDefault();
        updatePriorityButtons();
    });
    
    function getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.priority-item:not([style*="opacity: 0.5"])')];
        
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }
    
    // Close on backdrop click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
    
    function updatePriorityButtons() {
        const items = document.querySelectorAll('.priority-item');
        items.forEach((item, index) => {
            const upBtn = item.querySelector('.priority-up');
            const downBtn = item.querySelector('.priority-down');
            upBtn.disabled = index === 0;
            downBtn.disabled = index === items.length - 1;
        });
    }
}

// --- LANGUAGE SWITCHING ---

function setupLanguageSwitcher() {
    const select = document.getElementById('setting-lang');
    if (!select) return;

    select.value = I18n.getLang();

    select.addEventListener('change', async () => {
        await I18n.setLang(select.value);
        applyI18nToDocument();
        renderFoldersAndFavorites();
    });

    I18n.onChange(() => {
        select.value = I18n.getLang();
    });
}

function applyI18nToDocument() {
        I18n.applyToDocument();

        // Re-translate nav tabs
        document.querySelectorAll('.nav-tab .nav-label').forEach(el => {
            const tabKey = el.textContent.trim().toLowerCase();
            if (tabKey === 'favorites' || tabKey === '最愛') el.textContent = I18n.t('options.favorites');
            else if (tabKey === 'settings' || tabKey === '設定') el.textContent = I18n.t('options.settings');
            else if (tabKey === 'data' || tabKey === '數據') el.textContent = I18n.t('options.data');
            else if (tabKey === 'about' || tabKey === '關於') el.textContent = I18n.t('options.about');
        });

        // Section headers
        document.querySelectorAll('.section-header .section-title').forEach(el => {
            const text = el.textContent.trim();
            if (text === 'Folders & Favorites' || text === '資料夾與最愛') el.textContent = I18n.t('options.folders_favorites');
            else if (text === 'App Settings' || text === '應用程式設定') el.textContent = I18n.t('options.app_settings');
            else if (text === 'Backup & Restore' || text === '備份與還原') el.textContent = I18n.t('options.backup_restore');
            else if (text === 'Danger Zone' || text === '危險區域') el.textContent = I18n.t('options.danger_zone');
            else if (text === 'Storage Usage' || text === '儲存空間使用量') el.textContent = I18n.t('options.storage_usage');
        });

        // Action buttons
        const btnMap = {
            'manageFolderPriorityBtn': 'options.priority_order',
            'addFolderBtn': 'options.add_folder',
            'addFavouriteBtn': 'options.add_favourite',
            'exportAllBtn': 'options.export_json',
            'importBtn': 'options.import',
            'clearAllBtn': 'options.clear_everything',
            'testNotificationBtn': 'options.test'
        };
        for (const [id, key] of Object.entries(btnMap)) {
            const el = document.getElementById(id);
            if (el) el.textContent = I18n.t(key);
        }

        // Unassigned header
        document.querySelectorAll('.unassigned-header .folder-name').forEach(el => {
            el.textContent = I18n.t('options.unassigned');
        });

        // Empty state
        document.querySelectorAll('.empty-state p').forEach(el => {
            el.textContent = I18n.t('options.no_folders');
        });
        document.querySelectorAll('.empty-state small').forEach(el => {
            el.textContent = I18n.t('options.no_folders_desc');
        });

        // No Folder option in edit modal
        const noFolderOption = document.querySelector('#favoriteFolderSelect option[value=""]');
        if (noFolderOption) noFolderOption.textContent = I18n.t('options.no_folder');
    }
