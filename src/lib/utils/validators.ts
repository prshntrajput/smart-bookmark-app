/**
 * Pure validation utilities — no side effects, fully testable.
 * SRP: this module's only job is input validation.
 */

import { APP_CONFIG } from "@/constants";

export function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function isValidTitle(title: string): boolean {
  const trimmed = title.trim();
  return trimmed.length >= 1 && trimmed.length <= APP_CONFIG.MAX_TITLE_LENGTH;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validateBookmark(
  url: string,
  title: string
): ValidationResult {
  if (!url.trim()) {
    return { valid: false, error: "URL is required" };
  }
  if (!isValidUrl(url)) {
    return {
      valid: false,
      error: "Please enter a valid URL (must start with http:// or https://)",
    };
  }
  if (url.length > APP_CONFIG.MAX_URL_LENGTH) {
    return { valid: false, error: "URL is too long" };
  }
  if (!title.trim()) {
    return { valid: false, error: "Title is required" };
  }
  if (!isValidTitle(title)) {
    return {
      valid: false,
      error: `Title must be between 1 and ${APP_CONFIG.MAX_TITLE_LENGTH} characters`,
    };
  }
  return { valid: true };
}
