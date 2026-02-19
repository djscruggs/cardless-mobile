export type CustomVerificationProvider = 'custom';

export type UploadIdRequest = {
  image: string; // base64 data URL - front of ID (required)
  backImage?: string; // base64 data URL - back of ID (optional but recommended)
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
  type: string; // e.g., "evidence_fake_SUSPICIOUS_WORDS", "evidence_tampering_GLARE"
  result: 'PASS' | 'FAIL' | 'SUSPICIOUS';
};

export type FraudCheck = {
  passed: boolean;
  signals: FraudSignal[];
};

export type UploadIdResponse = {
  success: boolean;
  sessionId?: string;
  verificationToken?: string; // REQUIRED for credential creation - Format: sessionId:dataHmac:timestamp:signature (expires in 10 minutes)
  extractedData?: ExtractedData;
  lowConfidenceFields?: string[]; // AWS Textract quality warnings
  photoUrl?: string;
  isExpired?: boolean;
  warnings?: string[] | null;
  bothSidesProcessed?: boolean; // Whether front and back were processed
  fraudCheck?: FraudCheck;
  // Fraud detection error fields (when fraudCheck.passed = false)
  error?: string;
  fraudDetected?: boolean;
  fraudSignals?: FraudSignal[]; // Legacy field for error responses
};

export type UploadSelfieRequest = {
  sessionId: string;
  image: string; // base64 data URL - selfie
  idPhoto: string; // base64 data URL - ID photo from Step 1 (stored client-side)
};

export type LivenessResult = {
  isLive: boolean;
  confidence: number;
  qualityScore: number;
  issues?: string[];
};

export type UploadSelfieResponse = {
  success: boolean;
  match: boolean;
  confidence: number;
  sessionId: string;
  livenessResult?: LivenessResult;
  error?: string;
  issues?: string[];
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
