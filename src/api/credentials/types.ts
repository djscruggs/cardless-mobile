export type IdType = 'passport' | 'government_id';

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

// Verification-based credential request (new flow)
export type VerificationCredentialRequest = {
  verificationSessionId: string;
  walletAddress: string;
};

// Union type for credential requests
export type CredentialRequest =
  | DirectCredentialRequest
  | VerificationCredentialRequest;

export type PersonalData = {
  firstName: string;
  middleName?: string;
  lastName: string;
  birthDate: string;
  governmentId: string;
  idType: IdType;
  state: string;
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
