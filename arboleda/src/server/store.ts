import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';
import type { Pool as PgPool } from 'pg';
import type { PuntoArbolado, PuntoPayload, TareaTipo } from '../types/punto.ts';

const INITIAL_SEED_PUNTOS: PuntoArbolado[] = [
  {
    id: '5a8b4d10-2e3f-4c9a-8b1d-100000000101',
    nombre_punto: 'Bosques de Palermo — Sector Rosedal',
    latitud: -34.571842,
    longitud: -58.417615,
    codigo_arbol: 'ARB-101',
    especie: 'Jacaranda mimosifolia',
    tarea: 'riego',
    created_at: '2026-11-20T09:00:00.000Z',
    updated_at: '2026-11-20T09:00:00.000Z',
  },
  {
    id: '5a8b4d10-2e3f-4c9a-8b1d-100000000204',
    nombre_punto: 'Parque Centenario — Sendero Norte',
    latitud: -34.606125,
    longitud: -58.435784,
    codigo_arbol: 'ARB-204',
    especie: 'Tipuana tipu',
    tarea: 'poda',
    created_at: '2026-11-20T09:15:00.000Z',
    updated_at: '2026-11-20T09:15:00.000Z',
  },
  {
    id: '5a8b4d10-2e3f-4c9a-8b1d-100000000309',
    nombre_punto: 'Reserva Ecológica Costanera Sur — Mirador',
    latitud: -34.609512,
    longitud: -58.352940,
    codigo_arbol: 'ARB-309',
    especie: 'Erythrina crista-galli (Ceibo)',
    tarea: 'riego',
    created_at: '2026-11-20T09:30:00.000Z',
    updated_at: '2026-11-20T09:30:00.000Z',
  },
];

const { Pool } = pg;

const TABLE_NAME = 'puntos_arbolado';
const DATA_DIR = path.resolve(process.cwd(), 'data');
const LOCAL_STORE_PATH = path.resolve(DATA_DIR, 'puntos.json');

export type StorageBackend = 'supabase' | 'postgres' | 'local';

let cachedSupabaseClient: SupabaseClient | null = null;
let cachedPgPool: PgPool | null = null;

export function isSupabaseConfigured(): boolean {
  const url = process.env.SUPABASE_URL?.trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY)?.trim();
  return Boolean(url && key);
}

export function isPostgresConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

export function getStorageBackend(): StorageBackend {
  if (isSupabaseConfigured()) return 'supabase';
  if (isPostgresConfigured()) return 'postgres';
  return 'local';
}

function getSupabaseClient(): SupabaseClient {
  if (!cachedSupabaseClient) {
    const url = process.env.SUPABASE_URL?.trim();
    const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY)?.trim();
    if (!url || !key) {
      throw new Error('Supabase no está configurado en las variables de entorno.');
    }
    cachedSupabaseClient = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }
  return cachedSupabaseClient;
}

function getPgPool(): PgPool {
  if (!cachedPgPool) {
    const connectionString = process.env.DATABASE_URL?.trim();
    if (!connectionString) {
      throw new Error('DATABASE_URL no está configurada en las variables de entorno.');
    }
    const useSsl =
      process.env.NODE_ENV === 'production' ||
      connectionString.includes('render.com') ||
      connectionString.includes('sslmode=require');

    cachedPgPool = new Pool({
      connectionString,
      max: 10,
      connectionTimeoutMillis: 15000,
      ssl: useSsl ? { rejectUnauthorized: false } : undefined,
    });

    cachedPgPool.on('error', (err) => {
      console.error('Error inesperado en el pool de PostgreSQL:', err);
    });
  }
  return cachedPgPool;
}

function normalizePgRow(row: Record<string, unknown>): PuntoArbolado {
  return {
    id: String(row.id),
    nombre_punto: String(row.nombre_punto),
    latitud: Number(row.latitud),
    longitud: Number(row.longitud),
    codigo_arbol: String(row.codigo_arbol),
    especie: String(row.especie),
    tarea: String(row.tarea) as TareaTipo,
    created_at:
      row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    updated_at:
      row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
  };
}

async function readLocalStore(): Promise<PuntoArbolado[]> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const raw = await fs.readFile(LOCAL_STORE_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed as PuntoArbolado[];
    }
  } catch (err: unknown) {
    const nodeErr = err as { code?: string };
    if (nodeErr.code !== 'ENOENT') {
      console.error('Error al leer almacenamiento local:', err);
    }
  }
  const seeded = INITIAL_SEED_PUNTOS.map((item) => ({ ...item }));
  await writeLocalStore(seeded);
  return seeded;
}

async function writeLocalStore(items: PuntoArbolado[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(LOCAL_STORE_PATH, JSON.stringify(items, null, 2), 'utf-8');
}

export class StoreConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StoreConflictError';
  }
}

export class StoreNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StoreNotFoundError';
  }
}

export async function listPuntos(filters?: {
  tarea?: TareaTipo | 'todas';
  search?: string;
}): Promise<PuntoArbolado[]> {
  const tareaFilter = filters?.tarea && filters.tarea !== 'todas' ? filters.tarea : undefined;
  const searchTerm = filters?.search?.trim().toLowerCase() || '';
  const backend = getStorageBackend();

  if (backend === 'supabase') {
    const supabase = getSupabaseClient();
    let query = supabase
      .from(TABLE_NAME)
      .select('id, nombre_punto, latitud, longitud, codigo_arbol, especie, tarea, created_at, updated_at')
      .order('created_at', { ascending: false });

    if (tareaFilter) {
      query = query.eq('tarea', tareaFilter);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error('No se pudieron consultar los puntos en Supabase.', { cause: error });
    }

    const rows = (data ?? []) as PuntoArbolado[];
    if (!searchTerm) return rows;
    return rows.filter(
      (item) =>
        item.nombre_punto.toLowerCase().includes(searchTerm) ||
        item.codigo_arbol.toLowerCase().includes(searchTerm) ||
        item.especie.toLowerCase().includes(searchTerm)
    );
  }

  if (backend === 'postgres') {
    const pool = getPgPool();
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (tareaFilter) {
      params.push(tareaFilter);
      conditions.push(`tarea = $${params.length}`);
    }
    if (searchTerm) {
      params.push(`%${searchTerm}%`);
      const idx = params.length;
      conditions.push(
        `(lower(nombre_punto) LIKE $${idx} OR lower(codigo_arbol) LIKE $${idx} OR lower(especie) LIKE $${idx})`
      );
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql = `
      SELECT id, nombre_punto, latitud, longitud, codigo_arbol, especie, tarea, created_at, updated_at
      FROM public.${TABLE_NAME}
      ${whereClause}
      ORDER BY created_at DESC
    `;

    try {
      const result = await pool.query(sql, params);
      return result.rows.map(normalizePgRow);
    } catch (error) {
      throw new Error('No se pudieron consultar los puntos en PostgreSQL.', { cause: error });
    }
  }

  let items = await readLocalStore();
  if (tareaFilter) {
    items = items.filter((item) => item.tarea === tareaFilter);
  }
  if (searchTerm) {
    items = items.filter(
      (item) =>
        item.nombre_punto.toLowerCase().includes(searchTerm) ||
        item.codigo_arbol.toLowerCase().includes(searchTerm) ||
        item.especie.toLowerCase().includes(searchTerm)
    );
  }
  return items.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function getPuntoById(id: string): Promise<PuntoArbolado> {
  const backend = getStorageBackend();

  if (backend === 'supabase') {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('id, nombre_punto, latitud, longitud, codigo_arbol, especie, tarea, created_at, updated_at')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new Error('Error al consultar el punto en Supabase.', { cause: error });
    }
    if (!data) {
      throw new StoreNotFoundError('Punto no encontrado.');
    }
    return data as PuntoArbolado;
  }

  if (backend === 'postgres') {
    const pool = getPgPool();
    try {
      const result = await pool.query(
        `SELECT id, nombre_punto, latitud, longitud, codigo_arbol, especie, tarea, created_at, updated_at
         FROM public.${TABLE_NAME}
         WHERE id = $1`,
        [id]
      );
      if (result.rows.length === 0) {
        throw new StoreNotFoundError('Punto no encontrado.');
      }
      return normalizePgRow(result.rows[0]);
    } catch (error) {
      if (error instanceof StoreNotFoundError) throw error;
      throw new Error('Error al consultar el punto en PostgreSQL.', { cause: error });
    }
  }

  const items = await readLocalStore();
  const found = items.find((item) => item.id === id);
  if (!found) {
    throw new StoreNotFoundError('Punto no encontrado.');
  }
  return found;
}

export async function createPunto(payload: PuntoPayload): Promise<PuntoArbolado> {
  const backend = getStorageBackend();

  if (backend === 'supabase') {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .insert(payload)
      .select('id, nombre_punto, latitud, longitud, codigo_arbol, especie, tarea, created_at, updated_at')
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new StoreConflictError(`Ya existe un registro con el código de árbol "${payload.codigo_arbol}".`);
      }
      throw new Error('No se pudo crear el punto en Supabase.', { cause: error });
    }
    return data as PuntoArbolado;
  }

  if (backend === 'postgres') {
    const pool = getPgPool();
    try {
      const result = await pool.query(
        `INSERT INTO public.${TABLE_NAME} (nombre_punto, latitud, longitud, codigo_arbol, especie, tarea)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, nombre_punto, latitud, longitud, codigo_arbol, especie, tarea, created_at, updated_at`,
        [
          payload.nombre_punto,
          payload.latitud,
          payload.longitud,
          payload.codigo_arbol,
          payload.especie,
          payload.tarea,
        ]
      );
      return normalizePgRow(result.rows[0]);
    } catch (error: unknown) {
      const pgErr = error as { code?: string };
      if (pgErr.code === '23505') {
        throw new StoreConflictError(`Ya existe un registro con el código de árbol "${payload.codigo_arbol}".`);
      }
      throw new Error('No se pudo crear el punto en PostgreSQL.', { cause: error });
    }
  }

  const items = await readLocalStore();
  const duplicate = items.some((item) => item.codigo_arbol.toUpperCase() === payload.codigo_arbol.toUpperCase());
  if (duplicate) {
    throw new StoreConflictError(`Ya existe un registro con el código de árbol "${payload.codigo_arbol}".`);
  }

  const now = new Date().toISOString();
  const created: PuntoArbolado = {
    id: crypto.randomUUID(),
    ...payload,
    created_at: now,
    updated_at: now,
  };
  items.unshift(created);
  await writeLocalStore(items);
  return created;
}

export async function updatePunto(id: string, payload: PuntoPayload): Promise<PuntoArbolado> {
  const backend = getStorageBackend();

  if (backend === 'supabase') {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .update({
        nombre_punto: payload.nombre_punto,
        latitud: payload.latitud,
        longitud: payload.longitud,
        codigo_arbol: payload.codigo_arbol,
        especie: payload.especie,
        tarea: payload.tarea,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('id, nombre_punto, latitud, longitud, codigo_arbol, especie, tarea, created_at, updated_at')
      .maybeSingle();

    if (error) {
      if (error.code === '23505') {
        throw new StoreConflictError(`Ya existe otro registro con el código de árbol "${payload.codigo_arbol}".`);
      }
      throw new Error('No se pudo actualizar el punto en Supabase.', { cause: error });
    }
    if (!data) {
      throw new StoreNotFoundError('Punto no encontrado.');
    }
    return data as PuntoArbolado;
  }

  if (backend === 'postgres') {
    const pool = getPgPool();
    try {
      const result = await pool.query(
        `UPDATE public.${TABLE_NAME}
         SET nombre_punto = $1,
             latitud = $2,
             longitud = $3,
             codigo_arbol = $4,
             especie = $5,
             tarea = $6,
             updated_at = now()
         WHERE id = $7
         RETURNING id, nombre_punto, latitud, longitud, codigo_arbol, especie, tarea, created_at, updated_at`,
        [
          payload.nombre_punto,
          payload.latitud,
          payload.longitud,
          payload.codigo_arbol,
          payload.especie,
          payload.tarea,
          id,
        ]
      );
      if (result.rows.length === 0) {
        throw new StoreNotFoundError('Punto no encontrado.');
      }
      return normalizePgRow(result.rows[0]);
    } catch (error: unknown) {
      if (error instanceof StoreNotFoundError) throw error;
      const pgErr = error as { code?: string };
      if (pgErr.code === '23505') {
        throw new StoreConflictError(`Ya existe otro registro con el código de árbol "${payload.codigo_arbol}".`);
      }
      throw new Error('No se pudo actualizar el punto en PostgreSQL.', { cause: error });
    }
  }

  const items = await readLocalStore();
  const idx = items.findIndex((item) => item.id === id);
  if (idx === -1) {
    throw new StoreNotFoundError('Punto no encontrado.');
  }

  const duplicate = items.some(
    (item) => item.id !== id && item.codigo_arbol.toUpperCase() === payload.codigo_arbol.toUpperCase()
  );
  if (duplicate) {
    throw new StoreConflictError(`Ya existe otro registro con el código de árbol "${payload.codigo_arbol}".`);
  }

  const updated: PuntoArbolado = {
    ...items[idx],
    ...payload,
    updated_at: new Date().toISOString(),
  };
  items[idx] = updated;
  await writeLocalStore(items);
  return updated;
}

export async function deletePunto(id: string): Promise<void> {
  const backend = getStorageBackend();

  if (backend === 'supabase') {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .delete()
      .eq('id', id)
      .select('id');

    if (error) {
      throw new Error('No se pudo eliminar el punto en Supabase.', { cause: error });
    }
    if (!data || data.length === 0) {
      throw new StoreNotFoundError('Punto no encontrado.');
    }
    return;
  }

  if (backend === 'postgres') {
    const pool = getPgPool();
    try {
      const result = await pool.query(
        `DELETE FROM public.${TABLE_NAME} WHERE id = $1 RETURNING id`,
        [id]
      );
      if (result.rows.length === 0) {
        throw new StoreNotFoundError('Punto no encontrado.');
      }
      return;
    } catch (error) {
      if (error instanceof StoreNotFoundError) throw error;
      throw new Error('No se pudo eliminar el punto en PostgreSQL.', { cause: error });
    }
  }

  const items = await readLocalStore();
  const next = items.filter((item) => item.id !== id);
  if (next.length === items.length) {
    throw new StoreNotFoundError('Punto no encontrado.');
  }
  await writeLocalStore(next);
}

export async function restoreSeedPuntos(): Promise<PuntoArbolado[]> {
  const backend = getStorageBackend();

  if (backend === 'supabase') {
    const supabase = getSupabaseClient();
    const rowsToInsert = INITIAL_SEED_PUNTOS.map(({ id, nombre_punto, latitud, longitud, codigo_arbol, especie, tarea }) => ({
      id,
      nombre_punto,
      latitud,
      longitud,
      codigo_arbol,
      especie,
      tarea,
    }));

    const { error } = await supabase
      .from(TABLE_NAME)
      .upsert(rowsToInsert, { onConflict: 'codigo_arbol', ignoreDuplicates: true });

    if (error) {
      throw new Error('No se pudieron restaurar los ejemplos en Supabase.', { cause: error });
    }
    return listPuntos();
  }

  if (backend === 'postgres') {
    const pool = getPgPool();
    try {
      for (const seed of INITIAL_SEED_PUNTOS) {
        await pool.query(
          `INSERT INTO public.${TABLE_NAME} (id, nombre_punto, latitud, longitud, codigo_arbol, especie, tarea)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (codigo_arbol) DO NOTHING`,
          [
            seed.id,
            seed.nombre_punto,
            seed.latitud,
            seed.longitud,
            seed.codigo_arbol,
            seed.especie,
            seed.tarea,
          ]
        );
      }
      return listPuntos();
    } catch (error) {
      throw new Error('No se pudieron restaurar los ejemplos en PostgreSQL.', { cause: error });
    }
  }

  const current = await readLocalStore();
  const existingCodes = new Set(current.map((item) => item.codigo_arbol.toUpperCase()));
  const merged = [...current];
  for (const seed of INITIAL_SEED_PUNTOS) {
    if (!existingCodes.has(seed.codigo_arbol.toUpperCase())) {
      merged.push({ ...seed });
    }
  }
  await writeLocalStore(merged);
  return listPuntos();
}
