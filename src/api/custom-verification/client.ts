import { Env } from '@env';
import axios from 'axios';

// Create a client for custom verification API
export const customVerificationClient = axios.create({
  baseURL: Env.API_URL,
  headers: {
    'X-API-Key': Env.CARDLESS_API_KEY,
  },
});

// Add request interceptor for debugging
customVerificationClient.interceptors.request.use(
  (config) => {
    const isFormData = config.data instanceof FormData;

    console.log('🔵 Custom Verification Request:', {
      method: config.method?.toUpperCase(),
      url: (config.baseURL || '') + (config.url || ''),
      data: isFormData
        ? '[FormData - check network tab for details]'
        : config.data
          ? {
              ...config.data,
              image: config.data.image
                ? `[base64 image: ${config.data.image.substring(0, 50)}...]`
                : undefined,
              backImage: config.data.backImage
                ? `[base64 image: ${config.data.backImage.substring(0, 50)}...]`
                : undefined,
              idPhoto: config.data.idPhoto
                ? `[base64 image: ${config.data.idPhoto.substring(0, 50)}...]`
                : undefined,
            }
          : undefined,
      contentType: config.headers?.['Content-Type'],
    });
    return config;
  },
  (error) => {
    console.log('🔴 Custom Verification Request Error:', error);
    return Promise.reject(error);
  }
);

// Add response interceptor for debugging
customVerificationClient.interceptors.response.use(
  (response) => {
    console.log('🟢 Custom Verification Response:', {
      status: response.status,
      data: response.data,
      url: response.config.url,
    });
    return response;
  },
  (error) => {
    console.log('🔴 Custom Verification Response Error:', {
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
