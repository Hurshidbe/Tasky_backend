import { Types } from 'mongoose';

/**
 * Validates whether a string is a valid MongoDB ObjectId.
 * Replaces repetitive /^[0-9a-fA-F]{24}$/ regex checks throughout the codebase.
 */
export function isValidObjectId(id: string): boolean {
  return Types.ObjectId.isValid(id) && /^[0-9a-fA-F]{24}$/.test(id);
}
