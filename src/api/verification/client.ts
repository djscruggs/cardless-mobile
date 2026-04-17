import { Env } from '@env';
import axios from 'axios';

// Create a client for verification API
export const verificationClient = axios.create({
  baseURL: Env.API_URL,
  headers: {
    'X-API-Key': Env.CARDLESS_API_KEY,
  },
});

// Add request interceptor for debugging
verificationClient.interceptors.request.use(
  (config) => {
    console.log('🔵 Verification Request:', {
      method: config.method?.toUpperCase(),
      url: (config.baseURL || '') + (config.url || ''),
      data: config.data,
    });
    return config;
  },
  (error) => {
    console.log('🔴 Verification Request Error:', error);
    return Promise.reject(error);
  }
);

// Add response interceptor for debugging
verificationClient.interceptors.response.use(
  (response) => {
    console.log('🟢 Verification Response:', {
      status: response.status,
      data: response.data,
      url: response.config.url,
    });
    return response;
  },
  (error) => {
    console.log('🔴 Verification Response Error:', {
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
