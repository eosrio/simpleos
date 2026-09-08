const { test } = require('node:test');
const assert = require('node:assert/strict');
const { verifyUpdaterSignature } = require('./verify-updater-signature');

// Independent golden vector from minisign-verify 0.2.5's verify_prehashed test.
const encode = text => Buffer.from(text).toString('base64');
const key = encode('untrusted comment: minisign public key\nRWQf6LRCGA9i53mlYecO4IzT51TGPpvWucNSCh1CBM0QTaLn73Y7GFO3');
const signatureText = 'untrusted comment: signature from minisign secret key\n'
  + 'RUQf6LRCGA9i559r3g7V1qNyJDApGip8MfqcadIgT9CuhV3EMhHoN1mGTkUidF/z7SrlQgXdy8ofjb7bNJJylDOocrCo8KLzZwo=\n'
  + 'trusted comment: timestamp:1556193335\tfile:test\n'
  + 'y/rUw2y8/hOUYjZU71eHp/Wo1KZ40fGy2VJEDl34XMJM+TX48Ss/17u3IvIfbVR1FkZZSNCisQbuQY+bHwhEBg==';

test('accepts an independent valid minisign artifact', () => {
  verifyUpdaterSignature(Buffer.from('test'), key, encode(signatureText));
});
test('rejects stale signatures even when the key ID matches', () => {
  assert.throws(() => verifyUpdaterSignature(Buffer.from('Test'), key, encode(signatureText)));
});
test('authenticates the trusted comment and rejects missing material', () => {
  assert.throws(() => verifyUpdaterSignature(Buffer.from('test'), key, encode(signatureText.replace('file:test', 'file:other'))));
  assert.throws(() => verifyUpdaterSignature(Buffer.from('test'), '', ''));
});
