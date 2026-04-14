import { describe, expect, it } from '@jest/globals';
import {
  generateCodeChallenge,
  generateCodeVerifier,
  generatePKCEPair,
} from '../pkce';

describe('generateCodeVerifier', () => {
  it('returns exactly 43 base64url characters', () => {
    const verifier = generateCodeVerifier();
    expect(verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it('returns different values on successive calls', () => {
    const a = generateCodeVerifier();
    const b = generateCodeVerifier();
    expect(a).not.toBe(b);
  });
});

describe('generateCodeChallenge', () => {
  // RFC 7636 Appendix B test vector
  it('produces the correct S256 hash for the RFC 7636 Appendix B test vector', async () => {
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    const challenge = await generateCodeChallenge(verifier);
    expect(challenge).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  });

  it('returns a base64url string without padding', async () => {
    const challenge = await generateCodeChallenge('test-verifier');
    expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(challenge).not.toContain('=');
  });
});

describe('generatePKCEPair', () => {
  it('returns a verifier and challenge that are consistent', async () => {
    const { verifier, challenge } = await generatePKCEPair();
    const recomputed = await generateCodeChallenge(verifier);
    expect(challenge).toBe(recomputed);
  });

  it('returns a verifier matching the expected format', async () => {
    const { verifier } = await generatePKCEPair();
    expect(verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });
});
