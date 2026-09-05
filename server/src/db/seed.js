import { db, resetDatabase } from './index.js';
import { nanoid } from 'nanoid';

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function choice(arr) {
  return arr[randInt(0, arr.length - 1)];
}
function isoDate(d) {
  return d.toISOString().slice(0, 10);
}
function atLocalTime(dateStr, hh, mm) {
  return new Date(`${dateStr}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00.000Z`);
}
function addSeconds(date, s) {
  return new Date(date.getTime() + s * 1000);
}
function iso(date) {
  return date.toISOString();
}

function seed() {
  resetDatabase();
  console.log('Seeding database...');

  const now = new Date();

  const insOperator = db.prepare('INSERT INTO operators (name, short_code) VALUES (?, ?)');
  const cityBus = insOperator.run('CityBus Co.', 'CB').lastInsertRowid;
  const metroTram = insOperator.run('MetroTram', 'MT').lastInsertRowid;
  const regioRail = insOperator.run('RegioRail', 'RR').lastInsertRowid;

  const insZone = db.prepare('INSERT INTO zones (name) VALUES (?)');
  const zone1 = insZone.run('Zone 1 (Core)').lastInsertRowid;
  const zone2 = insZone.run('Zone 2 (Inner Suburbs)').lastInsertRowid;
  const zone3 = insZone.run('Zone 3 (Outer)').lastInsertRowid;

  const insStop = db.prepare('INSERT INTO stops (name, mode, lat, lon) VALUES (?, ?, ?, ?)');
  const insStopZone = db.prepare('INSERT INTO stop_zones (stop_id, zone_id) VALUES (?, ?)');
  function stop(name, mode, lat, lon, zoneId) {
    const id = insStop.run(name, mode, lat, lon).lastInsertRowid;
    insStopZone.run(id, zoneId);
    return id;
  }

  const riverside = stop('Riverside Ave', 'bus', 51.505, -0.14, zone2);
  const marketSquare = stop('Market Square', 'bus', 51.51, -0.13, zone1);
  const oakStreet = stop('Oak Street', 'bus', 51.515, -0.12, zone2);
  const university = stop('University', 'bus', 51.52, -0.11, zone2);
  const cityHall = stop('City Hall', 'tram', 51.512, -0.128, zone1);
  const greenPark = stop('Green Park', 'tram', 51.518, -0.122, zone1);
  const northFields = stop('North Fields', 'tram', 51.525, -0.115, zone2);
  const centralStation = stop('Central Station', 'train', 51.53, -0.11, zone1);
  const hillcrest = stop('Hillcrest', 'train', 51.55, -0.09, zone3);
  const airport = stop('Airport', 'train', 51.58, -0.06, zone3);

  const insRoute = db.prepare(
    'INSERT INTO routes (operator_id, mode, short_name, long_name) VALUES (?, ?, ?, ?)'
  );
  const bus12 = insRoute.run(cityBus, 'bus', '12', 'Riverside Ave – University').lastInsertRowid;
  const tram7 = insRoute.run(metroTram, 'tram', '7', 'Market Square – Central Station').lastInsertRowid;
  const trainR1 = insRoute.run(regioRail, 'train', 'R1', 'Central Station – Airport').lastInsertRowid;

  const insRouteStop = db.prepare(
    'INSERT INTO route_stops (route_id, stop_id, sequence, offset_seconds) VALUES (?, ?, ?, ?)'
  );
  const bus12Stops = [
    [riverside, 0],
    [marketSquare, 240],
    [oakStreet, 540],
    [university, 840],
  ];
  bus12Stops.forEach(([stopId, offset], i) => insRouteStop.run(bus12, stopId, i + 1, offset));

  const tram7Stops = [
    [marketSquare, 0],
    [cityHall, 180],
    [greenPark, 420],
    [northFields, 660],
    [centralStation, 900],
  ];
  tram7Stops.forEach(([stopId, offset], i) => insRouteStop.run(tram7, stopId, i + 1, offset));

  const trainR1Stops = [
    [centralStation, 0],
    [hillcrest, 600],
    [airport, 1320],
  ];
  trainR1Stops.forEach(([stopId, offset], i) => insRouteStop.run(trainR1, stopId, i + 1, offset));

  const insVehicle = db.prepare(
    'INSERT INTO vehicles (operator_id, mode, registration, capacity) VALUES (?, ?, ?, ?)'
  );
  const busVehicles = [
    insVehicle.run(cityBus, 'bus', 'CB-101', 70).lastInsertRowid,
    insVehicle.run(cityBus, 'bus', 'CB-102', 70).lastInsertRowid,
    insVehicle.run(cityBus, 'bus', 'CB-103', 70).lastInsertRowid,
  ];
  const tramVehicles = [
    insVehicle.run(metroTram, 'tram', 'MT-201', 150).lastInsertRowid,
    insVehicle.run(metroTram, 'tram', 'MT-202', 150).lastInsertRowid,
  ];
  const trainVehicles = [
    insVehicle.run(regioRail, 'train', 'RR-301', 400).lastInsertRowid,
    insVehicle.run(regioRail, 'train', 'RR-302', 400).lastInsertRowid,
  ];

  const routeDefs = [
    { routeId: bus12, stops: bus12Stops, vehicles: busVehicles, intervalMin: 20 },
    { routeId: tram7, stops: tram7Stops, vehicles: tramVehicles, intervalMin: 15 },
    { routeId: trainR1, stops: trainR1Stops, vehicles: trainVehicles, intervalMin: 30 },
  ];

  const insTrip = db.prepare(
    'INSERT INTO trips (route_id, vehicle_id, service_date, status) VALUES (?, ?, ?, ?)'
  );
  const insStopTime = db.prepare(
    'INSERT INTO stop_times (trip_id, stop_id, sequence, scheduled_arrival, scheduled_departure) VALUES (?, ?, ?, ?, ?)'
  );
  const insRealtime = db.prepare(
    'INSERT INTO realtime_updates (trip_id, stop_id, recorded_at, delay_minutes, occupancy, source) VALUES (?, ?, ?, ?, ?, ?)'
  );

  const DAYS_BACK = 7;
  const DAYS_FWD = 1;
  const allTripsByDate = {}; // date -> [{tripId, routeId, departure}]

  for (let dOffset = -DAYS_BACK; dOffset <= DAYS_FWD; dOffset++) {
    const day = new Date(now);
    day.setUTCDate(day.getUTCDate() + dOffset);
    const dateStr = isoDate(day);
    allTripsByDate[dateStr] = [];

    for (const def of routeDefs) {
      const serviceStart = atLocalTime(dateStr, 6, 0);
      const serviceEnd = atLocalTime(dateStr, 22, 30);
      let cursor = new Date(serviceStart);
      let vIdx = 0;
      while (cursor <= serviceEnd) {
        const vehicleId = def.vehicles[vIdx % def.vehicles.length];
        vIdx++;
        // Cancel a rare trip for realism
        const status = Math.random() < 0.02 ? 'cancelled' : (cursor < now ? 'completed' : 'scheduled');
        const tripId = insTrip.run(def.routeId, vehicleId, dateStr, status).lastInsertRowid;

        def.stops.forEach(([stopId, offset], i) => {
          const t = addSeconds(cursor, offset);
          insStopTime.run(tripId, stopId, i + 1, iso(t), iso(t));
        });

        allTripsByDate[dateStr].push({ tripId, routeId: def.routeId, departure: cursor, stops: def.stops, status });

        // Real-time updates for trips that have already "happened"
        if (cursor < now && status !== 'cancelled') {
          let cumulativeDelay = randInt(-1, 2); // can arrive slightly early
          def.stops.forEach(([stopId, offset]) => {
            cumulativeDelay = Math.max(0, cumulativeDelay + randInt(-1, 3));
            const recordedAt = addSeconds(cursor, offset);
            const occupancy = choice(['empty', 'seats_available', 'seats_available', 'standing_room', 'full']);
            insRealtime.run(tripId, stopId, iso(recordedAt), cumulativeDelay, occupancy, 'vehicle_gps');
          });
        }

        cursor = addSeconds(cursor, def.intervalMin * 60);
      }
    }
  }

  // ---- Fare products & prices ----
  const insProduct = db.prepare(
    'INSERT INTO fare_products (name, description, validity_minutes, kind, active) VALUES (?, ?, ?, ?, 1)'
  );
  const singleRide = insProduct
    .run('Single Ride', 'One ride within the purchased zones, valid 90 minutes from activation.', 90, 'single_ride')
    .lastInsertRowid;
  const dayPass = insProduct
    .run('Day Pass', 'Unlimited rides across all zones for 24 hours from activation.', 24 * 60, 'day_pass')
    .lastInsertRowid;
  const weeklyPass = insProduct
    .run('Weekly Pass', 'Unlimited rides across all zones for 7 days from activation.', 7 * 24 * 60, 'weekly_pass')
    .lastInsertRowid;

  const insPrice = db.prepare(
    `INSERT INTO fare_prices (product_id, from_zone_id, to_zone_id, price_cents, currency, valid_from)
     VALUES (?, ?, ?, ?, 'EUR', ?)`
  );
  const epoch = iso(new Date(now.getTime() - 1000 * 60 * 60 * 24 * 30));
  const zonePairs = [
    [zone1, zone1, 250],
    [zone1, zone2, 350],
    [zone1, zone3, 480],
    [zone2, zone2, 250],
    [zone2, zone3, 380],
    [zone3, zone3, 250],
  ];
  const singleRidePrices = {};
  for (const [fz, tz, cents] of zonePairs) {
    const id = insPrice.run(singleRide, fz, tz, cents, epoch).lastInsertRowid;
    singleRidePrices[`${fz}-${tz}`] = id;
    if (fz !== tz) {
      const id2 = insPrice.run(singleRide, tz, fz, cents, epoch).lastInsertRowid;
      singleRidePrices[`${tz}-${fz}`] = id2;
    }
  }
  const dayPassPriceId = insPrice.run(dayPass, null, null, 900, epoch).lastInsertRowid;
  const weeklyPassPriceId = insPrice.run(weeklyPass, null, null, 3200, epoch).lastInsertRowid;

  // ---- Customers ----
  const insCustomer = db.prepare('INSERT INTO customers (name, email) VALUES (?, ?)');
  const customers = [
    insCustomer.run('Alex Rider', 'alex@example.com').lastInsertRowid,
    insCustomer.run('Priya Nair', 'priya@example.com').lastInsertRowid,
    insCustomer.run('Sam Okafor', 'sam@example.com').lastInsertRowid,
    insCustomer.run('Jin Park', 'jin@example.com').lastInsertRowid,
    insCustomer.run('Demo Rider', 'benjamindamc@gmail.com').lastInsertRowid,
  ];

  // ---- Historical tickets / payments / validations for reporting ----
  const insTicket = db.prepare(
    `INSERT INTO tickets (customer_id, fare_price_id, validation_code, status, purchased_at, activated_at, valid_until)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  const insPayment = db.prepare(
    `INSERT INTO payments (ticket_id, amount_cents, currency, method, status, created_at)
     VALUES (?, ?, 'EUR', ?, ?, ?)`
  );
  const insValidation = db.prepare(
    `INSERT INTO validations (ticket_id, trip_id, stop_id, vehicle_id, validated_at, result)
     VALUES (?, ?, ?, ?, ?, 'accepted')`
  );
  const priceRow = db.prepare(
    `SELECT fp.price_cents, prod.validity_minutes FROM fare_prices fp
     JOIN fare_products prod ON prod.id = fp.product_id WHERE fp.id = ?`
  );
  const tripVehicle = db.prepare('SELECT vehicle_id FROM trips WHERE id = ?');

  for (let dOffset = -DAYS_BACK; dOffset <= 0; dOffset++) {
    const day = new Date(now);
    day.setUTCDate(day.getUTCDate() + dOffset);
    const dateStr = isoDate(day);
    const dayTrips = (allTripsByDate[dateStr] || []).filter(
      (t) => t.status !== 'cancelled' && t.departure < now
    );
    if (dayTrips.length === 0) continue;

    const ticketCount = randInt(35, 70);
    for (let i = 0; i < ticketCount; i++) {
      const customerId = choice(customers);
      const kindRoll = Math.random();
      let priceId, priceCents;
      if (kindRoll < 0.65) {
        priceId = choice(Object.values(singleRidePrices));
      } else if (kindRoll < 0.9) {
        priceId = dayPassPriceId;
      } else {
        priceId = weeklyPassPriceId;
      }
      const priceInfo = priceRow.get(priceId);
      priceCents = priceInfo.price_cents;

      const paymentSucceeds = Math.random() > 0.03;
      const code = nanoid(12);
      const trip = choice(dayTrips);
      const stopIdx = randInt(0, trip.stops.length - 1);
      const validatedAt = addSeconds(trip.departure, trip.stops[stopIdx][1] + randInt(-30, 30));
      // Purchased shortly before boarding, so timestamps stay causally ordered.
      const purchaseTime = addSeconds(validatedAt, -randInt(60, 1800));
      const isSingleRide = priceId !== dayPassPriceId && priceId !== weeklyPassPriceId;
      const validUntil = addSeconds(validatedAt, priceInfo.validity_minutes * 60);
      let finalStatus = 'pending_payment';
      if (paymentSucceeds) {
        finalStatus = isSingleRide ? 'used' : (validUntil < now ? 'expired' : 'active');
      }

      const ticketId = insTicket.run(
        customerId,
        priceId,
        code,
        finalStatus,
        iso(purchaseTime),
        paymentSucceeds ? iso(validatedAt) : null,
        paymentSucceeds ? iso(validUntil) : null
      ).lastInsertRowid;

      insPayment.run(
        ticketId,
        priceCents,
        choice(['card', 'wallet', 'card', 'card']),
        paymentSucceeds ? 'succeeded' : 'failed',
        iso(purchaseTime)
      );

      if (paymentSucceeds) {
        const vehicleId = tripVehicle.get(trip.tripId)?.vehicle_id ?? null;
        insValidation.run(ticketId, trip.tripId, trip.stops[stopIdx][0], vehicleId, iso(validatedAt));

        // Pass holders take a few more rides that day
        if (priceId === dayPassPriceId || priceId === weeklyPassPriceId) {
          const extraRides = randInt(0, 3);
          for (let r = 0; r < extraRides; r++) {
            const t2 = choice(dayTrips);
            const idx2 = randInt(0, t2.stops.length - 1);
            const when2 = addSeconds(t2.departure, t2.stops[idx2][1] + randInt(-30, 30));
            if (when2 < now) {
              const veh2 = tripVehicle.get(t2.tripId)?.vehicle_id ?? null;
              insValidation.run(ticketId, t2.tripId, t2.stops[idx2][0], veh2, iso(when2));
            }
          }
        }
      }
    }
  }

  // ---- A few live "active" tickets for the demo customer, ready to validate ----
  const demoCustomerId = customers[4];
  const liveSingle = insTicket.run(
    demoCustomerId,
    Object.values(singleRidePrices)[0],
    nanoid(12),
    'active',
    iso(now),
    null,
    null
  ).lastInsertRowid;
  insPayment.run(liveSingle, priceRow.get(Object.values(singleRidePrices)[0]).price_cents, 'card', 'succeeded', iso(now));

  const liveDayPass = insTicket.run(
    demoCustomerId,
    dayPassPriceId,
    nanoid(12),
    'active',
    iso(now),
    null,
    null
  ).lastInsertRowid;
  insPayment.run(liveDayPass, priceRow.get(dayPassPriceId).price_cents, 'wallet', 'succeeded', iso(now));

  console.log('Seed complete.');
  console.log(`  Operators: 3, Stops: 10, Routes: 3`);
  console.log(`  Trips: ${Object.values(allTripsByDate).flat().length}`);
  console.log(`  Customers: ${customers.length}`);
}

seed();
