# Mobility Ticketing System

A data-centric mobility & ticketing platform for buses, trams, and trains
in a city: route search, live departures/delays, digital ticket purchase
and validation, and operator tools for timetables, pricing, and
usage/revenue reporting.

This is week 1 of an iterative build — see [`docs/DESIGN.md`](docs/DESIGN.md)
for the schema, the reasoning behind it, and what's deliberately out of
scope for now.

## Stack

- **Database**: SQLite (`server/src/db/schema.sql`), via `better-sqlite3`.
- **API**: Node.js + Express (`server/`).
- **UI**: React + Vite (`client/`) — a rider app and an operator console
  in one, switchable from the header.

## Running it

Two terminals:

```bash
# 1. API server (http://localhost:4000)
cd server
npm install
npm run seed    # (re)creates server/data.sqlite with a sample network,
                 # timetable, fares, and ~a week of purchase/validation history
npm start

# 2. Web UI (http://localhost:5173)
cd client
npm install
npm run dev
```

The client dev server proxies `/api/*` to `http://localhost:4000`, so just
open http://localhost:5173.

`npm run seed` drops and recreates all tables — run it again any time you
want a clean demo dataset.

## What's in the sample data

Three operators (CityBus, MetroTram, RegioRail) running a bus, a tram, and
a train line that connect through two interchange stops (Market Square,
Central Station), a week of trips with simulated real-time delay/occupancy
readings, three fare products (Single Ride, Day Pass, Weekly Pass) with
zone-based pricing, five demo customers, and roughly a week of purchase and
validation history so the reporting views have something to show.

## Using the app

**Rider app**: search for a direct trip between two stops, check a live
departure board, buy a ticket, view "My tickets", and validate a ticket
(a stand-in for the onboard/gate scanner — paste a code or quick-pick one
of your own).

**Operator console**: define routes and their stopping pattern, generate
timetable trips from that pattern, set/version fare prices, and view
revenue, usage, and punctuality reports over a date range.
