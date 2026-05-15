export type AppErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'BAD_REQUEST'
  | 'DOMAIN_RULE_VIOLATION'
  | 'INSUFFICIENT_STOCK'
  | 'CREDIT_LIMIT_EXCEEDED'
  | 'INVALID_STATE'
  | 'INTERNAL_ERROR';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: AppErrorCode;
  public readonly details?: unknown;

  constructor(
    code: AppErrorCode,
    message: string,
    statusCode = 400,
    details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found', details?: unknown) {
    super('NOT_FOUND', message, 404, details);
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation failed', details?: unknown) {
    super('VALIDATION_ERROR', message, 422, details);
    this.name = 'ValidationError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super('UNAUTHORIZED', message, 401);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden', details?: unknown) {
    super('FORBIDDEN', message, 403, details);
    this.name = 'ForbiddenError';
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflict', details?: unknown) {
    super('CONFLICT', message, 409, details);
    this.name = 'ConflictError';
  }
}

export class DomainRuleError extends AppError {
  constructor(
    code: AppErrorCode = 'DOMAIN_RULE_VIOLATION',
    message = 'Domain rule violation',
    statusCode = 409,
    details?: unknown,
  ) {
    super(code, message, statusCode, details);
    this.name = 'DomainRuleError';
  }
}

export class InsufficientStockError extends DomainRuleError {
  constructor(message = 'Insufficient stock', details?: unknown) {
    super('INSUFFICIENT_STOCK', message, 409, details);
    this.name = 'InsufficientStockError';
  }
}

export class CreditLimitExceededError extends DomainRuleError {
  constructor(message = 'Customer credit limit exceeded', details?: unknown) {
    super('CREDIT_LIMIT_EXCEEDED', message, 409, details);
    this.name = 'CreditLimitExceededError';
  }
}

export class InvalidStateError extends DomainRuleError {
  constructor(message = 'Invalid state transition', details?: unknown) {
    super('INVALID_STATE', message, 409, details);
    this.name = 'InvalidStateError';
  }
}
