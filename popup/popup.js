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
        this.searchMode = 'route'; // 'route' or 'stop'
        this.stopSearchTimeout = null;
        this.autocompleteData = []; // cached stop autocomplete data

        this.init();
    }

    async init() {
        await I18n.init();
        this.setupNavigation();
        this.setupSearch();
        this.setupSearchModeToggle();
        this.setupAutocomplete();
        this.setupFavorites();
        this.setupSectionToggles();
        this.setupSettings();
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
                    this.navigateTo('view-settings');
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
            tabs = activeFolders.map(folder => ({ id: folder.id, name: folder.name, icon: '<svg class="icon icon-xs" viewBox="0 0 24 24"><use href="../icons/sprite.svg#icon-folder"/></svg>', color: folder.color }));
        } else {
            tabs = [{ id: 'all', name: I18n.t('home.all_favorites'), icon: '<svg class="icon icon-xs" viewBox="0 0 24 24"><use href="../icons/sprite.svg#icon-clock"/></svg>' }];
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
            favList.innerHTML = `<div class="list-item"><div class="list-content"><div class="list-subtitle">${I18n.t('home.no_favorites')}</div></div></div>`;
        } else {
            // Render favorites with ETA data
            const favoritePromises = filteredFavorites.map(async (fav) => {
                let etaData = [];
                try {
                    // Get ETA data for this specific stop and route
                    etaData = await API.getStopRouteETA(fav.stopId, fav.route, '1', fav.provider || null);
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
                            <div class="list-title">${fav.route} <span class="badge badge-primary">${I18n.t('details.to', {dest: fav.dest || '...'})}</span></div>
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
                            }, 500);
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
            recentList.innerHTML = `<div class="list-item"><div class="list-content"><div class="list-subtitle">${I18n.t('home.no_recent')}</div></div></div>`;
        } else {
            // Show all recents if expanded, otherwise show first 3
            const displayCount = isRecentExpanded ? recents.length : 3;
            recentList.innerHTML = recents.slice(0, displayCount).map(r => `
                <div class="list-item recent-item" data-route="${r.route}">
                    <div class="list-content">
                        <div class="list-title">${r.route}</div>
                        <div class="list-subtitle">${I18n.t('home.last_viewed', {date: new Date(r.searchedAt).toLocaleDateString()})}</div>
                    </div>
                </div>
            `).join('');

            // Add "Show more" button if there are more items and not expanded
            if (!isRecentExpanded && recents.length > 3) {
                recentList.innerHTML += `
                    <div class="list-item show-more-item">
                        <div class="list-content">
                            <div class="list-subtitle">${I18n.t('home.show_more', {count: recents.length - 3})}</div>
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
                    this.renderHome();
                });
            }
        }
    }

    // --- SEARCH VIEW ---
    setupSearchModeToggle() {
        const toggle = document.getElementById('search-mode-toggle');
        if (!toggle) return;
        toggle.addEventListener('click', (e) => {
            const btn = e.target.closest('.search-mode-btn');
            if (!btn) return;
            toggle.querySelectorAll('.search-mode-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            this.searchMode = btn.dataset.mode;
            const input = document.getElementById('route-search-input');
            if (this.searchMode === 'stop') {
                input.dataset.i18nPlaceholder = 'search.placeholder_stop';
                input.placeholder = I18n.t('search.placeholder_stop');
            } else {
                input.dataset.i18nPlaceholder = 'search.placeholder';
                input.placeholder = I18n.t('search.placeholder');
            }
            document.getElementById('search-results').innerHTML = '';
            document.getElementById('autocomplete-dropdown').style.display = 'none';
            input.value = '';
            input.focus();
        });
    }

    setupSearch() {
        const input = document.getElementById('route-search-input');
        input.addEventListener('input', (e) => {
            clearTimeout(this.searchDebounce);
            this.searchDebounce = setTimeout(() => {
                this.performSearch(e.target.value);
            }, this.searchMode === 'stop' ? 300 : 500);
        });
    }

    setupAutocomplete() {
        const input = document.getElementById('route-search-input');
        const dropdown = document.getElementById('autocomplete-dropdown');

        input.addEventListener('input', () => {
            this.handleAutocomplete();
        });

        input.addEventListener('blur', () => {
            setTimeout(() => {
                dropdown.style.display = 'none';
            }, 200);
        });

        input.addEventListener('focus', () => {
            if (dropdown.children.length > 0) {
                dropdown.style.display = 'block';
            }
        });
    }

    async handleAutocomplete() {
        const input = document.getElementById('route-search-input');
        const dropdown = document.getElementById('autocomplete-dropdown');
        const query = input.value.trim();

        if (!query || query.length < 2) {
            dropdown.style.display = 'none';
            return;
        }

        clearTimeout(this.stopSearchTimeout);
        this.stopSearchTimeout = setTimeout(async () => {
            try {
                if (this.searchMode === 'stop') {
                    const stops = await this.searchStopsByName(query);
                    if (stops.length === 0) {
                        dropdown.style.display = 'none';
                        return;
                    }
                    dropdown.innerHTML = stops.slice(0, 10).map(stop => `
                        <div class="autocomplete-item" data-stop-id="${stop.stop}" data-stop-name="${stop.name_en || stop.stop}" data-stop-name-tc="${stop.name_tc || ''}">
                            <span class="autocomplete-stop-icon">🚏</span>
                            <span class="autocomplete-stop-name">${stop.name_tc || stop.name_en || stop.stop}</span>
                            <span class="autocomplete-route-tag">${stop.stop}</span>
                        </div>
                    `).join('');
                    dropdown.style.display = 'block';

                    dropdown.querySelectorAll('.autocomplete-item').forEach(item => {
                        item.addEventListener('click', () => {
                            const stopId = item.dataset.stopId;
                            const stopName = I18n.getLang() === 'zh-HK' ? item.dataset.stopNameTc || item.dataset.stopName : item.dataset.stopName;
                            input.value = stopName;
                            dropdown.style.display = 'none';
                            this.performStopSearch(stopId, stopName);
                        });
                    });
                } else {
                    if (typeof API !== 'undefined' && API.searchRoutes) {
                        const routes = await API.searchRoutes(query);
                        if (!routes || routes.length === 0) {
                            dropdown.style.display = 'none';
                            return;
                        }
                        dropdown.innerHTML = routes.slice(0, 8).map(r => `
                            <div class="autocomplete-item" data-route="${r.route}">
                                <span class="autocomplete-route">${r.route}</span>
                                <span class="autocomplete-dest">${I18n.t('details.to', {dest: r.dest_tc || r.dest_en || ''})}</span>
                            </div>
                        `).join('');
                        dropdown.style.display = 'block';

                        dropdown.querySelectorAll('.autocomplete-item').forEach(item => {
                            item.addEventListener('click', () => {
                                input.value = item.dataset.route;
                                dropdown.style.display = 'none';
                                this.performSearch(item.dataset.route);
                            });
                        });
                    }
                }
            } catch (e) {
                console.error('Autocomplete error', e);
                dropdown.style.display = 'none';
            }
        }, 200);
    }

    async searchStopsByName(query) {
        const q = query.toLowerCase().trim();
        if (typeof API !== 'undefined' && API.searchStops) {
            try {
                const stops = await API.searchStops(q);
                if (stops && stops.length > 0) return stops;
            } catch (e) {}
        }

        if (this.autocompleteData.length === 0) {
            await this.buildStopCache();
        }

        return this.autocompleteData.filter(stop =>
            (stop.name_en && stop.name_en.toLowerCase().includes(q)) ||
            (stop.name_tc && stop.name_tc.includes(q)) ||
            (stop.stop && stop.stop.includes(q))
        ).slice(0, 20);
    }

    async buildStopCache() {
        try {
            const cached = await chrome.storage.local.get('stopList');
            if (cached.stopList && cached.stopList.data) {
                this.autocompleteData = cached.stopList.data;
                return;
            }
        } catch (_) {}

        try {
            console.log('Building stop cache (this may take a moment)...');
            const allRoutes = await API.getAllRoutes();
            const stopSet = new Map();
            const routesToProcess = allRoutes.slice(0, 50);
            for (const route of routesToProcess) {
                const bound = route.bound === 'O' ? 'outbound' : 'inbound';
                try {
                    const stops = await API.getRouteStops(route.route, bound, route.service_type || '1');
                    stops.forEach(s => {
                        const key = s.stop;
                        if (!stopSet.has(key)) {
                            stopSet.set(key, {
                                stop: s.stop,
                                name_en: s.stopInfo?.name_en || `Stop ${s.stop}`,
                                name_tc: s.stopInfo?.name_tc || `站點 ${s.stop}`
                            });
                        }
                    });
                } catch (_) {}
            }
            this.autocompleteData = Array.from(stopSet.values());
            try {
                await chrome.storage.local.set({ stopList: { data: this.autocompleteData, timestamp: Date.now() } });
            } catch (_) {}
        } catch (e) {
            console.warn('Failed to build stop cache:', e);
            this.autocompleteData = [];
        }
    }

    async performStopSearch(stopId, stopName) {
        const container = document.getElementById('search-results');
        container.innerHTML = `<div class="text-center" style="padding:20px;">${I18n.t('search.searching')}</div>`;

        try {
            const stopEtas = await API.getETA(stopId);
            if (!stopEtas || stopEtas.length === 0) {
                container.innerHTML = `<div class="text-center p-4">${I18n.t('search.no_results_stop')}</div>`;
                return;
            }

            const routeMap = new Map();
            stopEtas.forEach(eta => {
                if (!routeMap.has(eta.route)) {
                    routeMap.set(eta.route, []);
                }
                routeMap.get(eta.route).push(eta);
            });

            container.innerHTML = `<div class="section-title" style="margin-top:0;">🚏 ${stopName} (${stopId})</div>`;
            routeMap.forEach((etas, route) => {
                const card = document.createElement('div');
                card.className = 'eta-card';
                card.style.cursor = 'pointer';
                card.innerHTML = `
                    <div class="eta-header">
                        <span style="font-size:18px;font-weight:600;color:var(--text-primary);">${route}</span>
                        <div class="eta-times">
                            ${etas.slice(0, 3).map(e => {
                                const f = API.formatETA(e.eta);
                                return `<span class="time-display small">${f.text}</span>`;
                            }).join('')}
                        </div>
                    </div>
                `;
                card.addEventListener('click', async () => {
                    const variants = await API.getRouteVariants(route);
                    // For stop search: try KMB first, then CTB
                    let variant = variants.find(v => v._provider === 'kmb') || variants[0] || { route, bound: 'O', service_type: '1' };
                    await this.openRouteDetails(variant);
                    setTimeout(() => {
                        const stopEl = document.querySelector(`[data-stop-id="${stopId}"]`);
                        if (stopEl) {
                            stopEl.classList.add('expanded');
                            const seq = parseInt(stopEl.dataset.seq);
                            this.renderStopEta({stop: stopId, seq: seq}, variant, `details-${stopId}-${seq}`);
                        }
                    }, 500);
                });
                container.appendChild(card);
            });
        } catch (e) {
            container.innerHTML = `<div class="text-center text-danger">${I18n.t('search.error', {message: e.message})}</div>`;
        }
    }

    setupFavorites() {
        const favTabs = document.querySelectorAll('[data-fav-tab]');
        favTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('[data-fav-tab]').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
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

                this.renderHome();
            });
        });
    }

    setupDarkMode() {
        const toggle = document.getElementById('setting-dark-mode');
        if (!toggle) return;

        chrome.storage.sync.get('theme', (result) => {
            const theme = result.theme || 'light';
            if (theme === 'dark') {
                toggle.checked = true;
                document.body.classList.add('dark-mode');
            } else {
                toggle.checked = false;
                document.body.classList.remove('dark-mode');
            }
        });

        toggle.addEventListener('change', (e) => {
            if (e.target.checked) {
                document.body.classList.add('dark-mode');
                chrome.storage.sync.set({ theme: 'dark' });
            } else {
                document.body.classList.remove('dark-mode');
                chrome.storage.sync.set({ theme: 'light' });
            }
        });
    }

    setupLanguage() {
        const select = document.getElementById('setting-lang');
        if (!select) return;

        select.value = I18n.getLang();

        select.addEventListener('change', async () => {
            await I18n.setLang(select.value);
            I18n.applyToDocument(); // Re-translate all static elements
            this.renderFavoriteTabs();
            this.renderHome();
            const input = document.getElementById('route-search-input');
            if (this.searchMode === 'stop') {
                input.placeholder = I18n.t('search.placeholder_stop');
            } else {
                input.placeholder = I18n.t('search.placeholder');
            }
        });

        I18n.onChange(() => {
            select.value = I18n.getLang();
        });
    }

    getTimeLabel(time) {
        if (!time) return '';

        const timeslot = this.timeslots.find(slot => slot.id === time);
        if (timeslot) return timeslot.name;

        const labels = {
            morning: '<svg class="icon icon-xs" viewBox="0 0 24 24"><use href="../icons/sprite.svg#icon-sunrise"/></svg> Morning',
            afternoon: '<svg class="icon icon-xs" viewBox="0 0 24 24"><use href="../icons/sprite.svg#icon-sunny"/></svg> Afternoon',
            evening: '<svg class="icon icon-xs" viewBox="0 0 24 24"><use href="../icons/sprite.svg#icon-moon-phase"/></svg> Evening'
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

        const existing = this.favorites.find(f => f.stopId === stopId && f.route === route);
        if (existing && (!this.editFavorite || existing.id !== this.editFavorite.id)) {
            this.showModal({
                title: I18n.t('fav.exists_title'),
                message: I18n.t('fav.exists_message'),
                confirmText: I18n.t('fav.ok')
            });
            return;
        }

        if (this.editFavorite) {
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
                    title: I18n.t('fav.updated_title'),
                    message: I18n.t('fav.updated_message'),
                    confirmText: I18n.t('fav.ok')
                });

                this.editFavorite = null;
                this.renderHome();
                chrome.runtime.sendMessage({ action: 'refreshFavourites' });
            }
        } else {
            this.showFolderSelectionModal(data, async (selectedFolderId) => {
                const favourite = {
                    id: `${route}-${stopId}-${Date.now()}`,
                    route: route,
                    dest: dest,
                    stopId: stopId,
                    stopName: stopName,
                    folder: selectedFolderId,
                    provider: data._provider || null  // Remember which API this stop belongs to
                };

                this.favorites.push(favourite);
                await Storage.saveFavorites(this.favorites);

                this.showModal({
                    title: I18n.t('fav.add_title'),
                    message: selectedFolderId ? I18n.t('fav.add_message_folder') : I18n.t('fav.add_message'),
                    confirmText: I18n.t('fav.ok')
                });

                this.renderHome();
                chrome.runtime.sendMessage({ action: 'refreshFavourites' });
            });
        }
    };

    async performSearch(query) {
        const container = document.getElementById('search-results');
        const dropdown = document.getElementById('autocomplete-dropdown');
        dropdown.style.display = 'none';

        if (!query || query.length < 1) {
            container.innerHTML = '';
            return;
        }

        if (this.searchMode === 'stop') {
            const stops = await this.searchStopsByName(query);
            if (stops.length > 0) {
                this.performStopSearch(stops[0].stop, stops[0].name_en || stops[0].stop);
            } else {
                container.innerHTML = `<div class="text-center p-4">${I18n.t('search.no_results_stop')}</div>`;
            }
            return;
        }

        container.innerHTML = `<div class="text-center" style="padding:20px;">${I18n.t('search.searching')}</div>`;

        try {
            if (typeof API === 'undefined' || !API.searchRoutes) {
                throw new Error('API not available');
            }

            const routes = await API.searchRoutes(query);

            if (!Array.isArray(routes) || routes.length === 0) {
                container.innerHTML = `<div class="text-center p-4">${I18n.t('search.no_results')}</div>`;
                return;
            }

            container.innerHTML = '';

            const variantsMap = new Map();
            for (const routeObj of routes.slice(0, 5)) {
                if (!routeObj || !routeObj.route) continue;

                if (!variantsMap.has(routeObj.route)) {
                    variantsMap.set(routeObj.route, true);
                    const variants = await API.getRouteVariants(routeObj.route);

                    if (Array.isArray(variants)) {
                        variants.forEach(variant => {
                            if (!variant) return;

                            const el = document.createElement('div');
                            el.className = 'eta-card';
                            el.style.cursor = 'pointer';
                            el.style.display = 'flex';
                            el.style.justifyContent = 'space-between';
                            el.style.alignItems = 'center';

                            // Show provider badge for ambiguous routes (KMB vs CTB)
                            const providerLabel = variant._provider ? (variant._provider === 'ctb' ? 'CTB' : 'KMB') : '';
                            const providerBadge = providerLabel ? `<span style="font-size:10px;padding:1px 5px;border-radius:4px;background:rgba(52,152,219,0.1);color:var(--primary-color);font-weight:600;margin-left:4px;">${providerLabel}</span>` : '';

                            el.innerHTML = `
                                <div style="font-size: 18px; font-weight: 600; color: var(--text-primary);">${variant.route || ''}${providerBadge}</div>
                                <div style="text-align: right;">
                                    <div style="font-size: 14px; color: var(--text-primary); font-weight: 500;">${I18n.t('details.to', {dest: variant.dest_tc || variant.dest_en || ''})}</div>
                                    <div style="font-size: 11px; color: var(--text-secondary);">${I18n.t('details.from', {orig: variant.orig_tc || variant.orig_en || ''})}</div>
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
            container.innerHTML = `<div class="text-center text-danger">${I18n.t('search.error', {message: e.message})}</div>`;
        }
    }

    // --- DETAILS VIEW ---
    async openRouteDetails(variant) {
        this.navigateTo('view-details');
        this.currentVariant = variant;

        document.getElementById('detail-route-no').textContent = variant.route;
        document.getElementById('detail-route-dest').textContent = I18n.t('details.to', {dest: variant.dest_tc || variant.dest_en});

        this.loadStopsList(variant);
    }

    async loadStopsList(variant) {
        const container = document.getElementById('stops-container');
        container.innerHTML = `<div class="text-center p-4">${I18n.t('details.loading')}</div>`;

        this.routeEtaData = null;

        try {
            // Use _provider from variant if available (for ambiguous routes like KMB vs CTB route 1)
            const forceProvider = variant._provider || null;
            const stops = await API.getRouteStops(variant.route, variant.bound, variant.service_type, forceProvider);

            if (stops.length === 0) {
                container.innerHTML = `<div class="text-center p-4">${I18n.t('details.no_stops')}</div>`;
                return;
            }

            this.fetchRouteEtaInBackground(variant);

            container.innerHTML = `<div class="timeline" style="margin-left: 8px;"></div>`;
            const timeline = container.querySelector('.timeline');

            stops.forEach((stop, index) => {
                const stopEl = document.createElement('div');
                stopEl.className = 'stop-row';
                stopEl.dataset.stopId = stop.stop;
                stopEl.dataset.seq = stop.seq;

                const isFavorite = this.favorites.some(fav => fav.stopId === stop.stop && fav.route === variant.route && (fav.dest === variant.dest_tc || fav.dest === variant.dest_en));

                stopEl.innerHTML = `
                    <div class="stop-header">
                        <div class="stop-dot"></div>
                        <div class="stop-name">${stop.stopInfo?.name_tc || stop.stopInfo?.name_en || stop.stop}</div>
                        <div class="stop-actions">
                            <button class="fav-btn" data-stop-id="${stop.stop}" data-route="${variant.route}" data-dest="${variant.dest_tc || variant.dest_en}" data-stop-name="${stop.stopInfo?.name_tc || stop.stopInfo?.name_en || stop.stop}" data-provider="${variant._provider || ''}" title="${isFavorite ? I18n.t('fav.remove') : I18n.t('fav.add')}">${isFavorite ? '<svg class="icon icon-sm" viewBox="0 0 24 24" fill="currentColor"><use href="../icons/sprite.svg#icon-star"/></svg>' : '<svg class="icon icon-sm" viewBox="0 0 24 24"><use href="../icons/sprite.svg#icon-star-empty"/></svg>'}</button>
                            <div class="expand-icon"><svg class="icon icon-xs" viewBox="0 0 24 24"><use href="../icons/sprite.svg#icon-arrow-down"/></svg></div>
                        </div>
                    </div>
                    <div class="stop-details" id="details-${stop.stop}-${stop.seq}">
                    </div>
                `;

                const header = stopEl.querySelector('.stop-header');
                header.addEventListener('click', (e) => {
                    if (e.target.classList.contains('fav-btn')) return;

                    const isExpanded = stopEl.classList.contains('expanded');

                    if (isExpanded) {
                        stopEl.classList.remove('expanded');
                    } else {
                        stopEl.classList.add('expanded');
                        this.renderStopEta(stop, variant, `details-${stop.stop}-${stop.seq}`);
                    }
                });

                const favBtn = stopEl.querySelector('.fav-btn');
                favBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();

                    const isCurrentlyFavorite = this.favorites.some(fav => fav.stopId === favBtn.dataset.stopId && fav.route === favBtn.dataset.route && (fav.dest === favBtn.dataset.dest));

                    if (isCurrentlyFavorite) {
                        this.favorites = this.favorites.filter(fav => !(fav.stopId === favBtn.dataset.stopId && fav.route === favBtn.dataset.route && (fav.dest === favBtn.dataset.dest)));
                        await Storage.saveFavorites(this.favorites);
                        favBtn.innerHTML = '<svg class="icon icon-sm" viewBox="0 0 24 24"><use href="../icons/sprite.svg#icon-star-empty"/></svg>';
                        favBtn.title = I18n.t('fav.add');
                        chrome.runtime.sendMessage({ action: 'refreshFavourites' });
                    } else {
                        await this.addToFavourites(favBtn.dataset);
                        favBtn.innerHTML = '<svg class="icon icon-sm" viewBox="0 0 24 24" fill="currentColor"><use href="../icons/sprite.svg#icon-star"/></svg>';
                        favBtn.title = I18n.t('fav.remove');
                    }
                });

                timeline.appendChild(stopEl);
            });

            Storage.addRecentSearch(variant.route, variant).catch(console.error);

        } catch (e) {
            container.innerHTML = `<div class="text-center text-danger">${I18n.t('details.error_stops')}</div>`;
            console.error(e);
        }
    }

    async fetchRouteEtaInBackground(variant) {
        this.clearEtaIntervals();

        // Use _provider from variant if available (for ambiguous routes)
        const provider = variant._provider || (typeof API._providerForRoute === 'function' ? API._providerForRoute(variant.route) : 'kmb');

        const fetchFn = async () => {
            try {
                if (provider === 'ctb') {
                    // CTB: no bulk ETA endpoint, fetch per-stop when expanded
                    // Store a flag so renderStopEta knows to fetch individually
                    this.routeEtaData = 'ctb';
                    // Re-render any expanded stops with per-stop ETA
                    document.querySelectorAll('.stop-row.expanded').forEach(row => {
                        const stopId = row.dataset.stopId;
                        const seq = parseInt(row.dataset.seq);
                        this.renderStopEta({stop: stopId, seq: seq}, variant, `details-${stopId}-${seq}`);
                    });
                    return;
                }

                const data = await API.getRouteETA(variant.route, variant.service_type, variant._provider || null);
                if(data) {
                    // CTB uses 'outbound'/'inbound' for dir, KMB uses 'O'/'I'
                    const bound = variant.bound;
                    const relevantData = data.filter(item => {
                        if (item.dir === bound) return true;
                        // Normalize: 'outbound' matches 'O', 'inbound' matches 'I'
                        if (bound === 'outbound' && item.dir === 'O') return true;
                        if (bound === 'inbound' && item.dir === 'I') return true;
                        if (bound === 'O' && item.dir === 'outbound') return true;
                        if (bound === 'I' && item.dir === 'inbound') return true;
                        return false;
                    });

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

                    document.querySelectorAll('.stop-row.expanded').forEach(row => {
                        const stopId = row.dataset.stopId;
                        const seq = parseInt(row.dataset.seq);
                        this.renderStopEta({stop: stopId, seq: seq}, variant, `details-${stopId}-${seq}`);
                    });
                }
            } catch(e) {
                console.error("Background ETA fetch failed", e);
                if(!this.routeEtaData) this.routeEtaData = "error";
            }
        };

        await fetchFn();

        const autoRefreshSetting = await chrome.storage.sync.get('autoRefresh');
        const isAutoRefresh = autoRefreshSetting.autoRefresh !== false;

        if (isAutoRefresh) {
            const intervalId = setInterval(fetchFn, 30000);
            this.activeEtaIntervals.push(intervalId);
        }
    }

    async renderStopEta(stop, variant, elementId) {
        const el = document.getElementById(elementId);
        if(!el) return;

        // CTB: fetch per-stop ETA individually
        if (this.routeEtaData === 'ctb') {
            el.innerHTML = `
                <div class="loading-container">
                    <div class="spinner"></div>
                    <span>${I18n.t('details.loading_eta')}</span>
                </div>`;
            try {
                const etas = await API.getStopRouteETA(stop.stop, variant.route, variant.service_type);
                if (etas && etas.length > 0) {
                    el.innerHTML = etas.map(e => {
                        const formatted = API.formatETA(e.eta);
                        return `
                        <div class="eta-item">
                            <div class="eta-main">
                                <span class="eta-time-large">${formatted.text || 'N/A'}</span>
                                <span class="text-secondary small" style="margin-left: 6px;">(${formatted.time})</span>
                            </div>
                            ${e.rmk_tc ? `<div class="eta-remark">${e.rmk_tc}</div>` : ''}
                            ${e.dest_tc ? `<div class="eta-remark">${I18n.t('details.to', {dest: e.dest_tc})}</div>` : ''}
                        </div>
                    `}).join('');
                } else {
                    el.innerHTML = `<div class="text-secondary small" style="padding:8px;">${I18n.t('details.no_scheduled')}</div>`;
                }
            } catch(e) {
                el.innerHTML = `<div class="text-danger small" style="padding:8px;">${I18n.t('details.error_eta')}</div>`;
            }
            return;
        }

        if (!this.routeEtaData) {
            el.innerHTML = `
                <div class="loading-container">
                    <div class="spinner"></div>
                    <span>${I18n.t('details.loading_eta')}</span>
                </div>`;
            return;
        }

        if (this.routeEtaData === "error") {
            el.innerHTML = `<div class="text-danger small" style="padding:8px;">${I18n.t('details.error_eta')}</div>`;
            return;
        }

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
            el.innerHTML = `<div class="text-secondary small" style="padding:8px;">${I18n.t('details.no_scheduled')}</div>`;
        }
    }

    clearEtaIntervals() {
        this.activeEtaIntervals.forEach(i => clearInterval(i));
        this.activeEtaIntervals = [];
    }

    // --- MODAL UTILS ---
    showModal({ title, message, confirmText = I18n.t('modal.confirm'), cancelText = I18n.t('modal.cancel'), confirmStyle = 'primary', onConfirm }) {
        const modal = document.getElementById('app-modal');
        const titleEl = document.getElementById('modal-title');
        const msgEl = document.getElementById('modal-message');
        const actionsEl = document.getElementById('modal-actions');

        if (!modal) return;

        titleEl.textContent = title;
        msgEl.textContent = message;
        actionsEl.innerHTML = '';

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

        const confirmBtn = document.createElement('button');
        confirmBtn.className = `modal-btn bold ${confirmStyle === 'danger' ? 'danger' : ''}`;
        confirmBtn.textContent = confirmText;
        confirmBtn.addEventListener('click', () => {
            modal.classList.remove('active');
            setTimeout(() => modal.classList.add('hidden'), 200);
            if (onConfirm) onConfirm();
        });
        actionsEl.appendChild(confirmBtn);

        modal.classList.remove('hidden');
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

        titleEl.textContent = I18n.t('fav.choose_folder');
        msgEl.innerHTML = `<div style="margin-bottom: 16px;">${I18n.t('fav.select_folder')}</div>`;

        const folderSelect = document.createElement('div');
        folderSelect.style.cssText = 'margin-bottom: 16px;';

        const unassignedOption = document.createElement('button');
        unassignedOption.className = 'folder-option-btn active';
        unassignedOption.innerHTML = `<span class="folder-icon"><svg class="icon icon-sm" viewBox="0 0 24 24"><use href="../icons/sprite.svg#icon-folder"/></svg></span> ${I18n.t('fav.unassigned')}`;
        unassignedOption.addEventListener('click', () => {
            document.querySelectorAll('.folder-option-btn').forEach(btn => btn.classList.remove('active'));
            unassignedOption.classList.add('active');
        });
        folderSelect.appendChild(unassignedOption);

        this.folders.forEach(folder => {
            const folderOption = document.createElement('button');
            folderOption.className = 'folder-option-btn';
            folderOption.innerHTML = `<span class="folder-icon">${folder.icon || '<svg class="icon icon-sm" viewBox="0 0 24 24"><use href="../icons/sprite.svg#icon-folder"/></svg>'}</span> ${folder.name}`;
            folderOption.dataset.folderId = folder.id;
            folderOption.addEventListener('click', () => {
                document.querySelectorAll('.folder-option-btn').forEach(btn => btn.classList.remove('active'));
                folderOption.classList.add('active');
            });
            folderSelect.appendChild(folderOption);
        });

        msgEl.appendChild(folderSelect);

        actionsEl.innerHTML = '';

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'modal-btn';
        cancelBtn.textContent = I18n.t('fav.cancel');
        cancelBtn.addEventListener('click', () => {
            modal.classList.remove('active');
            setTimeout(() => modal.classList.add('hidden'), 200);
        });
        actionsEl.appendChild(cancelBtn);

        const addBtn = document.createElement('button');
        addBtn.className = 'modal-btn bold primary';
        addBtn.textContent = I18n.t('fav.add_favorite');
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

        modal.classList.remove('hidden');
        requestAnimationFrame(() => {
            modal.classList.add('active');
        });
    }

    setupSettings() {
        const clearDataBtn = document.getElementById('clear-data-btn');
        if (clearDataBtn) {
            clearDataBtn.addEventListener('click', async () => {
                this.showModal({
                    title: I18n.t('settings.reset_title'),
                    message: I18n.t('settings.reset_confirm'),
                    confirmText: I18n.t('settings.reset_button'),
                    confirmStyle: 'danger',
                    onConfirm: async () => {
                       await chrome.storage.local.clear();
                       location.reload();
                    }
                });
            });
        }

        // Dark Mode
        const darkModeToggle = document.getElementById('setting-dark-mode');
        if (darkModeToggle) {
            chrome.storage.sync.get('theme', (result) => {
                const theme = result.theme || 'light';
                if (theme === 'dark') {
                    darkModeToggle.checked = true;
                    document.body.classList.add('dark-mode');
                }
            });

            darkModeToggle.addEventListener('change', (e) => {
                if (e.target.checked) {
                    document.body.classList.add('dark-mode');
                    chrome.storage.sync.set({ theme: 'dark' });
                } else {
                    document.body.classList.remove('dark-mode');
                    chrome.storage.sync.set({ theme: 'light' });
                }
            });
        }

        const autoRefreshToggle = document.getElementById('setting-auto-refresh');
        if (autoRefreshToggle) {
            chrome.storage.sync.get('autoRefresh', (result) => {
                const saved = result.autoRefresh;
                if (saved === false) {
                    autoRefreshToggle.checked = false;
                }
            });

            autoRefreshToggle.addEventListener('change', (e) => {
                chrome.storage.sync.set({ autoRefresh: e.target.checked });
            });
        }
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