// EasyETA popup — home / search / route details / settings.

const PROVIDERS = { kmb: 'KMB', ctb: 'CTB', gmb: 'GMB' };
const REFRESH_MS = 30000;

const $ = (id) => document.getElementById(id);

class App {
    constructor() {
        this.favorites = [];
        this.folders = [];
        this.view = 'view-home';
        this.searchMode = 'route';
        this.searchTimer = null;
        this.refreshTimer = null;
        this.variant = null;
        this.stops = [];
        this.etaMap = new Map();
        this.expanded = new Set();
        this.favTab = 'all';
        this.recentExpanded = false;
    }

    async init() {
        await I18n.init();
        this.applyTheme();
        this.bindNav();
        this.bindSearch();
        this.bindHeader();
        this.renderSettings();
        await this.loadData();
        await this.renderHome();
    }

    // ---------- data ----------

    async loadData() {
        this.favorites = (await Storage.getFavorites()) || [];
        this.folders = (await Storage.getFolders()) || [];
    }

    getActiveFolders() {
        const now = new Date();
        const day = now.toLocaleDateString('en', { weekday: 'long' }).toLowerCase();
        const time = now.toTimeString().slice(0, 5);
        return this.folders
            .filter(f => {
                const t = f.timeslot;
                if (!t) return false;
                if (t.perday) {
                    const d = t.perday[day];
                    return !!d && time >= d.start && time <= d.end;
                }
                return (t.days || []).includes(day) && time >= t.startTime && time <= t.endTime;
            })
            .sort((a, b) => (a.priority || 999) - (b.priority || 999));
    }

    variantOfFav(fav) {
        return {
            _provider: fav.provider, route: fav.route, dir: fav.dir,
            service_type: fav.service_type, route_id: fav.route_id, region: fav.region,
            orig_tc: fav.orig_tc, orig_en: fav.orig_en, dest_tc: fav.dest_tc, dest_en: fav.dest_en
        };
    }

    // ---------- chrome ----------

    applyTheme() {
        chrome.storage.sync.get('theme', ({ theme }) => {
            document.body.classList.toggle('dark-mode', theme === 'dark');
        });
    }

    bindNav() {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', () => this.navigate(item.dataset.target));
        });
        document.querySelectorAll('[data-section]').forEach(t => {
            t.addEventListener('click', () => {
                this.recentExpanded = !this.recentExpanded;
                t.classList.toggle('expanded', this.recentExpanded);
                this.renderRecent();
            });
        });
    }

    bindHeader() {
        $('back-btn').addEventListener('click', () => this.navigate('view-home'));
        $('refresh-btn').addEventListener('click', () => this.variant && this.loadStops(this.variant));
    }

    navigate(view) {
        this.view = view;
        document.querySelectorAll('.view').forEach(el => el.classList.toggle('active', el.id === view));
        document.querySelectorAll('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.target === view));

        const detail = view === 'view-details';
        $('back-btn').classList.toggle('hidden', !detail);
        $('refresh-btn').classList.toggle('hidden', !detail);
        $('header-title').classList.toggle('hidden', detail);
        $('header-sub').classList.toggle('hidden', !detail);

        if (!detail) {
            this.stopRefresh();
            $('header-title').textContent = 'EasyETA';
            $('header-sub').textContent = '';
            $('header-sub').classList.remove('visible');
        }
        if (view === 'view-home') this.renderHome();
        if (view === 'view-search') setTimeout(() => $('search-input').focus(), 50);
    }

    // ---------- home ----------

    async renderHome() {
        await this.renderFavTabs();
        await this.renderFavorites();
        this.renderRecent();
    }

    async renderFavTabs() {
        const tabsEl = $('fav-tabs');
        const active = this.getActiveFolders();
        const activeIds = new Set(active.map(f => f.id));

        if (this.folders.length === 0) {
            tabsEl.classList.add('hidden');
            this.favTab = 'all';
            return;
        }

        const ordered = [...active, ...this.folders.filter(f => !activeIds.has(f.id))];
        const tabs = [{ id: 'all', name: I18n.t('home.all_favorites'), active: false }]
            .concat(ordered.map(f => ({ id: f.id, name: f.name, color: f.color, active: activeIds.has(f.id) })));

        if (!tabs.some(t => t.id === this.favTab)) this.favTab = 'all';
        tabsEl.classList.remove('hidden');
        tabsEl.innerHTML = tabs.map(t => `
            <button class="tab-btn ${this.favTab === t.id ? 'active' : ''} ${t.active ? 'is-live' : ''}"
                    data-fav-tab="${t.id}" ${t.color ? `style="--tab-color:${t.color}"` : ''}>
                ${t.active ? '<span class="live-dot"></span>' : ''}${escapeHtml(t.name)}
            </button>`).join('');

        tabsEl.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.favTab = btn.dataset.favTab;
                this.renderHome();
            });
        });
    }

    async renderFavorites() {
        const list = $('favorites-list');
        const favs = this.favTab === 'all'
            ? this.favorites
            : this.favorites.filter(f => f.folder === this.favTab);

        if (favs.length === 0) {
            list.innerHTML = `<div class="empty-state">
                <svg class="icon icon-lg" viewBox="0 0 24 24"><use href="../icons/sprite.svg#icon-bus"/></svg>
                <p>${I18n.t('home.no_favorites')}</p>
                <button class="link-btn" id="empty-search">${I18n.t('home.start_search')}</button>
            </div>`;
            const go = $('empty-search');
            if (go) go.addEventListener('click', () => this.navigate('view-search'));
            return;
        }

        list.innerHTML = favs.map(fav => `
            <div class="list-item fav-row" data-id="${fav.id}">
                <div class="route-badge ${fav.provider}">${escapeHtml(fav.route)}</div>
                <div class="list-content">
                    <div class="list-title">${escapeHtml(localized(fav.dest_tc, fav.dest_en) || fav.dest || '')}</div>
                    <div class="list-subtitle">${escapeHtml(localized(fav.stopNameTc, fav.stopName) || fav.stopName || '')}</div>
                </div>
                <div class="eta-chips" data-eta-for="${fav.id}"><span class="eta-chip muted">···</span></div>
            </div>`).join('');

        list.querySelectorAll('.fav-row').forEach(row => {
            row.addEventListener('click', async () => {
                const fav = this.favorites.find(f => f.id === row.dataset.id);
                if (fav) this.openDetails(this.variantOfFav(fav), { focusStop: fav.stopId });
            });
        });

        // ETAs land per favourite as they arrive, so the list is never blocked.
        favs.forEach(async fav => {
            const etas = await API.getStopRouteEtas(fav.stopId, this.variantOfFav(fav));
            const slot = list.querySelector(`[data-eta-for="${CSS.escape(fav.id)}"]`);
            if (slot) slot.innerHTML = etaChips(etas);
        });
    }

    renderRecent() {
        const list = $('recent-list');
        const section = document.querySelector('[data-section="recent"]');
        Storage.getRecentSearches().then(recents => {
            if (!recents.length) {
                list.innerHTML = `<div class="list-item"><div class="list-content"><div class="list-subtitle">${I18n.t('home.no_recent')}</div></div></div>`;
                return;
            }
            const shown = this.recentExpanded ? recents : recents.slice(0, 3);
            list.innerHTML = shown.map(r => `
                <div class="list-item recent-row" data-route="${escapeHtml(r.route)}">
                    <div class="route-badge ${r._provider || 'kmb'}">${escapeHtml(r.route)}</div>
                    <div class="list-content">
                        <div class="list-title">${escapeHtml(localized(r.dest_tc, r.dest_en) || '')}</div>
                        <div class="list-subtitle">${I18n.t('home.last_viewed', { date: new Date(r.searchedAt).toLocaleDateString() })}</div>
                    </div>
                </div>`).join('');

            list.querySelectorAll('.recent-row').forEach(row => {
                row.addEventListener('click', () => {
                    this.navigate('view-search');
                    $('search-input').value = row.dataset.route;
                    this.runSearch(row.dataset.route);
                });
            });

            if (!this.recentExpanded && recents.length > 3) {
                const more = document.createElement('div');
                more.className = 'list-item show-more-item';
                more.innerHTML = `<div class="list-content"><div class="list-subtitle">${I18n.t('home.show_more', { count: recents.length - 3 })}</div></div>`;
                more.addEventListener('click', () => {
                    this.recentExpanded = true;
                    section.classList.add('expanded');
                    this.renderRecent();
                });
                list.appendChild(more);
            }
        });
    }

    // ---------- search ----------

    bindSearch() {
        const input = $('search-input');
        input.addEventListener('input', () => {
            const q = input.value.trim();
            $('search-clear').classList.toggle('hidden', !q);
            clearTimeout(this.searchTimer);
            if (!q) {
                $('search-results').innerHTML = this.searchHint();
                return;
            }
            this.searchTimer = setTimeout(() => this.runSearch(q), 280);
        });

        $('search-clear').addEventListener('click', () => {
            input.value = '';
            $('search-clear').classList.add('hidden');
            $('search-results').innerHTML = this.searchHint();
            input.focus();
        });

        $('search-mode-toggle').addEventListener('click', (e) => {
            const btn = e.target.closest('.segment-btn');
            if (!btn) return;
            document.querySelectorAll('#search-mode-toggle .segment-btn').forEach(b => b.classList.toggle('active', b === btn));
            this.searchMode = btn.dataset.mode;
            input.placeholder = I18n.t(this.searchMode === 'stop' ? 'search.placeholder_stop' : 'search.placeholder');
            input.value = '';
            $('search-clear').classList.add('hidden');
            $('search-results').innerHTML = this.searchHint();
            input.focus();
        });

        $('search-results').innerHTML = this.searchHint();
    }

    searchHint() {
        return `<div class="empty-state"><svg class="icon icon-lg" viewBox="0 0 24 24"><use href="../icons/sprite.svg#icon-search"/></svg>
            <p>${I18n.t(this.searchMode === 'stop' ? 'search.hint_stop' : 'search.hint_route')}</p></div>`;
    }

    async runSearch(query) {
        const box = $('search-results');
        box.innerHTML = `<div class="loading-container"><div class="spinner"></div><span>${I18n.t('search.searching')}</span></div>`;
        try {
            return this.searchMode === 'stop' ? await this.runStopSearch(query) : await this.runRouteSearch(query);
        } catch (e) {
            box.innerHTML = `<div class="empty-state"><p>${I18n.t('search.error', { message: escapeHtml(e.message) })}</p></div>`;
        }
    }

    async runRouteSearch(query) {
        const box = $('search-results');
        const matches = await API.searchRoutes(query);
        if (!matches.length) {
            box.innerHTML = `<div class="empty-state"><p>${I18n.t('search.no_results')}</p></div>`;
            return;
        }

        box.innerHTML = '';
        for (const match of matches.slice(0, 8)) {
            const variants = await API.getRouteVariants(match.route);
            if (!variants.length) continue;

            const group = document.createElement('div');
            group.className = 'route-group';
            group.innerHTML = `
                <div class="route-group-head">
                    <span class="route-code">${escapeHtml(match.route)}</span>
                    <span class="chips">${match.providers.map(p => `<span class="chip ${p}">${PROVIDERS[p]}</span>`).join('')}</span>
                </div>
                <div class="route-bounds"></div>`;
            const bounds = group.querySelector('.route-bounds');

            variants.forEach(v => {
                const row = document.createElement('div');
                row.className = 'bound-row';
                row.innerHTML = `
                    <div class="bound-dest">
                        <span class="arrow">→</span> ${escapeHtml(localized(v.dest_tc, v.dest_en))}
                        ${v.note_en ? `<span class="note">${escapeHtml(v.note_en)}</span>` : ''}
                    </div>
                    <div class="bound-orig">
                        <span class="chip ${v._provider}">${PROVIDERS[v._provider]}</span>
                        ${escapeHtml(localized(v.orig_tc, v.orig_en))}
                    </div>`;
                row.addEventListener('click', () => this.openDetails(v));
                bounds.appendChild(row);
            });

            box.appendChild(group);
        }
    }

    async runStopSearch(query) {
        const box = $('search-results');
        const stops = await API.searchStops(query);
        if (!stops.length) {
            box.innerHTML = `<div class="empty-state"><p>${I18n.t('search.no_results_stop')}</p></div>`;
            return;
        }

        box.innerHTML = '';
        const group = document.createElement('div');
        group.className = 'section-group';
        stops.forEach(stop => {
            const row = document.createElement('div');
            row.className = 'list-item stop-result';
            row.innerHTML = `
                <div class="list-content">
                    <div class="list-title">${escapeHtml(localized(stop.name_tc, stop.name_en))}</div>
                    <div class="list-subtitle">${escapeHtml(localized(stop.name_en, stop.name_tc))}</div>
                </div>
                <svg class="icon icon-sm chevron" viewBox="0 0 24 24"><use href="../icons/sprite.svg#icon-arrow-right"/></svg>`;
            row.addEventListener('click', () => this.openStop(stop));
            group.appendChild(row);
        });
        box.appendChild(group);
    }

    // Routes arriving at a stop, with their next buses.
    async openStop(stop) {
        const box = $('search-results');
        box.innerHTML = `<div class="loading-container"><div class="spinner"></div><span>${I18n.t('search.searching')}</span></div>`;

        const etas = await API.getETA(stop.stop);
        if (!etas.length) {
            box.innerHTML = `<div class="empty-state"><p>${I18n.t('search.no_results_stop')}</p></div>`;
            return;
        }

        const byRoute = new Map();
        for (const e of etas) {
            const key = `${e.route}|${e.dir}`;
            if (!byRoute.has(key)) byRoute.set(key, { route: e.route, dir: e.dir, dest_tc: e.dest_tc, dest_en: e.dest_en, list: [] });
            byRoute.get(key).list.push(e);
        }

        box.innerHTML = `<div class="section-title">${escapeHtml(localized(stop.name_tc, stop.name_en))}</div>`;
        const group = document.createElement('div');
        group.className = 'section-group';

        byRoute.forEach(route => {
            const row = document.createElement('div');
            row.className = 'list-item route-at-stop';
            row.innerHTML = `
                <div class="route-badge kmb">${escapeHtml(route.route)}</div>
                <div class="list-content">
                    <div class="list-title">${escapeHtml(localized(route.dest_tc, route.dest_en))}</div>
                    <div class="list-subtitle">${I18n.t('details.from_stop')}</div>
                </div>
                <div class="eta-chips">${etaChips(route.list.map(e => API.formatETA(e.eta)))}</div>`;
            row.addEventListener('click', async () => {
                const variants = await API.getRouteVariants(route.route);
                const match = variants.find(v =>
                    (v._provider === 'kmb' && v.dir === route.dir) ||
                    (v._provider !== 'kmb' && v.dest_tc === route.dest_tc)
                ) || variants[0];
                if (match) this.openDetails(match, { focusStop: stop.stop });
            });
            group.appendChild(row);
        });

        box.appendChild(group);
    }

    // ---------- details ----------

    async openDetails(variant, opts = {}) {
        this.variant = variant;
        this.navigate('view-details');
        $('header-sub').textContent = `${PROVIDERS[variant._provider]} · ${localized(variant.orig_tc, variant.orig_en)} → ${localized(variant.dest_tc, variant.dest_en)}`;
        $('header-sub').classList.add('visible');
        $('header-title').classList.add('hidden');

        Storage.addRecentSearch(variant.route, {
            dest_tc: variant.dest_tc, dest_en: variant.dest_en,
            _provider: variant._provider, dir: variant.dir
        }).catch(() => {});

        await this.loadStops(variant, opts.focusStop);
    }

    async loadStops(variant, focusStop = null) {
        const container = $('stops-container');
        $('details-meta').innerHTML = `<div class="route-code">${escapeHtml(variant.route)}</div>
            <div class="meta-line"><span class="chip ${variant._provider}">${PROVIDERS[variant._provider]}</span>
            ${escapeHtml(localized(variant.orig_tc, variant.orig_en))} → ${escapeHtml(localized(variant.dest_tc, variant.dest_en))}</div>`;
        container.innerHTML = `<div class="loading-container"><div class="spinner"></div><span>${I18n.t('details.loading')}</span></div>`;

        try {
            this.stops = await API.getRouteStops(variant);
        } catch (e) {
            container.innerHTML = `<div class="empty-state"><p>${I18n.t('details.error_stops')}</p></div>`;
            return;
        }

        if (!this.stops.length) {
            container.innerHTML = `<div class="empty-state"><p>${I18n.t('details.no_stops')}</p></div>`;
            return;
        }

        this.expanded.clear();
        if (focusStop) this.expanded.add(Number(focusStop.seq) || focusStop);

        container.innerHTML = '<div class="stop-list"></div>';
        const list = container.querySelector('.stop-list');

        this.stops.forEach(stop => {
            const row = document.createElement('div');
            row.className = 'stop-row';
            row.dataset.seq = stop.seq;
            row.dataset.stopId = stop.id;
            row.innerHTML = `
                <div class="stop-line"><span class="stop-dot"></span></div>
                <div class="stop-body">
                    <div class="stop-head">
                        <div class="stop-name">${escapeHtml(localized(stop.name_tc, stop.name_en))}</div>
                        <div class="eta-chips" data-eta-seq="${stop.seq}"><span class="eta-chip muted">···</span></div>
                        <button class="fav-btn" aria-label="${I18n.t('fav.add')}"></button>
                    </div>
                    <div class="stop-extra"></div>
                </div>`;
            row.querySelector('.stop-head').addEventListener('click', (e) => {
                if (e.target.closest('.fav-btn')) return;
                this.toggleStop(row, stop);
            });
            row.querySelector('.fav-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleFavorite(row, variant, stop);
            });
            list.appendChild(row);
        });

        this.paintStars();
        await this.refreshEtas(variant);

        if (focusStop) {
            const row = list.querySelector(`.stop-row[data-seq="${CSS.escape(String(Number(focusStop.seq) || focusStop))}"]`);
            if (row) row.scrollIntoView({ block: 'center' });
        }

        this.startRefresh(variant);
    }

    async refreshEtas(variant) {
        const paint = (map) => {
            this.etaMap = map;
            this.stops.forEach(stop => {
                const slot = document.querySelector(`[data-eta-seq="${stop.seq}"]`);
                if (!slot) return;
                const etas = map.get(stop.seq) || [];
                slot.innerHTML = etaChips(etas);
                const row = slot.closest('.stop-row');
                if (row && row.classList.contains('open')) this.renderStopExtra(row, stop, etas);
            });
        };

        const map = await API.getRouteEtas(variant, this.stops, paint);
        paint(map);
    }

    startRefresh(variant) {
        this.stopRefresh();
        chrome.storage.sync.get('autoRefresh', ({ autoRefresh }) => {
            if (autoRefresh === false) return;
            this.refreshTimer = setInterval(() => {
                if (this.view !== 'view-details') return this.stopRefresh();
                this.refreshEtas(variant);
            }, REFRESH_MS);
        });
    }

    stopRefresh() {
        if (this.refreshTimer) clearInterval(this.refreshTimer);
        this.refreshTimer = null;
    }

    toggleStop(row, stop) {
        row.classList.toggle('open');
        if (row.classList.contains('open')) {
            this.renderStopExtra(row, stop, this.etaMap.get(stop.seq) || []);
        }
    }

    renderStopExtra(row, stop, etas) {
        const extra = row.querySelector('.stop-extra');
        if (!etas.length) {
            extra.innerHTML = `<div class="stop-empty">${I18n.t('details.no_scheduled')}</div>`;
            return;
        }
        extra.innerHTML = etas.map(e => `
            <div class="eta-detail">
                <span class="eta-time">${e.time}</span>
                <span class="eta-min">${e.minutes <= 0 ? I18n.t('details.arriving') : `${e.minutes} min`}</span>
                ${e.remark_tc ? `<span class="eta-remark">${escapeHtml(I18n.getLang() === 'zh-HK' ? e.remark_tc : e.remark_en)}</span>` : ''}
            </div>`).join('');
    }

    paintStars() {
        if (!this.variant) return;
        document.querySelectorAll('.stop-row').forEach(row => {
            const stopId = row.dataset.stopId;
            const on = this.favorites.some(f =>
                f.stopId === stopId && f.route === this.variant.route &&
                f.provider === this.variant._provider && f.dir === this.variant.dir
            );
            row.classList.toggle('is-fav', on);
            row.querySelector('.fav-btn').innerHTML =
                `<svg class="icon icon-sm" viewBox="0 0 24 24"><use href="../icons/sprite.svg#icon-${on ? 'star' : 'star-empty'}"/></svg>`;
        });
    }

    // ---------- favourites ----------

    async toggleFavorite(row, variant, stop) {
        const stopId = stop.id;
        const existing = this.favorites.find(f =>
            f.stopId === stopId && f.route === variant.route &&
            f.provider === variant._provider && f.dir === variant.dir
        );

        if (existing) {
            this.favorites = this.favorites.filter(f => f !== existing);
            await Storage.saveFavorites(this.favorites);
            this.paintStars();
            return;
        }

        const folder = await this.chooseFolder();
        if (folder === undefined) return; // cancelled

        this.favorites.push({
            id: `${variant._provider}-${variant.route}-${variant.dir}-${stopId}`,
            route: variant.route,
            stopId,
            stopName: localized(stop.name_tc, stop.name_en),
            stopNameTc: stop.name_tc,
            dest_tc: variant.dest_tc,
            dest_en: variant.dest_en,
            orig_tc: variant.orig_tc,
            orig_en: variant.orig_en,
            provider: variant._provider,
            dir: variant.dir,
            service_type: variant.service_type,
            route_id: variant.route_id,
            region: variant.region,
            folder: folder || undefined
        });
        await Storage.saveFavorites(this.favorites);
        this.paintStars();
        chrome.runtime.sendMessage({ action: 'refreshFavourites' });
    }

    chooseFolder() {
        return new Promise(resolve => {
            if (!this.folders.length) return resolve(null);

            const modal = $('app-modal');
            $('modal-title').textContent = I18n.t('fav.choose_folder');
            $('modal-message').innerHTML = `<div class="folder-list">${this.folders.map(f => `
                <button class="folder-option" data-folder="${f.id}">
                    <span class="folder-dot" style="background:${f.color || 'var(--primary-color)'}"></span>${escapeHtml(f.name)}
                </button>`).join('')}</div>`;
            $('modal-actions').innerHTML = `<button class="modal-btn" data-act="cancel">${I18n.t('modal.cancel')}</button>`;

            const close = (value) => {
                modal.classList.remove('active');
                setTimeout(() => modal.classList.add('hidden'), 180);
                resolve(value);
            };

            $('modal-message').querySelectorAll('.folder-option').forEach(btn => {
                btn.addEventListener('click', () => close(btn.dataset.folder));
            });
            $('modal-actions').querySelector('[data-act="cancel"]').addEventListener('click', () => close(undefined));

            modal.classList.remove('hidden');
            requestAnimationFrame(() => modal.classList.add('active'));
        });
    }

    // ---------- settings ----------

    renderSettings() {
        const list = $('settings-list');
        list.innerHTML = `
            <div class="list-item">
                <div class="list-content">
                    <div class="list-title">${I18n.t('settings.dark_mode')}</div>
                    <div class="list-subtitle">${I18n.t('settings.dark_mode_desc')}</div>
                </div>
                <label class="toggle-switch"><input type="checkbox" id="set-dark"><span class="slider"></span></label>
            </div>
            <div class="list-item">
                <div class="list-content">
                    <div class="list-title">${I18n.t('settings.language')}</div>
                    <div class="list-subtitle">${I18n.t('settings.language_desc')}</div>
                </div>
                <select class="lang-select" id="set-lang">
                    <option value="en">English</option>
                    <option value="zh-HK">繁體中文</option>
                </select>
            </div>
            <div class="list-item">
                <div class="list-content">
                    <div class="list-title">${I18n.t('settings.auto_refresh')}</div>
                    <div class="list-subtitle">${I18n.t('settings.auto_refresh_desc')}</div>
                </div>
                <label class="toggle-switch"><input type="checkbox" id="set-refresh"><span class="slider"></span></label>
            </div>
            <div class="list-item" id="open-options">
                <div class="list-content">
                    <div class="list-title">${I18n.t('settings.open')}</div>
                    <div class="list-subtitle">${I18n.t('settings.subtitle')}</div>
                </div>
                <svg class="icon icon-sm chevron" viewBox="0 0 24 24"><use href="../icons/sprite.svg#icon-arrow-right"/></svg>
            </div>`;

        const dark = $('set-dark');
        chrome.storage.sync.get('theme', ({ theme }) => { dark.checked = theme === 'dark'; });
        dark.addEventListener('change', () => {
            document.body.classList.toggle('dark-mode', dark.checked);
            chrome.storage.sync.set({ theme: dark.checked ? 'dark' : 'light' });
            Storage.getSettings().then(settings => Storage.saveSettings({ ...settings, theme: dark.checked ? 'dark' : 'light' }));
        });

        const lang = $('set-lang');
        lang.value = I18n.getLang();
        lang.addEventListener('change', async () => {
            await I18n.setLang(lang.value);
            this.renderSettings();
            this.bindStaticI18n();
            await this.renderHome();
            $('search-results').innerHTML = this.searchHint();
        });

        const auto = $('set-refresh');
        chrome.storage.sync.get('autoRefresh', ({ autoRefresh }) => { auto.checked = autoRefresh !== false; });
        auto.addEventListener('change', () => {
            chrome.storage.sync.set({ autoRefresh: auto.checked });
            Storage.getSettings().then(settings => Storage.saveSettings({ ...settings, autoRefresh: auto.checked }));
        });

        $('open-options').addEventListener('click', () => chrome.runtime.openOptionsPage());
    }

    bindStaticI18n() {
        I18n.applyToDocument();
        $('search-input').placeholder = I18n.t(this.searchMode === 'stop' ? 'search.placeholder_stop' : 'search.placeholder');
        if (this.variant) {
            $('header-sub').textContent = `${PROVIDERS[this.variant._provider]} · ${localized(this.variant.orig_tc, this.variant.orig_en)} → ${localized(this.variant.dest_tc, this.variant.dest_en)}`;
        }
    }
}

// ---------- helpers ----------

function localized(tc, en) {
    return I18n.getLang() === 'zh-HK' ? (tc || en || '') : (en || tc || '');
}

function escapeHtml(text) {
    return String(text == null ? '' : text)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

// Up to three minute-chips; "–" when the operator has nothing scheduled.
function etaChips(etas) {
    if (!etas || !etas.length) return '<span class="eta-chip muted">–</span>';
    return etas.slice(0, 3).map(e => {
        const cls = e.minutes <= 0 ? 'now' : e.minutes <= 5 ? 'soon' : '';
        const label = e.minutes <= 0 ? I18n.t('details.arriving') : `${e.minutes}`;
        return `<span class="eta-chip ${cls}" title="${escapeHtml(e.time)}">${label}</span>`;
    }).join('');
}

document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
    window.app.init();
});

chrome.runtime.onMessage.addListener((message) => {
    if (window.app && (message.action === 'refreshFavourites' || message.action === 'refreshFolders')) {
        window.app.loadData().then(() => {
            if (window.app.view === 'view-home') window.app.renderHome();
            else window.app.paintStars();
        });
    }
});
