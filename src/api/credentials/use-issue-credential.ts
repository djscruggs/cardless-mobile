import { Env } from '@env';
import type { AxiosError } from 'axios';
import axios from 'axios';
import { createMutation } from 'react-query-kit';

import type { CredentialRequest, CredentialResponse } from './types';

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
    console.log('🔵 Axios Request:', {
      method: config.method?.toUpperCase(),
      url: (config.baseURL || '') + (config.url || ''),
      data: config.data,
      headers: config.headers,
    });
    return config;
  },
  (error) => {
    console.log('🔴 Axios Request Error:', error);
    return Promise.reject(error);
  }
);

// Add response interceptor for debugging
credentialClient.interceptors.response.use(
  (response) => {
    console.log('🟢 Axios Response:', {
      status: response.status,
      data: response.data,
      url: response.config.url,
    });
    return response;
  },
  (error) => {
    console.log('🔴 Axios Response Error:', {
      message: error.message,
      code: error.code,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      url: error.config?.url,
      baseURL: error.config?.baseURL,
    });
    return Promise.reject(error);
  }
);

export const useIssueCredential = createMutation<
  CredentialResponse,
  CredentialRequest,
  AxiosError
>({
  mutationFn: async (variables) =>
    credentialClient({
      url: '/api/credentials',
      method: 'POST',
      data: variables,
    }).then((response) => response.data),
});
