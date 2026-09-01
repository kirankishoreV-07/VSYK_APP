// ============================================================
// Phone Number Normalization Utilities
// ============================================================
// VSYK customers.phone stores 10-digit Indian mobile numbers.
// Gupshup uses E.164 format with 91 prefix (e.g. 919876543210).
//
// These functions convert between the two formats safely,
// handling common variations without modifying existing DB data.
// ============================================================

/**
 * Convert any phone format to the DB format (10-digit Indian mobile).
 *
 * Accepted inputs:
 *   919876543210   → 9876543210
 *   +919876543210  → 9876543210
 *   9876543210     → 9876543210
 *   0919876543210  → 9876543210  (edge case)
 *
 * Returns the cleaned 10-digit string, or the original input
 * if it cannot be confidently normalized.
 */
export function normalizePhoneToDb(phone: string): string {
  // Strip all non-digit characters (spaces, dashes, plus sign)
  const digits = phone.replace(/\D/g, '');

  // Already 10 digits — return as-is
  if (digits.length === 10) {
    return digits;
  }

  // 12 digits starting with 91 — strip country code
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits.slice(2);
  }

  // 13 digits starting with 091 — strip 0 + country code (rare edge case)
  if (digits.length === 13 && digits.startsWith('091')) {
    return digits.slice(3);
  }

  // 11 digits starting with 0 — strip leading zero (landline convention, rare)
  if (digits.length === 11 && digits.startsWith('0')) {
    return digits.slice(1);
  }

  // Cannot normalize confidently — return cleaned digits
  return digits;
}

/**
 * Convert a DB phone number (10-digit) to Gupshup E.164 format.
 *
 * Input:  9876543210
 * Output: 919876543210
 *
 * If the phone already has the 91 prefix, it is returned as-is.
 */
export function normalizePhoneToGupshup(phone: string): string {
  const digits = phone.replace(/\D/g, '');

  // Already 12 digits with 91 prefix — return as-is
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits;
  }

  // 10 digits — prepend 91
  if (digits.length === 10) {
    return `91${digits}`;
  }

  // Unexpected format — prepend 91 anyway as best effort
  return `91${digits}`;
}

/**
 * Validate that a phone string looks like a plausible Indian mobile number
 * after normalization to 10 digits.
 *
 * Indian mobile numbers start with 6, 7, 8, or 9.
 */
export function isValidIndianMobile(phone10: string): boolean {
  return /^[6-9]\d{9}$/.test(phone10);
}
