import { Request } from 'express';
import { TokenPayload } from '../../utils/jwt';

export interface AuthenticatedRequest extends Request {
  user?: TokenPayload;
}

export interface UserFilter {
  email?: {
    contains: string;
    mode?: 'insensitive';
  };
  role?: 'USER' | 'ADMIN' | 'SUPER_ADMIN';
  isActive?: boolean;
  deletedAt?: null;
}
