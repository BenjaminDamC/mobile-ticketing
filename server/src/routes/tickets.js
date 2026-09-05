import { Router } from 'express';
import { nanoid } from 'nanoid';
import { db } from '../db/index.js';
import { h, HttpError } from '../util.js';

const router = Router();

const TICKET_DETAIL_SQL = `
  SELECT tk.*, fp.price_cents, fp.currency, prod.name AS product_name, prod.kind AS product_kind,
         prod.validity_minutes, fz.name AS from_zone_name, tz.name AS to_zone_name
  FROM tickets tk
  JOIN fare_prices fp ON fp.id = tk.fare_price_id
  JOIN fare_products prod ON prod.id = fp.product_id
  LEFT JOIN zones fz ON fz.id = fp.from_zone_id
  LEFT JOIN zones tz ON tz.id = fp.to_zone_id
`;

router.get('/', h((req, res) => {
  const { customerId } = req.query;
  if (!customerId) throw new HttpError(400, 'customerId is required');
  const rows = db
    .prepare(`${TICKET_DETAIL_SQL} WHERE tk.customer_id = ? ORDER BY tk.purchased_at DESC`)
    .all(customerId);
  res.json(rows);
}));

router.get('/:id', h((req, res) => {
  const ticket = db.prepare(`${TICKET_DETAIL_SQL} WHERE tk.id = ?`).get(req.params.id);
  if (!ticket) throw new HttpError(404, 'Ticket not found');
  const validations = db
    .prepare(
      `SELECT v.*, s.name AS stop_name, r.short_name AS route_short_name
       FROM validations v
       LEFT JOIN stops s ON s.id = v.stop_id
       LEFT JOIN trips t ON t.id = v.trip_id
       LEFT JOIN routes r ON r.id = t.route_id
       WHERE v.ticket_id = ? ORDER BY v.validated_at DESC`
    )
    .all(req.params.id);
  res.json({ ...ticket, validations });
}));

// Purchase = create ticket + take payment, atomically. Ticket only becomes
// usable ('active') once the payment succeeds.
router.post('/purchase', h((req, res) => {
  const { customerId, farePriceId, method } = req.body;
  if (!customerId || !farePriceId || !method) {
    throw new HttpError(400, 'customerId, farePriceId, method are required');
  }
  const price = db.prepare('SELECT * FROM fare_prices WHERE id = ?').get(farePriceId);
  if (!price) throw new HttpError(404, 'Fare price not found');
  if (price.valid_to) throw new HttpError(409, 'This price is no longer in effect; refetch current prices');
  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId);
  if (!customer) throw new HttpError(404, 'Customer not found');

  const tx = db.transaction(() => {
    const code = nanoid(12);
    const ticketInfo = db
      .prepare(
        `INSERT INTO tickets (customer_id, fare_price_id, validation_code, status)
         VALUES (?, ?, ?, 'pending_payment')`
      )
      .run(customerId, farePriceId, code);
    const ticketId = ticketInfo.lastInsertRowid;

    // Simulated payment gateway: succeeds unless explicitly told to fail (for demo/testing).
    const succeeded = method !== 'card_declined_demo';
    db.prepare(
      `INSERT INTO payments (ticket_id, amount_cents, currency, method, status)
       VALUES (?, ?, ?, ?, ?)`
    ).run(ticketId, price.price_cents, price.currency, method, succeeded ? 'succeeded' : 'failed');

    db.prepare('UPDATE tickets SET status = ? WHERE id = ?').run(
      succeeded ? 'active' : 'cancelled',
      ticketId
    );

    if (!succeeded) throw new HttpError(402, 'Payment failed');
    return ticketId;
  });

  const ticketId = tx();
  res.status(201).json(db.prepare(`${TICKET_DETAIL_SQL} WHERE tk.id = ?`).get(ticketId));
}));

export default router;
