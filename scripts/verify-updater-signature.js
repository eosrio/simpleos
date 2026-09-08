const { createHash, createPublicKey, verify } = require('node:crypto');

/** Tauri wraps minisign text in base64. Match minisign-verify's verification. */
function verifyUpdaterSignature(artifact, publicKeyBase64, signatureBase64) {
  const keyLines = Buffer.from(publicKeyBase64.trim(), 'base64').toString('utf8').trim().split(/\r?\n/);
  const lines = Buffer.from(signatureBase64.trim(), 'base64').toString('utf8').trim().split(/\r?\n/);
  if (keyLines.length !== 2 || lines.length !== 4 || !lines[2].startsWith('trusted comment: ')) {
    throw new Error('Malformed updater signing material');
  }
  const key = Buffer.from(keyLines[1], 'base64');
  const signature = Buffer.from(lines[1], 'base64');
  const globalSignature = Buffer.from(lines[3], 'base64');
  if (key.length !== 42 || signature.length !== 74 || globalSignature.length !== 64
      || !['Ed', 'ED'].includes(key.subarray(0, 2).toString())
      || !['Ed', 'ED'].includes(signature.subarray(0, 2).toString())
      || !key.subarray(2, 10).equals(signature.subarray(2, 10))) {
    throw new Error('Invalid updater signature algorithm, encoding, or key ID');
  }
  const publicKey = createPublicKey({
    key: Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), key.subarray(10)]),
    format: 'der', type: 'spki',
  });
  const digest = signature.subarray(0, 2).toString() === 'ED'
    ? createHash('blake2b512').update(artifact).digest() : artifact;
  const trusted = Buffer.from(lines[2].slice('trusted comment: '.length));
  if (!verify(null, digest, publicKey, signature.subarray(10))
      || !verify(null, Buffer.concat([signature.subarray(10), trusted]), publicKey, globalSignature)) {
    throw new Error('Updater signature does not authenticate this artifact and trusted comment');
  }
}

module.exports = { verifyUpdaterSignature };
