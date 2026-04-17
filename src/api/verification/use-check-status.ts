import type { AxiosError } from 'axios';
import { createQuery } from 'react-query-kit';

import { verificationClient } from './client';
import type { SessionStatusResponse } from './types';

type Variables = {
  sessionId: string;
  // Pass enabled: false to pause polling once status reaches terminal state
};

export const useCheckStatus = createQuery<
  SessionStatusResponse,
  Variables,
  AxiosError
>({
  queryKey: ['verification-status'],
  fetcher: (variables: Variables) => {
    return verificationClient
      .get(`/api/verification/status/${variables.sessionId}`)
      .then((response) => response.data);
  },
  // Callers should set refetchInterval: 2000 and disable when completed/failed
});
