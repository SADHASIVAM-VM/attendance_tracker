import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import apiRouter from './routes/api.js';
import { getDb } from './database/db.js';
import { seedDatabase } from './database/seed/seed.js';

const app = express();

app.use(cors({
  origin: '*', // Adjust for production allowlists
  credentials: true,
}));

app.use(express.json());

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
    // Seed initial dataset if not present
    await seedDatabase();

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

if (process.env.NODE_ENV !== 'test') {
  startServer();
}
