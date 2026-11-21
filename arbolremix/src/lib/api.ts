import type { PuntoArbolado, PuntoPayload, TareaTipo, ValidationErrors } from '../types/punto.ts';

export interface PublicConfig {
  googleMapsApiKey: string;
  storageMode: 'supabase' | 'local';
}

export interface ListPuntosResponse {
  data: PuntoArbolado[];
  meta: {
    total: number;
    storageMode: 'supabase' | 'local';
  };
}

export class ApiError extends Error {
  status: number;
  fields?: ValidationErrors;

  constructor(message: string, status: number, fields?: ValidationErrors) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.fields = fields;
  }
}

async function parseJsonSafe(res: Response): Promise<Record<string, unknown>> {
  try {
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export async function fetchPublicConfig(): Promise<PublicConfig> {
  const res = await fetch('/api/public-config');
  if (!res.ok) {
    throw new ApiError('No se pudo obtener la configuración del servicio.', res.status);
  }
  return (await res.json()) as PublicConfig;
}

export async function fetchPuntos(
  tarea: TareaTipo | 'todas' = 'todas',
  search = ''
): Promise<ListPuntosResponse> {
  const params = new URLSearchParams();
  if (tarea !== 'todas') {
    params.set('tarea', tarea);
  }
  if (search.trim()) {
    params.set('q', search.trim());
  }
  const qs = params.toString();
  const res = await fetch(`/api/puntos${qs ? `?${qs}` : ''}`);
  const body = await parseJsonSafe(res);
  if (!res.ok) {
    throw new ApiError(
      (body.error as string) || 'Error al cargar los puntos de arbolado.',
      res.status
    );
  }
  return body as unknown as ListPuntosResponse;
}

export async function createPuntoApi(payload: PuntoPayload): Promise<PuntoArbolado> {
  const res = await fetch('/api/puntos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await parseJsonSafe(res);
  if (!res.ok) {
    throw new ApiError(
      (body.error as string) || 'No se pudo crear el punto.',
      res.status,
      body.fields as ValidationErrors | undefined
    );
  }
  return body.data as PuntoArbolado;
}

export async function updatePuntoApi(id: string, payload: PuntoPayload): Promise<PuntoArbolado> {
  const res = await fetch(`/api/puntos/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await parseJsonSafe(res);
  if (!res.ok) {
    throw new ApiError(
      (body.error as string) || 'No se pudo actualizar el punto.',
      res.status,
      body.fields as ValidationErrors | undefined
    );
  }
  return body.data as PuntoArbolado;
}

export async function deletePuntoApi(id: string): Promise<void> {
  const res = await fetch(`/api/puntos/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  const body = await parseJsonSafe(res);
  if (!res.ok) {
    throw new ApiError((body.error as string) || 'No se pudo eliminar el punto.', res.status);
  }
}

export async function seedPuntosApi(): Promise<PuntoArbolado[]> {
  const res = await fetch('/api/puntos/seed', { method: 'POST' });
  const body = await parseJsonSafe(res);
  if (!res.ok) {
    throw new ApiError((body.error as string) || 'No se pudieron restaurar los ejemplos.', res.status);
  }
  return (body.data as PuntoArbolado[]) ?? [];
}
