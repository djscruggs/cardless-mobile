import algosdk from 'algosdk';

import { getItem, removeItem, setItem } from './storage';

const WALLET_ADDRESS_KEY = 'cardless_wallet_address';
const WALLET_MNEMONIC_KEY = 'cardless_wallet_mnemonic';

/**
 * Generate a new Algorand wallet
 * @returns Wallet address and mnemonic
 */
export function generateWallet(): { address: string; mnemonic: string } {
  const account = algosdk.generateAccount();
  const mnemonic = algosdk.secretKeyToMnemonic(account.sk);

  return {
    address: account.addr.toString(),
    mnemonic,
  };
}

/**
 * Get the wallet address from storage
 */
export function getWalletAddress(): string | null {
  return getItem<string>(WALLET_ADDRESS_KEY);
}

/**
 * Get the wallet mnemonic from storage
 * WARNING: Handle this with extreme care - should only be used for signing
 */
export function getWalletMnemonic(): string | null {
  return getItem<string>(WALLET_MNEMONIC_KEY);
}

/**
 * Get the private key from mnemonic
 * @param mnemonic - The mnemonic phrase
 * @returns Private key as Uint8Array
 */
export function getPrivateKeyFromMnemonic(mnemonic: string): Uint8Array {
  const account = algosdk.mnemonicToSecretKey(mnemonic);
  return account.sk;
}

/**
 * Get the current wallet's private key
 * @returns Private key or null if no wallet exists
 */
export function getWalletPrivateKey(): Uint8Array | null {
  const mnemonic = getWalletMnemonic();
  if (!mnemonic) return null;

  try {
    return getPrivateKeyFromMnemonic(mnemonic);
  } catch (error) {
    console.error('Error getting private key:', error);
    return null;
  }
}

/**
 * Save wallet to storage
 * @param address - Wallet address
 * @param mnemonic - Wallet mnemonic (25-word phrase)
 */
export async function saveWallet(address: string, mnemonic: string) {
  await setItem(WALLET_ADDRESS_KEY, address);
  await setItem(WALLET_MNEMONIC_KEY, mnemonic);
}

/**
 * Initialize wallet - creates one if it doesn't exist
 * @returns Wallet address
 */
export async function initializeWallet(): Promise<string> {
  const existingAddress = getWalletAddress();

  if (existingAddress) {
    return existingAddress;
  }

  // Generate new wallet
  const { address, mnemonic } = generateWallet();
  await saveWallet(address, mnemonic);

  console.log('🔐 New wallet created:', address);
  console.log(
    '⚠️ IMPORTANT: Back up this mnemonic phrase (in production, show to user):'
  );
  console.log(mnemonic);

  return address;
}

/**
 * Clear wallet from storage (use with caution!)
 */
export async function clearWallet() {
  await removeItem(WALLET_ADDRESS_KEY);
  await removeItem(WALLET_MNEMONIC_KEY);
}

/**
 * Check if wallet exists
 */
export function hasWallet(): boolean {
  return getWalletAddress() !== null;
}

export const wallet = {
  generateWallet,
  getWalletAddress,
  getWalletMnemonic,
  getPrivateKeyFromMnemonic,
  getWalletPrivateKey,
  saveWallet,
  initializeWallet,
  clearWallet,
  hasWallet,
};
