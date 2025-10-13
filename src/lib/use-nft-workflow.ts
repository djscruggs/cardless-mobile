/* eslint-disable max-lines-per-function */
import * as React from 'react';
import { showMessage } from 'react-native-flash-message';

import { useTransferNFT } from '@/api';
import { showErrorMessage } from '@/components/ui/utils';

import { optInToAsset } from './algorand';
import { credentialStorage } from './secure-credential-storage';

type NFTWorkflowState =
  | 'idle'
  | 'opting-in'
  | 'transferring'
  | 'complete'
  | 'error';

interface UseNFTWorkflowOptions {
  assetId?: number;
  walletAddress: string;
  privateKey?: Uint8Array; // Private key for signing opt-in transaction
  onComplete?: () => void;
  onError?: (error: Error) => void;
}

export function useNFTWorkflow({
  assetId,
  walletAddress,
  privateKey,
  onComplete,
  onError,
}: UseNFTWorkflowOptions) {
  const [state, setState] = React.useState<NFTWorkflowState>('idle');
  const [optInTxId, setOptInTxId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<Error | null>(null);

  const { mutate: transferNFT } = useTransferNFT();

  const startWorkflow = React.useCallback(async () => {
    if (!assetId) {
      const err = new Error('No asset ID provided');
      setError(err);
      setState('error');
      onError?.(err);
      return;
    }

    if (!privateKey) {
      const err = new Error('No private key provided for signing');
      setError(err);
      setState('error');
      onError?.(err);
      return;
    }

    try {
      // Step 1: Opt-in to the asset
      setState('opting-in');
      showMessage({
        message: 'Transfer in progress...',
        type: 'info',
      });

      console.log('🔵 Starting NFT opt-in for asset:', assetId);
      const txId = await optInToAsset(walletAddress, privateKey, assetId);
      setOptInTxId(txId);

      console.log('✅ Opt-in successful, txId:', txId);
      showMessage({
        message: 'Credential created! Requesting transfer...',
        type: 'success',
      });

      // Step 2: Request transfer from server
      setState('transferring');
      transferNFT(
        {
          assetId,
          walletAddress,
        },
        {
          onSuccess: async (response) => {
            console.log('✅ NFT transfer successful:', response);
            setState('complete');

            // Update NFT data in storage
            await credentialStorage.updateNFT({
              assetId: response.assetId.toString(),
              requiresOptIn: false, // Already opted in
            });

            showMessage({
              message: 'Credential transferred successfully!',
              type: 'success',
            });

            onComplete?.();
          },
          onError: (transferError) => {
            console.error('❌ Error transferring NFT:', transferError);
            const responseData = transferError.response?.data as
              | { error?: string; message?: string }
              | undefined;
            const errorMessage =
              responseData?.error ||
              responseData?.message ||
              'Failed to transfer NFT';

            const err = new Error(errorMessage);
            setError(err);
            setState('error');
            showErrorMessage(errorMessage);
            onError?.(err);
          },
        }
      );
    } catch (optInError) {
      console.error('❌ Error during opt-in:', optInError);
      const err =
        optInError instanceof Error
          ? optInError
          : new Error('Failed to opt-in to asset');
      setError(err);
      setState('error');
      showErrorMessage(err.message);
      onError?.(err);
    }
  }, [assetId, walletAddress, privateKey, transferNFT, onComplete, onError]);

  const reset = React.useCallback(() => {
    setState('idle');
    setOptInTxId(null);
    setError(null);
  }, []);

  return {
    state,
    optInTxId,
    error,
    startWorkflow,
    reset,
    isLoading: state === 'opting-in' || state === 'transferring',
    isComplete: state === 'complete',
    hasError: state === 'error',
  };
}
