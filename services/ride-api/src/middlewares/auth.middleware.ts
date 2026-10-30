import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { AppError } from '../utils/app-error';

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      userRole?: string;
    }
  }
}

interface AccessPayload {
  sub: string;
  role: string;
  email: string;
}

export function authMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    next(new AppError(401, 'Missing bearer token', 'UNAUTHORIZED'));
    return;
  }
  try {
    const payload = jwt.verify(header.slice(7), env.jwtAccessSecret) as AccessPayload;
    req.userId = payload.sub;
    req.userRole = payload.role;
    next();
  } catch {
    next(new AppError(401, 'Invalid access token', 'UNAUTHORIZED'));
  }
}
