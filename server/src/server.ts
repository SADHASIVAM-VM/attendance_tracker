import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import apiRouter from './routes/api';
import { getDb } from './database/db';
import { seedDatabase } from './database/seed/seed';
import { query } from './config/db.config';

const app = express();

// Fail-safe CORS headers with cookie credentials support
app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept');
  }
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

app.use(cors({
  origin: true,
  credentials: true,
}));

app.use(express.json());

// Cookie parser middleware
app.use((req: express.Request, _res: express.Response, next: express.NextFunction) => {
  const cookieHeader = req.headers.cookie;
  (req as any).cookies = {};
  if (cookieHeader) {
    cookieHeader.split(';').forEach((c) => {
      const [key, ...v] = c.trim().split('=');
      if (key) {
        (req as any).cookies[key] = decodeURIComponent(v.join('='));
      }
    });
  }
  next();
});

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
    // Initialize DB and ensure all tables/schema exist
    await getDb();

    // Test DB query
    await query("SELECT NOW() AS current_time").then((e) => {
      console.log("Database connection successful:", e.rows[0].current_time);
    }).catch((error) => {
      console.warn("Direct pool query info:", error.message);
    });

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
