// Storage Utility Module
// Handles all Chrome storage operations with a consistent API

const Storage = {
    /**
     * Get a single value from storage
     * @param {string} key - The key to retrieve
     * @returns {Promise<any>} The stored value or null
     */
    async get(key) {
        try {
            const result = await chrome.storage.local.get(key);
            return result[key] || null;
        } catch (error) {
            console.error(`Error getting ${key} from storage:`, error);
            return null;
        }
    },

    /**
     * Get multiple values from storage
     * @param {string[]} keys - Array of keys to retrieve
     * @returns {Promise<Object>} Object with key-value pairs
     */
    async getMultiple(keys) {
        try {
            const result = await chrome.storage.local.get(keys);
            return result;
        } catch (error) {
            console.error('Error getting multiple values from storage:', error);
            return {};
        }
    },

    /**
     * Get all stored data
     * @returns {Promise<Object>} All stored data
     */
    async getAll() {
        try {
            const result = await chrome.storage.local.get(null);
            return result;
        } catch (error) {
            console.error('Error getting all data from storage:', error);
            return {};
        }
    },

    /**
     * Set a single value in storage
     * @param {string} key - The key to set
     * @param {any} value - The value to store
     * @returns {Promise<boolean>} Success status
     */
    async set(key, value) {
        try {
            await chrome.storage.local.set({ [key]: value });
            return true;
        } catch (error) {
            console.error(`Error setting ${key} in storage:`, error);
            return false;
        }
    },

    /**
     * Set multiple values in storage
     * @param {Object} items - Object with key-value pairs to store
     * @returns {Promise<boolean>} Success status
     */
    async setMultiple(items) {
        try {
            await chrome.storage.local.set(items);
            return true;
        } catch (error) {
            console.error('Error setting multiple values in storage:', error);
            return false;
        }
    },

    /**
     * Remove a single key from storage
     * @param {string} key - The key to remove
     * @returns {Promise<boolean>} Success status
     */
    async remove(key) {
        try {
            await chrome.storage.local.remove(key);
            return true;
        } catch (error) {
            console.error(`Error removing ${key} from storage:`, error);
            return false;
        }
    },

    /**
     * Remove multiple keys from storage
     * @param {string[]} keys - Array of keys to remove
     * @returns {Promise<boolean>} Success status
     */
    async removeMultiple(keys) {
        try {
            await chrome.storage.local.remove(keys);
            return true;
        } catch (error) {
            console.error('Error removing multiple keys from storage:', error);
            return false;
        }
    },

    /**
     * Clear all storage
     * @returns {Promise<boolean>} Success status
     */
    async clear() {
        try {
            await chrome.storage.local.clear();
            return true;
        } catch (error) {
            console.error('Error clearing storage:', error);
            return false;
        }
    },

    /**
     * Get storage usage information
     * @returns {Promise<Object>} Object with bytes used and quota
     */
    async getUsage() {
        try {
            const bytesInUse = await chrome.storage.local.getBytesInUse(null);
            return {
                bytesInUse,
                quota: chrome.storage.local.QUOTA_BYTES || 5242880, // 5MB default
                percentageUsed: (bytesInUse / (chrome.storage.local.QUOTA_BYTES || 5242880)) * 100
            };
        } catch (error) {
            console.error('Error getting storage usage:', error);
            return { bytesInUse: 0, quota: 0, percentageUsed: 0 };
        }
    },

    // Specialized getters/setters for common data structures

    /**
     * Get all favorites
     * @returns {Promise<Array>} Array of favorite stops
     */
    async getFavorites() {
        const favorites = await this.get('favorites');
        return favorites || [];
    },

    /**
     * Save favorites
     * @param {Array} favorites - Array of favorite stops
     * @returns {Promise<boolean>} Success status
     */
    async saveFavorites(favorites) {
        return await this.set('favorites', favorites);
    },

    /**
     * Get all timeslots
     * @returns {Promise<Array>} Array of timeslots
     */
    async getTimeslots() {
        const timeslots = await this.get('timeslots');
        return timeslots || [];
    },

    /**
     * Save timeslots
     * @param {Array} timeslots - Array of timeslots
     * @returns {Promise<boolean>} Success status
     */
    async saveTimeslots(timeslots) {
        return await this.set('timeslots', timeslots);
    },

    /**
     * Get all folders
     * @returns {Promise<Array>} Array of folders
     */
    async getFolders() {
        const folders = await this.get('folders');
        return folders || [];
    },

    /**
     * Save folders
     * @param {Array} folders - Array of folders
     * @returns {Promise<boolean>} Success status
     */
    async saveFolders(folders) {
        return await this.set('folders', folders);
    },

    /**
     * Get recent searches
     * @returns {Promise<Array>} Array of recent searches
     */
    async getRecentSearches() {
        const recent = await this.get('recentSearches');
        return recent || [];
    },

    /**
     * Save recent searches
     * @param {Array} searches - Array of recent searches
     * @returns {Promise<boolean>} Success status
     */
    async saveRecentSearches(searches) {
        return await this.set('recentSearches', searches);
    },

    /**
     * Add a recent search
     * @param {string} route - The route number
     * @param {Object} details - Additional details about the search
     */
    async addRecentSearch(route, details = {}) {
        const searches = await this.getRecentSearches();
        
        // Remove existing entry for this route to avoid duplicates
        const filtered = searches.filter(s => s.route !== route);
        
        // Add new entry to the top
        filtered.unshift({
            route,
            searchedAt: new Date().toISOString(),
            ...details
        });
        
        // Keep only top 10
        const trimmed = filtered.slice(0, 10);
        
        return await this.saveRecentSearches(trimmed);
    },

    /**
     * Get all rules
     * @returns {Promise<Array>} Array of notification rules
     */
    async getRules() {
        const rules = await this.get('rules');
        return rules || [];
    },

    /**
     * Save rules
     * @param {Array} rules - Array of notification rules
     * @returns {Promise<boolean>} Success status
     */
    async saveRules(rules) {
        return await this.set('rules', rules);
    },

    /**
     * Get settings
     * @returns {Promise<Object>} Settings object
     */
    async getSettings() {
        const settings = await this.get('settings');
        return settings || this.getDefaultSettings();
    },

    /**
     * Save settings
     * @param {Object} settings - Settings object
     * @returns {Promise<boolean>} Success status
     */
    async saveSettings(settings) {
        return await this.set('settings', settings);
    },

    /**
     * Get default settings
     * @returns {Object} Default settings object
     */
    getDefaultSettings() {
        return {
            theme: 'light',
            language: 'en',
            notifications: {
                sound: true,
                vibrate: false,
                badge: true
            },
            autoRefresh: true,
            refreshInterval: 30, // seconds
            etaDisplayFormat: 'both' // 'relative', 'absolute', or 'both'
        };
    }
};

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Storage;
}

// Make Storage available globally for browser extension context
// Check if we're in a browser context (popup/content scripts) or service worker context
if (typeof window !== 'undefined') {
    window.Storage = Storage;
} else if (typeof globalThis !== 'undefined' && typeof chrome !== 'undefined') {
    // Service worker context - only assign if chrome APIs are available
    globalThis.Storage = Storage;
}
