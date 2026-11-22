const assert = require('assert');
const RuleEngine = require('./rule-engine.js');
(async () => {
    const context = { currentTime: { hour: 8, minute: 30, day: 1 }, eta: { next: 4, second: 9 } };
    const rule = { enabled: true, type: 'conditional', mode: 'visual', conditions: { operator: 'AND', rules: [{ field: 'eta', target: 'next_bus', operator: '<=', value: 5 }] } };
    assert.strictEqual(RuleEngine.evaluateVisualConditions(rule, context), true);
    assert.strictEqual(RuleEngine.evaluateVisualConditions(rule, { ...context, eta: null }), false);
    assert.strictEqual(RuleEngine.evaluateVisualConditions({ ...rule, conditions: { operator: 'AND', rules: [] } }, context), false);
    assert.strictEqual(await RuleEngine.evaluate({ ...rule, enabled: false }, context), false);
    assert.strictEqual(await RuleEngine.evaluate({ ...rule, name: 'Test' }, context), true);
    assert.strictEqual(await RuleEngine.evaluate({ ...rule, mode: 'script', script: 'return true' }, context), false);
    assert.strictEqual(RuleEngine.validateRule({ ...rule, name: 'Test' }).valid, true);
    console.log('rule-engine.selftest: all checks passed');
})().catch(err => { console.error(err); process.exit(1); });
