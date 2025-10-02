import { Env } from '@env';
import axios from 'axios';

// Mock provider client - separate from main server
export const mockProviderClient = axios.create({
  baseURL:
    Env.APP_ENV === 'production'
      ? 'https://mock-provider.cardlessid.org' // Not used in production
      : 'http://192.168.0.12:3001',
});

// Add request interceptor for debugging
mockProviderClient.interceptors.request.use(
  (config) => {
    console.log('🔵 Mock Provider Request:', {
      method: config.method?.toUpperCase(),
      url: (config.baseURL || '') + (config.url || ''),
      data: config.data,
      headers: config.headers,
    });
    return config;
  },
  (error) => {
    console.log('🔴 Mock Provider Request Error:', error);
    return Promise.reject(error);
  }
);

// Add response interceptor for debugging
mockProviderClient.interceptors.response.use(
  (response) => {
    console.log('🟢 Mock Provider Response:', {
      status: response.status,
      data: response.data,
      url: response.config.url,
    });
    return response;
  },
  (error) => {
    console.log('🔴 Mock Provider Response Error:', {
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
