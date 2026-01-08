// EasyETA Side Panel Logic
// Redesigned App-like Experience

class App {
    constructor() {
        this.currentView = 'view-home';
        this.favorites = [];
        this.folders = [];
        this.searchDebounce = null;
        this.activeEtaIntervals = []; // To clear intervals when leaving view
        this.currentFavTab = 'all'; // Current favorite tab
        this.editFavorite = null; // For editing existing favorites
        
        this.init();
    }

    async init() {
        this.setupNavigation();
        this.setupSearch();
        this.setupFavorites();
        this.setupSectionToggles();
        this.setupDarkMode();
        await this.loadData();
        this.renderHome();
    }

    async loadData() {
        try {
            this.favorites = await Storage.getFavorites() || [];
            this.folders = await Storage.getFolders() || [];
            
            // Check if we're editing a favorite
            const editData = await chrome.storage.local.get('editFavorite');
            if (editData.editFavorite) {
                this.editFavorite = editData.editFavorite;
                // Clear the edit data
                await chrome.storage.local.remove('editFavorite');
                // Navigate to search to allow editing
                this.navigateTo('view-search');
            }
            
            // Pre-warm cache if needed
        } catch (e) {
            console.error("Load data error", e);
        }
    }

    getFolderTimeslotLabel(folderId) {
        if (!folderId) return '';
        const folder = this.folders.find(f => f.id === folderId);
        if (!folder || !folder.timeslot) return '';
        
        if (folder.timeslot.perday) {
            // For per-day, show current day's time if available
            const now = new Date();
            const currentDay = now.toLocaleDateString('en', { weekday: 'long' }).toLowerCase();
            const dayTimes = folder.timeslot.perday[currentDay];
            if (dayTimes) {
                return `${dayTimes.start}-${dayTimes.end}`;
            }
            return 'Per-day';
        } else {
            return `${folder.timeslot.startTime}-${folder.timeslot.endTime}`;
        }
    }

    getCurrentActiveFolders() {
        const now = new Date();
        const currentDay = now.toLocaleDateString('en', { weekday: 'long' }).toLowerCase(); // 'monday', etc.
        const currentTime = now.toTimeString().slice(0, 5); // HH:MM

        const activeFolders = this.folders.filter(folder => {
            if (!folder.timeslot) return false;
            if (folder.timeslot.perday) {
                const dayTimes = folder.timeslot.perday[currentDay];
                if (!dayTimes) return false;
                return currentTime >= dayTimes.start && currentTime <= dayTimes.end;
            } else if (folder.timeslot.days) {
                if (!folder.timeslot.days.includes(currentDay)) return false;
                return currentTime >= folder.timeslot.startTime && currentTime <= folder.timeslot.endTime;
            }
            return false;
        });

        // Sort by priority (lower number = higher priority)
        return activeFolders.sort((a, b) => (a.priority || 999) - (b.priority || 999));
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

        // Handle edit mode for search view
        if (viewId === 'view-search' && this.editFavorite) {
            // Pre-populate search with current favorite data
            const searchInput = document.getElementById('route-search-input');
            if (searchInput) {
                searchInput.value = this.editFavorite.route;
                // Trigger search
                this.performSearch(this.editFavorite.route);
            }
        }

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
        
        const activeFolders = this.getCurrentActiveFolders();
        let tabs;
        if (activeFolders.length > 0) {
            tabs = activeFolders.map(folder => ({ id: folder.id, name: folder.name, icon: '📁', color: folder.color }));
        } else {
            tabs = [{ id: 'all', name: 'All Favorites', icon: '🕐' }];
        }
        
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
        
        // Ensure currentFavTab is valid
        const currentActiveFolders = this.getCurrentActiveFolders();
        const validTabs = currentActiveFolders.length > 0 ? currentActiveFolders.map(f => f.id) : ['all'];
        if (!validTabs.includes(this.currentFavTab)) {
            this.currentFavTab = validTabs[0];
        }
        
        const favList = document.getElementById('favorites-list');
        const recentList = document.getElementById('recent-list');
        
        // Filter favorites by current tab
        let filteredFavorites = this.favorites;
        if (this.currentFavTab !== 'all') {
            // It's a folder
            filteredFavorites = this.favorites.filter(fav => fav.folder === this.currentFavTab);
        }
        
        // Render Favorites
        if (filteredFavorites.length === 0) {
            favList.innerHTML = `<div class="list-item"><div class="list-content"><div class="list-subtitle">No favorites in this category</div></div></div>`;
        } else {
            // Render favorites with ETA data
            const favoritePromises = filteredFavorites.map(async (fav) => {
                let etaData = [];
                try {
                    // Get ETA data for this specific stop and route
                    etaData = await API.getStopRouteETA(fav.stopId, fav.route, '1');
                } catch (error) {
                    console.warn(`Failed to get ETA for ${fav.route} at ${fav.stopId}:`, error);
                }

                // Format ETA display
                let etaLines = [];
                if (etaData.length === 0) {
                    etaLines = [{ text: '*', isScheduled: true }];
                } else {
                    etaLines = etaData.slice(0, 3).map((eta) => {
                        const etaText = eta.formatted?.display || '*';
                        const isScheduled = etaText === '*' || !eta.eta;
                        // Show remarks if they exist and are not "scheduled bus"
                        let displayText = etaText;
                        if (eta.rmk_tc && eta.rmk_tc !== '預定班次' && eta.rmk_tc !== 'scheduled bus') {
                            displayText = `${etaText} (${eta.rmk_tc})`;
                        }
                        return { text: displayText, isScheduled };
                    });
                }

                return `
                    <div class="list-item favorite-item" data-id="${fav.id}">
                        <div class="list-content">
                            <div class="list-title">${fav.route} <span class="badge badge-primary">To ${fav.dest || '...'}</span></div>
                            <div class="list-subtitle">${fav.stopName}</div>
                        </div>
                        <div class="eta-column">
                            ${etaLines.map(line => `<div class="eta-line${line.isScheduled ? ' scheduled' : ''}">${line.text}</div>`).join('')}
                        </div>
                    </div>
                `;
            });

            // Wait for all ETA data to be fetched
            const favoriteHtmls = await Promise.all(favoritePromises);
            favList.innerHTML = favoriteHtmls.join('');
            
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
        const recentSectionTitle = document.querySelector('.section-title[data-section="recent"]');
        const isRecentExpanded = recentSectionTitle.classList.contains('expanded');
        
        if (recents.length === 0) {
            recentList.innerHTML = `<div class="list-item"><div class="list-content"><div class="list-subtitle">No recent searches</div></div></div>`;
        } else {
            // Show all recents if expanded, otherwise show first 3
            const displayCount = isRecentExpanded ? recents.length : 3;
            recentList.innerHTML = recents.slice(0, displayCount).map(r => `
                <div class="list-item recent-item" data-route="${r.route}">
                    <div class="list-content">
                        <div class="list-title">${r.route}</div>
                        <div class="list-subtitle">Last viewed: ${new Date(r.searchedAt).toLocaleDateString()}</div>
                    </div>
                </div>
            `).join('');

            // Add "Show more" button if there are more items and not expanded
            if (!isRecentExpanded && recents.length > 3) {
                recentList.innerHTML += `
                    <div class="list-item show-more-item">
                        <div class="list-content">
                            <div class="list-subtitle">Show ${recents.length - 3} more...</div>
                        </div>
                    </div>
                `;
            }

            recentList.querySelectorAll('.recent-item').forEach(el => {
                el.addEventListener('click', () => {
                    this.navigateTo('view-search');
                    this.performSearch(el.dataset.route);
                });
            });

            // Add click handler for show more
            const showMoreItem = recentList.querySelector('.show-more-item');
            if (showMoreItem) {
                showMoreItem.addEventListener('click', () => {
                    recentSectionTitle.classList.add('expanded');
                    this.renderHome(); // Re-render to show expanded state
                });
            }
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

    setupSectionToggles() {
        const sectionTitles = document.querySelectorAll('.section-title[data-section]');
        sectionTitles.forEach(title => {
            title.addEventListener('click', () => {
                const section = title.dataset.section;
                const isExpanded = title.classList.contains('expanded');
                
                if (isExpanded) {
                    title.classList.remove('expanded');
                } else {
                    title.classList.add('expanded');
                }
                
                // Re-render home to update the display
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
        if (folder && folder.timeslot) {
            if (folder.timeslot.perday) {
                return `Per-day: ${Object.entries(folder.timeslot.perday).map(([day, times]) => `${day.slice(0,3)}:${times.start}-${times.end}`).join(', ')}`;
            } else if (folder.timeslot.days) {
                return `${folder.timeslot.days.join(',')} ${folder.timeslot.startTime}-${folder.timeslot.endTime}`;
            }
        }
        
        return '';
    }

    async addToFavourites(data) {
        if (!data || typeof data !== 'object') {
            console.error('Invalid data passed to addToFavourites:', data);
            return;
        }

        const { stopId, route, dest, stopName } = data;
        
        if (!stopId || !route) {
            console.error('Missing required data in addToFavourites:', data);
            return;
        }
        
        // Check if already exists (but allow if we're editing the same one)
        const existing = this.favorites.find(f => f.stopId === stopId && f.route === route);
        if (existing && (!this.editFavorite || existing.id !== this.editFavorite.id)) {
            this.showModal({
                title: 'Already Added',
                message: 'This stop is already in your favourites.',
                confirmText: 'OK'
            });
            return;
        }

        if (this.editFavorite) {
            // Update existing favorite
            const index = this.favorites.findIndex(f => f.id === this.editFavorite.id);
            if (index !== -1) {
                this.favorites[index] = {
                    ...this.favorites[index],
                    route: route,
                    dest: dest,
                    stopId: stopId,
                    stopName: stopName
                };
                await Storage.saveFavorites(this.favorites);
                
                this.showModal({
                    title: 'Updated',
                    message: 'Favorite has been updated successfully.',
                    confirmText: 'OK'
                });
                
                // Clear edit mode
                this.editFavorite = null;
                
                // Refresh home view
                this.renderHome();
                
                // Notify options page to refresh
                chrome.runtime.sendMessage({ action: 'refreshFavourites' });
            }
        } else {
            // Show folder selection modal
            this.showFolderSelectionModal(data, async (selectedFolderId) => {
                // Create favourite object
                const favourite = {
                    id: `${route}-${stopId}-${Date.now()}`,
                    route: route,
                    dest: dest,
                    stopId: stopId,
                    stopName: stopName,
                    folder: selectedFolderId // Add folder assignment
                };

                // Add to favourites
                this.favorites.push(favourite);
                await Storage.saveFavorites(this.favorites);
                
                this.showModal({
                    title: 'Added to Favourites',
                    message: selectedFolderId ? 'Stop added to your favourites successfully.' : 'Stop added to unassigned favourites.',
                    confirmText: 'OK'
                });
                
                // Refresh home view
                this.renderHome();
                
                // Notify options page to refresh
                chrome.runtime.sendMessage({ action: 'refreshFavourites' });
            });
        }
    };

    async performSearch(query) {
        const container = document.getElementById('search-results');
        if (!query || query.length < 1) {
            container.innerHTML = '';
            return;
        }

        container.innerHTML = '<div class="text-center" style="padding:20px;">Searching...</div>';

        try {
            // Check if API is available
            if (typeof API === 'undefined' || !API.searchRoutes) {
                throw new Error('API not available');
            }

            // 1. Search for routes matching query
            const routes = await API.searchRoutes(query);
            
            if (!Array.isArray(routes) || routes.length === 0) {
                container.innerHTML = '<div class="text-center p-4">No routes found</div>';
                return;
            }

            // 2. Fetch variants for unique routes found
            // Clear current "Searching..." text before appending results
            container.innerHTML = '';
            
            const variantsMap = new Map();
            for (const routeObj of routes.slice(0, 5)) {
                if (!routeObj || !routeObj.route) continue;
                
                if (!variantsMap.has(routeObj.route)) {
                    variantsMap.set(routeObj.route, true);
                    const variants = await API.getRouteVariants(routeObj.route);
                    
                    // Render each variant
                    if (Array.isArray(variants)) {
                        variants.forEach(variant => {
                            if (!variant) return;
                            
                            const el = document.createElement('div');
                            el.className = 'eta-card';
                            el.style.cursor = 'pointer';
                            el.style.display = 'flex';
                            el.style.justifyContent = 'space-between';
                            el.style.alignItems = 'center';
                            
                            // Modified layout: Route No on left, Destination on right
                            el.innerHTML = `
                                <div style="font-size: 18px; font-weight: 600; color: var(--text-primary);">${variant.route || ''}</div>
                                <div style="text-align: right;">
                                    <div style="font-size: 14px; color: var(--text-primary); font-weight: 500;">To ${variant.dest_tc || variant.dest_en || ''}</div>
                                    <div style="font-size: 11px; color: var(--text-secondary);">From ${variant.orig_tc || variant.orig_en || ''}</div>
                                </div>
                            `;
                            el.addEventListener('click', () => {
                                this.openRouteDetails(variant);
                            });
                            container.appendChild(el);
                        });
                    }
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
                
                // Check if this stop is already a favorite
                const isFavorite = this.favorites.some(fav => fav.stopId === stop.stop && fav.route === variant.route && (fav.dest === variant.dest_tc || fav.dest === variant.dest_en));
                
                // New Expandable Layout
                stopEl.innerHTML = `
                    <div class="stop-header">
                        <div class="stop-dot"></div>
                        <div class="stop-name">${stop.stopInfo?.name_tc || stop.stopInfo?.name_en || stop.stop}</div>
                        <div class="stop-actions">
                            <button class="fav-btn" data-stop-id="${stop.stop}" data-route="${variant.route}" data-dest="${variant.dest_tc || variant.dest_en}" data-stop-name="${stop.stopInfo?.name_tc || stop.stopInfo?.name_en || stop.stop}" title="${isFavorite ? 'Remove from favourites' : 'Add to favourites'}">${isFavorite ? '⭐' : '☆'}</button>
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
                    
                    const isCurrentlyFavorite = this.favorites.some(fav => fav.stopId === favBtn.dataset.stopId && fav.route === favBtn.dataset.route && (fav.dest === favBtn.dataset.dest));
                    
                    if (isCurrentlyFavorite) {
                        // Remove from favorites
                        this.favorites = this.favorites.filter(fav => !(fav.stopId === favBtn.dataset.stopId && fav.route === favBtn.dataset.route && (fav.dest === favBtn.dataset.dest)));
                        await Storage.saveFavorites(this.favorites);
                        favBtn.textContent = '☆';
                        favBtn.title = 'Add to favourites';
                        // Notify popup to refresh
                        chrome.runtime.sendMessage({ action: 'refreshFavourites' });
                    } else {
                        // Add to favorites
                        await this.addToFavourites(favBtn.dataset);
                        favBtn.textContent = '⭐';
                        favBtn.title = 'Remove from favourites';
                    }
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

    showFolderSelectionModal(favoriteData, onFolderSelected) {
        const modal = document.getElementById('app-modal');
        const titleEl = document.getElementById('modal-title');
        const msgEl = document.getElementById('modal-message');
        const actionsEl = document.getElementById('modal-actions');
        
        if (!modal) return;
        
        titleEl.textContent = 'Choose Folder';
        msgEl.innerHTML = '<div style="margin-bottom: 16px;">Select a folder for this favorite:</div>';
        
        // Create folder selection
        const folderSelect = document.createElement('div');
        folderSelect.style.cssText = 'margin-bottom: 16px;';
        
        // Unassigned option
        const unassignedOption = document.createElement('button');
        unassignedOption.className = 'folder-option-btn active';
        unassignedOption.innerHTML = '<span class="folder-icon">📁</span> Unassigned';
        unassignedOption.addEventListener('click', () => {
            document.querySelectorAll('.folder-option-btn').forEach(btn => btn.classList.remove('active'));
            unassignedOption.classList.add('active');
        });
        folderSelect.appendChild(unassignedOption);
        
        // Folder options
        this.folders.forEach(folder => {
            const folderOption = document.createElement('button');
            folderOption.className = 'folder-option-btn';
            folderOption.innerHTML = `<span class="folder-icon">${folder.icon || '📁'}</span> ${folder.name}`;
            folderOption.dataset.folderId = folder.id;
            folderOption.addEventListener('click', () => {
                document.querySelectorAll('.folder-option-btn').forEach(btn => btn.classList.remove('active'));
                folderOption.classList.add('active');
            });
            folderSelect.appendChild(folderOption);
        });
        
        msgEl.appendChild(folderSelect);
        
        actionsEl.innerHTML = ''; // Clear previous buttons
        
        // Cancel Button
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'modal-btn';
        cancelBtn.textContent = 'Cancel';
        cancelBtn.addEventListener('click', () => {
            modal.classList.remove('active');
            setTimeout(() => modal.classList.add('hidden'), 200);
        });
        actionsEl.appendChild(cancelBtn);
        
        // Add Button
        const addBtn = document.createElement('button');
        addBtn.className = 'modal-btn bold primary';
        addBtn.textContent = 'Add Favorite';
        addBtn.addEventListener('click', () => {
            const selectedFolderBtn = document.querySelector('.folder-option-btn.active');
            let selectedFolderId = null;
            
            if (selectedFolderBtn && selectedFolderBtn.dataset.folderId) {
                selectedFolderId = selectedFolderBtn.dataset.folderId;
            }
            
            modal.classList.remove('active');
            setTimeout(() => modal.classList.add('hidden'), 200);
            onFolderSelected(selectedFolderId);
        });
        actionsEl.appendChild(addBtn);
        
        // Show
        modal.classList.remove('hidden');
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
    if ((message.action === 'refreshFavourites' || message.action === 'refreshFolders') && window.app) {
        window.app.loadData().then(() => {
            window.app.renderHome();
        });
    }
});
