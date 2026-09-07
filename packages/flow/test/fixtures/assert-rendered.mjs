import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const path = process.argv[2];
assert(path, 'Pass the path to the built fixture HTML.');
const html = readFileSync(path, 'utf8');

for (const [id, content] of [
  ['when', 'when-ok'],
  ['alias-when', 'alias-when-ok'],
  ['switch-case', 'switch-case-ok'],
  ['alias-switch-case', 'alias-switch-case-ok'],
]) {
  assert(html.includes(`<p id="${id}">${content}</p>`), `Missing rendered ${id} slot.`);
}
for (const pattern of [
  /<div id="iterate">\s*iterate-ok\s*<\/div>/,
  /<div id="alias-iterate">\s*alias-iterate-ok\s*<\/div>/,
  /<div id="factory-iterate">\s*factory-iterate-ok\s*<\/div>/,
]) {
  assert(pattern.test(html), `Missing iteration callback output: ${pattern.source}`);
}
assert(html.includes('<strong>factory-when-ok</strong>'));
assert(html.includes('<em>factory-switch-case-ok</em>'));
assert(html.includes('<span data-index="0">&lt;script&gt;unsafe&lt;/script&gt;</span>'));
assert(!html.includes('<script>unsafe</script>'));
assert(html.includes('<i data-key="label">record-value</i>'));
assert(html.includes('0:async-a;1:async-b;'));
assert(!html.includes('unexpected-'));
console.log('Flow fixture passed: all wrappers/factories, callback indexes/keys, async ordering, HTML preservation, escaping, and empty branches.');
