import { createMutation } from 'react-query-kit';

import { customVerificationClient } from './client';
import type { UploadIdRequest, UploadIdResponse } from './types';

type Variables = UploadIdRequest;
type Response = UploadIdResponse;

export const useUploadId = createMutation<Response, Variables, Error>({
  mutationFn: async (variables) => {
    const response = await customVerificationClient.post<Response>(
      '/api/custom-verification/upload-id',
      variables
    );
    return response.data;
  },
});
