import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts', // Apunta al archivo que acabamos de crear
  out: './drizzle',             // Aquí guardará los historiales de cambios
  dialect: 'postgresql',        // Definimos que usamos Postgres
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});