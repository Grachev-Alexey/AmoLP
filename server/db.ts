import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";
import 'dotenv/config';

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Please set it to your local PostgreSQL connection string",
  );
}

// Создаем пул соединений для локальной PostgreSQL
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20, // максимум 20 соединений
  idleTimeoutMillis: 30000, // 30 секунд простоя
  connectionTimeoutMillis: 2000, // 2 секунды на подключение
});

export const db = drizzle(pool, { schema });