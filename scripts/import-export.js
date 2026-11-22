// Import/Export Utility
// Handles data export and import for backup and sync

const ImportExport = {
    /**
     * Export all data to JSON
     * @returns {Promise<Object>} Exportable data object
     */
    async exportAll() {
        const data = await Storage.getAll();
        const sync = await chrome.storage.sync.get(null);
        const settings = await Storage.getSettings();
        
        const exportData = {
            version: '1.0.0',
            exportedAt: new Date().toISOString(),
            exportedBy: `EasyETA_HK v${chrome.runtime.getManifest().version}`,
            
            data: {
                rules: data.rules || [],
                favorites: data.favorites || [],
                folders: data.folders || [],
                timeslots: data.timeslots || [],
                recentSearches: data.recentSearches || [],
                settings: { ...settings, ...sync },
                usage: data.usage || {}
            },
            
            stats: {
                totalRules: (data.rules || []).length,
                totalFavorites: (data.favorites || []).length,
                totalFolders: (data.folders || []).length,
                totalTimeslots: (data.timeslots || []).length,
                rulesEnabled: (data.rules || []).filter(r => r.enabled).length
            }
        };
        
        return exportData;
    },

    /**
     * Export only rules
     * @returns {Promise<Object>} Exportable rules data
     */
    async exportRules() {
        const rules = await Storage.getRules();
        
        return {
            version: '1.0.0',
            exportedAt: new Date().toISOString(),
            type: 'rules',
            data: { rules },
            stats: {
                totalRules: rules.length,
                rulesEnabled: rules.filter(r => r.enabled).length
            }
        };
    },

    /**
     * Export only favorites
     * @returns {Promise<Object>} Exportable favorites data
     */
    async exportFavorites() {
        const favorites = await Storage.getFavorites();
        
        return {
            version: '1.0.0',
            exportedAt: new Date().toISOString(),
            type: 'favorites',
            data: { favorites },
            stats: {
                totalFavorites: favorites.length
            }
        };
    },

    /**
     * Download export data as JSON file
     * @param {Object} data - Data to export
     * @param {string} filename - Filename for download
     */
    downloadJSON(data, filename = 'easyeta_backup.json') {
        const blob = new Blob([JSON.stringify(data, null, 2)], {
            type: 'application/json'
        });
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        
        // Clean up
        setTimeout(() => URL.revokeObjectURL(url), 100);
    },

    /**
     * Validate import data
     * @param {Object} data - Data to validate
     * @returns {Object} Validation result
     */
    validateImport(data) {
        const errors = [];
        const warnings = [];
        
        // Check required fields
        if (!data || typeof data !== 'object' || Array.isArray(data)) {
            errors.push('Import must be a JSON object');
        }
        if (!data?.version) errors.push('Missing version field');
        if (!data?.data || typeof data.data !== 'object') errors.push('Missing data field');
        
        // Check version compatibility
        if (data.version && !this.isVersionCompatible(data.version)) {
            warnings.push(`Data version ${data.version} may not be fully compatible`);
        }
        
        // Validate rules if present
        if (data.data?.rules) {
            if (!Array.isArray(data.data.rules)) {
                errors.push('Rules must be an array');
            } else {
                data.data.rules.forEach((rule, index) => {
                    if (!rule.id) {
                        errors.push(`Rule ${index} is missing ID`);
                    }
                    if (!rule.name) {
                        errors.push(`Rule ${index} is missing name`);
                    }
                });
            }
        }
        
        for (const key of ['favorites', 'folders', 'timeslots', 'recentSearches']) {
            if (data.data?.[key] != null && !Array.isArray(data.data[key])) errors.push(`${key} must be an array`);
        }
        
        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
    },

    /**
     * Check if version is compatible
     * @param {string} version - Version string to check
     * @returns {boolean} True if compatible
     */
    isVersionCompatible(version) {
        // Simple version check - can be enhanced
        const [major] = version.split('.');
        return major === '1';
    },

    /**
     * Import data from JSON object
     * @param {Object} data - Data to import
     * @param {Object} options - Import options
     * @returns {Promise<Object>} Import result
     */
    async importData(data, options = {}) {
        const {
            merge = false,      // If true, merge with existing data; if false, replace
            importRules = true,
            importFavorites = true,
            importFolders = true,
            importTimeslots = true,
            importRecentSearches = true,
            importSettings = true
        } = options;
        
        // Normalize the older flat backup format before validation/import.
        if (data && !data.data && ['favorites', 'folders', 'rules'].some(key => Array.isArray(data[key]))) {
            data = { version: data.version || '1.0.0', data };
        }
        const validation = this.validateImport(data);
        if (!validation.valid) throw new Error(`Invalid import data: ${validation.errors.join(', ')}`);

        const result = {
            success: false,
            imported: {
                rules: 0,
                favorites: 0,
                folders: 0,
                timeslots: 0,
                recentSearches: 0,
                settings: false
            },
            errors: [],
            warnings: validation.warnings
        };
        
        try {
            // Import rules
            if (importRules && data.data.rules) {
                const existingRules = merge ? await Storage.getRules() : [];
                const newRules = data.data.rules;
                
                let combinedRules;
                if (merge) {
                    // Merge: add new rules, update existing ones
                    combinedRules = [...existingRules];
                    newRules.forEach(newRule => {
                        const existingIndex = combinedRules.findIndex(r => r.id === newRule.id);
                        if (existingIndex >= 0) {
                            combinedRules[existingIndex] = newRule;
                        } else {
                            combinedRules.push(newRule);
                        }
                    });
                } else {
                    // Replace
                    combinedRules = newRules;
                }
                
                await Storage.saveRules(combinedRules);
                result.imported.rules = newRules.length;
            }
            
            // Import favorites
            if (importFavorites && data.data.favorites) {
                const existingFavorites = merge ? await Storage.getFavorites() : [];
                const newFavorites = data.data.favorites;
                
                let combinedFavorites;
                if (merge) {
                    // Merge: add new favorites, avoid duplicates
                    combinedFavorites = [...existingFavorites];
                    newFavorites.forEach(newFav => {
                        const exists = combinedFavorites.some(f => f.stopId === newFav.stopId);
                        if (!exists) {
                            combinedFavorites.push(newFav);
                        }
                    });
                } else {
                    // Replace
                    combinedFavorites = newFavorites;
                }
                
                await Storage.saveFavorites(combinedFavorites);
                result.imported.favorites = newFavorites.length;
            }
            
            // Import folders
            if (importFolders && data.data.folders) {
                const existingFolders = merge ? await Storage.getFolders() : [];
                const newFolders = data.data.folders;
                
                let combinedFolders;
                if (merge) {
                    // Merge: add new folders, update existing ones
                    combinedFolders = [...existingFolders];
                    newFolders.forEach(newFolder => {
                        const existingIndex = combinedFolders.findIndex(f => f.id === newFolder.id);
                        if (existingIndex >= 0) {
                            combinedFolders[existingIndex] = newFolder;
                        } else {
                            combinedFolders.push(newFolder);
                        }
                    });
                } else {
                    // Replace
                    combinedFolders = newFolders;
                }
                
                await Storage.saveFolders(combinedFolders);
                result.imported.folders = newFolders.length;
            }
            
            // Import timeslots
            if (importTimeslots && data.data.timeslots) {
                const existingTimeslots = merge ? await Storage.getTimeslots() : [];
                const newTimeslots = data.data.timeslots;
                
                let combinedTimeslots;
                if (merge) {
                    // Merge: add new timeslots, update existing ones
                    combinedTimeslots = [...existingTimeslots];
                    newTimeslots.forEach(newTimeslot => {
                        const existingIndex = combinedTimeslots.findIndex(t => t.id === newTimeslot.id);
                        if (existingIndex >= 0) {
                            combinedTimeslots[existingIndex] = newTimeslot;
                        } else {
                            combinedTimeslots.push(newTimeslot);
                        }
                    });
                } else {
                    // Replace
                    combinedTimeslots = newTimeslots;
                }
                
                await Storage.saveTimeslots(combinedTimeslots);
                result.imported.timeslots = newTimeslots.length;
            }
            
            // Import recent searches
            if (importRecentSearches && data.data.recentSearches) {
                const existingRecentSearches = merge ? await Storage.getRecentSearches() : [];
                const newRecentSearches = data.data.recentSearches;
                
                let combinedRecentSearches;
                if (merge) {
                    // Merge: add new searches, avoid duplicates
                    combinedRecentSearches = [...existingRecentSearches];
                    newRecentSearches.forEach(newSearch => {
                        const exists = combinedRecentSearches.some(s => s.query === newSearch.query);
                        if (!exists) {
                            combinedRecentSearches.push(newSearch);
                        }
                    });
                } else {
                    // Replace
                    combinedRecentSearches = newRecentSearches;
                }
                
                await Storage.saveRecentSearches(combinedRecentSearches);
                result.imported.recentSearches = newRecentSearches.length;
            }
            
            // Import settings
            if (importSettings && data.data.settings) {
                const currentSettings = await Storage.getSettings();
                const newSettings = merge 
                    ? { ...currentSettings, ...data.data.settings }
                    : data.data.settings;
                
                await Storage.saveSettings(newSettings);
                await chrome.storage.sync.set({ theme: newSettings.theme, language: newSettings.language, autoRefresh: newSettings.autoRefresh });
                result.imported.settings = true;
            }
            
            result.success = true;
        } catch (error) {
            result.errors.push(error.message);
            throw error;
        }
        
        return result;
    },

    /**
     * Read JSON file from file input
     * @param {File} file - File object from input
     * @returns {Promise<Object>} Parsed JSON data
     */
    async readJSONFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    resolve(data);
                } catch (error) {
                    reject(new Error('Invalid JSON file'));
                }
            };
            
            reader.onerror = () => {
                reject(new Error('Failed to read file'));
            };
            
            reader.readAsText(file);
        });
    }
};

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ImportExport;
}
