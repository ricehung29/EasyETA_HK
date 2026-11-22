// Hong Kong Public Transport API Client
//   KMB: https://data.etabus.gov.hk/v1/transport/kmb
//   CTB: https://rt.data.gov.hk/v1/transport/citybus-nwfb
//   GMB: https://data.etagmb.gov.hk            (root-level routes, NOT under /v1/transport)
//
// Everything the UI touches is a "variant":
//   { _provider, route, dir, service_type, route_id?, region?,
//     orig_tc, orig_en, dest_tc, dest_en, note_en? }
// `dir` is opaque to callers: KMB 'O'/'I', CTB 'outbound'/'inbound', GMB route_seq.

const API = {
    baseUrls: {
        kmb: 'https://data.etabus.gov.hk/v1/transport/kmb',
        ctb: 'https://rt.data.gov.hk/v1/transport/citybus-nwfb',
        gmb: 'https://data.etagmb.gov.hk'
    },

    // In-memory cache for API responses
    cache: new Map(),
    cacheTimeout: 30000,

    // In-memory cache for the big static lists (also persisted in storage)
    _memo: new Map(),
    _kmbStopMap: null,
    _ctbStopNames: new Map(),

    // Rate limiting: max 10 requests per second
    rateLimit: {
        maxPerSecond: 10,
        timestamps: [],
        queue: [],
        processing: false
    },

    // ---------- transport ----------

    async rateLimitedFetch(url, options = {}) {
        return new Promise((resolve, reject) => {
            this.rateLimit.queue.push({ url, options, resolve, reject });
            if (!this.rateLimit.processing) {
                this.rateLimit.processing = true;
                this._processQueue();
            }
        });
    },

    _processQueue() {
        const now = Date.now();
        this.rateLimit.timestamps = this.rateLimit.timestamps.filter(t => now - t < 1000);

        while (this.rateLimit.queue.length > 0 && this.rateLimit.timestamps.length < this.rateLimit.maxPerSecond) {
            const item = this.rateLimit.queue.shift();
            this.rateLimit.timestamps.push(Date.now());
            this._executeFetch(item.url, item.options).then(item.resolve).catch(item.reject);
        }

        if (this.rateLimit.queue.length > 0) {
            setTimeout(() => this._processQueue(), 200);
        } else {
            this.rateLimit.processing = false;
        }
    },

    async _executeFetch(url, options = {}) {
        const cached = this.cache.get(url);
        if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
            return cached.data;
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal,
                headers: { 'Accept': 'application/json', ...options.headers }
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText || ''}`);
            }

            const data = await response.json();
            this.cache.set(url, { data, timestamp: Date.now() });
            return data;
        } catch (error) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') throw new Error('timeout: request aborted');
            throw error;
        }
    },

    async fetch(url, options = {}) {
        return this.rateLimitedFetch(url, options);
    },

    // Storage-backed cache for reference data (routes/stops change rarely, ~weekly).
    async _cached(key, ttl, loader) {
        if (this._memo.has(key)) return this._memo.get(key);
        try {
            const stored = (await chrome.storage.local.get(key))[key];
            if (stored && stored.data && Date.now() - stored.timestamp < ttl) {
                this._memo.set(key, stored.data);
                return stored.data;
            }
        } catch (_) { /* no cache available */ }

        const data = await loader();
        if (data && data.length) {
            this._memo.set(key, data);
            try {
                await chrome.storage.local.set({ [key]: { data, timestamp: Date.now() } });
            } catch (_) { /* storage full */ }
        }
        return data || [];
    },

    staticTtl: 7 * 24 * 60 * 60 * 1000,

    // ---------- reference data ----------

    loadKmbRoutes() {
        return this._cached('kmbRoutes', this.staticTtl, async () => {
            const res = await this.rateLimitedFetch(`${this.baseUrls.kmb}/route/`);
            return res?.data || [];
        });
    },

    loadCtbRoutes() {
        return this._cached('ctbRoutes', this.staticTtl, async () => {
            const res = await this.rateLimitedFetch(`${this.baseUrls.ctb}/route/ctb`);
            return res?.data || [];
        });
    },

    // GMB only publishes an index of region -> route codes; details are per region.
    loadGmbIndex() {
        return this._cached('gmbIndex', this.staticTtl, async () => {
            const res = await this.rateLimitedFetch(`${this.baseUrls.gmb}/route/`);
            const regions = res?.data?.routes || {};
            return Object.entries(regions).flatMap(([region, codes]) =>
                codes.map(route => ({ route, region }))
            );
        });
    },

    // The full KMB stop list (~6.7k stops, one request) — used to name every
    // KMB stop on a route without 20 individual lookups.
    getAllStops() {
        return this._cached('kmbStops', this.staticTtl, async () => {
            const res = await this.rateLimitedFetch(`${this.baseUrls.kmb}/stop`);
            return res?.data || [];
        });
    },

    async _stopsById() {
        if (!this._kmbStopMap) {
            this._kmbStopMap = new Map((await this.getAllStops()).map(s => [s.stop, s]));
        }
        return this._kmbStopMap;
    },

    // ---------- search ----------

    // Returns [{ route, providers: ['kmb','ctb','gmb'] }], exact match first.
    async searchRoutes(query) {
        const q = String(query).trim().toUpperCase();
        if (!q) return [];

        const [kmb, ctb, gmb] = await Promise.all([
            this.loadKmbRoutes(), this.loadCtbRoutes(), this.loadGmbIndex()
        ]);

        const hits = new Map();
        const add = (route, provider) => {
            if (!hits.has(route)) hits.set(route, new Set());
            hits.get(route).add(provider);
        };
        kmb.forEach(r => r.route && r.route.toUpperCase().includes(q) && add(r.route, 'kmb'));
        ctb.forEach(r => r.route && r.route.toUpperCase().includes(q) && add(r.route, 'ctb'));
        gmb.forEach(r => r.route && r.route.toUpperCase().includes(q) && add(r.route, 'gmb'));

        return [...hits.entries()]
            .map(([route, providers]) => ({ route, providers: [...providers] }))
            .sort((a, b) =>
                (a.route.toUpperCase() === q ? 0 : 1) - (b.route.toUpperCase() === q ? 0 : 1) ||
                a.route.length - b.route.length ||
                a.route.localeCompare(b.route)
            );
    },

    // Every direction of a route code, from all operators that run it.
    async getRouteVariants(routeCode) {
        const rn = String(routeCode).toUpperCase();
        const [kmb, ctb, gmbIndex] = await Promise.all([
            this.loadKmbRoutes(), this.loadCtbRoutes(), this.loadGmbIndex()
        ]);
        const out = [];

        // KMB: the list already carries one row per (direction, service type).
        // Collapse service types that start at the same place; keep the primary.
        const kmbRows = kmb
            .filter(r => r.route && r.route.toUpperCase() === rn)
            .sort((a, b) => a.bound.localeCompare(b.bound) || Number(a.service_type) - Number(b.service_type));
        const seen = new Set();
        for (const r of kmbRows) {
            const key = `${r.bound}|${r.orig_en}`;
            if (seen.has(key)) continue;
            seen.add(key);
            out.push({
                _provider: 'kmb', route: r.route, dir: r.bound, service_type: r.service_type,
                orig_tc: r.orig_tc, orig_en: r.orig_en, dest_tc: r.dest_tc, dest_en: r.dest_en
            });
        }

        // CTB: the list row describes the outbound; the inbound is its reverse.
        const c = ctb.find(r => r.route && r.route.toUpperCase() === rn);
        if (c) {
            const base = { _provider: 'ctb', route: c.route, service_type: '1' };
            out.push({ ...base, dir: 'outbound', orig_tc: c.orig_tc, orig_en: c.orig_en, dest_tc: c.dest_tc, dest_en: c.dest_en });
            out.push({ ...base, dir: 'inbound', orig_tc: c.dest_tc, orig_en: c.dest_en, dest_tc: c.orig_tc, dest_en: c.orig_en });
        }

        // GMB: codes repeat across regions, so resolve each region that has it.
        const regions = [...new Set(gmbIndex.filter(r => r.route.toUpperCase() === rn).map(r => r.region))];
        for (const region of regions) {
            let entries = [];
            try {
                const res = await this.rateLimitedFetch(`${this.baseUrls.gmb}/route/${region}/${rn}`);
                entries = res?.data || [];
            } catch (_) { continue; }

            for (const e of entries) {
                for (const d of e.directions || []) {
                    out.push({
                        _provider: 'gmb', route: e.route_code, dir: d.route_seq,
                        service_type: String(e.route_id), route_id: e.route_id, region,
                        orig_tc: d.orig_tc, orig_en: d.orig_en,
                        dest_tc: d.dest_tc, dest_en: d.dest_en,
                        note_en: e.description_en || ''
                    });
                }
            }
        }

        return out;
    },

    // ---------- stops on a route ----------

    async getRouteStops(variant) {
        if (variant._provider === 'ctb') return this._ctbStops(variant);
        if (variant._provider === 'gmb') return this._gmbStops(variant);
        return this._kmbStops(variant);
    },

    async _kmbStops(v) {
        const dir = v.dir === 'I' ? 'inbound' : 'outbound';
        const res = await this.rateLimitedFetch(`${this.baseUrls.kmb}/route-stop/${v.route}/${dir}/${v.service_type || '1'}`);
        const byId = await this._stopsById();
        return (res?.data || []).map((rs, i) => {
            const info = byId.get(rs.stop) || {};
            return {
                seq: Number(rs.seq || i + 1),
                id: rs.stop,
                name_tc: info.name_tc || `站 ${rs.stop}`,
                name_en: info.name_en || rs.stop
            };
        });
    },

    async _ctbStops(v) {
        // CTB has no bulk stop endpoint, so names are resolved once and kept.
        const res = await this.rateLimitedFetch(`${this.baseUrls.ctb}/route-stop/ctb/${v.route}/${v.dir}`);
        let known = {};
        try { known = (await chrome.storage.local.get('ctbStops')).ctbStops || {}; } catch (_) {}

        const out = [];
        for (const rs of res?.data || []) {
            let d = this._ctbStopNames.get(rs.stop) || known[rs.stop];
            if (!d) {
                try { d = (await this.rateLimitedFetch(`${this.baseUrls.ctb}/stop/${rs.stop}`))?.data; } catch (_) { d = null; }
            }
            if (d && d.name_tc) {
                this._ctbStopNames.set(rs.stop, d);
                known[rs.stop] = { name_tc: d.name_tc, name_en: d.name_en };
            }
            out.push({
                seq: Number(rs.seq),
                id: rs.stop,
                name_tc: d?.name_tc || rs.stop,
                name_en: d?.name_en || rs.stop
            });
        }
        try { await chrome.storage.local.set({ ctbStops: known }); } catch (_) {}
        return out;
    },

    async _gmbStops(v) {
        const res = await this.rateLimitedFetch(`${this.baseUrls.gmb}/route-stop/${v.route_id}/${v.dir}`);
        return (res?.data?.route_stops || []).map(s => ({
            seq: Number(s.stop_seq),
            id: String(s.stop_id),
            name_tc: s.name_tc,
            name_en: s.name_en
        }));
    },

    // ---------- ETA ----------

    _eta(row) {
        const f = this.formatETA(row.eta);
        return {
            minutes: f.minutes, time: f.time, status: f.status,
            remark_tc: row.rmk_tc || '', remark_en: row.rmk_en || '',
            dest_tc: row.dest_tc || '', dest_en: row.dest_en || '',
            ts: row.eta ? new Date(row.eta).getTime() : Infinity
        };
    },

    _sortEtas(list) {
        return list.sort((a, b) => a.ts - b.ts);
    },

    // CTB's ETA payload uses 'O'/'I' even though its route-stop URLs use 'outbound'/'inbound'.
    _ctbDirMatches(rowDir, dir) {
        return (rowDir === 'O' ? 'outbound' : 'inbound') === dir;
    },

    // Drops buses that already left (operators keep a row for a minute or two).
    _fresh(list) {
        const cutoff = Date.now() - 60000;
        return this._sortEtas(list.filter(e => e.ts >= cutoff));
    },

    // Map of stop seq -> [eta]. KMB answers the whole route in one call;
    // CTB and GMB only expose per-stop ETA, so they are fetched in batches.
    async getRouteEtas(variant, stops, onBatch) {
        const map = new Map();

        if (variant._provider === 'kmb') {
            try {
                const res = await this.rateLimitedFetch(
                    `${this.baseUrls.kmb}/route-eta/${variant.route}/${variant.service_type || '1'}`
                );
                for (const row of res?.data || []) {
                    if (row.dir !== variant.dir || !row.eta) continue;
                    const seq = Number(row.seq);
                    if (!map.has(seq)) map.set(seq, []);
                    map.get(seq).push(this._eta(row));
                }
                map.forEach((list, seq) => map.set(seq, this._fresh(list)));
            } catch (e) {
                console.warn('KMB route ETA failed:', e);
            }
            if (onBatch) onBatch(map);
            return map;
        }

        const chunk = 6;
        for (let i = 0; i < stops.length; i += chunk) {
            await Promise.all(stops.slice(i, i + chunk).map(async stop => {
                const list = await this.getStopRouteEtas(stop.id, variant);
                if (list.length) map.set(stop.seq, list);
            }));
            if (onBatch) onBatch(map);
        }
        return map;
    },

    // ETAs for one stop on one route (favourites, expanded stop rows).
    async getStopRouteEtas(stopId, variant) {
        try {
            if (variant._provider === 'ctb') {
                const res = await this.rateLimitedFetch(`${this.baseUrls.ctb}/eta/ctb/${stopId}/${variant.route}`);
                return this._fresh((res?.data || [])
                    .filter(r => this._ctbDirMatches(r.dir, variant.dir) && r.eta)
                    .map(r => this._eta(r)));
            }
            if (variant._provider === 'gmb') {
                const res = await this.rateLimitedFetch(`${this.baseUrls.gmb}/eta/stop/${stopId}`);
                const entry = (res?.data || [])
                    .find(d => d.route_id === variant.route_id && d.route_seq === variant.dir);
                return this._fresh((entry?.eta || []).map(e => this._eta({
                    eta: e.timestamp, rmk_tc: e.remarks_tc, rmk_en: e.remarks_en
                })));
            }
            const res = await this.rateLimitedFetch(
                `${this.baseUrls.kmb}/eta/${stopId}/${variant.route}/${variant.service_type || '1'}`
            );
            return this._fresh((res?.data || [])
                .filter(r => r.dir === variant.dir && r.eta)
                .map(r => this._eta(r)));
        } catch (e) {
            console.warn('Stop ETA failed:', e);
            return [];
        }
    },

    // All routes at a KMB stop (stop-name search results).
    async getETA(stopId, route = null) {
        try {
            const res = await this.rateLimitedFetch(`${this.baseUrls.kmb}/stop-eta/${stopId}`);
            let etas = res?.data || [];
            if (route) etas = etas.filter(e => e.route === route);
            etas.sort((a, b) => new Date(a.eta) - new Date(b.eta));
            return etas.map(e => ({ ...e, formatted: this.formatETA(e.eta) }));
        } catch (e) {
            console.warn('Stop ETA list failed:', e);
            return [];
        }
    },

    // Stop-name search (KMB carries the full stop list).
    async searchStops(query) {
        const q = String(query).trim().toLowerCase();
        if (!q) return [];
        const stops = await this.getAllStops();
        return stops.filter(s =>
            (s.name_en && s.name_en.toLowerCase().includes(q)) ||
            (s.name_tc && s.name_tc.includes(q)) ||
            (s.stop && s.stop.toLowerCase().includes(q))
        ).slice(0, 20);
    },

    formatETA(etaISO, format = 'both') {
        if (!etaISO) {
            return { minutes: null, text: '*', status: 'scheduled', time: '--:--', display: '*' };
        }

        const eta = new Date(etaISO);
        const diffMins = Math.round((eta - new Date()) / 60000);

        let status = 'normal';
        let text = '';
        if (diffMins <= 0) {
            status = 'arriving';
            text = 'Arriving';
        } else if (diffMins <= 3) {
            status = 'arriving';
            text = `${diffMins} min${diffMins > 1 ? 's' : ''}`;
        } else {
            text = `${diffMins} mins`;
            if (diffMins <= 10) status = 'soon';
        }

        const time = eta.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

        let display;
        switch (format) {
            case 'relative': display = text; break;
            case 'absolute': display = time; break;
            default: display = `${text} (${time})`;
        }

        return { minutes: diffMins, text, status, time, display };
    }
};

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
}

// Make API available globally for browser extension context
if (typeof window !== 'undefined') {
    window.API = API;
} else if (typeof globalThis !== 'undefined') {
    globalThis.API = API;
}
