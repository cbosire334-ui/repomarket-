import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
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
  const user = getUserFromRequest(req);
  if (!user) return res.status(401).json({ error: 'Authentication required' });

  const id = req.query.id as string;

  const existing = await db.execute({
    sql: 'SELECT * FROM items WHERE id = ?',
    args: [id],
  });
  if (!existing.rows.length) {
    return res.status(404).json({ error: 'Item not found' });
  }
  if (existing.rows[0].owner_id !== user.id) {
    return res.status(403).json({ error: 'Not your item' });
  }

  if (req.method === 'PUT') {
    const parsed = itemSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });
    const { name, price, category, description } = parsed.data;

    await db.execute({
      sql: `UPDATE items SET name = ?, price = ?, category = ?, description = ?, updated_at = ?
            WHERE id = ?`,
      args: [name, price, category, description, Date.now(), id],
    });

    const result = await db.execute({
      sql: `SELECT items.*, users.name AS owner_name
            FROM items JOIN users ON users.id = items.owner_id
            WHERE items.id = ?`,
      args: [id],
    });
    return res.json(shapeItem(result.rows[0] as Record<string, unknown>));
  }

  if (req.method === 'DELETE') {
    await db.execute({ sql: 'DELETE FROM items WHERE id = ?', args: [id] });
    return res.json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
