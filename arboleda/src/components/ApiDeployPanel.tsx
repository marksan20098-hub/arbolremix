import { useState } from 'react';
import { Check, Copy, Database, Globe, Server } from 'lucide-react';
import type { PuntoArbolado } from '../types/punto.ts';

interface ApiDeployPanelProps {
  activeTab: 'api' | 'supabase' | 'render';
  storageMode: 'supabase' | 'postgres' | 'local';
  puntos: PuntoArbolado[];
}

const SUPABASE_SQL = `CREATE EXTENSION IF NOT EXISTS pgcrypto;

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

INSERT INTO public.puntos_arbolado (nombre_punto, latitud, longitud, codigo_arbol, especie, tarea)
VALUES
  ('Bosques de Palermo — Sector Rosedal', -34.571842, -58.417615, 'ARB-101', 'Jacaranda mimosifolia', 'riego'),
  ('Parque Centenario — Sendero Norte', -34.606125, -58.435784, 'ARB-204', 'Tipuana tipu', 'poda'),
  ('Reserva Ecológica Costanera Sur — Mirador', -34.609512, -58.352940, 'ARB-309', 'Erythrina crista-galli (Ceibo)', 'riego')
ON CONFLICT (codigo_arbol) DO NOTHING;`;

const RENDER_YAML = `services:
  - type: web
    name: arboleda-gis-api
    runtime: node
    plan: free
    buildCommand: npm install --legacy-peer-deps && npm run build
    startCommand: npm start
    healthCheckPath: /api/health
    envVars:
      - key: NODE_ENV
        value: production
      - key: NODE_VERSION
        value: 22
      - key: SUPABASE_URL
        sync: false
      - key: SUPABASE_SERVICE_ROLE_KEY
        sync: false
      - key: DATABASE_URL
        sync: false
      - key: VITE_GOOGLE_MAPS_API_KEY
        sync: false`;

function CopyButton({ text, label = 'Copiar' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-700" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? 'Copiado' : label}
    </button>
  );
}

export function ApiDeployPanel({ activeTab, storageMode, puntos }: ApiDeployPanelProps) {
  const [liveResponse, setLiveResponse] = useState<string>('');
  const [testingEndpoint, setTestingEndpoint] = useState(false);

  const testEndpoint = async (url: string) => {
    setTestingEndpoint(true);
    try {
      const res = await fetch(url);
      const json = await res.json();
      setLiveResponse(JSON.stringify(json, null, 2));
    } catch (err) {
      setLiveResponse(JSON.stringify({ error: String(err) }, null, 2));
    } finally {
      setTestingEndpoint(false);
    }
  };

  if (activeTab === 'supabase') {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-medium text-emerald-700">
                <Database className="h-4 w-4" />
                <span>Esquema PostgreSQL · Archivo supabase/schema.sql</span>
              </div>
              <h2 className="mt-1 font-display text-xl font-semibold text-slate-900">
                Tabla puntos_arbolado en Supabase
              </h2>
              <p className="mt-1 max-w-2xl text-sm text-slate-600">
                Incluye UUID único, validación de grados decimales en base de datos, restricción de
                tarea (<code className="font-mono text-xs">riego | poda</code>), índice y los tres
                ejemplos iniciales en ubicaciones distintas.
              </p>
            </div>
            <CopyButton text={SUPABASE_SQL} label="Copiar SQL" />
          </div>

          <pre className="mt-4 overflow-x-auto rounded-lg border border-slate-200 bg-slate-950 p-4 font-mono text-xs leading-relaxed text-slate-100">
            <code>{SUPABASE_SQL}</code>
          </pre>

          <div className="mt-5 grid grid-cols-1 gap-4 border-t border-slate-200 pt-5 sm:grid-cols-3">
            <div>
              <div className="text-xs font-medium text-slate-500">Estado actual del backend</div>
              <div className="mt-1 text-sm font-semibold text-slate-900">
                {storageMode === 'supabase'
                  ? 'Conectado a Supabase'
                  : storageMode === 'postgres'
                    ? 'Conectado a Render Postgres'
                    : 'Modo vista previa (sin credenciales aún)'}
              </div>
            </div>
            <div>
              <div className="text-xs font-medium text-slate-500">Variables requeridas</div>
              <div className="mt-1 font-mono text-xs text-slate-800">
                SUPABASE_URL · SUPABASE_SERVICE_ROLE_KEY
              </div>
            </div>
            <div>
              <div className="text-xs font-medium text-slate-500">Registros activos</div>
              <div className="mt-1 font-mono text-sm font-semibold tabular-nums text-slate-900">
                {puntos.length} puntos
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (activeTab === 'render') {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-medium text-emerald-700">
                <Globe className="h-4 w-4" />
                <span>Blueprint Render · Archivo render.yaml</span>
              </div>
              <h2 className="mt-1 font-display text-xl font-semibold text-slate-900">
                Despliegue en Render (Web Service + API Express)
              </h2>
              <p className="mt-1 max-w-2xl text-sm text-slate-600">
                Un único servicio Node sirve el frontend compilado (<code className="font-mono text-xs">dist/</code>) y todos los endpoints REST bajo <code className="font-mono text-xs">/api/*</code> en el puerto asignado por Render.
              </p>
            </div>
            <CopyButton text={RENDER_YAML} label="Copiar render.yaml" />
          </div>

          <pre className="mt-4 overflow-x-auto rounded-lg border border-slate-200 bg-slate-950 p-4 font-mono text-xs leading-relaxed text-slate-100">
            <code>{RENDER_YAML}</code>
          </pre>

          <div className="mt-6 grid grid-cols-1 gap-4 border-t border-slate-200 pt-5 md:grid-cols-2">
            <div className="space-y-2">
              <h3 className="font-display text-sm font-semibold text-slate-900">
                Pasos para publicar en Render
              </h3>
              <ol className="list-decimal space-y-1.5 pl-4 text-sm text-slate-600">
                <li>Ejecutá <code className="font-mono text-xs">supabase/schema.sql</code> en el SQL Editor de Supabase.</li>
                <li>Subí el repositorio a GitHub y creá un Web Service (o Blueprint con <code className="font-mono text-xs">render.yaml</code>).</li>
                <li>Cargá <code className="font-mono text-xs">SUPABASE_URL</code>, <code className="font-mono text-xs">SUPABASE_SERVICE_ROLE_KEY</code> y <code className="font-mono text-xs">VITE_GOOGLE_MAPS_API_KEY</code> en Environment.</li>
              </ol>
            </div>
            <div className="space-y-2">
              <h3 className="font-display text-sm font-semibold text-slate-900">
                Comandos de producción
              </h3>
              <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3.5 font-mono text-xs text-slate-800">
                <div>Build: npm install --legacy-peer-deps && npm run build</div>
                <div>Start: npm start</div>
                <div>Healthcheck: GET /api/health</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // activeTab === 'api'
  const endpoints = [
    { method: 'GET', path: '/api/health', desc: 'Estado del servicio web y motor de almacenamiento activo' },
    { method: 'GET', path: '/api/puntos', desc: 'Lista puntos; admite ?tarea=riego|poda y ?q=búsqueda' },
    { method: 'GET', path: '/api/puntos/:id', desc: 'Obtiene un punto único por UUID' },
    { method: 'POST', path: '/api/puntos', desc: 'Crea un punto validando latitud (-90..90) y longitud (-180..180)' },
    { method: 'PUT', path: '/api/puntos/:id', desc: 'Actualiza un registro existente con validación completa' },
    { method: 'DELETE', path: '/api/puntos/:id', desc: 'Elimina un punto por ID' },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-emerald-700">
              <Server className="h-4 w-4" />
              <span>API REST Express · Servicio unificado</span>
            </div>
            <h2 className="mt-1 font-display text-xl font-semibold text-slate-900">
              Endpoints disponibles
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => testEndpoint('/api/health')}
              disabled={testingEndpoint}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
            >
              Probar /api/health
            </button>
            <button
              type="button"
              onClick={() => testEndpoint('/api/puntos')}
              disabled={testingEndpoint}
              className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-800 whitespace-nowrap"
            >
              Probar GET /api/puntos
            </button>
          </div>
        </div>

        <div className="mt-5 divide-y divide-slate-200 border-y border-slate-200">
          {endpoints.map((ep) => (
            <div
              key={`${ep.method}-${ep.path}`}
              className="grid grid-cols-1 items-center gap-2 py-3 sm:grid-cols-12"
            >
              <div className="sm:col-span-2">
                <span className="font-mono text-xs font-semibold text-emerald-700">{ep.method}</span>
              </div>
              <div className="font-mono text-xs text-slate-900 sm:col-span-4">{ep.path}</div>
              <div className="text-sm text-slate-600 sm:col-span-6">{ep.desc}</div>
            </div>
          ))}
        </div>

        {liveResponse && (
          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-slate-600">Respuesta en vivo</span>
              <CopyButton text={liveResponse} label="Copiar JSON" />
            </div>
            <pre className="max-h-72 overflow-auto rounded-lg border border-slate-200 bg-slate-950 p-4 font-mono text-xs text-slate-100">
              <code>{liveResponse}</code>
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
