import { Router } from 'express';
import { db } from '../db/index.js';
import { h, HttpError } from '../util.js';

const router = Router();

router.get('/', h((req, res) => {
  res.json(db.prepare('SELECT * FROM customers ORDER BY name').all());
}));

router.post('/', h((req, res) => {
  const { name, email } = req.body;
  if (!name || !email) throw new HttpError(400, 'name and email are required');
  try {
    const info = db.prepare('INSERT INTO customers (name, email) VALUES (?, ?)').run(name, email);
    res.status(201).json(db.prepare('SELECT * FROM customers WHERE id = ?').get(info.lastInsertRowid));
  } catch (err) {
    if (String(err.message).includes('UNIQUE')) throw new HttpError(409, 'A customer with this email already exists');
    throw err;
  }
}));

router.get('/by-email/:email', h((req, res) => {
  const customer = db.prepare('SELECT * FROM customers WHERE email = ?').get(req.params.email);
  if (!customer) throw new HttpError(404, 'Customer not found');
  res.json(customer);
}));

export default router;
