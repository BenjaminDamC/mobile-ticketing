# Integrity map — Mobility Ticketing

The rule that shapes the whole database is:

> **Can the database ever contain an invalid state?**

Every business rule below is enforced *in the database*, so no application bug
or ad-hoc script can write bad data. Where a `CHECK`/`UNIQUE`/`FOREIGN KEY`
can't express the rule (because it spans more than one row), a trigger does.

## Rule → what enforces it

| # | Business rule | Enforced by | Kind |
|---|---|---|---|
| 1 | An operator has a unique short code | `UNIQUE(short_code)` | constraint |
| 2 | A route name is unique within its operator | `UNIQUE(operator_id, short_name)` | constraint |
| 3 | A stop/route/vehicle has a valid mode | `CHECK (mode IN (...))` | constraint |
| 4 | A stop appears in a route at exactly one position | `PRIMARY KEY (route_id, sequence)` | constraint |
| 5 | A stop may repeat on a route (loops) | *no* unique on `(route_id, stop_id)` | design choice |
| 6 | A trip has a legal status | `CHECK (status IN (...))` | constraint |
| 7 | A ticket has a legal status | `CHECK (status IN (...))` | constraint |
| 8 | A ticket's scan code is unique | `UNIQUE(validation_code)` | constraint |
| 9 | Every ticket references a real customer + fare price | `FOREIGN KEY` (×2) | constraint |
| 10 | **A payment equals the ticket's fare price** | `trg_payment_matches_fare` | trigger |
| 11 | **A terminal ticket can't be reactivated** | `trg_ticket_terminal_immutable` | trigger |

## The two cross-table rules (why triggers)

A `CHECK` constraint can only look at the row being written. Rules 10 and 11
span tables, so they need triggers:

- **Payment amount = fare price** reads `payments → tickets → fare_prices`.
  The trigger aborts any payment whose `amount_cents` differs from the price
  the ticket was actually sold at.
- **Terminal states are final** — `used`, `expired`, `refunded`, `cancelled` are
  one-way. The trigger aborts any `UPDATE` that moves a ticket *out* of one of
  those states, so a used single-ride ticket can never be flipped back to
  `active`.

Both are verified by `server/scripts/integrity-tests.mjs` (`npm run test:integrity`).

## What the database deliberately does *not* do

- **"Active only after payment"** lives in the purchase endpoint as an explicit
  transaction (see `routes/tickets.js`), not a trigger. The state machine is
  small and the business rule reads better in code than hidden in a trigger.
  What the trigger *does* guarantee is the reverse direction: once paid and
  used, the ticket can't be silently reused.
- **Concurrency.** The triggers stop logically-wrong single writes, but they
  are not a substitute for transaction isolation. Two validations racing for
  the last seat on a vehicle would need an explicit lock or `SERIALIZABLE`,
  not a `BEFORE INSERT` trigger.
