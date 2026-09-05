import { Router } from 'express';
import { db } from '../db/index.js';
import { h, HttpError } from '../util.js';

const router = Router();

router.get('/', h((req, res) => {
  const limit = Number(req.query.limit) || 25;
  const rows = db
    .prepare(
      `SELECT v.*, t.validation_code, c.name AS customer_name, s.name AS stop_name,
              r.short_name AS route_short_name
       FROM validations v
       LEFT JOIN tickets t ON t.id = v.ticket_id
       LEFT JOIN customers c ON c.id = t.customer_id
       LEFT JOIN stops s ON s.id = v.stop_id
       LEFT JOIN trips tr ON tr.id = v.trip_id
       LEFT JOIN routes r ON r.id = tr.route_id
       ORDER BY v.validated_at DESC LIMIT ?`
    )
    .all(limit);
  res.json(rows);
}));

// Validate (tap-in) a ticket. Correctness-critical: runs as one transaction so a
// ticket can never be left in an inconsistent state between the status flip and the log entry.
router.post('/', h((req, res) => {
  const { validationCode, tripId, stopId, vehicleId } = req.body;
  if (!validationCode) throw new HttpError(400, 'validationCode is required');

  const tx = db.transaction(() => {
    const ticket = db
      .prepare(
        `SELECT tk.*, prod.kind AS product_kind, prod.validity_minutes, prod.name AS product_name
         FROM tickets tk
         JOIN fare_prices fp ON fp.id = tk.fare_price_id
         JOIN fare_products prod ON prod.id = fp.product_id
         WHERE tk.validation_code = ?`
      )
      .get(validationCode);

    if (!ticket) {
      db.prepare(
        `INSERT INTO validations (ticket_id, scanned_code, trip_id, stop_id, vehicle_id, result)
         VALUES (NULL, ?, ?, ?, ?, 'rejected_not_found')`
      ).run(validationCode, tripId || null, stopId || null, vehicleId || null);
      return { result: 'rejected_not_found', message: 'No ticket matches this code' };
    }

    const now = new Date();
    let result;

    if (['pending_payment', 'cancelled', 'refunded'].includes(ticket.status)) {
      result = 'rejected_not_active';
    } else if (ticket.status === 'expired') {
      result = 'rejected_expired';
    } else if (ticket.status === 'used') {
      result = 'rejected_used';
    } else if (ticket.status === 'active') {
      if (!ticket.activated_at) {
        const validUntil = new Date(now.getTime() + ticket.validity_minutes * 60000).toISOString();
        const newStatus = ticket.product_kind === 'single_ride' ? 'used' : 'active';
        db.prepare('UPDATE tickets SET activated_at = ?, valid_until = ?, status = ? WHERE id = ?').run(
          now.toISOString(),
          validUntil,
          newStatus,
          ticket.id
        );
        result = 'accepted';
      } else if (new Date(ticket.valid_until) < now) {
        db.prepare("UPDATE tickets SET status = 'expired' WHERE id = ?").run(ticket.id);
        result = 'rejected_expired';
      } else {
        result = 'accepted';
      }
    } else {
      result = 'rejected_not_active';
    }

    db.prepare(
      `INSERT INTO validations (ticket_id, scanned_code, trip_id, stop_id, vehicle_id, result)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(ticket.id, validationCode, tripId || null, stopId || null, vehicleId || null, result);

    const updated = db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticket.id);
    return {
      result,
      message: {
        accepted: 'Ticket accepted — have a good ride.',
        rejected_expired: 'This ticket has expired.',
        rejected_used: 'This single-ride ticket has already been used.',
        rejected_not_active: 'This ticket has not been paid for or is no longer usable.',
      }[result],
      ticket: updated,
      productName: ticket.product_name,
    };
  });

  const outcome = tx();
  res.status(outcome.result === 'accepted' ? 200 : 422).json(outcome);
}));

export default router;
