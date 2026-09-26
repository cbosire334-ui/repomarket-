import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { db } from '../../lib/db';
import { getUserFromRequest } from '../../lib/auth';

const itemSchema = z.object({
  name: z.string().trim().min(1).max(80),
  price: z.number().nonnegative().max(1_000_000_000),
  category: z.enum(['Vehicle', 'Electronics', 'Furniture', 'Appliances', 'Real Estate', 'Other']),
  description: z.string().trim().max(500).optional().default(''),
});

function shapeItem(r: Record<string, unknown>) {
  return {
    id: r.id,
    ownerId: r.owner_id,
    ownerName: r.owner_name,
    name: r.name,
    price: r.price,
    category: r.category,
    description: r.description || '',
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    const q = ((req.query.q as string) || '').trim().toLowerCase();

    let result;
    if (q) {
      result = await db.execute({
        sql: `SELECT items.*, users.name AS owner_name
              FROM items JOIN users ON users.id = items.owner_id
              WHERE LOWER(items.name) LIKE ? OR LOWER(items.description) LIKE ? OR LOWER(items.category) LIKE ?
              ORDER BY items.created_at DESC`,
        args: [`%${q}%`, `%${q}%`, `%${q}%`],
      });
    } else {
      result = await db.execute({
        sql: `SELECT items.*, users.name AS owner_name
              FROM items JOIN users ON users.id = items.owner_id
              ORDER BY items.created_at DESC`,
        args: [],
      });
    }

    return res.json(result.rows.map(shapeItem));
  }

  if (req.method === 'POST') {
    const user = getUserFromRequest(req);
    if (!user) return res.status(401).json({ error: 'Authentication required' });

    const parsed = itemSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });
    const { name, price, category, description } = parsed.data;

    const id = randomUUID();
    const now = Date.now();

    await db.execute({
      sql: `INSERT INTO items (id, owner_id, name, price, category, description, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [id, user.id, name, price, category, description, now, now],
    });

    const result = await db.execute({
      sql: `SELECT items.*, users.name AS owner_name
            FROM items JOIN users ON users.id = items.owner_id
            WHERE items.id = ?`,
      args: [id],
    });

    return res.status(201).json(shapeItem(result.rows[0] as Record<string, unknown>));
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
