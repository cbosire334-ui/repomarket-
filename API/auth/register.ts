import type { VercelRequest, VercelResponse } from '@vercel/node';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { db } from '../../lib/db';
import { signToken } from '../../lib/auth';

const schema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(200).toLowerCase(),
  password: z.string().min(6).max(200),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input' });
  }
  const { name, email, password } = parsed.data;

  const existing = await db.execute({
    sql: 'SELECT id FROM users WHERE email = ?',
    args: [email],
  });
  if (existing.rows.length) {
    return res.status(409).json({ error: 'Email already registered' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const id = randomUUID();
  const createdAt = Date.now();

  await db.execute({
    sql: 'INSERT INTO users (id, name, email, password_hash, created_at) VALUES (?, ?, ?, ?, ?)',
    args: [id, name, email, passwordHash, createdAt],
  });

  const user = { id, name, email };
  const token = signToken(user);
  return res.status(201).json({ token, user });
}
