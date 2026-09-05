// EasyETA_HK Internationalization (i18n) System
// Supports English (en) and Traditional Chinese (zh-HK)

const I18n = {
    _currentLang: 'en',
    _listeners: [],

    translations: {
        'en': {
            // App
            'app.name': 'EasyETA',
            'app.title': 'EasyETA_HK - HK Bus Tracker',

            // Navigation
            'nav.home': 'Home',
            'nav.search': 'Search',
            'nav.settings': 'Settings',

            // Home
            'home.favorites': 'Favorites',
            'home.recent': 'Recent Searches',
            'home.no_favorites': 'No favorites in this category',
            'home.no_favorites_all': 'No favorites yet',
            'home.no_recent': 'No recent searches',
            'home.show_more': 'Show {count} more...',
            'home.all_favorites': 'All Favorites',
            'home.last_viewed': 'Last viewed: {date}',

            // Search
            'search.placeholder': 'Search route (e.g. 968, 1A)',
            'search.placeholder_stop': 'Search route or stop (e.g. 968, 1A, Central)',
            'search.searching': 'Searching...',
            'search.no_results': 'No routes found',
            'search.no_results_stop': 'No routes or stops found',
            'search.error': 'Error searching: {message}',
            'search.search_routes': 'Routes',
            'search.search_stops': 'Stops',

            // Route Details
            'details.to': 'To {dest}',
            'details.from': 'From {orig}',
            'details.loading': 'Loading stops...',
            'details.no_stops': 'No stops found',
            'details.loading_eta': 'Loading real-time data...',
            'details.no_scheduled': 'No scheduled bus',
            'details.error_eta': 'Error loading data',
            'details.error_stops': 'Error loading stops',

            // Favorites
            'fav.add_title': 'Added to Favourites',
            'fav.add_message': 'Stop added to your favourites successfully.',
            'fav.add_message_folder': 'Stop added to folder successfully.',
            'fav.exists_title': 'Already Added',
            'fav.exists_message': 'This stop is already in your favourites.',
            'fav.updated_title': 'Updated',
            'fav.updated_message': 'Favorite has been updated successfully.',
            'fav.remove': 'Remove from favourites',
            'fav.add': 'Add to favourites',
            'fav.choose_folder': 'Choose Folder',
            'fav.select_folder': 'Select a folder for this favorite:',
            'fav.unassigned': 'Unassigned',
            'fav.cancel': 'Cancel',
            'fav.add_favorite': 'Add Favorite',
            'fav.ok': 'OK',

            // Settings (popup)
            'settings.open': 'Open Settings',
            'settings.subtitle': 'Manage rules, favorites, and preferences',
            'settings.dark_mode': 'Dark Mode',
            'settings.dark_mode_desc': 'Enable dark theme for the extension',
            'settings.auto_refresh': 'Auto Refresh (30s)',
            'settings.auto_refresh_desc': 'Automatically refresh ETA data every 30 seconds',
            'settings.language': 'Language',
            'settings.language_desc': 'Choose display language',
            'settings.reset_all': 'Reset All Data',
            'settings.reset_desc': 'Remove all favorites and history',
            'settings.reset_confirm': 'Are you sure you want to reset all data? This cannot be undone.',
            'settings.reset_title': 'Reset All Data',
            'settings.reset_button': 'Reset',

            // Options page
            'options.favorites': 'Favorites',
            'options.settings': 'Settings',
            'options.data': 'Data',
            'options.about': 'About',
            'options.folders_favorites': 'Folders & Favorites',
            'options.priority_order': 'Priority Order',
            'options.add_folder': 'Add Folder',
            'options.add_favourite': 'Add Favourite',
            'options.app_settings': 'App Settings',
            'options.test_notification': 'Test Notification',
            'options.test_notification_desc': 'Send a test notification to verify functionality',
            'options.test': 'Test',
            'options.version': 'Version',
            'options.backup_restore': 'Backup & Restore',
            'options.export_data': 'Export Data',
            'options.export_desc': 'Save your favorites to a file',
            'options.export_json': 'Export JSON',
            'options.import_data': 'Import Data',
            'options.import_desc': 'Restore from a backup file',
            'options.import': 'Import',
            'options.danger_zone': 'Danger Zone',
            'options.clear_all': 'Clear All Data',
            'options.clear_all_desc': 'Remove all favorites and history',
            'options.clear_everything': 'Clear Everything',
            'options.storage_usage': 'Storage Usage',
            'options.calculating': 'Calculating...',
            'options.storage_used': '{size} KB used by EasyETA',
            'options.no_folders': 'No folders or favorites created yet',
            'options.no_folders_desc': 'Create folders to organize your favorites into categories.',
            'options.favorites_count': '{count} favorites',
            'options.no_folder': 'No Folder',
            'options.unassigned': 'Unassigned Favorites',
            'options.edit': 'Edit',
            'options.delete': 'Delete',
            'options.save': 'Save',
            'options.cancel': 'Cancel',
            'options.remove_favorite': 'Remove Favorite',
            'options.save_changes': 'Save Changes',
            'options.edit_favorite': 'Edit Favorite',
            'options.folder': 'Folder:',
            'options.search_route': 'Search Route',
            'options.placeholder_route': 'e.g. 968, 1A',
            'options.direction': 'Direction',
            'options.select_stop': 'Select Stop',
            'options.select_direction': 'Select direction first...',
            'options.rule_name': 'Rule Name (Optional)',
            'options.placeholder_rule_name': 'e.g. Morning Bus',

            // Folder editor
            'folder.add': 'Add Folder',
            'folder.edit': 'Edit Folder',
            'folder.name': 'Name:',
            'folder.name_placeholder': 'e.g., Work Routes',
            'folder.color': 'Color:',
            'folder.days': 'Days:',
            'folder.per_day': 'Use different times per day',
            'folder.time_range': 'Time Range:',
            'folder.help': 'Favorites in this folder will appear during the selected days and time range',
            'folder.missing_name': 'Please enter a folder name.',
            'folder.conflict_title': 'Timeslot Conflict',
            'folder.conflict_save': 'Save Anyway',
            'folder.delete_confirm': 'Delete this folder? Favorites in this folder will be moved to "No Folder".',
            'folder.priority_title': 'Folder Priority Order',
            'folder.priority_help': 'Drag or use arrows to reorder folders. Higher priority folders appear first when timeslots overlap.',
            'folder.priority_saved': 'Folder priority order has been saved.',
            'folder.priority_updated': 'Priority Updated',

            // Modal
            'modal.confirm': 'OK',
            'modal.cancel': 'Cancel',

            // Timeslot
            'timeslot.none': 'No specific timeslot',
            'timeslot.no_config': 'No times configured',
            'timeslot.max_range': '(max range)',
            'timeslot.custom': 'Custom...',

            // About
            'about.description': 'A fast, privacy-focused Hong Kong bus tracker supporting KMB, CTB, and GMB.',

            // Data
            'data.import_success': 'Import successful! Reloading page...',
            'data.import_error': 'Error parsing file: {message}',
            'data.clear_confirm': "Type 'DELETE' to confirm clearing all data.",
            'data.clear_prompt': "Type 'DELETE' to confirm clearing all data.",
            'data.clear_success': 'All data cleared.',
            'data.select_file': 'Please select a JSON file first',
            'data.backup_file': 'easyeta-backup-{date}.json',

            // Search types
            'search_type.route': 'Route',
            'search_type.stop': 'Stop',
        },

        'zh-HK': {
            // App
            'app.name': 'EasyETA',
            'app.title': 'EasyETA_HK - 香港巴士追蹤',

            // Navigation
            'nav.home': '首頁',
            'nav.search': '搜尋',
            'nav.settings': '設定',

            // Home
            'home.favorites': '我的最愛',
            'home.recent': '最近搜尋',
            'home.no_favorites': '此分類沒有最愛',
            'home.no_favorites_all': '暫無最愛',
            'home.no_recent': '暫無最近搜尋',
            'home.show_more': '顯示多 {count} 個...',
            'home.all_favorites': '所有最愛',
            'home.last_viewed': '上次瀏覽：{date}',

            // Search
            'search.placeholder': '搜尋路線（例如 968, 1A）',
            'search.placeholder_stop': '搜尋路線或站點（例如 968, 1A, 中環）',
            'search.searching': '搜尋中...',
            'search.no_results': '找不到路線',
            'search.no_results_stop': '找不到路線或站點',
            'search.error': '搜尋錯誤：{message}',
            'search.search_routes': '路線',
            'search.search_stops': '站點',

            // Route Details
            'details.to': '往 {dest}',
            'details.from': '由 {orig}',
            'details.loading': '載入站點中...',
            'details.no_stops': '找不到站點',
            'details.loading_eta': '載入實時數據中...',
            'details.no_scheduled': '沒有預定班次',
            'details.error_eta': '載入數據錯誤',
            'details.error_stops': '載入站點錯誤',

            // Favorites
            'fav.add_title': '已加入最愛',
            'fav.add_message': '站點已成功加入最愛。',
            'fav.add_message_folder': '站點已成功加入資料夾。',
            'fav.exists_title': '已加入',
            'fav.exists_message': '此站點已存在於你的最愛中。',
            'fav.updated_title': '已更新',
            'fav.updated_message': '最愛已成功更新。',
            'fav.remove': '從最愛中移除',
            'fav.add': '加入最愛',
            'fav.choose_folder': '選擇資料夾',
            'fav.select_folder': '為此最愛選擇資料夾：',
            'fav.unassigned': '未分類',
            'fav.cancel': '取消',
            'fav.add_favorite': '加入最愛',
            'fav.ok': '確定',

            // Settings (popup)
            'settings.open': '開啟設定',
            'settings.subtitle': '管理規則、最愛和偏好設定',
            'settings.dark_mode': '深色模式',
            'settings.dark_mode_desc': '啟用擴充功能的深色主題',
            'settings.auto_refresh': '自動更新（30秒）',
            'settings.auto_refresh_desc': '每30秒自動更新ETA數據',
            'settings.language': '語言',
            'settings.language_desc': '選擇顯示語言',
            'settings.reset_all': '重設所有數據',
            'settings.reset_desc': '移除所有最愛和歷史記錄',
            'settings.reset_confirm': '你確定要重設所有數據嗎？此操作無法撤銷。',
            'settings.reset_title': '重設所有數據',
            'settings.reset_button': '重設',

            // Options page
            'options.favorites': '最愛',
            'options.settings': '設定',
            'options.data': '數據',
            'options.about': '關於',
            'options.folders_favorites': '資料夾與最愛',
            'options.priority_order': '優先順序',
            'options.add_folder': '新增資料夾',
            'options.add_favourite': '新增最愛',
            'options.app_settings': '應用程式設定',
            'options.test_notification': '測試通知',
            'options.test_notification_desc': '發送測試通知以驗證功能',
            'options.test': '測試',
            'options.version': '版本',
            'options.backup_restore': '備份與還原',
            'options.export_data': '匯出數據',
            'options.export_desc': '將最愛儲存到檔案',
            'options.export_json': '匯出 JSON',
            'options.import_data': '匯入數據',
            'options.import_desc': '從備份檔案還原',
            'options.import': '匯入',
            'options.danger_zone': '危險區域',
            'options.clear_all': '清除所有數據',
            'options.clear_all_desc': '移除所有最愛和歷史記錄',
            'options.clear_everything': '清除全部',
            'options.storage_usage': '儲存空間使用量',
            'options.calculating': '計算中...',
            'options.storage_used': 'EasyETA 使用了 {size} KB',
            'options.no_folders': '尚未建立資料夾或最愛',
            'options.no_folders_desc': '建立資料夾以將最愛分類整理。',
            'options.favorites_count': '{count} 個最愛',
            'options.no_folder': '無資料夾',
            'options.unassigned': '未分類最愛',
            'options.edit': '編輯',
            'options.delete': '刪除',
            'options.save': '儲存',
            'options.cancel': '取消',
            'options.remove_favorite': '移除最愛',
            'options.save_changes': '儲存變更',
            'options.edit_favorite': '編輯最愛',
            'options.folder': '資料夾：',
            'options.search_route': '搜尋路線',
            'options.placeholder_route': '例如 968, 1A',
            'options.direction': '方向',
            'options.select_stop': '選擇站點',
            'options.select_direction': '請先選擇方向...',
            'options.rule_name': '規則名稱（可選）',
            'options.placeholder_rule_name': '例如 早上巴士',

            // Folder editor
            'folder.add': '新增資料夾',
            'folder.edit': '編輯資料夾',
            'folder.name': '名稱：',
            'folder.name_placeholder': '例如：工作路線',
            'folder.color': '顏色：',
            'folder.days': '日子：',
            'folder.per_day': '每日不同時間',
            'folder.time_range': '時間範圍：',
            'folder.help': '此資料夾中的最愛將在選定的日子和時間範圍內顯示',
            'folder.missing_name': '請輸入資料夾名稱。',
            'folder.conflict_title': '時間衝突',
            'folder.conflict_save': '仍要儲存',
            'folder.delete_confirm': '刪除此資料夾？資料夾中的最愛將移至「無資料夾」。',
            'folder.priority_title': '資料夾優先順序',
            'folder.priority_help': '拖曳或使用箭頭重新排序。當時間重疊時，優先順序較高的資料夾會優先顯示。',
            'folder.priority_saved': '資料夾優先順序已儲存。',
            'folder.priority_updated': '優先順序已更新',

            // Modal
            'modal.confirm': '確定',
            'modal.cancel': '取消',

            // Timeslot
            'timeslot.none': '無特定時間',
            'timeslot.no_config': '未設定時間',
            'timeslot.max_range': '（最大範圍）',
            'timeslot.custom': '自訂...',

            // About
            'about.description': '一個快速、注重隱私的香港巴士追蹤工具，支援九巴、城巴及綠色小巴。',

            // Data
            'data.import_success': '匯入成功！正在重新載入頁面...',
            'data.import_error': '解析檔案錯誤：{message}',
            'data.clear_confirm': "請輸入 'DELETE' 以確認清除所有數據。",
            'data.clear_prompt': "請輸入 'DELETE' 以確認清除所有數據。",
            'data.clear_success': '所有數據已清除。',
            'data.select_file': '請先選擇一個 JSON 檔案',
            'data.backup_file': 'easyeta-backup-{date}.json',

            // Search types
            'search_type.route': '路線',
            'search_type.stop': '站點',
        }
    },

    /**
     * Initialize i18n system - load saved language preference
     */
    async init() {
        try {
            const result = await chrome.storage.sync.get('language');
            if (result.language) {
                this._currentLang = result.language;
            }
        } catch (e) {
            // Fallback to default
        }
        this.applyToDocument();
    },

    /**
     * Get current language code
     * @returns {string}
     */
    getLang() {
        return this._currentLang;
    },

    /**
     * Set language and persist
     * @param {string} lang - 'en' or 'zh-HK'
     */
    async setLang(lang) {
        if (!this.translations[lang]) return;
        this._currentLang = lang;
        try {
            await chrome.storage.sync.set({ language: lang });
        } catch (e) {
            // Fallback
        }
        this.applyToDocument();
        this._notifyListeners();
    },

    /**
     * Translate a key with optional variables
     * @param {string} key - Translation key
     * @param {Object} vars - Variables to interpolate
     * @returns {string}
     */
    t(key, vars = {}) {
        const lang = this._currentLang;
        let text = this.translations[lang]?.[key] || this.translations['en']?.[key] || key;
        // Interpolate variables
        for (const [k, v] of Object.entries(vars)) {
            text = text.replace(`{${k}}`, v);
        }
        return text;
    },

    /**
     * Apply translations to all elements with data-i18n attributes
     */
    applyToDocument() {
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.dataset.i18n;
            const vars = {};
            if (el.dataset.i18nVars) {
                try {
                    Object.assign(vars, JSON.parse(el.dataset.i18nVars));
                } catch (e) {}
            }
            el.textContent = this.t(key, vars);
        });
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            el.placeholder = this.t(el.dataset.i18nPlaceholder);
        });
        document.querySelectorAll('[data-i18n-title]').forEach(el => {
            el.title = this.t(el.dataset.i18nTitle);
        });
    },

    /**
     * Register a listener for language changes
     * @param {Function} fn
     */
    onChange(fn) {
        this._listeners.push(fn);
    },

    _notifyListeners() {
        this._listeners.forEach(fn => fn(this._currentLang));
    }
};

// Expose globally
if (typeof window !== 'undefined') {
    window.I18n = I18n;
}