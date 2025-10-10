export type CustomVerificationProvider = 'custom';

export type UploadIdRequest = {
  image: string; // base64 data URL
  mimeType: string; // e.g., 'image/jpeg'
};

export type ExtractedData = {
  firstName: string;
  middleName?: string;
  lastName: string;
  birthDate: string; // YYYY-MM-DD format
  governmentId: string;
  idType: 'drivers_license' | 'passport' | 'government_id';
  state?: string;
  expirationDate?: string;
};

export type FraudSignal = {
  type: string;
  result: 'PASS' | 'FAIL';
};

export type UploadIdResponse = {
  success: boolean;
  sessionId: string;
  extractedData: ExtractedData;
  fraudSignals: FraudSignal[];
  photoUrl: string;
  isExpired: boolean;
  warnings: string[];
};

export type UploadSelfieRequest = {
  sessionId: string;
  image: string; // base64 data URL
};

export type UploadSelfieResponse = {
  success: boolean;
  match: boolean;
  confidence: number;
  sessionId: string;
};

export type CustomVerificationSession = {
  id: string;
  provider: 'custom';
  providerSessionId: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  createdAt: number;
  expiresAt: number;
  verifiedData?: ExtractedData;
  documentAiData?: {
    fraudSignalsCount: number;
    fraudSignals: FraudSignal[];
    hasData: boolean;
  };
  idPhotoUrl?: string;
  selfiePhotoUrl?: string;
  faceMatchResult?: {
    match: boolean;
    confidence: number;
  };
};

export type GetSessionResponse = {
  success: boolean;
  session: CustomVerificationSession;
};
