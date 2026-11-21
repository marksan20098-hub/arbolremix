import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { INITIAL_SEED_PUNTOS } from '../data/seedPuntos.ts';
import type { PuntoArbolado, PuntoPayload, TareaTipo } from '../types/punto.ts';

const TABLE_NAME = 'puntos_arbolado';
const DATA_DIR = path.resolve(process.cwd(), 'data');
const LOCAL_STORE_PATH = path.resolve(DATA_DIR, 'puntos.json');

let cachedSupabaseClient: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  const url = process.env.SUPABASE_URL?.trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY)?.trim();
  return Boolean(url && key);
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

  if (isSupabaseConfigured()) {
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
  if (isSupabaseConfigured()) {
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

  const items = await readLocalStore();
  const found = items.find((item) => item.id === id);
  if (!found) {
    throw new StoreNotFoundError('Punto no encontrado.');
  }
  return found;
}

export async function createPunto(payload: PuntoPayload): Promise<PuntoArbolado> {
  if (isSupabaseConfigured()) {
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
  if (isSupabaseConfigured()) {
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
  if (isSupabaseConfigured()) {
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

  const items = await readLocalStore();
  const next = items.filter((item) => item.id !== id);
  if (next.length === items.length) {
    throw new StoreNotFoundError('Punto no encontrado.');
  }
  await writeLocalStore(next);
}

export async function restoreSeedPuntos(): Promise<PuntoArbolado[]> {
  if (isSupabaseConfigured()) {
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
