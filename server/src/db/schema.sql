-- Mobility Ticketing System schema (SQLite)
PRAGMA foreign_keys = ON;

-- ============ Network & timetable ============

CREATE TABLE operators (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  short_code    TEXT NOT NULL UNIQUE
);

CREATE TABLE stops (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  mode          TEXT NOT NULL CHECK (mode IN ('bus','tram','train')),
  lat           REAL NOT NULL,
  lon           REAL NOT NULL
);

CREATE TABLE zones (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL UNIQUE
);

CREATE TABLE stop_zones (
  stop_id       INTEGER NOT NULL REFERENCES stops(id) ON DELETE CASCADE,
  zone_id       INTEGER NOT NULL REFERENCES zones(id) ON DELETE CASCADE,
  PRIMARY KEY (stop_id, zone_id)
);

CREATE TABLE routes (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  operator_id   INTEGER NOT NULL REFERENCES operators(id),
  mode          TEXT NOT NULL CHECK (mode IN ('bus','tram','train')),
  short_name    TEXT NOT NULL,
  long_name     TEXT NOT NULL,
  UNIQUE(operator_id, short_name)
);

CREATE TABLE route_stops (
  route_id      INTEGER NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  stop_id       INTEGER NOT NULL REFERENCES stops(id),
  sequence      INTEGER NOT NULL,
  offset_seconds INTEGER NOT NULL, -- typical time from route start, for display
  PRIMARY KEY (route_id, sequence)
);
CREATE INDEX idx_route_stops_stop ON route_stops(stop_id);

CREATE TABLE vehicles (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  operator_id   INTEGER NOT NULL REFERENCES operators(id),
  mode          TEXT NOT NULL CHECK (mode IN ('bus','tram','train')),
  registration  TEXT NOT NULL UNIQUE,
  capacity      INTEGER NOT NULL
);

CREATE TABLE trips (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  route_id      INTEGER NOT NULL REFERENCES routes(id),
  vehicle_id    INTEGER REFERENCES vehicles(id),
  service_date  TEXT NOT NULL, -- ISO date, e.g. 2026-09-07
  status        TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','cancelled','completed')),
  UNIQUE(route_id, service_date, id)
);
CREATE INDEX idx_trips_route_date ON trips(route_id, service_date);

CREATE TABLE stop_times (
  trip_id             INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  stop_id             INTEGER NOT NULL REFERENCES stops(id),
  sequence            INTEGER NOT NULL,
  scheduled_arrival   TEXT NOT NULL,   -- ISO datetime
  scheduled_departure TEXT NOT NULL,   -- ISO datetime
  PRIMARY KEY (trip_id, sequence)
);
CREATE INDEX idx_stop_times_stop_dep ON stop_times(stop_id, scheduled_departure);

-- ============ Real-time layer ============

CREATE TABLE realtime_updates (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_id         INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  stop_id         INTEGER NOT NULL REFERENCES stops(id),
  recorded_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  delay_minutes   INTEGER NOT NULL DEFAULT 0,
  occupancy       TEXT CHECK (occupancy IN ('empty','seats_available','standing_room','full')),
  source          TEXT NOT NULL DEFAULT 'ops' -- 'ops' | 'vehicle_gps' | 'manual'
);
CREATE INDEX idx_realtime_trip_stop_time ON realtime_updates(trip_id, stop_id, recorded_at DESC);

-- ============ Fares & products ============

CREATE TABLE fare_products (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT NOT NULL,
  description     TEXT,
  validity_minutes INTEGER NOT NULL, -- how long a purchased ticket is valid for after activation
  kind            TEXT NOT NULL CHECK (kind IN ('single_ride','day_pass','weekly_pass','monthly_pass')),
  active          INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE fare_prices (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id      INTEGER NOT NULL REFERENCES fare_products(id),
  from_zone_id    INTEGER REFERENCES zones(id),  -- NULL = zone-independent (e.g. day pass)
  to_zone_id      INTEGER REFERENCES zones(id),
  price_cents     INTEGER NOT NULL,
  currency        TEXT NOT NULL DEFAULT 'EUR',
  valid_from      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  valid_to        TEXT -- NULL = currently in effect
);
CREATE INDEX idx_fare_prices_product ON fare_prices(product_id, valid_from);

-- ============ Ticketing (correctness-critical) ============

CREATE TABLE customers (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE tickets (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id       INTEGER NOT NULL REFERENCES customers(id),
  fare_price_id     INTEGER NOT NULL REFERENCES fare_prices(id),
  validation_code   TEXT NOT NULL UNIQUE, -- what the QR code encodes
  status            TEXT NOT NULL DEFAULT 'pending_payment'
                      CHECK (status IN ('pending_payment','active','used','expired','refunded','cancelled')),
  purchased_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  activated_at      TEXT,   -- set on first validation for ride-window products
  valid_until       TEXT    -- computed once activated: activated_at + validity_minutes
);
CREATE INDEX idx_tickets_customer ON tickets(customer_id);
CREATE INDEX idx_tickets_status ON tickets(status);

CREATE TABLE payments (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id     INTEGER NOT NULL REFERENCES tickets(id),
  amount_cents  INTEGER NOT NULL,
  currency      TEXT NOT NULL DEFAULT 'EUR',
  method        TEXT NOT NULL CHECK (method IN ('card','wallet','cash')),
  status        TEXT NOT NULL CHECK (status IN ('pending','succeeded','failed','refunded')),
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_payments_created ON payments(created_at);
CREATE INDEX idx_payments_ticket ON payments(ticket_id);

-- ============ Validation (correctness-critical, append-only) ============

CREATE TABLE validations (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id     INTEGER REFERENCES tickets(id), -- NULL when the scanned code matched no ticket
  scanned_code  TEXT,                            -- raw code as scanned, kept even on a miss
  trip_id       INTEGER REFERENCES trips(id),
  stop_id       INTEGER REFERENCES stops(id),
  vehicle_id    INTEGER REFERENCES vehicles(id),
  validated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  result        TEXT NOT NULL CHECK (result IN ('accepted','rejected_expired','rejected_used','rejected_not_found','rejected_not_active'))
);
CREATE INDEX idx_validations_ticket ON validations(ticket_id);
CREATE INDEX idx_validations_time ON validations(validated_at);

-- ============ Reporting views ============

CREATE VIEW v_daily_revenue AS
SELECT
  substr(p.created_at, 1, 10)  AS day,
  fp.id                        AS product_id,
  fp.name                      AS product_name,
  SUM(p.amount_cents)          AS revenue_cents,
  COUNT(*)                     AS payment_count
FROM payments p
JOIN tickets t       ON t.id = p.ticket_id
JOIN fare_prices fpr ON fpr.id = t.fare_price_id
JOIN fare_products fp ON fp.id = fpr.product_id
WHERE p.status = 'succeeded'
GROUP BY day, fp.id;

CREATE VIEW v_route_usage AS
SELECT
  substr(v.validated_at, 1, 10) AS day,
  r.id                          AS route_id,
  r.short_name                  AS route_short_name,
  s.id                          AS stop_id,
  s.name                        AS stop_name,
  COUNT(*)                      AS validation_count
FROM validations v
LEFT JOIN trips t  ON t.id = v.trip_id
LEFT JOIN routes r ON r.id = t.route_id
LEFT JOIN stops s  ON s.id = v.stop_id
WHERE v.result = 'accepted'
GROUP BY day, r.id, s.id;

CREATE VIEW v_route_punctuality AS
SELECT
  substr(ru.recorded_at, 1, 10) AS day,
  r.id                          AS route_id,
  r.short_name                  AS route_short_name,
  AVG(ru.delay_minutes)         AS avg_delay_minutes,
  COUNT(*)                      AS sample_count
FROM realtime_updates ru
JOIN trips t  ON t.id = ru.trip_id
JOIN routes r ON r.id = t.route_id
GROUP BY day, r.id;

-- ============ Integrity triggers ============
-- A CHECK constraint can only see its own row, so the two rules below
-- (which span tables) are enforced with triggers instead.

-- A payment must equal the exact fare price the ticket was sold at.
-- (payments -> tickets -> fare_prices is a cross-table rule.)
CREATE TRIGGER trg_payment_matches_fare
BEFORE INSERT ON payments
FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'payment amount does not match the ticket fare price')
  WHERE NEW.amount_cents <> (
    SELECT fp.price_cents
    FROM tickets t
    JOIN fare_prices fp ON fp.id = t.fare_price_id
    WHERE t.id = NEW.ticket_id
  );
END;

-- Terminal ticket states are final: a used/expired/refunded/cancelled ticket
-- cannot be moved back to an earlier state. This makes "use a single-ride
-- ticket twice" or "reactivate a refunded ticket" impossible at the DB level,
-- regardless of what the application code does.
CREATE TRIGGER trg_ticket_terminal_immutable
BEFORE UPDATE OF status ON tickets
FOR EACH ROW
WHEN OLD.status IN ('used', 'expired', 'refunded', 'cancelled')
  AND NEW.status <> OLD.status
BEGIN
  SELECT RAISE(ABORT, 'illegal transition out of terminal status: ' || OLD.status);
END;
