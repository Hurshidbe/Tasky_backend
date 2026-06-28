export enum Roles {
  USER = 'user',
  ADMIN = 'admin',
}

/** Bcrypt salt rounds for password hashing */
export const BCRYPT_SALT_ROUNDS = 12;

/** Default limit for activity feed queries */
export const ACTIVITY_FEED_LIMIT = 50;

/** MongoDB ObjectId regex pattern */
export const MONGO_ID_REGEX = /^[0-9a-fA-F]{24}$/;
