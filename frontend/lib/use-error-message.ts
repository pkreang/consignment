"use client";

import { useTranslations } from 'next-intl';
import { ApiError } from '@/lib/api';

// The 11 stable backend AppErrorCode values (see the i18n design spec).
// SYNC: keep this list in step with the "errors" keys in messages/en.json
// and messages/th.json, and with the backend's AppErrorCode enum. Adding a
// code here without a matching message-file key makes next-intl throw at runtime.
const ERROR_CODES = [
  'VALIDATION_ERROR',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'BAD_REQUEST',
  'DOMAIN_RULE_VIOLATION',
  'INSUFFICIENT_STOCK',
  'CREDIT_LIMIT_EXCEEDED',
  'INVALID_STATE',
  'INTERNAL_ERROR',
] as const;

type ErrorCode = (typeof ERROR_CODES)[number];

function isErrorCode(code: string | undefined): code is ErrorCode {
  return code !== undefined && (ERROR_CODES as readonly string[]).includes(code);
}

/**
 * Returns a function that turns any thrown value into a localized,
 * user-facing message:
 *  1. ApiError with a known backend code  -> translated string for that code
 *  2. any other ApiError                  -> the raw message the API sent
 *  3. anything else                       -> a generic translated message
 */
export function useErrorMessage(): (err: unknown) => string {
  const t = useTranslations('errors');
  return (err: unknown): string => {
    if (err instanceof ApiError) {
      if (isErrorCode(err.code)) return t(err.code);
      return err.message;
    }
    return t('unexpected');
  };
}
