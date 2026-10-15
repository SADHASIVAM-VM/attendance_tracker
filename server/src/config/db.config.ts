import { Pool } from "pg";

const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DB_SSL === 'true' || process.env.DATABASE_URL.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined,
      }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT) || 5432,
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'sadha123',
        database: process.env.DB_NAME || 'attendance_tracker',
      }
);

export const query = (text: string, params?: any[]) => pool.query(text, params);
