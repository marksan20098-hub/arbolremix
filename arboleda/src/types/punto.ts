export type TareaTipo = 'riego' | 'poda';

export interface PuntoArbolado {
  id: string;
  nombre_punto: string;
  latitud: number;
  longitud: number;
  codigo_arbol: string;
  especie: string;
  tarea: TareaTipo;
  created_at: string;
  updated_at: string;
}

export interface PuntoPayload {
  nombre_punto: string;
  latitud: number;
  longitud: number;
  codigo_arbol: string;
  especie: string;
  tarea: TareaTipo;
}

export interface ValidationErrors {
  nombre_punto?: string;
  latitud?: string;
  longitud?: string;
  codigo_arbol?: string;
  especie?: string;
  tarea?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationErrors;
  normalized?: PuntoPayload;
}

export function validatePuntoInput(raw: {
  nombre_punto?: unknown;
  latitud?: unknown;
  longitud?: unknown;
  codigo_arbol?: unknown;
  especie?: unknown;
  tarea?: unknown;
}): ValidationResult {
  const errors: ValidationErrors = {};

  const nombre = typeof raw.nombre_punto === 'string' ? raw.nombre_punto.trim() : '';
  if (nombre.length < 2 || nombre.length > 140) {
    errors.nombre_punto = 'El nombre del punto debe tener entre 2 y 140 caracteres.';
  }

  const codigo = typeof raw.codigo_arbol === 'string' ? raw.codigo_arbol.trim().toUpperCase() : '';
  if (codigo.length < 2 || codigo.length > 40) {
    errors.codigo_arbol = 'El código de árbol debe tener entre 2 y 40 caracteres.';
  }

  const especie = typeof raw.especie === 'string' ? raw.especie.trim() : '';
  if (especie.length < 2 || especie.length > 120) {
    errors.especie = 'La especie debe tener entre 2 y 120 caracteres.';
  }

  const tareaRaw = typeof raw.tarea === 'string' ? raw.tarea.trim().toLowerCase() : '';
  if (tareaRaw !== 'riego' && tareaRaw !== 'poda') {
    errors.tarea = 'La tarea debe ser "riego" o "poda".';
  }

  const latParsed =
    typeof raw.latitud === 'number'
      ? raw.latitud
      : typeof raw.latitud === 'string' && raw.latitud.trim() !== ''
        ? Number(raw.latitud.trim().replace(',', '.'))
        : NaN;

  if (!Number.isFinite(latParsed) || latParsed < -90 || latParsed > 90) {
    errors.latitud = 'La latitud debe estar en grados decimales entre −90 y 90.';
  }

  const lngParsed =
    typeof raw.longitud === 'number'
      ? raw.longitud
      : typeof raw.longitud === 'string' && raw.longitud.trim() !== ''
        ? Number(raw.longitud.trim().replace(',', '.'))
        : NaN;

  if (!Number.isFinite(lngParsed) || lngParsed < -180 || lngParsed > 180) {
    errors.longitud = 'La longitud debe estar en grados decimales entre −180 y 180.';
  }

  const valid = Object.keys(errors).length === 0;
  if (!valid) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: {},
    normalized: {
      nombre_punto: nombre,
      latitud: Number(latParsed.toFixed(6)),
      longitud: Number(lngParsed.toFixed(6)),
      codigo_arbol: codigo,
      especie,
      tarea: tareaRaw as TareaTipo,
    },
  };
}
