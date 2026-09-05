import express from 'express';
import cors from 'cors';

import stopsRouter from './routes/stops.js';
import networkRouter from './routes/network.js';
import tripsRouter from './routes/trips.js';
import searchRouter from './routes/search.js';
import realtimeRouter from './routes/realtime.js';
import productsRouter from './routes/products.js';
import customersRouter from './routes/customers.js';
import ticketsRouter from './routes/tickets.js';
import validationsRouter from './routes/validations.js';
import reportsRouter from './routes/reports.js';

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/stops', stopsRouter);
app.use('/api/network', networkRouter);
app.use('/api/trips', tripsRouter);
app.use('/api/search', searchRouter);
app.use('/api/realtime', realtimeRouter);
app.use('/api/products', productsRouter);
app.use('/api/customers', customersRouter);
app.use('/api/tickets', ticketsRouter);
app.use('/api/validations', validationsRouter);
app.use('/api/reports', reportsRouter);

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use((err, req, res, next) => {
  console.error(err);
  const status = err.statusCode || 500;
  res.status(status).json({ error: err.message || 'Internal error' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`API listening on http://localhost:${PORT}`));
