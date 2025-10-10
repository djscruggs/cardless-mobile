import { createMutation } from 'react-query-kit';

import { customVerificationClient } from './client';
import type { UploadSelfieRequest, UploadSelfieResponse } from './types';

type Variables = UploadSelfieRequest;
type Response = UploadSelfieResponse;

export const useUploadSelfie = createMutation<Response, Variables, Error>({
  mutationFn: async (variables) => {
    const response = await customVerificationClient.post<Response>(
      '/api/custom-verification/upload-selfie',
      variables
    );
    return response.data;
  },
});
