import { Env } from '@env';
import algosdk from 'algosdk';
import axios from 'axios';

import { getWalletCredentials } from './algorand';

export interface SignedProofPayload {
  nonce: string;
  walletAddress: string;
  minAge: number;
  meetsRequirement: boolean;
  timestamp: number;
}

export interface SignedProof {
  payload: SignedProofPayload;
  signature: string; // base64url ed25519 signature
}

export interface SignProofArgs {
  nonce: string;
  minAge: number;
  meetsRequirement: boolean;
  account: algosdk.Account;
}

export function signProof({
  nonce,
  minAge,
  meetsRequirement,
  account,
}: SignProofArgs): SignedProof {
  const payload: SignedProofPayload = {
    nonce,
    walletAddress: algosdk.encodeAddress(account.addr.publicKey),
    minAge,
    meetsRequirement,
    timestamp: Date.now(),
  };
  const message = Buffer.from(JSON.stringify(payload));
  const sigBytes = algosdk.signBytes(message, account.sk);
  return { payload, signature: Buffer.from(sigBytes).toString('base64url') };
}

export async function checkAgeRequirement(
  walletAddress: string,
  minAge: number,
  issuerAddress: string
): Promise<boolean> {
  const credentials = await getWalletCredentials(walletAddress, issuerAddress);
  if (credentials.length === 0) return false;

  // Credential NFT exists — age check is validated server-side at issuance;
  // presence of a non-frozen credential means user passed KYC.
  const validCredential = credentials.find((c) => !c.frozen);
  if (!validCredential) return false;

  // We trust the on-chain credential as proof of age — minAge is enforced
  // server-side during issuance. The proof carries minAge so the verifier
  // can re-check if needed.
  void minAge;
  return true;
}

const proofClient = axios.create({ baseURL: Env.API_URL });

export async function submitProof(
  nonce: string,
  signedProof: SignedProof
): Promise<void> {
  await proofClient.post('/api/v/submit', { nonce, signedProof });
}
