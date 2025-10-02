export type VerificationProvider = 'mock' | 'idenfy' | 'stripe_identity';

export type VerificationStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'expired';

export type StartSessionRequest = {
  provider?: VerificationProvider;
};

export type StartSessionResponse = {
  sessionId: string;
  authToken: string;
  expiresAt: string;
  provider: VerificationProvider;
};

export type SessionStatusResponse = {
  sessionId: string;
  status: VerificationStatus;
  provider: VerificationProvider;
  ready: boolean;
  expiresAt: string;
  credentialIssued: boolean;
};
