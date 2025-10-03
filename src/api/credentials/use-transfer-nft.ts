import { Env } from '@env';
import type { AxiosError } from 'axios';
import axios from 'axios';
import { createMutation } from 'react-query-kit';

// Create a separate client for credential API since it has different base URL
const credentialClient = axios.create({
  baseURL:
    Env.APP_ENV === 'production'
      ? 'https://cardlessid.org'
      : 'http://192.168.0.12:5173',
});

// Add request interceptor for debugging
credentialClient.interceptors.request.use(
  (config) => {
    console.log('🔵 NFT Transfer Request:', {
      method: config.method?.toUpperCase(),
      url: (config.baseURL || '') + (config.url || ''),
      data: config.data,
    });
    return config;
  },
  (error) => {
    console.log('🔴 NFT Transfer Request Error:', error);
    return Promise.reject(error);
  }
);

// Add response interceptor for debugging
credentialClient.interceptors.response.use(
  (response) => {
    console.log('🟢 NFT Transfer Response:', {
      status: response.status,
      data: response.data,
      url: response.config.url,
    });
    return response;
  },
  (error) => {
    console.log('🔴 NFT Transfer Response Error:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
      url: error.config?.url,
    });
    return Promise.reject(error);
  }
);

type TransferNFTRequest = {
  assetId: number;
  walletAddress: string;
};

type TransferNFTResponse = {
  success: boolean;
  assetId: number;
  walletAddress: string;
  transactions: {
    transfer: {
      id: string;
      explorerUrl: string;
    };
    freeze: {
      id: string;
      explorerUrl: string;
    };
  };
  message: string;
};

export const useTransferNFT = createMutation<
  TransferNFTResponse,
  TransferNFTRequest,
  AxiosError
>({
  mutationFn: async (variables) =>
    credentialClient({
      url: '/api/credentials/transfer',
      method: 'POST',
      data: variables,
    }).then((response) => response.data),
});
