export type IdType = 'drivers_license' | 'passport' | 'government_id';

// Direct credential request (original flow - for development/testing)
export type DirectCredentialRequest = {
  walletAddress: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  birthDate: string; // ISO format
  governmentId: string;
  idType: IdType;
  state: string; // US state code
};

// Verification-based credential request (legacy - session ID only)
export type VerificationCredentialRequest = {
  verificationSessionId: string;
  walletAddress: string;
};

// Token-based credential request (new secure flow with data integrity verification)
export type TokenBasedCredentialRequest = {
  verificationToken: string; // REQUIRED - from upload-id response
  walletAddress: string;
  // Identity data (for server-side hash verification)
  firstName: string;
  middleName?: string;
  lastName: string;
  birthDate: string;
  governmentId: string;
  idType: 'drivers_license' | 'passport' | 'government_id';
  state?: string;
  expirationDate?: string;
};

// Union type for credential requests
export type CredentialRequest =
  | DirectCredentialRequest
  | VerificationCredentialRequest
  | TokenBasedCredentialRequest;

export type PersonalData = {
  firstName: string;
  middleName?: string;
  lastName: string;
  birthDate: string;
  governmentId: string;
  idType: IdType;
  state: string;
};

export type FraudDetection = {
  performed: boolean;
  passed: boolean;
  method: string;
  provider: string;
  signals: { type: string; result: string }[];
};

export type DocumentAnalysis = {
  provider: string;
  bothSidesAnalyzed: boolean;
  lowConfidenceFields: string[];
  qualityLevel: 'high' | 'medium' | 'low';
};

export type BiometricVerification = {
  performed: boolean;
  faceMatch: {
    confidence: number;
    provider: string;
  };
  liveness: {
    confidence: number;
    provider: string;
  };
};

export type Evidence = {
  type: string[];
  verifier: string;
  evidenceDocument: string;
  subjectPresence: string;
  documentPresence: string;
  verificationMethod: string;
  fraudDetection: FraudDetection;
  documentAnalysis: DocumentAnalysis;
  biometricVerification: BiometricVerification;
};

export type VerificationQuality = {
  level: 'high' | 'medium' | 'low';
  fraudCheckPassed: boolean;
  extractionMethod: string;
  bothSidesProcessed: boolean;
  lowConfidenceFields: string[];
  fraudSignals: { type: string; result: string }[];
  faceMatchConfidence: number;
  livenessConfidence: number;
};

export type ServiceEndpoint = {
  id: string; // e.g., '#system-attestation'
  type: string; // e.g., 'ZkProofSystemVersion'
  serviceEndpoint: string; // GitHub commit URL for auditability
};

export type VerifiableCredential = {
  '@context': string[];
  id: string;
  type: string[];
  issuer: {
    id: string;
  };
  issuanceDate: string;
  credentialSubject: {
    id: string;
    'cardlessid:governmentIdHash': string;
    'cardlessid:firstNameHash': string;
    'cardlessid:middleNameHash': string;
    'cardlessid:lastNameHash': string;
    'cardlessid:birthDateHash': string;
    'cardlessid:compositeHash': string;
    'cardlessid:idType': IdType;
    'cardlessid:state': string;
  };
  evidence?: Evidence[];
  service?: ServiceEndpoint[]; // Optional: Links to exact git commit for auditability and transparency
  proof: {
    type: string;
    created: string;
    verificationMethod: string;
    proofPurpose: string;
    proofValue: string;
  };
};

export type CredentialResponse = {
  credential: VerifiableCredential;
  personalData: PersonalData;
  verificationQuality?: VerificationQuality;
  nft?: {
    assetId: string; // Backend sends as string due to JSON.stringify issues with large numbers
    requiresOptIn: boolean;
    instructions?: {
      step1: string;
      step2: string;
      step3: string;
    };
  };
  blockchain?: {
    transaction: {
      id: string;
      explorerUrl: string;
      note?: string;
    };
    network?: 'testnet' | 'mainnet';
  };
  duplicateDetection?: {
    duplicateCount: number;
    isDuplicate: boolean;
    message: string;
  };
};
