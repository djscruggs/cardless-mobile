import { Env } from '@env';
import axios from 'axios';

// Create a client for verification API - uses same base URL as credentials
export const verificationClient = axios.create({
  baseURL:
    Env.APP_ENV === 'production'
      ? 'https://cardlessid.org'
      : 'http://192.168.0.12:5173',
});

// Add request interceptor for debugging
verificationClient.interceptors.request.use(
  (config) => {
    console.log('🔵 Verification Request:', {
      method: config.method?.toUpperCase(),
      url: (config.baseURL || '') + (config.url || ''),
      data: config.data,
      headers: config.headers,
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
