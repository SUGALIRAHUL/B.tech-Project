/**
 * Country-specific phone number validation rules.
 * Each entry defines the country code, expected digit length(s) for the
 * local number (after the country code), and display metadata.
 */

export interface CountryPhoneRule {
  code: string;
  name: string;
  flag: string;
  /** Allowed digit lengths for the local number (excluding country code). */
  lengths: number[];
}

export const countryPhoneRules: CountryPhoneRule[] = [
  { code: "+1", name: "United States", flag: "🇺🇸", lengths: [10] },
  { code: "+1", name: "Canada", flag: "🇨🇦", lengths: [10] },
  { code: "+44", name: "United Kingdom", flag: "🇬🇧", lengths: [10] },
  { code: "+61", name: "Australia", flag: "🇦🇺", lengths: [9] },
  { code: "+91", name: "India", flag: "🇮🇳", lengths: [10] },
  { code: "+49", name: "Germany", flag: "🇩🇪", lengths: [10, 11] },
  { code: "+33", name: "France", flag: "🇫🇷", lengths: [9] },
  { code: "+39", name: "Italy", flag: "🇮🇹", lengths: [9, 10] },
  { code: "+34", name: "Spain", flag: "🇪🇸", lengths: [9] },
  { code: "+86", name: "China", flag: "🇨🇳", lengths: [11] },
  { code: "+81", name: "Japan", flag: "🇯🇵", lengths: [10, 11] },
  { code: "+82", name: "South Korea", flag: "🇰🇷", lengths: [10, 11] },
  { code: "+55", name: "Brazil", flag: "🇧🇷", lengths: [10, 11] },
  { code: "+52", name: "Mexico", flag: "🇲🇽", lengths: [10] },
  { code: "+27", name: "South Africa", flag: "🇿🇦", lengths: [9] },
  { code: "+7", name: "Russia", flag: "🇷🇺", lengths: [10] },
  { code: "+31", name: "Netherlands", flag: "🇳🇱", lengths: [9] },
  { code: "+46", name: "Sweden", flag: "🇸🇪", lengths: [9, 10] },
  { code: "+41", name: "Switzerland", flag: "🇨🇭", lengths: [9] },
  { code: "+47", name: "Norway", flag: "🇳🇴", lengths: [8] },
  { code: "+45", name: "Denmark", flag: "🇩🇰", lengths: [8] },
  { code: "+358", name: "Finland", flag: "🇫🇮", lengths: [9, 10] },
  { code: "+48", name: "Poland", flag: "🇵🇱", lengths: [9] },
  { code: "+351", name: "Portugal", flag: "🇵🇹", lengths: [9] },
  { code: "+30", name: "Greece", flag: "🇬🇷", lengths: [10] },
  { code: "+90", name: "Turkey", flag: "🇹🇷", lengths: [10] },
  { code: "+971", name: "UAE", flag: "🇦🇪", lengths: [9] },
  { code: "+966", name: "Saudi Arabia", flag: "🇸🇦", lengths: [9] },
  { code: "+65", name: "Singapore", flag: "🇸🇬", lengths: [8] },
  { code: "+852", name: "Hong Kong", flag: "🇭🇰", lengths: [8] },
  { code: "+64", name: "New Zealand", flag: "🇳🇿", lengths: [9, 10] },
  { code: "+60", name: "Malaysia", flag: "🇲🇾", lengths: [9, 10] },
  { code: "+66", name: "Thailand", flag: "🇹🇭", lengths: [9] },
  { code: "+63", name: "Philippines", flag: "🇵🇭", lengths: [10] },
  { code: "+62", name: "Indonesia", flag: "🇮🇩", lengths: [10, 11, 12] },
  { code: "+84", name: "Vietnam", flag: "🇻🇳", lengths: [9, 10] },
  { code: "+234", name: "Nigeria", flag: "🇳🇬", lengths: [10] },
  { code: "+254", name: "Kenya", flag: "🇰🇪", lengths: [9] },
  { code: "+20", name: "Egypt", flag: "🇪🇬", lengths: [10] },
  { code: "+972", name: "Israel", flag: "🇮🇱", lengths: [9] },
];

/**
 * Find the matching phone rule by country code + country name.
 * Uses both code and name to disambiguate (e.g. US vs Canada both use +1).
 */
export function getPhoneRuleByCodeAndName(code: string, name: string): CountryPhoneRule | undefined {
  return countryPhoneRules.find(r => r.code === code && r.name === name);
}

/**
 * Find the first matching phone rule by country code only.
 */
export function getPhoneRuleByCode(code: string): CountryPhoneRule | undefined {
  return countryPhoneRules.find(r => r.code === code);
}

/**
 * Get the maximum allowed digits for a given country code.
 * Returns the largest length from the rule, or 15 as ITU-T default.
 */
export function getMaxDigits(code: string, name?: string): number {
  const rule = name
    ? getPhoneRuleByCodeAndName(code, name)
    : getPhoneRuleByCode(code);
  if (!rule) return 15; // ITU-T E.164 max
  return Math.max(...rule.lengths);
}

/**
 * Get the minimum allowed digits for a given country code.
 */
export function getMinDigits(code: string, name?: string): number {
  const rule = name
    ? getPhoneRuleByCodeAndName(code, name)
    : getPhoneRuleByCode(code);
  if (!rule) return 7;
  return Math.min(...rule.lengths);
}

/**
 * Validate a phone number (digits only, without country code) against the rule.
 */
export function isValidPhoneLength(digits: string, code: string, name?: string): boolean {
  const rule = name
    ? getPhoneRuleByCodeAndName(code, name)
    : getPhoneRuleByCode(code);
  if (!rule) return digits.length >= 7 && digits.length <= 15;
  return rule.lengths.includes(digits.length);
}

/**
 * Get a human-readable hint for expected phone length, e.g. "10 digits" or "9-10 digits".
 */
export function getPhoneLengthHint(code: string, name?: string): string {
  const rule = name
    ? getPhoneRuleByCodeAndName(code, name)
    : getPhoneRuleByCode(code);
  if (!rule) return "7-15 digits";
  const min = Math.min(...rule.lengths);
  const max = Math.max(...rule.lengths);
  if (min === max) return `${min} digits`;
  return `${min}-${max} digits`;
}
