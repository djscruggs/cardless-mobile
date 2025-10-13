import { createMutation } from 'react-query-kit';

import { customVerificationClient } from './client';
import type { UploadSelfieRequest, UploadSelfieResponse } from './types';

type Variables = UploadSelfieRequest;
type Response = UploadSelfieResponse;

export const useUploadSelfie = createMutation<Response, Variables, Error>({
  mutationFn: async (variables) => {
    const formData = new FormData();
    formData.append('sessionId', variables.sessionId);
    formData.append('selfie', variables.image);
    formData.append('idPhoto', variables.idPhoto);

    const response = await customVerificationClient.post<Response>(
      '/api/custom-verification/upload-selfie',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return response.data;
  },
});
