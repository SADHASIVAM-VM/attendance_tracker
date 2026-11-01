import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import apiRouter from './routes/api.js';
import { getDb } from './database/db.js';
import { seedDatabase } from './database/seed/seed.js';
import { executeDueWorkerTransfers } from './services/workerTransferService.js';

const app = express();

app.use(cors({
  origin: true,
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({
    status: 'HEALTHY',
    timestamp: new Date().toISOString(),
    service: 'Attendance Management API',
    version: '1.0.0',
  });
});

// REST API v1 & root /api alias
app.use('/api/v1', apiRouter);
app.use('/api', apiRouter);

// Global error handling middleware
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled API Error:', err);
  res.status(err.status || 500).json({
    error: err.name || 'INTERNAL_SERVER_ERROR',
    message: err.message || 'An unexpected server error occurred',
  });
});

const PORT = Number(process.env.PORT) || 5000;

async function startServer() {
  try {
    // Initialize DB and ensure tables
    await getDb();
    // Seed initial dataset and verify 5 system roles ({ ADMIN, SUPERVISOR, ENGINEER, ACCOUNTANT, WORKER })
    await seedDatabase();

    // Reconcile due worker transfers on startup & run background reconciliation every 60s
    try {
      const db = await getDb();
      await executeDueWorkerTransfers(db);
    } catch (e) {
      console.warn('Initial worker transfer reconciliation notice:', e);
    }

    setInterval(async () => {
      try {
        const db = await getDb();
        await executeDueWorkerTransfers(db);
      } catch (_) {}
    }, 60_000);

    app.listen(PORT, () => {
      console.log(`🚀 Workforce Attendance API running on http://localhost:${PORT}`);
      console.log(`📡 Health Check: http://localhost:${PORT}/health`);
      console.log(`📚 REST API v1: http://localhost:${PORT}/api/v1`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

export { app, startServer };


startServer();

