import type { AxiosError } from 'axios';
import { createMutation } from 'react-query-kit';

import { verificationClient } from './client';
import type { StartSessionRequest, StartSessionResponse } from './types';

export const useStartSession = createMutation<
  StartSessionResponse,
  StartSessionRequest,
  AxiosError
>({
  mutationFn: async (variables) =>
    verificationClient({
      url: '/api/verification/start',
      method: 'POST',
      data: variables,
    }).then((response) => response.data),
});
