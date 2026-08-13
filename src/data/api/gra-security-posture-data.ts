export interface SecurityHeaderBaseline {
  name: string;
  required: boolean;
}

export interface SecurityPostureDataShape {
  baselineHeaders: readonly SecurityHeaderBaseline[];
  versionProbePaths: readonly string[];
  adminProbePaths: readonly string[];
  versionPattern: RegExp;
  dashboardMarkers: readonly string[];
  stackTraceMarkers: readonly string[];
  sessionCookiePattern: RegExp;
  invalidOperation: string;
  corsTestOrigin: string;
  minimalOperation: string;
}

export const SecurityPostureData: SecurityPostureDataShape = {
  baselineHeaders: [
    { name: 'strict-transport-security', required: true },
    { name: 'x-content-type-options', required: true },
    { name: 'x-frame-options', required: false },
    { name: 'content-security-policy', required: false },
    { name: 'referrer-policy', required: false },
    { name: 'permissions-policy', required: false },
  ],
  versionProbePaths: ['/magento_version'],
  adminProbePaths: ['/admin', '/setup'],
  versionPattern: /2\.4\.\d+/,
  dashboardMarkers: ['Dashboard', 'adminhtml', 'Advanced Reporting'],
  stackTraceMarkers: ['/vendor/', '/app/code/', 'Stack trace', '#0 /'],
  sessionCookiePattern: /^(PHPSESSID|.*_session|mage-cache-sessid)/i,
  invalidOperation: 'query InvalidProbe { __thisFieldDoesNotExist }',
  corsTestOrigin: 'https://cors-probe.invalid.example',
  minimalOperation: 'query SecurityProbe { __typename }',
};
