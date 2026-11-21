-- Esquema SQL para PostgreSQL en Render (Render Postgres)
-- Podés ejecutarlo con psql "$DATABASE_URL" -f render/schema.sql
-- o pegarlo directamente en la consola SQL / pgAdmin conectado a tu base de Render.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.puntos_arbolado (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre_punto text NOT NULL CHECK (char_length(trim(nombre_punto)) BETWEEN 2 AND 140),
  latitud double precision NOT NULL CHECK (latitud >= -90 AND latitud <= 90),
  longitud double precision NOT NULL CHECK (longitud >= -180 AND longitud <= 180),
  codigo_arbol text NOT NULL UNIQUE CHECK (char_length(trim(codigo_arbol)) BETWEEN 2 AND 40),
  especie text NOT NULL CHECK (char_length(trim(especie)) BETWEEN 2 AND 120),
  tarea text NOT NULL CHECK (tarea IN ('riego', 'poda')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_puntos_arbolado_tarea
  ON public.puntos_arbolado (tarea);

CREATE OR REPLACE FUNCTION public.actualizar_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_puntos_arbolado_updated_at ON public.puntos_arbolado;
CREATE TRIGGER trg_puntos_arbolado_updated_at
  BEFORE UPDATE ON public.puntos_arbolado
  FOR EACH ROW
  EXECUTE FUNCTION public.actualizar_updated_at();

-- Tres ejemplos iniciales en ubicaciones distintas (grados decimales)
INSERT INTO public.puntos_arbolado (id, nombre_punto, latitud, longitud, codigo_arbol, especie, tarea)
VALUES
  (
    '5a8b4d10-2e3f-4c9a-8b1d-100000000101',
    'Bosques de Palermo — Sector Rosedal',
    -34.571842,
    -58.417615,
    'ARB-101',
    'Jacaranda mimosifolia',
    'riego'
  ),
  (
    '5a8b4d10-2e3f-4c9a-8b1d-100000000204',
    'Parque Centenario — Sendero Norte',
    -34.606125,
    -58.435784,
    'ARB-204',
    'Tipuana tipu',
    'poda'
  ),
  (
    '5a8b4d10-2e3f-4c9a-8b1d-100000000309',
    'Reserva Ecológica Costanera Sur — Mirador',
    -34.609512,
    -58.352940,
    'ARB-309',
    'Erythrina crista-galli (Ceibo)',
    'riego'
  )
ON CONFLICT (codigo_arbol) DO NOTHING;
