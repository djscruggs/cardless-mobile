import { Env } from '@env';
import algosdk from 'algosdk';

// Algorand network configuration
const ALGORAND_NETWORK = Env.ALGORAND_NETWORK || 'testnet';

const ALGOD_CONFIG =
  ALGORAND_NETWORK === 'mainnet'
    ? {
        server: 'https://mainnet-api.algonode.cloud',
        port: 443,
        token: '',
      }
    : {
        server: 'https://testnet-api.algonode.cloud',
        port: 443,
        token: '',
      };

const INDEXER_CONFIG =
  ALGORAND_NETWORK === 'mainnet'
    ? {
        server: 'https://mainnet-idx.algonode.cloud',
        port: 443,
        token: '',
      }
    : {
        server: 'https://testnet-idx.algonode.cloud',
        port: 443,
        token: '',
      };

// Initialize clients
export const algodClient = new algosdk.Algodv2(
  ALGOD_CONFIG.token,
  ALGOD_CONFIG.server,
  ALGOD_CONFIG.port
);

export const indexerClient = new algosdk.Indexer(
  INDEXER_CONFIG.token,
  INDEXER_CONFIG.server,
  INDEXER_CONFIG.port
);

/**
 * Opt-in to an NFT asset
 * @param walletAddress - The wallet address opting in
 * @param privateKey - The private key as Uint8Array
 * @param assetId - The asset ID to opt into
 * @returns Transaction ID
 */
export async function optInToAsset(
  walletAddress: string,
  privateKey: Uint8Array,
  assetId: number
): Promise<string> {
  const suggestedParams = await algodClient.getTransactionParams().do();

  const txn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
    sender: walletAddress,
    receiver: walletAddress,
    amount: 0,
    assetIndex: assetId,
    suggestedParams,
  });

  const signedTxn = txn.signTxn(privateKey);
  const response = await algodClient.sendRawTransaction(signedTxn).do();

  // Wait for confirmation
  await algosdk.waitForConfirmation(algodClient, response.txid, 4);

  return response.txid;
}

/**
 * Check wallet credentials from blockchain
 * @param walletAddress - The wallet address to check
 * @param issuerAddress - The issuer address to filter by
 * @returns Array of credentials
 */
export async function getWalletCredentials(
  walletAddress: string,
  issuerAddress: string
): Promise<Array<{ assetId: number; frozen: boolean }>> {
  const accountInfo = await indexerClient.lookupAccountByID(walletAddress).do();

  const credentials = [];

  for (const asset of accountInfo.account.assets || []) {
    if (asset.amount > 0) {
      // Get asset details
      const assetInfo = await indexerClient
        .lookupAssetByID(asset.assetId)
        .do();

      // Check if created by our issuer
      if (assetInfo.asset.params.creator === issuerAddress) {
        credentials.push({
          assetId: Number(asset.assetId),
          frozen: asset.isFrozen || false,
        });
      }
    }
  }

  return credentials;
}

/**
 * Get account information
 * @param address - The account address
 * @returns Account information
 */
export async function getAccountInfo(address: string) {
  return await algodClient.accountInformation(address).do();
}

/**
 * Get asset information
 * @param assetId - The asset ID
 * @returns Asset information
 */
export async function getAssetInfo(assetId: number) {
  return await indexerClient.lookupAssetByID(assetId).do();
}

export const algorand = {
  optInToAsset,
  getWalletCredentials,
  getAccountInfo,
  getAssetInfo,
  algodClient,
  indexerClient,
  network: ALGORAND_NETWORK,
};
