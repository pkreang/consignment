import { Request, Response, NextFunction, RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import {
  ForbiddenError,
  UnauthorizedError,
} from '../errors/AppError';

export type AuthUser = {
  userId: bigint;
  username: string;
  roleId?: bigint;
  roleName?: string;
  employeeId?: bigint;
  permissions: string[];
};

export type JwtPayload = {
  sub: string;
  username: string;
  roleId?: string;
  roleName?: string;
  employeeId?: string;
  permissions: string[];
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
      auditContext?: {
        requestId?: string;
        userId?: bigint;
        username?: string;
        ip?: string;
      };
    }
  }
}

export const authenticate: RequestHandler = (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  const header = req.header('authorization');
  if (!header || !header.toLowerCase().startsWith('bearer ')) {
    return next(new UnauthorizedError('Missing or invalid Authorization header'));
  }
  const token = header.slice(7).trim();
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    req.user = {
      userId: BigInt(decoded.sub),
      username: decoded.username,
      roleId: decoded.roleId ? BigInt(decoded.roleId) : undefined,
      roleName: decoded.roleName,
      employeeId: decoded.employeeId ? BigInt(decoded.employeeId) : undefined,
      permissions: decoded.permissions ?? [],
    };
    next();
  } catch (err) {
    next(new UnauthorizedError('Invalid or expired token'));
  }
};

export const requirePermission =
  (...required: string[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.user) return next(new UnauthorizedError());
    const granted = new Set(req.user.permissions);
    if (granted.has('*')) return next();
    for (const code of required) {
      if (!granted.has(code)) {
        return next(
          new ForbiddenError(
            `Missing required permission: ${code}`,
            { required, granted: [...granted] },
          ),
        );
      }
    }
    next();
  };

export const hasPermission = (user: AuthUser | undefined, code: string): boolean => {
  if (!user) return false;
  return user.permissions.includes('*') || user.permissions.includes(code);
};

export function signAccessToken(payload: Omit<JwtPayload, 'iat' | 'exp'>) {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

export function signRefreshToken(payload: Omit<JwtPayload, 'iat' | 'exp'>) {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}
