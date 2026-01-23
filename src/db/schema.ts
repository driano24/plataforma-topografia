// src/db/schema.ts
import { pgTable, serial, text, doublePrecision, timestamp, jsonb, boolean, integer } from 'drizzle-orm/pg-core';

// 1. Tabla de USUARIOS (Admin, Clientes, Topógrafos)
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  password: text('password').notNull(), // Aquí guardarás el hash encriptado
  name: text('name').notNull(),
  role: text('role').default('client'), // 'admin', 'client', 'surveyor'
  createdAt: timestamp('created_at').defaultNow(),
});

// 2. Tabla de PROYECTOS
export const projects = pgTable('projects', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  locationName: text('location_name'),
  clientId: integer('client_id').references(() => users.id), // Vinculado al cliente
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
});

// 3. Tabla de REPORTES DE CAMPO (La parte pesada de ingeniería)
export const fieldReports = pgTable('field_reports', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').references(() => projects.id).notNull(),
  surveyorId: integer('surveyor_id').references(() => users.id), // Quién hizo la visita
  visitDate: timestamp('visit_date').notNull(),
  
  // Coordenadas de Referencia (Usamos doble precisión para topografía)
  north: doublePrecision('north').notNull(),
  east: doublePrecision('east').notNull(),
  elevation: doublePrecision('elevation').notNull(), // Cota
  
  // Datos flexibles (JSONB es perfecto para listas variables de gastos o fotos)
  expenses: jsonb('expenses'), 
  photos: jsonb('photos'),     
  
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
});