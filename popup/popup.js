// EasyETA Side Panel Logic
// Redesigned App-like Experience

class App {
    constructor() {
        this.currentView = 'view-home';
        this.favorites = [];
        this.folders = [];
        this.timeslots = [];
        this.searchDebounce = null;
        this.activeEtaIntervals = []; // To clear intervals when leaving view
        this.currentFavTab = 'all'; // Current favorite tab
        
        this.init();
    }

    async init() {
        this.setupNavigation();
        this.setupSearch();
        this.setupFavorites();
        this.setupDarkMode();
        await this.loadData();
        this.renderHome();
    }

    async loadData() {
        try {
            this.favorites = await Storage.getFavorites() || [];
            this.folders = await Storage.getFolders() || [];
            this.timeslots = await Storage.getTimeslots() || [];
            // Pre-warm cache if needed
        } catch (e) {
            console.error("Load data error", e);
        }
    }

    setupNavigation() {
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            item.addEventListener('click', () => {
                const target = item.dataset.target;
                if (target === 'view-settings') {
                    chrome.runtime.openOptionsPage();
                    return;
                }
                this.navigateTo(target);
            });
        });

        // Settings item in the settings view
        const settingsItem = document.getElementById('settings-item');
        if (settingsItem) {
            settingsItem.addEventListener('click', () => {
                chrome.runtime.openOptionsPage();
            });
        }

        const backBtn = document.getElementById('back-btn');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                this.navigateTo(this.previousView || 'view-home');
            });
        }
    }

    navigateTo(viewId) {
        // Hide all views
        document.querySelectorAll('.view').forEach(el => {
            el.classList.remove('active');
            if(el.id !== viewId) el.classList.add('hidden'); // Ensure hidden is applied
        });
        
        // Show target
        const targetView = document.getElementById(viewId);
        if (targetView) {
            targetView.classList.remove('hidden');
            targetView.classList.add('active');
        }

        // Update Nav Bar state
        document.querySelectorAll('.nav-item').forEach(item => {
            if(item.dataset.target === viewId) item.classList.add('active');
            else item.classList.remove('active');
        });

        // Store history for simple back
        if (viewId !== 'view-details') {
            this.previousView = viewId;
        }

        this.currentView = viewId;
        
        // Refresh data based on view
        if (viewId === 'view-home') this.renderHome();
        
        // Clear ETA intervals if leaving details
        if (viewId !== 'view-details') {
            this.clearEtaIntervals();
        }
    }

    // --- HOME VIEW ---
    renderFavoriteTabs() {
        const tabGroup = document.querySelector('.tab-group');
        
        const tabs = [
            { id: 'all', name: 'All Favorites', icon: '🕐' },
            ...this.timeslots.map(slot => ({ id: slot.id, name: slot.name, icon: '⏰' })),
            ...this.folders.map(folder => ({ id: folder.id, name: folder.name, icon: '📁', color: folder.color }))
        ];
        
        tabGroup.innerHTML = tabs.map(tab => 
            `<button class="tab-btn ${this.currentFavTab === tab.id ? 'active' : ''}" 
                     data-fav-tab="${tab.id}" 
                     style="${tab.color ? `--tab-color: ${tab.color}` : ''}">
                ${tab.icon} ${tab.name}
            </button>`
        ).join('');
        
        // Re-attach event listeners
        this.setupFavorites();
    }
    
    async renderHome() {
        // Render tabs first
        this.renderFavoriteTabs();
        
        const favList = document.getElementById('favorites-list');
        const recentList = document.getElementById('recent-list');
        
        // Filter favorites by current tab
        let filteredFavorites = this.favorites;
        if (this.currentFavTab !== 'all') {
            // Check if it's a timeslot or custom tab
            const isTimeslot = this.timeslots.some(slot => slot.id === this.currentFavTab);
            if (isTimeslot) {
                // Show favorites from folders that have this timeslot assigned
                const foldersWithTimeslot = this.folders.filter(folder => folder.timeslotId === this.currentFavTab);
                const folderIds = foldersWithTimeslot.map(folder => folder.id);
                filteredFavorites = this.favorites.filter(fav => folderIds.includes(fav.folder));
            } else {
                // It's a folder
                filteredFavorites = this.favorites.filter(fav => fav.folder === this.currentFavTab);
            }
        }
        
        // Render Favorites
        if (filteredFavorites.length === 0) {
            favList.innerHTML = `<div class="list-item"><div class="list-content"><div class="list-subtitle">No favorites in this category</div></div></div>`;
        } else {
            favList.innerHTML = filteredFavorites.map(fav => `
                <div class="list-item favorite-item" data-id="${fav.id}">
                    <div class="list-content">
                        <div class="list-title">${fav.route} <span class="badge badge-primary">To ${fav.dest || '...'}</span></div>
                        <div class="list-subtitle">${fav.stopName} ${this.getFolderTimeslotLabel(fav.folder) ? `<span class="badge">${this.getFolderTimeslotLabel(fav.folder)}</span>` : ''}</div>
                    </div>
                    <div class="list-trailing">
                        ▶
                    </div>
                </div>
            `).join('');
            
            // Add click listeners
            favList.querySelectorAll('.favorite-item').forEach(el => {
                el.addEventListener('click', async () => {
                    const favId = el.dataset.id;
                    const fav = this.favorites.find(f => f.id === favId);
                    if (fav) {
                        // Find the variant for this favorite
                        const variants = await API.getRouteVariants(fav.route);
                        const variant = variants.find(v => (v.dest_tc === fav.dest || v.dest_en === fav.dest));
                        if (variant) {
                            await this.openRouteDetails(variant);
                            // After loading, expand the specific stop
                            setTimeout(() => {
                                const stopEl = document.querySelector(`[data-stop-id="${fav.stopId}"]`);
                                if (stopEl) {
                                    stopEl.classList.add('expanded');
                                    const detailsEl = stopEl.querySelector('.stop-details');
                                    const seq = parseInt(stopEl.dataset.seq);
                                    if (detailsEl) {
                                        this.renderStopEta({stop: fav.stopId, seq: seq}, variant, `details-${fav.stopId}-${seq}`);
                                    }
                                }
                            }, 500); // Small delay to allow stops to load
                        }
                    }
                });
            });
        }

        // Render Recent
        const recents = await Storage.getRecentSearches() || [];
        if (recents.length === 0) {
            recentList.innerHTML = `<div class="list-item"><div class="list-content"><div class="list-subtitle">No recent searches</div></div></div>`;
        } else {
            recentList.innerHTML = recents.slice(0, 5).map(r => `
                <div class="list-item recent-item" data-route="${r.route}">
                    <div class="list-content">
                        <div class="list-title">${r.route}</div>
                        <div class="list-subtitle">Last viewed: ${new Date(r.searchedAt).toLocaleDateString()}</div>
                    </div>
                </div>
            `).join('');

            recentList.querySelectorAll('.recent-item').forEach(el => {
                el.addEventListener('click', () => {
                    this.navigateTo('view-search');
                    this.performSearch(el.dataset.route);
                });
            });
        }
    }

    // --- SEARCH VIEW ---
    setupSearch() {
        const input = document.getElementById('route-search-input');
        input.addEventListener('input', (e) => {
            clearTimeout(this.searchDebounce);
            this.searchDebounce = setTimeout(() => {
                this.performSearch(e.target.value);
            }, 500);
        });
    }

    setupFavorites() {
        const favTabs = document.querySelectorAll('[data-fav-tab]');
        favTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                // Update active tab
                document.querySelectorAll('[data-fav-tab]').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                
                // Update current tab and re-render
                this.currentFavTab = tab.dataset.favTab;
                this.renderHome();
            });
        });
    }

    setupDarkMode() {
        // Check saved preference and apply dark mode
        if (localStorage.getItem('theme') === 'dark') {
            document.body.classList.add('dark-mode');
        }
    }

    getTimeLabel(time) {
        if (!time) return '';
        
        // First try to find it as a timeslot ID
        const timeslot = this.timeslots.find(slot => slot.id === time);
        if (timeslot) return timeslot.name;
        
        // Fallback to old labels for backward compatibility
        const labels = {
            morning: '🌅 Morning',
            afternoon: '☀️ Afternoon', 
            evening: '🌙 Evening'
        };
        return labels[time] || time;
    }

    getFolderTimeslotLabel(folderId) {
        if (!folderId) return '';
        
        const folder = this.folders.find(f => f.id === folderId);
        if (folder && folder.timeslotId) {
            return this.getTimeLabel(folder.timeslotId);
        }
        
        return '';
    }

    async addToFavourites(data) {
        const { stopId, route, dest, stopName } = data;
        
        // Check if already exists
        const existing = this.favorites.find(f => f.stopId === stopId && f.route === route);
        if (existing) {
            this.showModal({
                title: 'Already Added',
                message: 'This stop is already in your favourites.',
                confirmText: 'OK'
            });
            return;
        }

        // Create favourite object
        const favourite = {
            id: `${route}-${stopId}-${Date.now()}`,
            route: route,
            dest: dest,
            stopId: stopId,
            stopName: stopName,
            preferredTime: '' // Default to no specific timeslot
        };

        // Add to favourites
        this.favorites.push(favourite);
        await Storage.saveFavorites(this.favorites);
        
        // Refresh home view
        this.renderHome();
        
        // Notify options page to refresh
        chrome.runtime.sendMessage({ action: 'refreshFavourites' });
        
        console.log('Added to favourites:', favourite);
    }

    async performSearch(query) {
        const container = document.getElementById('search-results');
        if (!query || query.length < 1) {
            container.innerHTML = '';
            return;
        }

        container.innerHTML = '<div class="text-center" style="padding:20px;">Searching...</div>';

        try {
            // 1. Search for routes matching query
             // Use exact match or starts with for number
            const routes = await API.searchRoutes(query);
            
            if (routes.length === 0) {
                container.innerHTML = '<div class="text-center p-4">No routes found</div>';
                return;
            }

            // 2. Fetch variants for unique routes found
            // Clear current "Searching..." text before appending results
            container.innerHTML = '';
            
            const variantsMap = new Map();
            for (const routeObj of routes.slice(0, 5)) {
                 if (!variantsMap.has(routeObj.route)) {
                    variantsMap.set(routeObj.route, true);
                    const variants = await API.getRouteVariants(routeObj.route);
                    
                    // Render each variant
                    variants.forEach(variant => {
                        const el = document.createElement('div');
                        el.className = 'eta-card';
                        el.style.cursor = 'pointer';
                        el.style.display = 'flex';
                        el.style.justifyContent = 'space-between';
                        el.style.alignItems = 'center';
                        
                        // Modified layout: Route No on left, Destination on right
                        el.innerHTML = `
                            <div style="font-size: 18px; font-weight: 600; color: var(--text-primary);">${variant.route}</div>
                            <div style="text-align: right;">
                                <div style="font-size: 14px; color: var(--text-primary); font-weight: 500;">To ${variant.dest_tc || variant.dest_en}</div>
                                <div style="font-size: 11px; color: var(--text-secondary);">From ${variant.orig_tc || variant.orig_en}</div>
                            </div>
                        `;
                        el.addEventListener('click', () => {
                            this.openRouteDetails(variant);
                        });
                        container.appendChild(el);
                    });
                 }
            }

        } catch (e) {
            console.error("Search error", e);
            container.innerHTML = `<div class="text-center text-danger">Error searching: ${e.message}</div>`;
        }
    }

    // --- DETAILS VIEW ---
    async openRouteDetails(variant) {
        // Navigate
        this.navigateTo('view-details');
        this.currentVariant = variant;
        
        // Update Header
        document.getElementById('detail-route-no').textContent = variant.route;
        document.getElementById('detail-route-dest').textContent = `To ${variant.dest_tc || variant.dest_en}`;
        
        // Load Stops
        this.loadStopsList(variant);
    }

    async loadStopsList(variant) {
        const container = document.getElementById('stops-container');
        container.innerHTML = '<div class="text-center p-4">Loading stops...</div>';
        
        // Reset cached ETA data
        this.routeEtaData = null;

        try {
            // Fetch stops first to render UI quickly
            const stops = await API.getRouteStops(variant.route, variant.bound, variant.service_type);
            
            if (stops.length === 0) {
                container.innerHTML = '<div class="text-center p-4">No stops found</div>';
                return;
            }
            
            // Start fetching Route ETA in background immediately
            this.fetchRouteEtaInBackground(variant);

            container.innerHTML = `<div class="timeline" style="margin-left: 8px;"></div>`;
            const timeline = container.querySelector('.timeline');

            stops.forEach((stop, index) => {
                const stopEl = document.createElement('div');
                stopEl.className = 'stop-row';
                // Store both seq and stopId for matching
                stopEl.dataset.stopId = stop.stop;
                stopEl.dataset.seq = stop.seq;
                
                // New Expandable Layout
                stopEl.innerHTML = `
                    <div class="stop-header">
                        <div class="stop-dot"></div>
                        <div class="stop-name">${stop.stopInfo?.name_tc || stop.stopInfo?.name_en || stop.stop}</div>
                        <div class="stop-actions">
                            <button class="fav-btn" data-stop-id="${stop.stop}" data-route="${variant.route}" data-dest="${variant.dest_tc || variant.dest_en}" data-stop-name="${stop.stopInfo?.name_tc || stop.stopInfo?.name_en || stop.stop}" title="Add to favourites">☆</button>
                            <div class="expand-icon">▼</div>
                        </div>
                    </div>
                    <div class="stop-details" id="details-${stop.stop}-${stop.seq}">
                        <!-- ETA will load here -->
                    </div>
                `;
                
                // Click header to toggle expand
                const header = stopEl.querySelector('.stop-header');
                header.addEventListener('click', (e) => {
                    // Don't expand if clicking on the favourite button
                    if (e.target.classList.contains('fav-btn')) return;
                    
                    const isExpanded = stopEl.classList.contains('expanded');
                    
                    if (isExpanded) {
                        stopEl.classList.remove('expanded');
                    } else {
                        stopEl.classList.add('expanded');
                        // Load ETA from cache or wait
                        this.renderStopEta(stop, variant, `details-${stop.stop}-${stop.seq}`);
                    }
                });

                // Favourite button
                const favBtn = stopEl.querySelector('.fav-btn');
                favBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    await this.addToFavourites(favBtn.dataset);
                    favBtn.textContent = '★'; // Filled star
                    favBtn.style.color = 'var(--primary-color)';
                    setTimeout(() => {
                        favBtn.textContent = '☆';
                        favBtn.style.color = '';
                    }, 1000);
                });

                timeline.appendChild(stopEl);
            });

            // Save to history
            Storage.addRecentSearch(variant.route, variant).catch(console.error);

        } catch (e) {
            container.innerHTML = `<div class="text-center text-danger">Error loading stops</div>`;
            console.error(e);
        }
    }
    
    // Background fetch for all ETAs
    async fetchRouteEtaInBackground(variant) {
        // Clear existing interval if any
        this.clearEtaIntervals();

        const fetchFn = async () => {
            try {
                // If this is a refresh (interval), we might not want to clear data immediately to avoid flicker
                // But for simplicity, we update the data source and trigger re-renders
                
                const data = await API.getRouteETA(variant.route, variant.service_type);
                if(data) {
                    const bound = variant.bound; 
                    const relevantData = data.filter(item => item.dir === bound);
                    
                    this.routeEtaData = new Map();
                    relevantData.forEach(item => {
                        if(!this.routeEtaData.has(item.seq)) {
                            this.routeEtaData.set(item.seq, []);
                        }
                        this.routeEtaData.get(item.seq).push(item);
                    });
                    
                    this.routeEtaData.forEach(list => {
                        list.sort((a, b) => new Date(a.eta) - new Date(b.eta));
                    });
                    
                    // Trigger UI Refresh for expanded rows
                    document.querySelectorAll('.stop-row.expanded').forEach(row => {
                        const stopId = row.dataset.stopId;
                        const seq = parseInt(row.dataset.seq);
                        this.renderStopEta({stop: stopId, seq: seq}, variant, `details-${stopId}-${seq}`);
                    });
                }
            } catch(e) {
                console.error("Background ETA fetch failed", e);
                // Don't overwrite with error if we had data before (keep stale data on error)
                if(!this.routeEtaData) this.routeEtaData = "error"; 
            }
        };

        // Initial fetch
        await fetchFn();

        // Check if auto-refresh is enabled
        const isAutoRefresh = localStorage.getItem('autoRefresh') !== 'false';
        
        if (isAutoRefresh) {
            // Set Interval for 30s
            const intervalId = setInterval(fetchFn, 30000);
            this.activeEtaIntervals.push(intervalId);
        }
    }

    async renderStopEta(stop, variant, elementId) {
        const el = document.getElementById(elementId);
        if(!el) return;
        
        // If data not ready yet
        if (!this.routeEtaData) {
            el.innerHTML = `
                <div class="loading-container">
                    <div class="spinner"></div>
                    <span>Loading real-time data...</span>
                </div>`;
            return;
        }
        
        if (this.routeEtaData === "error") {
            el.innerHTML = '<div class="text-danger small" style="padding:8px;">Error loading data</div>';
            return;
        }
        
        // Data is ready, look up by valid key (Sequence is safest for Route ETA endpoint)
        // Ensure seq is number
        const seq = parseInt(stop.seq);
        const etas = this.routeEtaData.get(seq) || [];
        
        if (etas.length > 0) {
            el.innerHTML = etas.map(e => {
                const formatted = API.formatETA(e.eta);
                return `
                <div class="eta-item">
                    <div class="eta-main">
                        <span class="eta-time-large">${formatted.text || 'N/A'}</span>
                        <span class="text-secondary small" style="margin-left: 6px;">(${formatted.time})</span>
                    </div>
                    ${e.rmk_tc ? `<div class="eta-remark">${e.rmk_tc}</div>` : ''}
                </div>
            `}).join('');
        } else {
            el.innerHTML = '<div class="text-secondary small" style="padding:8px;">No scheduled bus</div>';
        }
    }
    
    // Legacy single loader removed.

    clearEtaIntervals() {
        this.activeEtaIntervals.forEach(i => clearInterval(i));
        this.activeEtaIntervals = [];
    }

    // --- MODAL UTILS ---
    showModal({ title, message, confirmText = 'OK', cancelText = 'Cancel', confirmStyle = 'primary', onConfirm }) {
        const modal = document.getElementById('app-modal');
        const titleEl = document.getElementById('modal-title');
        const msgEl = document.getElementById('modal-message');
        const actionsEl = document.getElementById('modal-actions');
        
        if (!modal) return;
        
        titleEl.textContent = title;
        msgEl.textContent = message;
        actionsEl.innerHTML = ''; // Clear previous buttons
        
        // Cancel Button (only if onConfirm is provided, implies choice)
        if (onConfirm) {
            const cancelBtn = document.createElement('button');
            cancelBtn.className = 'modal-btn';
            cancelBtn.textContent = cancelText;
            cancelBtn.addEventListener('click', () => {
                modal.classList.remove('active');
                setTimeout(() => modal.classList.add('hidden'), 200);
            });
            actionsEl.appendChild(cancelBtn);
        }
        
        // Confirm Button
        const confirmBtn = document.createElement('button');
        confirmBtn.className = `modal-btn bold ${confirmStyle === 'danger' ? 'danger' : ''}`;
        confirmBtn.textContent = confirmText;
        confirmBtn.addEventListener('click', () => {
            modal.classList.remove('active');
            setTimeout(() => modal.classList.add('hidden'), 200);
            if (onConfirm) onConfirm();
        });
        actionsEl.appendChild(confirmBtn);
        
        // Show
        modal.classList.remove('hidden');
        // Small delay to allow CSS transition to catch the "no hidden" state
        requestAnimationFrame(() => {
            modal.classList.add('active');
        });
    }



    setupSettings() {
        document.getElementById('clear-data-btn').addEventListener('click', async () => {
            this.showModal({
                title: 'Reset All Data',
                message: 'Are you sure you want to reset all data? This cannot be undone.',
                confirmText: 'Reset',
                confirmStyle: 'danger',
                onConfirm: async () => {
                   await chrome.storage.local.clear();
                   location.reload();
                }
            });
        });

        // Dark Mode Toggle Logic
        const darkModeToggle = document.getElementById('setting-dark-mode');
        // Check saved preference
        if (localStorage.getItem('theme') === 'dark') {
            darkModeToggle.checked = true;
            document.body.classList.add('dark-mode');
        }

        darkModeToggle.addEventListener('change', (e) => {
            if (e.target.checked) {
                document.body.classList.add('dark-mode');
                localStorage.setItem('theme', 'dark');
            } else {
                document.body.classList.remove('dark-mode');
                localStorage.setItem('theme', 'light');
            }
        });

        // Auto Refresh Toggle Logic
        const autoRefreshToggle = document.getElementById('setting-auto-refresh');
        // Check saved preference (default true)
        const savedAutoRefresh = localStorage.getItem('autoRefresh');
        if (savedAutoRefresh === 'false') {
             autoRefreshToggle.checked = false;
        }

        autoRefreshToggle.addEventListener('change', (e) => {
             localStorage.setItem('autoRefresh', e.target.checked);
        });
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});

// Listen for messages from options page to refresh favourites and folders
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if ((message.action === 'refreshFavourites' || message.action === 'refreshFolders' || message.action === 'refreshTimeslots') && window.app) {
        window.app.loadData().then(() => {
            window.app.renderHome();
        });
    }
});
