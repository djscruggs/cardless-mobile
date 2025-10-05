import { Env } from '@env';
import axios from 'axios';

/**
 * Client for CardlessID Challenge API (Centralized Service Model)
 *
 * This is used when websites integrate via CardlessID's CDN.
 * The flow is:
 * 1. Website creates challenge via CardlessID
 * 2. User scans QR code with challenge ID
 * 3. App fetches challenge details from CardlessID
 * 4. User approves/denies
 * 5. App sends response to CardlessID
 * 6. CardlessID callbacks the website
 */

const challengeClient = axios.create({
  baseURL: Env.API_URL,
});

export type ChallengeDetails = {
  challengeId: string;
  minAge: number;
  expiresAt: string;
  status: 'pending' | 'responded' | 'expired';
  createdAt: string;
  // Optional branding from the requesting website
  websiteName?: string;
  websiteIcon?: string;
};

export type ChallengeResponse = {
  challengeId: string;
  approved: boolean;
  walletAddress: string;
};

/**
 * Fetch challenge details from CardlessID service
 * Endpoint: GET /api/integrator/challenge/details/{challengeId}
 */
export async function getChallengeDetails(
  challengeId: string
): Promise<ChallengeDetails> {
  const response = await challengeClient.get<ChallengeDetails>(
    `/api/integrator/challenge/details/${challengeId}`
  );
  return response.data;
}

/**
 * Submit verification response to CardlessID service
 * CardlessID will then callback the original website
 * Endpoint: POST /api/integrator/challenge/respond
 */
export async function respondToChallenge(
  data: ChallengeResponse
): Promise<{ success: boolean }> {
  const response = await challengeClient.post<{ success: boolean }>(
    '/api/integrator/challenge/respond',
    data
  );
  return response.data;
}

/**
 * For demo/testing: Session-based verification
 * This is used for the age-verify demo page
 */
export type SessionDetails = {
  sessionId: string;
  minAge: number;
  expiresAt: string;
  status: 'pending' | 'responded' | 'expired';
};

export async function getSessionDetails(
  sessionId: string
): Promise<SessionDetails> {
  const response = await challengeClient.get<SessionDetails>(
    `/api/age-verify/session/${sessionId}`
  );
  return response.data;
}

export async function respondToSession(data: {
  sessionId: string;
  approved: boolean;
  walletAddress: string;
}): Promise<{ success: boolean }> {
  const response = await challengeClient.post<{ success: boolean }>(
    '/api/age-verify/respond',
    data
  );
  return response.data;
}
