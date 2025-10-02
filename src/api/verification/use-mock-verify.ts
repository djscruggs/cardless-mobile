import type { AxiosError } from 'axios';
import { createMutation } from 'react-query-kit';

import { mockProviderClient } from './mock-provider-client';
import type { MockProviderVerifyRequest } from './types';

type Response = {
  success: boolean;
  message: string;
};

export const useMockVerify = createMutation<
  Response,
  MockProviderVerifyRequest,
  AxiosError
>({
  mutationFn: async (variables) =>
    mockProviderClient({
      url: '/verify',
      method: 'POST',
      data: variables,
    }).then((response) => response.data),
});
