export type IdType = 'passport' | 'drivers_license';

export type CredentialRequest = {
  walletAddress: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  birthDate: string; // ISO format
  governmentId: string;
  idType: IdType;
  state: string; // US state code
};

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
  blockchain?: {
    credentialTransaction: {
      id: string;
      explorerUrl: string;
      note: string;
    };
    verificationTransaction: {
      id: string;
      explorerUrl: string;
      note: string;
    };
  };
};
