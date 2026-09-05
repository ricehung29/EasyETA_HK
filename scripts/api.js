// Hong Kong Public Transport API Client
// Supports: KMB (Kowloon Motor Bus), GMB (Green Minibus), CTB/NWFB (Citybus/New World First Bus)

const API = {
    // API Base URLs
    baseUrls: {
        kmb: 'https://data.etabus.gov.hk/v1/transport/kmb',
        gmb: 'https://data.etagmb.gov.hk/v1/transport/gmb',
        ctb: 'https://rt.data.gov.hk/v1/transport/citybus-nwfb'
    },

    // In-memory cache for API responses
    cache: new Map(),
    cacheTimeout: 30000, // 30 seconds

    // Route and stop caches
    routeCache: new Map(),
    stopCache: new Map(),

    // Rate limiting: max 10 requests per second
    rateLimit: {
        maxPerSecond: 10,
        timestamps: [],
        queue: [],
        processing: false
    },

    // Error types for consistent error handling
    ErrorTypes: {
        NETWORK: 'network_error',
        TIMEOUT: 'timeout_error',
        NOT_FOUND: 'not_found',
        RATE_LIMIT: 'rate_limit',
        PARSE: 'parse_error',
        UNKNOWN: 'unknown_error'
    },

    // User-friendly error messages in Chinese/English
    errorMessages: {
        network_error: { en: 'Network error. Please check your connection.', tc: '網絡錯誤，請檢查連線。' },
        timeout_error: { en: 'Request timed out. Please try again.', tc: '請求超時，請重試。' },
        not_found: { en: 'Data not found.', tc: '找不到資料。' },
        rate_limit: { en: 'Too many requests. Please slow down.', tc: '請求次數過多，請稍後再試。' },
        parse_error: { en: 'Failed to parse server response.', tc: '無法解析伺服器回應。' },
        unknown_error: { en: 'An unexpected error occurred.', tc: '發生意外錯誤。' }
    },

    /**
     * Get user-friendly error message
     * @param {string} errorType - One of ErrorTypes values
     * @param {string} lang - 'en' or 'tc'
     * @returns {string}
     */
    getErrorMessage(errorType, lang = 'en') {
        return this.errorMessages[errorType]?.[lang] || this.errorMessages.unknown_error[lang];
    },

    /**
     * Classify an error from a caught exception
     * @param {Error} error
     * @returns {string} ErrorTypes value
     */
    classifyError(error) {
        if (!error) return this.ErrorTypes.UNKNOWN;
        const msg = error.message || '';
        if (msg.includes('HTTP 404') || msg.includes('not found')) return this.ErrorTypes.NOT_FOUND;
        if (msg.includes('timeout') || msg.includes('abort')) return this.ErrorTypes.TIMEOUT;
        if (msg.includes('rate') || msg.includes('429') || msg.includes('too many')) return this.ErrorTypes.RATE_LIMIT;
        if (msg.includes('network') || msg.includes('fetch') || msg.includes('Failed to fetch') || msg.includes('ENOTFOUND')) return this.ErrorTypes.NETWORK;
        if (msg.includes('parse') || msg.includes('JSON')) return this.ErrorTypes.PARSE;
        return this.ErrorTypes.UNKNOWN;
    },

    /**
     * Rate-limited fetch wrapper
     */
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

    /**
     * Generic fetch with error handling, caching, and timeout
     */
    async _executeFetch(url, options = {}) {
        const cacheKey = url;
        const cached = this.cache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
            return cached.data;
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal,
                headers: {
                    'Accept': 'application/json',
                    ...options.headers
                }
            });

            clearTimeout(timeoutId);

            if (response.status === 429) {
                throw new Error('rate limit: 429 Too Many Requests');
            }
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText || ''}`);
            }

            const data = await response.json();

            this.cache.set(cacheKey, { data, timestamp: Date.now() });
            return data;
        } catch (error) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                throw new Error('timeout: request aborted');
            }
            throw error;
        }
    },

    /**
     * Public fetch method (kept for backward compatibility)
     */
    async fetch(url, options = {}) {
        return this.rateLimitedFetch(url, options);
    },

    /**
     * Normalise bound char from API to internal 'O'/'I' convention.
     * KMB: 'O'=outbound, 'I'=inbound
     * CTB: 'O'=outbound, 'I'=inbound
     */
    _normaliseBound(bound) {
        if (!bound) return 'O';
        const b = bound.toUpperCase();
        if (b === 'O' || b === 'OUTBOUND') return 'O';
        return 'I';
    },

    /**
     * Normalise route direction for CTB API: converts 'O'/'I' to 'outbound'/'inbound'
     */
    _normaliseRouteDirection(bound) {
        if (!bound) return 'outbound';
        const b = bound.toUpperCase();
        if (b === 'O' || b === 'OUTBOUND') return 'outbound';
        return 'inbound';
    },

    // ---- PROVIDER ROUTING ----
    // A route number can exist in BOTH KMB and CTB as completely different routes
    // (e.g. KMB route 1 = Chuk Yuen Estate ↔ Star Ferry, CTB route 1 = Central ↔ Happy Valley)
    // We must NOT guess — we check which provider actually has the route.
    // CTB-only routes: letter-prefix (A29, E23, N8), 970-979 cross-harbour, and
    // specific numbered routes unique to CTB/NWFB.
    // KMB-only and ambiguous (1-99) routes must be resolved by querying both APIs.

    // Routes that are EXCLUSIVE to CTB/NWFB (never in KMB)
    _ctbOnlyRoutes: new Set([
        '4','20','22','25','48','50','55','56','65','70','71','75','79','82','93',
        // CTB letter-prefix routes (not in KMB)
        'A29','E23','N8',
        // CTB numbered routes not in KMB
        '260','511','592','595','720','722','780','788','789'
    ]),

    // Routes that exist in BOTH KMB and CTB — we try KMB first (better ETA coverage)
    _ambiguousRoutes: new Set([
        '1','2','6','7','8','9','10','11','12','13','14','15','18','23','26','27',
        '38','40','42','63','72','73','76','77','78','81','85','90','91','97','98','99'
    ]),

    _isCTBRoute(routeStr) {
        const r = String(routeStr).toUpperCase();
        // 970-979 range → CTB cross-harbour (never in KMB)
        const num = parseInt(r, 10);
        if (num >= 970 && num <= 979) return true;
        // Known CTB-only routes (routes that exist ONLY in CTB, not in KMB)
        if (this._ctbOnlyRoutes.has(r)) return true;
        // All other routes: try KMB first (better ETA coverage, has route-eta endpoint)
        // KMB has letter-prefix routes like A31, B1, E31, P968, N116 etc.
        return false;
    },

    _providerForRoute(routeStr) {
        if (this._isCTBRoute(routeStr)) return 'ctb';
        return 'kmb'; // default: try KMB first
    },

    /**
     * Get all routes (KMB) with caching
     */
    async getAllRoutes() {
        try {
            const cached = await chrome.storage.local.get('routeList');
            if (cached.routeList && cached.routeList.timestamp) {
                const age = Date.now() - cached.routeList.timestamp;
                if (age < 24 * 60 * 60 * 1000) {
                    this.routeCache = new Map(cached.routeList.data.map(route => [
                        `${route.route}-${route.bound}-${route.service_type}`,
                        route
                    ]));
                    return cached.routeList.data;
                }
            }
        } catch (_) { /* no cached routes */ }

        const url = `${this.baseUrls.kmb}/route/`;
        try {
            const response = await this.fetch(url);
            if (response && response.data) {
                response.data.forEach(route => {
                    const key = `${route.route}-${route.bound}-${route.service_type}`;
                    this.routeCache.set(key, route);
                });
                try {
                    await chrome.storage.local.set({
                        routeList: { data: response.data, timestamp: Date.now() }
                    });
                } catch (_) { /* storage full, ignore */ }
                return response.data;
            }
        } catch (error) {
            console.error('Failed to fetch routes from API:', error);
            try {
                const cached = await chrome.storage.local.get('routeList');
                if (cached.routeList && cached.routeList.data) {
                    this.routeCache = new Map(cached.routeList.data.map(route => [
                        `${route.route}-${route.bound}-${route.service_type}`,
                        route
                    ]));
                    return cached.routeList.data;
                }
            } catch (_) { /* no cache fallback */ }
        }
        return [];
    },

    /**
     * Get all routes for GMB (green minibus)
     * GMB API: GET /route/ returns routes grouped by district (HKI, KLN, NT)
     * We flatten them into a uniform array matching KMB/CTB format for search.
     */
    async getAllGMBRoutes() {
        const url = `${this.baseUrls.gmb}/route/`;
        try {
            const response = await this.fetch(url);
            if (response && response.data && response.data.routes) {
                // Flatten district-grouped routes into array of route objects
                const allRoutes = [];
                const districts = response.data.routes;
                for (const [district, routeCodes] of Object.entries(districts)) {
                    for (const routeCode of routeCodes) {
                        allRoutes.push({
                            route: routeCode,
                            co: 'GMB',
                            region: district,
                            // GMB routes don't have bound/orig/dest at list level
                            // Those come from the route detail endpoint
                        });
                    }
                }
                return allRoutes;
            }
            return [];
        } catch (error) {
            console.error('Failed to fetch GMB routes:', error);
            return [];
        }
    },

    /**
     * Get all routes for CTB/NWFB
     * @param {string} company - 'ctb' or 'nwfb' (or both)
     */
    async getAllCTBRoutes(company = 'ctb') {
        const url = `${this.baseUrls.ctb}/route/${company}`;
        try {
            const response = await this.fetch(url);
            return response?.data || [];
        } catch (error) {
            console.error(`Failed to fetch CTB routes (${company}):`, error);
            return [];
        }
    },

    /**
     * Search routes by route number (KMB, GMB, CTB/NWFB)
     */
    async searchRoutes(query) {
        const searchTerm = query.toUpperCase().trim();
        if (!searchTerm) return [];

        // Search KMB, CTB, and GMB providers (NWFB merged into CTB, empty endpoint)
        const [kmbRoutes, ctbRoutes, gmbRoutes] = await Promise.all([
            this.getAllRoutes(),
            this.getAllCTBRoutes('ctb'),
            this.getAllGMBRoutes()
        ]);
        let allRoutes = [...kmbRoutes, ...ctbRoutes, ...gmbRoutes];

        const matches = allRoutes.filter(route =>
            route.route && route.route.toUpperCase().includes(searchTerm)
        );

        // Deduplicate by route number + provider (KMB & CTB can have same number = different routes)
        const seen = new Set();
        const unique = [];
        matches.forEach(route => {
            // Determine provider from the API it came from
            const provider = route.co ? route.co.toLowerCase() : (route.orig_en ? 'ctb' : 'kmb');
            const key = `${route.route}-${provider}-${route.bound || route.service_type || 'O'}`;
            if (!seen.has(key)) {
                seen.add(key);
                // Tag with provider so downstream knows which API to use
                route._provider = provider;
                unique.push(route);
            }
        });

        return unique.slice(0, 15);
    },

    _companyForRoute(routeStr) {
        // All routes are now under CTB since the NWFB merger
        // The API only accepts 'ctb' as company parameter
        return 'ctb';
    },

    /**
     * Get route details (auto-detect provider)
     * CTB: single route list endpoint with query params
     * KMB: /route/{route}/{direction}/{serviceType}
     */
    async getRoute(route, bound, serviceType = '1') {
        const provider = this._providerForRoute(route);

        if (provider === 'ctb') {
            const company = this._companyForRoute(route);
            const direction = this._normaliseRouteDirection(bound);
            // CTB route detail: filter from route list with query params
            const url = `${this.baseUrls.ctb}/route/${company}?route=${route}`;
            try {
                const response = await this.fetch(url);
                if (response && response.data) {
                    // CTB route list doesn't have dir/bound field — direction is inferred from route-stop
                    const match = response.data.find(r => r.route === route);
                    return match || null;
                }
                return null;
            } catch (error) {
                console.warn('CTB route details failed:', error);
                return null;
            }
        }

        const direction = this._normaliseRouteDirection(bound);
        const url = `${this.baseUrls.kmb}/route/${route}/${direction}/${serviceType}`;
        try {
            const response = await this.fetch(url);
            return response?.data || null;
        } catch (error) {
            console.warn('KMB route details failed:', error);
            return null;
        }
    },

    /**
     * Get all stops for a route (auto-detect provider)
     * @param {string} route - Route number
     * @param {string} bound - 'O'/'I' or 'outbound'/'inbound'
     * @param {string} serviceType - Service type (default '1')
     * @param {string} forceProvider - Optional: 'kmb' or 'ctb' to override auto-detection
     */
    async getRouteStops(route, bound, serviceType = '1', forceProvider = null) {
        const provider = forceProvider || this._providerForRoute(route);

        if (provider === 'ctb') {
            const company = this._companyForRoute(route);
            const direction = this._normaliseRouteDirection(bound);
            const url = `${this.baseUrls.ctb}/route-stop/${company}/${route}/${direction}`;
            try {
                const response = await this.fetch(url);
                if (response && response.data) {
                    // CTB returns stops with stop ID only; enrich with stop info if available
                    const stops = await Promise.all(response.data.map(async (rs, idx) => {
                        let stopInfo = this.stopCache.get(rs.stop);
                        if (!stopInfo) {
                            try {
                                stopInfo = await this.getStopCTB(rs.stop, company);
                                if (stopInfo) {
                                    this.stopCache.set(rs.stop, stopInfo);
                                }
                            } catch (_) {
                                stopInfo = null;
                            }
                        }
                        return {
                            ...rs,
                            seq: rs.seq || idx + 1,
                            stopInfo: stopInfo || {
                                stop: rs.stop,
                                name_en: `Stop ${rs.stop}`,
                                name_tc: `站點 ${rs.stop}`,
                                lat: '22.3193',
                                long: '114.1694'
                            }
                        };
                    }));
                    return stops;
                }
            } catch (error) {
                console.error(`CTB route stops failed for ${route}:`, error);
                return [];
            }
            return [];
        }

        try {
            // KMB route-stop endpoint requires 'outbound'/'inbound' (not 'O'/'I')
            const direction = this._normaliseRouteDirection(bound);
            const url = `${this.baseUrls.kmb}/route-stop/${route}/${direction}/${serviceType}`;
            const response = await this.fetch(url);
            if (response && response.data) {
                const stops = [];
                const batchSize = 5;
                for (let i = 0; i < response.data.length; i += batchSize) {
                    const batch = response.data.slice(i, i + batchSize);
                    const batchResults = await Promise.all(batch.map(async (routeStop) => {
                        try {
                            const stopDetail = await this.getStop(routeStop.stop);
                            return { ...routeStop, stopInfo: stopDetail };
                        } catch (_) {
                            return {
                                ...routeStop,
                                stopInfo: {
                                    stop: routeStop.stop,
                                    name_en: `Stop ${routeStop.stop}`,
                                    name_tc: `站點 ${routeStop.stop}`,
                                    lat: '22.3193',
                                    long: '114.1694'
                                }
                            };
                        }
                    }));
                    stops.push(...batchResults);
                }
                return stops;
            }
        } catch (error) {
            console.error(`Failed to get route stops for ${route} bound ${bound}:`, error);
            return [];
        }
        return [];
    },

    /**
     * Get CTB stop information
     */
    async getStopCTB(stopId, company = 'ctb') {
        if (this.stopCache.has(stopId)) {
            return this.stopCache.get(stopId);
        }
        // CTB stop endpoint: /stop/{stopId} (no company prefix)
        const url = `${this.baseUrls.ctb}/stop/${stopId}`;
        try {
            const response = await this.fetch(url);
            if (response && response.data && Object.keys(response.data).length > 0) {
                this.stopCache.set(stopId, response.data);
                return response.data;
            }
        } catch (error) {
            console.warn(`CTB API failed for stop ${stopId}:`, error);
        }
        return null;
    },

    /**
     * Get stop information with cache
     */
    async getStop(stopId) {
        if (this.stopCache.has(stopId)) {
            return this.stopCache.get(stopId);
        }
        const url = `${this.baseUrls.kmb}/stop/${stopId}`;
        try {
            const response = await this.fetch(url);
            if (response && response.data) {
                this.stopCache.set(stopId, response.data);
                return response.data;
            }
        } catch (error) {
            console.warn(`KMB API failed for stop ${stopId}:`, error);
        }
        throw new Error(`Unable to fetch stop information for ${stopId}`);
    },

    /**
     * Get ETAs for the entire route (KMB bulk endpoint)
     * @param {string} route - Route number
     * @param {string} serviceType - Service type (default '1')
     * @param {string} forceProvider - Optional: 'kmb' or 'ctb' to override auto-detection
     */
    async getRouteETA(route, serviceType = '1', forceProvider = null) {
        const provider = forceProvider || this._providerForRoute(route);

        if (provider === 'ctb') {
            // CTB doesn't have route-level ETA; return empty (callers handle this)
            return [];
        }

        const url = `${this.baseUrls.kmb}/route-eta/${route}/${serviceType}`;
        try {
            const response = await this.fetch(url);
            if (response && response.data) {
                return response.data;
            }
        } catch (error) {
            console.warn('Route ETA API failed:', error);
        }
        return [];
    },

    /**
     * Get ETA for a specific stop (returns all routes at that stop)
     * @deprecated Use getStopRouteETA for specific route+stop
     */
    async getETA(stopId, route = null, format = 'both') {
        const url = `${this.baseUrls.kmb}/stop-eta/${stopId}`;
        try {
            const response = await this.fetch(url);
            if (response && response.data) {
                let etas = response.data;
                if (route) {
                    etas = etas.filter(e => e.route === route);
                }
                etas.sort((a, b) => new Date(a.eta) - new Date(b.eta));
                return etas.map(eta => ({
                    ...eta,
                    formatted: this.formatETA(eta.eta, format)
                }));
            }
        } catch (error) {
            console.warn('ETA API failed:', error);
        }
        return [];
    },

    /**
     * Get ETA for a specific stop+route combination (auto-detect provider)
     * @param {string} stopId - Stop ID
     * @param {string} route - Route number
     * @param {string} serviceType - Service type (default '1')
     * @param {string} forceProvider - Optional: 'kmb' or 'ctb' to override auto-detection
     */
    async getStopRouteETA(stopId, route, serviceType = '1', forceProvider = null) {
        const provider = forceProvider || this._providerForRoute(route);

        if (provider === 'ctb') {
            const company = this._companyForRoute(route);
            // CTB ETA: endpoint is /eta/{company}/{stop_id}/{route_no}
            const url = `${this.baseUrls.ctb}/eta/${company}/${stopId}/${route}`;
            try {
                const response = await this.fetch(url);
                if (response && response.data) {
                    return response.data.map(eta => ({
                        ...eta,
                        formatted: this.formatETA(eta.eta)
                    }));
                }
            } catch (error) {
                console.warn('CTB ETA API failed:', error);
            }
            return [];
        }

        const url = `${this.baseUrls.kmb}/eta/${stopId}/${route}/${serviceType}`;
        try {
            const response = await this.fetch(url);
            if (response && response.data) {
                return response.data.map(eta => ({
                    ...eta,
                    formatted: this.formatETA(eta.eta)
                }));
            }
        } catch (error) {
            console.warn('Stop-Route ETA API failed:', error);
        }

        // Fallback: try stop-eta endpoint
        const fallbackEtas = await this.getETA(stopId, route, 'both');
        return fallbackEtas;
    },

    /**
     * Format ETA time for display
     * @param {string} etaISO - ISO timestamp
     * @param {string} format - 'relative', 'absolute', or 'both'
     */
    formatETA(etaISO, format = 'both') {
        if (!etaISO) {
            return {
                minutes: null,
                text: '*',
                status: 'scheduled',
                time: '--:--',
                display: '*'
            };
        }

        const now = new Date();
        const eta = new Date(etaISO);
        const diffMs = eta - now;
        const diffMins = Math.round(diffMs / 60000);

        let status = 'normal';
        let text = '';
        let display = '';

        if (diffMins <= 0) {
            status = 'arriving';
            text = 'Arriving';
        } else if (diffMins <= 3) {
            status = 'arriving';
            text = `${diffMins} min${diffMins > 1 ? 's' : ''}`;
        } else if (diffMins <= 10) {
            status = 'soon';
            text = `${diffMins} mins`;
        } else {
            status = 'normal';
            text = `${diffMins} mins`;
        }

        const time = eta.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

        switch (format) {
            case 'relative':
                display = text;
                break;
            case 'absolute':
                display = time;
                break;
            case 'both':
            default:
                display = `${text} (${time})`;
                break;
        }

        return { minutes: diffMins, text, status, time, display };
    },

    /**
     * Get all route variants (inbound/outbound/service types) for a route number.
     * For ambiguous routes (exist in both KMB and CTB), returns from BOTH providers
     * so the user can pick the correct one.
     */
    async getRouteVariants(routeNumber) {
        const rn = routeNumber.toUpperCase();

        // Check if route exists in KMB
        const kmbRoutes = await this.getAllRoutes();
        const kmbVariants = kmbRoutes.filter(route => route.route === rn);

        // Check if route also exists in CTB (NWFB merged into CTB, no separate endpoint)
        const ctbRoutes = await this.getAllCTBRoutes('ctb');
        const ctbVariants = ctbRoutes.filter(route => route.route === rn);

        // Merge: tag each variant with its provider
        const kmbTagged = kmbVariants.map(r => ({ ...r, _provider: 'kmb' }));
        // CTB routes don't have bound/service_type — try both directions so user can pick
        const ctbTagged = [];
        for (const r of ctbVariants) {
            for (const dir of ['outbound', 'inbound']) {
                ctbTagged.push({ ...r, _provider: 'ctb', bound: dir, service_type: '1' });
            }
        }

        // If only one provider has it, return those
        if (kmbTagged.length === 0) return ctbTagged;
        if (ctbTagged.length === 0) return kmbTagged;

        // Both have it: return both, tagged so UI can distinguish
        return [...kmbTagged, ...ctbTagged];
    },

    /**
     * Clear all API caches
     */
    clearCache() {
        this.cache.clear();
        this.rateLimit.timestamps = [];
        console.log('API cache cleared');
    },

    /**
     * Get cache statistics
     */
    getCacheStats() {
        return {
            size: this.cache.size,
            routes: this.routeCache.size,
            stops: this.stopCache.size,
            rateLimitQueue: this.rateLimit.queue.length
        };
    },

    /**
     * Search for bus stops by name
     * Searches KMB stop API, falls back to local stop cache.
     * The /stop endpoint returns ALL stops (~6700) so we cache it aggressively (1 hour).
     * @param {string} query - Stop name or ID to search
     * @returns {Promise<Array>} Array of matching stops
     */
    async searchStops(query) {
        const q = query.trim().toLowerCase();
        if (!q) return [];

        // Try KMB stop list API first (cached for 1 hour due to large response)
        try {
            // Use a longer cache for the stop list since it rarely changes
            const cached = this.cache.get('kmbStopList');
            let stops;
            if (cached && Date.now() - cached.timestamp < 3600000) { // 1 hour
                stops = cached.data;
            } else {
                const url = `${this.baseUrls.kmb}/stop`;
                const response = await this.fetch(url);
                if (response && response.data) {
                    stops = response.data;
                    this.cache.set('kmbStopList', { data: stops, timestamp: Date.now() });
                }
            }
            if (stops) {
                const filtered = stops.filter(s =>
                    (s.name_en && s.name_en.toLowerCase().includes(q)) ||
                    (s.name_tc && s.name_tc.includes(q)) ||
                    (s.stop && s.stop.includes(q))
                );
                return filtered.slice(0, 20);
            }
        } catch (e) {
            console.warn('KMB stop list API failed, using local cache:', e);
        }

        // Fallback: local stop cache built by popup
        try {
            const cached = await chrome.storage.local.get('stopList');
            if (cached.stopList && cached.stopList.data) {
                const data = cached.stopList.data;
                return data.filter(s =>
                    (s.name_en && s.name_en.toLowerCase().includes(q)) ||
                    (s.name_tc && s.name_tc.includes(q)) ||
                    (s.stop && s.stop.includes(q))
                ).slice(0, 20);
            }
        } catch (_) {}

        return [];
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