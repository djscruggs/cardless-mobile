/* eslint-disable max-lines-per-function */
import algosdk from 'algosdk';

import { getWalletCredentials } from '@/lib/algorand';
import {
  checkAgeRequirement,
  type SignedProofPayload,
  signProof,
} from '@/lib/proof-signing';

// Mock the @env module before importing proof-signing
jest.mock('@env', () => ({
  Env: { API_URL: 'https://cardlessid.org' },
}));

// Mock axios so submitProof doesn't need a real server
jest.mock('axios', () => {
  const create = jest.fn(() => ({ post: jest.fn() }));
  return { default: { create }, create };
});

// Mock algorand module for checkAgeRequirement tests
jest.mock('@/lib/algorand', () => ({
  getWalletCredentials: jest.fn(),
}));

const mockGetWalletCredentials = getWalletCredentials as jest.MockedFunction<
  typeof getWalletCredentials
>;

describe('signProof', () => {
  let account: algosdk.Account;

  beforeEach(() => {
    account = algosdk.generateAccount();
  });

  it('returns a payload with all required fields', () => {
    const nonce = 'test-nonce-123';
    const minAge = 21;

    const result = signProof({
      nonce,
      minAge,
      meetsRequirement: true,
      account,
    });

    expect(result.payload.nonce).toBe(nonce);
    expect(result.payload.minAge).toBe(minAge);
    expect(result.payload.meetsRequirement).toBe(true);
    expect(result.payload.walletAddress).toBe(
      algosdk.encodeAddress(account.addr.publicKey)
    );
    expect(typeof result.payload.timestamp).toBe('number');
    expect(result.payload.timestamp).toBeGreaterThan(0);
  });

  it('preserves meetsRequirement: false in payload', () => {
    const result = signProof({
      nonce: 'nonce',
      minAge: 18,
      meetsRequirement: false,
      account,
    });
    expect(result.payload.meetsRequirement).toBe(false);
  });

  it('returns a non-empty base64url signature string', () => {
    const result = signProof({
      nonce: 'nonce',
      minAge: 18,
      meetsRequirement: true,
      account,
    });
    expect(typeof result.signature).toBe('string');
    expect(result.signature.length).toBeGreaterThan(0);
    // base64url uses only these chars (no +, /, or =)
    expect(result.signature).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('produces a cryptographically valid ed25519 signature', () => {
    const result = signProof({
      nonce: 'nonce',
      minAge: 18,
      meetsRequirement: true,
      account,
    });

    const sigBytes = new Uint8Array(Buffer.from(result.signature, 'base64url'));
    const message = new Uint8Array(Buffer.from(JSON.stringify(result.payload)));
    const isValid = algosdk.verifyBytes(message, sigBytes, account.addr);

    expect(isValid).toBe(true);
  });

  it('signature is invalid if payload is tampered', () => {
    const result = signProof({
      nonce: 'nonce',
      minAge: 18,
      meetsRequirement: true,
      account,
    });

    const tamperedPayload: SignedProofPayload = {
      ...result.payload,
      meetsRequirement: false, // tampered
    };
    const sigBytes = new Uint8Array(Buffer.from(result.signature, 'base64url'));
    const message = new Uint8Array(
      Buffer.from(JSON.stringify(tamperedPayload))
    );
    const isValid = algosdk.verifyBytes(message, sigBytes, account.addr);

    expect(isValid).toBe(false);
  });
});

const WALLET = 'TESTADDRESS';
const ISSUER = 'ISSUERADDRESS';
const MIN_AGE = 21;

describe('checkAgeRequirement — returns false', () => {
  beforeEach(() => mockGetWalletCredentials.mockReset());

  it('when no credentials exist on-chain', async () => {
    mockGetWalletCredentials.mockResolvedValue([]);
    expect(await checkAgeRequirement(WALLET, MIN_AGE, ISSUER)).toBe(false);
  });

  it('when all credentials are frozen', async () => {
    mockGetWalletCredentials.mockResolvedValue([
      { assetId: 1, frozen: true },
      { assetId: 2, frozen: true },
    ]);
    expect(await checkAgeRequirement(WALLET, MIN_AGE, ISSUER)).toBe(false);
  });
});

describe('checkAgeRequirement — returns true', () => {
  beforeEach(() => mockGetWalletCredentials.mockReset());

  it('when at least one credential is not frozen', async () => {
    mockGetWalletCredentials.mockResolvedValue([
      { assetId: 1, frozen: true },
      { assetId: 2, frozen: false },
    ]);
    expect(await checkAgeRequirement(WALLET, MIN_AGE, ISSUER)).toBe(true);
  });

  it('when a single non-frozen credential exists', async () => {
    mockGetWalletCredentials.mockResolvedValue([
      { assetId: 42, frozen: false },
    ]);
    expect(await checkAgeRequirement(WALLET, MIN_AGE, ISSUER)).toBe(true);
  });

  it('passes walletAddress and issuerAddress to getWalletCredentials', async () => {
    mockGetWalletCredentials.mockResolvedValue([]);
    await checkAgeRequirement(WALLET, MIN_AGE, ISSUER);
    expect(mockGetWalletCredentials).toHaveBeenCalledWith(WALLET, ISSUER);
  });
});
