// Self-check for the route/variant logic in api.js.
//   node scripts/api.selftest.js
// Fails loudly if provider grouping, CTB direction mapping, or stale-ETA
// filtering regress.

const assert = require('assert');
const path = require('path');

// Minimal chrome.* stub so api.js can load outside the extension.
global.chrome = { storage: { local: { get: async () => ({}), set: async () => {} } } };
global.window = global;

require(path.join(__dirname, 'api.js'));
const API = global.API;

async function run() {
    // --- CTB direction codes ('O'/'I' in ETA rows vs 'outbound'/'inbound' in URLs)
    assert.strictEqual(API._ctbDirMatches('O', 'outbound'), true);
    assert.strictEqual(API._ctbDirMatches('I', 'outbound'), false);
    assert.strictEqual(API._ctbDirMatches('I', 'inbound'), true);

    // --- _fresh drops buses that already left, keeps the future sorted
    const now = Date.now();
    const list = [
        { ts: now + 60000, minutes: 1 },
        { ts: now - 120000, minutes: -2 },
        { ts: now + 30000, minutes: 0 }
    ];
    const fresh = API._fresh(list);
    assert.deepStrictEqual(fresh.map(e => e.minutes), [0, 1]);

    // --- searchRoutes tags providers and puts exact matches first
    API.loadKmbRoutes = async () => [{ route: '1' }, { route: '10' }, { route: '1A' }];
    API.loadCtbRoutes = async () => [{ route: '1' }];
    API.loadGmbIndex = async () => [{ route: '1', region: 'HKI' }, { route: '10', region: 'KOW' }];
    const hits = await API.searchRoutes('1');
    assert.deepStrictEqual(hits[0], { route: '1', providers: ['kmb', 'ctb', 'gmb'] });
    assert.deepStrictEqual(hits.map(h => h.route), ['1', '10', '1A']);

    // --- getRouteVariants: KMB collapses duplicate service types, CTB reverses inbound
    API.loadKmbRoutes = async () => ([
        { route: '1', bound: 'O', service_type: '1', orig_en: 'Star Ferry', dest_en: 'Chuk Yuen', orig_tc: '尖沙咀碼頭', dest_tc: '竹園' },
        { route: '1', bound: 'O', service_type: '2', orig_en: 'Star Ferry', dest_en: 'Chuk Yuen', orig_tc: '尖沙咀碼頭', dest_tc: '竹園' },
        { route: '1', bound: 'I', service_type: '1', orig_en: 'Chuk Yuen', dest_en: 'Star Ferry', orig_tc: '竹園', dest_tc: '尖沙咀碼頭' }
    ]);
    API.loadCtbRoutes = async () => ([
        { route: '1', orig_en: 'Central', dest_en: 'Happy Valley', orig_tc: '中環', dest_tc: '跑馬地' }
    ]);
    API.loadGmbIndex = async () => [];
    const variants = await API.getRouteVariants('1');
    assert.strictEqual(variants.length, 4, 'KMB service types collapse to one row per direction, CTB adds both');
    const ctbIn = variants.find(v => v._provider === 'ctb' && v.dir === 'inbound');
    assert.strictEqual(ctbIn.orig_en, 'Happy Valley');
    assert.strictEqual(ctbIn.dest_en, 'Central');

    console.log('api.selftest: all checks passed');
}

run().catch(err => {
    console.error('api.selftest FAILED:', err.message);
    process.exit(1);
});
