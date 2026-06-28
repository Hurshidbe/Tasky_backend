import { Request } from 'express';

export interface JwtPayload {
  userId: string;
  iat?: number;
  exp?: number;
}

export interface RequestWithUser extends Request {
  user: JwtPayload;
}

export interface Collaborator {
  userId: string;
}
