export interface ResetPasswordInput {
  email: string;
  resetPasswordToken: string;
  newPassword: string;
}

export interface RequestPasswordResetInput {
  email: string;
}

export interface GraAuthDataShape {
  invalidTokenReset: ResetPasswordInput;
  nonExistentEmailReset: ResetPasswordInput;
  weakPasswordReset: ResetPasswordInput;
  nonExistentEmailPasswordRequest: RequestPasswordResetInput;
  invalidFormatEmailPasswordRequest: RequestPasswordResetInput;
}

export interface GraAuthErrorMessages {
  invalidResetToken: string;
  weakPassword: string;
  invalidEmailFormat: string;
  unauthorizedAccess: string;
}

export const graAuthData: GraAuthDataShape = {
  invalidTokenReset: {
    email: 'platypus-staging-test@example.com',
    resetPasswordToken: 'invalid-token-abc123xyz987',
    newPassword: 'ValidNewPass123!',
  },
  nonExistentEmailReset: {
    email: `ghost${Date.now()}@platypus-nowhere.com`,
    resetPasswordToken: 'invalid-token-abc123xyz987',
    newPassword: 'ValidNewPass123!',
  },
  weakPasswordReset: {
    email: 'platypus-staging-test@example.com',
    resetPasswordToken: 'invalid-token-abc123xyz987',
    newPassword: 'weak',
  },
  nonExistentEmailPasswordRequest: {
    email: `ghost${Date.now()}@platypus-nowhere.com`,
  },
  invalidFormatEmailPasswordRequest: {
    email: 'not-a-valid-email-format',
  },
};

export const graAuthErrorMessages: GraAuthErrorMessages = {
  invalidResetToken: 'The provided token is invalid',
  weakPassword: 'password',
  invalidEmailFormat: 'Invalid email address',
  unauthorizedAccess: "The current customer isn't authorized.",
};
