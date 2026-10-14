// Rebuild the Rust interoperability fixtures with the app's installed WharfKit.
// Run: bun tests/fixtures/generate-esr.ts
import { SigningRequest } from '@wharfkit/signing-request';

const chainId = 'aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906';
const signer = { actor: 'alice', permission: 'active' };
const fixtures = [];
for (const scope of [undefined, 'example']) {
  const request = SigningRequest.createSync({ chainId, identity: { permission: signer, scope } });
  const resolved = request.resolve(new Map(), signer, { timestamp: '2030-01-01T00:00:00', expire_seconds: 120 });
  fixtures.push({
    version: request.version, chainId, scope: scope ?? '',
    packed: Buffer.from(resolved.serializedTransaction).toString('hex'),
    digest: resolved.signingDigest.hexString,
  });
}
await Bun.write(new URL('./esr-identities.json', import.meta.url), JSON.stringify(fixtures, null, 2) + '\n');
