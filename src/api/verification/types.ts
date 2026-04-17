export type VerificationProvider = 'mock' | 'idenfy' | 'stripe_identity';

export type VerificationStatus =
  | 'pending'
  | 'completed'
  | 'failed'
  | 'approved'
  | 'rejected'
  | 'expired';

export type StartSessionRequest = {
  provider?: VerificationProvider;
};

export type StartSessionResponse = {
  sessionId: string;
  authToken: string;
  providerSessionId: string;
  expiresAt: string;
  provider: VerificationProvider;
};

export type ExtractedIdentityData = {
  firstName: string;
  lastName: string;
  birthDate: string;
  governmentId: string;
  idType: string;
  state: string;
};

export type SessionStatusResponse = {
  sessionId: string;
  status: VerificationStatus;
  provider: VerificationProvider;
  ready: boolean;
  expiresAt: string;
  credentialIssued: boolean;
  verificationToken?: string;
  extractedData?: ExtractedIdentityData;
};

export type IdentityData = {
  firstName: string;
  middleName?: string;
  lastName: string;
  birthDate: string; // YYYY-MM-DD format
  governmentId: string;
  idType: 'government_id' | 'passport';
  state: string;
};

export type MockProviderVerifyRequest = {
  authToken: string;
  providerSessionId: string;
  identityData: IdentityData;
  approved?: boolean; // Only used if AUTO_APPROVE=true
};
