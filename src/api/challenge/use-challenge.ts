/**
 * Mutation hook for responding to challenges
 */
import { useMutation } from '@tanstack/react-query';
import { createQuery } from 'react-query-kit';

import type { ChallengeDetails, SessionDetails } from './client';
import {
  getChallengeDetails,
  getSessionDetails,
  respondToChallenge,
  respondToSession,
} from './client';

/**
 * React Query hook to fetch challenge details
 */
export const useChallenge = createQuery<
  ChallengeDetails,
  { challengeId: string }
>({
  queryKey: ['challenge'],
  fetcher: (variables) => {
    return getChallengeDetails(variables.challengeId);
  },
});

/**
 * React Query hook to fetch session details (demo mode)
 */
export const useSession = createQuery<SessionDetails, { sessionId: string }>({
  queryKey: ['session'],
  fetcher: (variables) => {
    return getSessionDetails(variables.sessionId);
  },
});

export function useChallengeResponse() {
  return useMutation({
    mutationFn: respondToChallenge,
  });
}

export function useSessionResponse() {
  return useMutation({
    mutationFn: respondToSession,
  });
}
