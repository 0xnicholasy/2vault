export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validateOpenRouterKey(key: string): ValidationResult {
  if (!key) return { valid: true }; // Empty is valid (not configured yet)
  if (!key.startsWith("sk-or-"))
    return { valid: false, error: "Must start with 'sk-or-'" };
  if (key.length < 20)
    return { valid: false, error: "Key appears too short" };
  return { valid: true };
}

export function validateVaultApiKey(key: string): ValidationResult {
  if (!key) return { valid: true }; // Empty is valid
  if (key.length < 5)
    return { valid: false, error: "Key appears too short" };
  return { valid: true };
}
