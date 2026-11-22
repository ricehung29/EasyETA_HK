const assert = require('assert');
const fs = require('fs');
const sw = fs.readFileSync(require.resolve('../background/service-worker.js'), 'utf8');
assert.match(sw, /importScripts\('\.\.\/scripts\/storage\.js', '\.\.\/scripts\/api\.js', '\.\.\/scripts\/rule-engine\.js'\)/);
assert.match(sw, /API\.getStopRouteEtas\(rule\.stopId, variant\)/);
assert.match(sw, /rule\.schedule\.days\.includes\(context\.currentTime\.day\)/);
assert.doesNotMatch(sw, /rule\.conditions && rule\.conditions\.length/);
console.log('service-worker.selftest: all checks passed');
