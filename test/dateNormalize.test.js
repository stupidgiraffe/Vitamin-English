const assert = require('assert');
const { normalizeDate, isSameDay } = require('../utils/dateNormalize');

assert.strictEqual(normalizeDate('2026-05-01'), '2026-05-01');
assert.strictEqual(normalizeDate('2026-5-1'), '2026-05-01');
assert.strictEqual(normalizeDate('2026-05-01T00:00:00.000Z'), '2026-05-01');
assert.strictEqual(normalizeDate('May 1, 2026'), '2026-05-01');
assert.strictEqual(normalizeDate('5/1/2026'), '2026-05-01');
assert.strictEqual(normalizeDate('invalid-date'), null);
assert.strictEqual(isSameDay('2026-05-01', '2026-05-01T00:00:00.000Z'), true);
assert.strictEqual(isSameDay('2026-05-01', '2026-05-02'), false);

console.log('dateNormalize tests passed');
