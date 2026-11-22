const assert = require('assert');
const local = { settings: { notifications: { sound: false } } };
const sync = { theme: 'dark', autoRefresh: false };
global.chrome = { storage: {
    local: { get: async key => key === 'settings' ? { settings: local.settings } : {}, set: async values => Object.assign(local, values) },
    sync: { get: async () => sync, set: async values => Object.assign(sync, values) }
} };
const Storage = require('./storage.js');
(async () => {
    const settings = await Storage.getSettings();
    assert.strictEqual(settings.theme, 'dark');
    assert.strictEqual(settings.autoRefresh, false);
    assert.strictEqual(settings.notifications.sound, false);
    await Storage.saveSettings({ ...settings, autoRefresh: true });
    assert.strictEqual(sync.autoRefresh, true);
    console.log('storage.selftest: all checks passed');
})().catch(error => { console.error(error); process.exit(1); });
