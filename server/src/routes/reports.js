import { Router } from 'express';
import { db } from '../db/index.js';

const router = Router();

function dateFilter(query, col) {
  const clauses = [];
  const params = [];
  if (query.from) {
    clauses.push(`${col} >= ?`);
    params.push(query.from);
  }
  if (query.to) {
    clauses.push(`${col} <= ?`);
    params.push(query.to);
  }
  return { where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', params };
}

router.get('/revenue', (req, res) => {
  const { where, params } = dateFilter(req.query, 'day');
  const rows = db.prepare(`SELECT * FROM v_daily_revenue ${where} ORDER BY day DESC, product_id`).all(...params);
  const totalRevenueCents = rows.reduce((sum, r) => sum + r.revenue_cents, 0);
  const totalPayments = rows.reduce((sum, r) => sum + r.payment_count, 0);
  res.json({ rows, totalRevenueCents, totalPayments });
});

router.get('/usage', (req, res) => {
  const { where, params } = dateFilter(req.query, 'day');
  const rows = db.prepare(`SELECT * FROM v_route_usage ${where} ORDER BY day DESC, validation_count DESC`).all(...params);
  const totalValidations = rows.reduce((sum, r) => sum + r.validation_count, 0);
  res.json({ rows, totalValidations });
});

router.get('/punctuality', (req, res) => {
  const { where, params } = dateFilter(req.query, 'day');
  const rows = db
    .prepare(`SELECT * FROM v_route_punctuality ${where} ORDER BY day DESC, route_short_name`)
    .all(...params);
  res.json({ rows });
});

router.get('/summary', (req, res) => {
  const revenue = db.prepare('SELECT COALESCE(SUM(revenue_cents),0) AS c FROM v_daily_revenue').get();
  const validations = db.prepare("SELECT COUNT(*) AS c FROM validations WHERE result = 'accepted'").get();
  const activeTickets = db.prepare("SELECT COUNT(*) AS c FROM tickets WHERE status = 'active'").get();
  const failedPayments = db.prepare("SELECT COUNT(*) AS c FROM payments WHERE status = 'failed'").get();
  res.json({
    totalRevenueCents: revenue.c,
    totalValidations: validations.c,
    activeTickets: activeTickets.c,
    failedPayments: failedPayments.c,
  });
});

export default router;
