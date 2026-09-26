import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../../lib/db';
import { getUserFromRequest } from '../../lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const auth = getUserFromRequest(req);
  if (!auth) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const result = await db.execute({
    sql: 'SELECT id, name, email FROM users WHERE id = ?',
    args: [auth.id],
  });
  const user = result.rows[0];
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  return res.json({ user });
}
