// src/db/index.ts
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';

const pool = new pg.Pool({
  // Esto tomará la dirección de la base de datos de tus variables de entorno
  connectionString: process.env.DATABASE_URL, 
});

export const db = drizzle(pool);