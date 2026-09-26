import jwt from 'jsonwebtoken';
import type { VercelRequest } from '@vercel/node';

const SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

export type AuthedUser = { id: string; email: string };

export function signToken(user: { id: string; email: string }): string {
  return jwt.sign({ sub: user.id, email: user.email }, SECRET, { expiresIn: '7d' });
}

/**
 * Reads the Bearer token from the request, verifies it,
 * and returns the user payload — or null if missing/invalid.
 */
export function getUserFromRequest(req: VercelRequest): AuthedUser | null {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return null;

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, SECRET) as { sub: string; email: string };
    return { id: payload.sub, email: payload.email };
  } catch {
    return null;
  }
}
