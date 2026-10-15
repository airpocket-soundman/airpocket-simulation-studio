import {test} from 'node:test';
import assert from 'node:assert/strict';
import {isCanonicalBase64} from '../src/print-operations.js';

// Oracle: the previous regex (overflows the V8 stack on multi-megabyte input, fine for small strings).
const OLD = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

test('new validator is equivalent to the old regex on an edge corpus', () => {
  const corpus = ['', 'A', 'AA', 'AAA', 'AAAA', 'AA==', 'AAA=', 'A===', '====', 'AA=A', 'A=AA', 'AAAA=', 'AAAA==', 'AAAAAA==', 'AAAAAAA=',
    'AAAA AAAA', ' AAA', 'AAA ', 'AAAA\n', '\nAAAA', 'AA==\n', 'AA=\n', 'AAAA\r\n', '-_-_', 'AA-=', 'AA==AAAA', 'AAAA====', 'AAA==', 'AA=',
    '+/+/', '+/+=', 'Zm9v', 'Zm9vYg==', 'Zm9vYmE=', 'Zm9vYmFy', 'Zm9vYg=', 'Zm9vY===', 'é', 'AAAé', 'AAé=', '\u0000AAA', 'AAAA\u0000', '😀AA', 'AAAAAAAA'.repeat(100), 'AAAAAAAA'.repeat(100) + 'AA==', 'AAAAAAAA'.repeat(100) + '=A=='];
  for (const c of 'AZaz09+/=-_ .\n\t*@') for (let n = 0; n <= 5; n++) corpus.push(c.repeat(n), 'AA' + c.repeat(n), c.repeat(n) + 'A', 'AAA' + c, 'AA' + c + c, 'A' + c + 'AA');
  let accepted = 0;
  for (const s of corpus) { assert.equal(isCanonicalBase64(s), OLD.test(s), JSON.stringify(s)); if (OLD.test(s)) accepted++; }
  assert.ok(accepted > 10 && accepted < corpus.length);
  for (const v of [null, undefined, 12, {}, ['AAAA']]) assert.equal(isCanonicalBase64(v), false);
});

test('hardcoded expectations', () => {
  for (const s of ['', 'AAAA', 'AA==', 'AAA=', 'Zm9vYg==', '+/+/']) assert.equal(isCanonicalBase64(s), true, s);
  for (const s of ['A', 'AA', 'AAA', 'A===', 'AA=A', 'AAAA=', 'AA=', 'AAAA\n', 'AA-=', '=AAA', 'AAAA AAAA']) assert.equal(isCanonicalBase64(s), false, s);
});

test('5,000,000-byte base64 is accepted without throwing; corruption is refused', () => {
  const bytes = Buffer.alloc(5000000); for (let i = 0; i < bytes.length; i++) bytes[i] = i * 7 % 256;
  const b64 = bytes.toString('base64');
  assert.ok(b64.length > 6600000);
  assert.throws(() => OLD.test(b64), RangeError);
  assert.equal(isCanonicalBase64(b64), true);
  assert.equal(isCanonicalBase64(b64 + 'A'), false);
  assert.equal(isCanonicalBase64(b64.slice(0, 3000000) + '*' + b64.slice(3000001)), false);
  assert.equal(isCanonicalBase64(b64.slice(0, 3000000) + '=' + b64.slice(3000001)), false);
  assert.equal(isCanonicalBase64(b64.slice(0, -4) + '\n' + b64.slice(-3)), false);
});
