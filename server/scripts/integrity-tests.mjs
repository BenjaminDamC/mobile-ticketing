// Integrity write tests — prove the database rejects invalid writes and accepts
// valid ones. Run with `npm run test:integrity` (from server/, after `npm run seed`).
//
// Each check runs inside a savepoint that is always rolled back, so the tests
// never disturb the seeded data.
import { db } from '../src/db/index.js';

let pass = 0;
let fail = 0;

function check(label, expectReject, fn) {
  db.exec('SAVEPOINT _check');
  let rejected = false;
  let message = '';
  try {
    fn();
  } catch (e) {
    rejected = true;
    message = e.message;
  }
  db.exec('ROLLBACK TO _check; RELEASE _check');

  const ok = rejected === expectReject;
  if (ok) pass += 1;
  else fail += 1;
  const want = expectReject ? 'reject' : 'allow';
  const got = rejected ? 'reject' : 'allow';
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}  [want ${want}, got ${got}]${rejected ? '\n       ' + message : ''}`);
}

function makeTicket(code, status) {
  const cust = db.prepare('SELECT id FROM customers LIMIT 1').get();
  const fp = db.prepare('SELECT id FROM fare_prices LIMIT 1').get();
  return db
    .prepare('INSERT INTO tickets (customer_id, fare_price_id, validation_code, status) VALUES (?, ?, ?, ?)')
    .run(cust.id, fp.id, code, status).lastInsertRowid;
}

console.log('Integrity write tests\n=====================');

// 1. CHECK constraint — legal status values only.
check('ticket status must be a legal value', true, () => {
  makeTicket('TEST-CHECK', 'bogus');
});

// 2. FOREIGN KEY — must reference a real customer.
check('ticket must reference a real customer', true, () => {
  const fp = db.prepare('SELECT id FROM fare_prices LIMIT 1').get();
  db.prepare('INSERT INTO tickets (customer_id, fare_price_id, validation_code, status) VALUES (?, ?, ?, ?)')
    .run(999999, fp.id, 'TEST-FK', 'pending_payment');
});

// 3. UNIQUE — validation code must be unique.
check('validation code must be unique', true, () => {
  const code = db.prepare('SELECT validation_code FROM tickets LIMIT 1').get().validation_code;
  makeTicket(code, 'pending_payment');
});

// 4. Trigger — payment amount must equal the fare price (wrong amount rejected).
check('payment amount must equal the ticket fare price', true, () => {
  const fp = db.prepare('SELECT id, price_cents FROM fare_prices LIMIT 1').get();
  const ticketId = makeTicket('TEST-PAY-BAD', 'pending_payment');
  db.prepare('INSERT INTO payments (ticket_id, amount_cents, currency, method, status) VALUES (?, ?, ?, ?, ?)')
    .run(ticketId, fp.price_cents + 999, 'EUR', 'card', 'succeeded');
});

// 5. Trigger — the correct amount is accepted.
check('a matching payment amount is accepted', false, () => {
  const fp = db.prepare('SELECT id, price_cents FROM fare_prices LIMIT 1').get();
  const ticketId = makeTicket('TEST-PAY-OK', 'pending_payment');
  db.prepare('INSERT INTO payments (ticket_id, amount_cents, currency, method, status) VALUES (?, ?, ?, ?, ?)')
    .run(ticketId, fp.price_cents, 'EUR', 'card', 'succeeded');
});

// 6. Trigger — a terminal ticket cannot be reactivated.
check('a used/expired ticket cannot move back to active', true, () => {
  const ticketId = makeTicket('TEST-TERMINAL', 'used');
  db.prepare("UPDATE tickets SET status = 'active' WHERE id = ?").run(ticketId);
});

// 7. Trigger — a legal status transition is accepted.
check('a pending_payment ticket can become active', false, () => {
  const ticketId = makeTicket('TEST-LEGAL', 'pending_payment');
  db.prepare("UPDATE tickets SET status = 'active' WHERE id = ?").run(ticketId);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
