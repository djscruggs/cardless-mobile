import { createMutation } from 'react-query-kit';

import { customVerificationClient } from './client';
import type { UploadIdRequest, UploadIdResponse } from './types';

type Variables = UploadIdRequest;
type Response = UploadIdResponse;

export const useUploadId = createMutation<Response, Variables, Error>({
  mutationFn: async (variables) => {
    const formData = new FormData();
    formData.append('image', variables.image);
    if (variables.backImage) {
      formData.append('backImage', variables.backImage);
    }
    formData.append('mimeType', variables.mimeType);

    const response = await customVerificationClient.post<Response>(
      '/api/custom-verification/upload-id',
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
