/**
 * Common utility functions for the test framework
 */

/**
 * Generate random string
 */
export function generateRandomString(length: number = 8): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Generate random email
 */
export function generateRandomEmail(domain: string = 'automation.com'): string {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000);
  return `test_${timestamp}_${random}@${domain}`;
}

/**
 * Generate random number within range
 */
export function generateRandomNumber(min: number = 1000, max: number = 9999): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Format currency
 */
export function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
  }).format(amount);
}

/**
 * Wait for specified time
 */
export function wait(milliseconds: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

/**
 * Get current timestamp
 */
export function getCurrentTimestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

/**
 * Generate unique ID
 */
export function generateUniqueId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * Get current date formatted as dd/MM/yyyy
 */
export function getCurrentDate(): string {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0'); // Month is 0-indexed
  const year = now.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Clean text by removing extra whitespace
 */
export function cleanText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Convert string to title case
 */
export function toTitleCase(text: string): string {
  return text.replace(/\w\S*/g, (txt) => 
    txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
  );
}

/**
 * Deep clone object
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Get environment variable with default value
 */
export function getEnvVar(key: string, defaultValue: string = ''): string {
  return process.env[key] || defaultValue;
}

/**
 * Parse JSON safely
 */
export function safeJsonParse(jsonString: string, defaultValue: any = null): any {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    console.warn(`Failed to parse JSON: ${jsonString}`);
    return defaultValue;
  }
}

/**
 * Retry function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === maxRetries) {
        throw lastError;
      }
      
      const delay = baseDelay * Math.pow(2, attempt);
      await wait(delay);
    }
  }
  
  throw lastError!;
}
