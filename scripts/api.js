// Hong Kong Public Transport API Client - KMB Integration
// Real API integration with KMB (Kowloon Motor Bus)

const API = {
    // KMB API Base URL
    baseUrls: {
        kmb: 'https://data.etabus.gov.hk/v1/transport/kmb',
        rt: 'https://rt.data.gov.hk/v1/transport'
    },

    // Cache for API responses
    cache: new Map(),
    cacheTimeout: 30000, // 30 seconds
    
    // Route data cache
    routeCache: new Map(),
    stopCache: new Map(),

    /**
     * Generic fetch with error handling and caching
     */
    async fetch(url, options = {}) {
        const cacheKey = url;
        const cached = this.cache.get(cacheKey);
        
        if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
            return cached.data;
        }

        try {
            const response = await fetch(url, {
                ...options,
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'EasyETA_HK/1.0.0 (Chrome Extension)',
                    'Referer': 'https://data.etabus.gov.hk/',
                    'Origin': 'https://data.etabus.gov.hk',
                    ...options.headers
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            
            // Cache the response
            this.cache.set(cacheKey, {
                data,
                timestamp: Date.now()
            });

            return data;
        } catch (error) {
            console.error('API fetch error:', error);
            throw error;
        }
    },

    /**
     * Get all routes with caching
     */
    async getAllRoutes() {
        // Check persistent cache first
        try {
            const cached = await chrome.storage.local.get('routeList');
            if (cached.routeList && cached.routeList.timestamp) {
                const age = Date.now() - cached.routeList.timestamp;
                if (age < 24 * 60 * 60 * 1000) { // 24 hours
                    this.routeCache = new Map(cached.routeList.data.map(route => [
                        `${route.route}-${route.bound}-${route.service_type}`,
                        route
                    ]));
                    return cached.routeList.data;
                }
            }
        } catch (error) {
            console.log('No cached routes found');
        }

        const url = `${this.baseUrls.kmb}/route/`;
        try {
            const response = await this.fetch(url);
            
            if (response && response.data) {
                // Cache routes for quick lookup
                response.data.forEach(route => {
                    const key = `${route.route}-${route.bound}-${route.service_type}`;
                    this.routeCache.set(key, route);
                });

                // Save to persistent storage
                try {
                    await chrome.storage.local.set({
                        routeList: {
                            data: response.data,
                            timestamp: Date.now()
                        }
                    });
                } catch (error) {
                    console.error('Failed to cache routes:', error);
                }

                return response.data;
            }
        } catch (error) {
            console.error('Failed to fetch routes from API:', error);
            // Try to return cached data if available
            try {
                const cached = await chrome.storage.local.get('routeList');
                if (cached.routeList && cached.routeList.data) {
                    console.log('Using cached route data');
                    this.routeCache = new Map(cached.routeList.data.map(route => [
                        `${route.route}-${route.bound}-${route.service_type}`,
                        route
                    ]));
                    return cached.routeList.data;
                }
            } catch (cacheError) {
                console.error('No cached routes available:', cacheError);
            }
        }
        return [];
    },

    /**
     * Search routes by route number
     */
    async searchRoutes(query) {
        const allRoutes = await this.getAllRoutes();
        const searchTerm = query.toUpperCase().trim();
        
        if (!searchTerm) return [];
        
        // Filter routes that match the search term
        const matches = allRoutes.filter(route => 
            route.route.toUpperCase().includes(searchTerm)
        );
        
        // Group by route number and get unique routes
        const uniqueRoutes = [];
        const seen = new Set();
        
        matches.forEach(route => {
            if (!seen.has(route.route)) {
                seen.add(route.route);
                uniqueRoutes.push(route);
            }
        });
        
        return uniqueRoutes.slice(0, 10); // Limit to 10 results
    },

    /**
     * Get route details
     */
    async getRoute(route, bound, serviceType = '1') {
        const direction = bound === 'O' ? 'outbound' : 'inbound';
        const url = `${this.baseUrls.kmb}/route/${route}/${direction}/${serviceType}`;
        try {
            const response = await this.fetch(url);
            return response?.data || null;
        } catch (error) {
            console.warn(`Failed to get route details:`, error);
            return null;
        }
    },

    /**
     * Get all stops for a route
     */
    async getRouteStops(route, bound, serviceType = '1') {
        const direction = bound === 'O' ? 'outbound' : 'inbound';
        try {
            const url = `${this.baseUrls.kmb}/route-stop/${route}/${direction}/${serviceType}`;
            const response = await this.fetch(url);
            
            if (response && response.data) {
                // Get stop details for each stop with error handling
                const stops = [];
                // Process stops in parallel to speed up loading
                // But careful with request limits? KMB API is usually fine
                
                // Let's load stop details in smaller batches
                const batchSize = 5;
                for (let i = 0; i < response.data.length; i += batchSize) {
                    const batch = response.data.slice(i, i + batchSize);
                    const batchResults = await Promise.all(batch.map(async (routeStop) => {
                        try {
                            const stopDetail = await this.getStop(routeStop.stop);
                            return {
                                ...routeStop,
                                stopInfo: stopDetail
                            };
                        } catch (error) {
                            console.warn(`Failed to get stop details for ${routeStop.stop}:`, error);
                            return {
                                ...routeStop,
                                stopInfo: {
                                    stop: routeStop.stop,
                                    name_en: `Stop ${routeStop.stop}`,
                                    name_tc: `站點 ${routeStop.stop}`,
                                    lat: '22.3193', // Fallback
                                    long: '114.1694' // Fallback
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
            // Return empty array when API fails - no mock data
            return [];
        }
        return [];
    },

    /**
     * Get stop information with fallback
     */
    async getStop(stopId) {
        // Check cache first
        if (this.stopCache.has(stopId)) {
            return this.stopCache.get(stopId);
        }
        
        try {
            // Try the main KMB API first
            const url = `${this.baseUrls.kmb}/stop/${stopId}`;
            const response = await this.fetch(url);
            
            if (response && response.data) {
                const stopData = response.data;
                this.stopCache.set(stopId, stopData);
                return stopData;
            }
        } catch (error) {
             // Fallback logic remains same, but let's fix the URL logic if needed
             // ...
             // For now let's assume the fallback in old code was mostly for mock. 
             // We can keep the Error throw if main API fails.
             console.warn(`KMB API failed for stop ${stopId}:`, error);
        }
        
        throw new Error(`Unable to fetch stop information for ${stopId}`);
    },

    /**
     * Get ETAs for the entire route (optimization)
     * @param {string} route
     * @param {string} serviceType
     */
    async getRouteETA(route, serviceType = '1') {
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
     * Get ETA for a specific stop and route
     * @deprecated Use getRouteETA for bulk fetching
     */
    async getETA(stopId, route = null, format = 'both') {
        // Use stop-eta endpoint (returns all routes for this stop)
        // URL: /stop-eta/{stop_id}
        const url = `${this.baseUrls.kmb}/stop-eta/${stopId}`;
        
        try {
            const response = await this.fetch(url);
            
            if (response && response.data) {
                let etas = response.data;
                
                // Filter by route if specified
                if (route) {
                    etas = etas.filter(e => e.route === route);
                }
                
                // Sort by time
                etas.sort((a, b) => new Date(a.eta) - new Date(b.eta));

                return etas.map(eta => ({
                    ...eta,
                    formatted: this.formatETA(eta.eta, format)
                }));
            }
        } catch (error) {
            console.warn('ETA API failed, returning empty array:', error);
        }
        return [];
    },

    /**
     * Get ETA for a specific stop and route combination (optimized)
     * @param {string} stopId
     * @param {string} route
     * @param {string} serviceType
     */
    async getStopRouteETA(stopId, route, serviceType = '1') {
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
        return [];
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

        // Format display based on user preference
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

        return {
            minutes: diffMins,
            text,
            status,
            time,
            display
        };
    },

    /**
     * Get all route variants (inbound/outbound)
     */
    async getRouteVariants(routeNumber) {
        const allRoutes = await this.getAllRoutes();
        return allRoutes.filter(route => route.route === routeNumber.toUpperCase());
    },

    /**
     * Clear API cache
     */
    clearCache() {
        this.cache.clear();
        console.log('API cache cleared');
    },

    /**
     * Get cache statistics
     */
    getCacheStats() {
        return {
            size: this.cache.size,
            routes: this.routeCache.size,
            stops: this.stopCache.size
        };
    },

    /**
     * Search for bus stops by name or route
     * @param {string} query - Search query
     * @returns {Promise<Array>} Array of matching bus stops
     */
    async searchStops(query) {
        // TODO: Implement actual HK government API integration
        throw new Error('Stop search not yet implemented - requires HK government API integration');
    }
};

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
}

// Make API available globally for browser extension context
// Check if we're in a browser context (popup/content scripts) or service worker context
if (typeof window !== 'undefined') {
    window.API = API;
} else if (typeof globalThis !== 'undefined') {
    // Service worker context
    globalThis.API = API;
}
