import { useEffect, useState } from 'react';
import { Droplets, MapPin, Scissors, X } from 'lucide-react';
import { validatePuntoInput } from '../types/punto.ts';
import type { PuntoArbolado, PuntoPayload, TareaTipo, ValidationErrors } from '../types/punto.ts';

interface PuntoFormModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  initialPunto: PuntoArbolado | null;
  saving: boolean;
  serverError: string | null;
  serverFields?: ValidationErrors;
  onClose: () => void;
  onSubmit: (payload: PuntoPayload) => Promise<void>;
}

export function PuntoFormModal({
  open,
  mode,
  initialPunto,
  saving,
  serverError,
  serverFields,
  onClose,
  onSubmit,
}: PuntoFormModalProps) {
  const [nombrePunto, setNombrePunto] = useState('');
  const [codigoArbol, setCodigoArbol] = useState('');
  const [especie, setEspecie] = useState('');
  const [tarea, setTarea] = useState<TareaTipo>('riego');
  const [latitud, setLatitud] = useState('');
  const [longitud, setLongitud] = useState('');
  const [errors, setErrors] = useState<ValidationErrors>({});

  useEffect(() => {
    if (!open) return;
    if (mode === 'edit' && initialPunto) {
      setNombrePunto(initialPunto.nombre_punto);
      setCodigoArbol(initialPunto.codigo_arbol);
      setEspecie(initialPunto.especie);
      setTarea(initialPunto.tarea);
      setLatitud(String(initialPunto.latitud));
      setLongitud(String(initialPunto.longitud));
    } else {
      setNombrePunto('');
      setCodigoArbol('');
      setEspecie('');
      setTarea('riego');
      setLatitud('');
      setLongitud('');
    }
    setErrors({});
  }, [open, mode, initialPunto]);

  useEffect(() => {
    if (serverFields) {
      setErrors((prev) => ({ ...prev, ...serverFields }));
    }
  }, [serverFields]);

  if (!open) return null;

  const validateSingleCoord = (field: 'latitud' | 'longitud', value: string) => {
    const trimmed = value.trim().replace(',', '.');
    if (!trimmed) {
      setErrors((prev) => ({
        ...prev,
        [field]:
          field === 'latitud'
            ? 'Ingresá la latitud en grados decimales (−90 a 90).'
            : 'Ingresá la longitud en grados decimales (−180 a 180).',
      }));
      return;
    }
    const num = Number(trimmed);
    if (field === 'latitud') {
      if (!Number.isFinite(num) || num < -90 || num > 90) {
        setErrors((prev) => ({
          ...prev,
          latitud: 'La latitud debe estar entre −90 y 90 grados decimales.',
        }));
      } else {
        setErrors((prev) => ({ ...prev, latitud: undefined }));
      }
    } else {
      if (!Number.isFinite(num) || num < -180 || num > 180) {
        setErrors((prev) => ({
          ...prev,
          longitud: 'La longitud debe estar entre −180 y 180 grados decimales.',
        }));
      } else {
        setErrors((prev) => ({ ...prev, longitud: undefined }));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validatePuntoInput({
      nombre_punto: nombrePunto,
      codigo_arbol: codigoArbol,
      especie,
      tarea,
      latitud,
      longitud,
    });

    if (!validation.valid || !validation.normalized) {
      setErrors(validation.errors);
      return;
    }

    setErrors({});
    await onSubmit(validation.normalized);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="punto-modal-title"
    >
      <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-lg">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 id="punto-modal-title" className="font-display text-lg font-semibold text-slate-900">
            {mode === 'create' ? 'Agregar punto de arbolado' : 'Editar punto de arbolado'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar formulario"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-2 focus-visible:outline-emerald-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5" noValidate>
          {serverError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-800">
              {serverError}
            </div>
          )}

          <div>
            <label htmlFor="nombre_punto" className="block text-sm font-medium text-slate-800">
              Nombre del punto
            </label>
            <input
              id="nombre_punto"
              type="text"
              value={nombrePunto}
              onChange={(e) => setNombrePunto(e.target.value)}
              placeholder="Ej. Parque Lezama — Esquina Brasil"
              className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/20"
            />
            {errors.nombre_punto && (
              <p className="mt-1 text-xs text-red-700">{errors.nombre_punto}</p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="codigo_arbol" className="block text-sm font-medium text-slate-800">
                Código de árbol
              </label>
              <input
                id="codigo_arbol"
                type="text"
                value={codigoArbol}
                onChange={(e) => setCodigoArbol(e.target.value.toUpperCase())}
                placeholder="Ej. ARB-405"
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 font-mono text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/20"
              />
              {errors.codigo_arbol && (
                <p className="mt-1 text-xs text-red-700">{errors.codigo_arbol}</p>
              )}
            </div>

            <div>
              <label htmlFor="especie" className="block text-sm font-medium text-slate-800">
                Especie
              </label>
              <input
                id="especie"
                type="text"
                value={especie}
                onChange={(e) => setEspecie(e.target.value)}
                placeholder="Ej. Handroanthus impetiginosus"
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/20"
              />
              {errors.especie && <p className="mt-1 text-xs text-red-700">{errors.especie}</p>}
            </div>
          </div>

          <div>
            <span className="block text-sm font-medium text-slate-800">Tarea asignada</span>
            <div className="mt-1.5 grid grid-cols-2 gap-2 rounded-lg bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setTarea('riego')}
                className={`inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                  tarea === 'riego'
                    ? 'bg-white text-sky-800 shadow-sm ring-1 ring-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Droplets className="h-4 w-4 text-sky-700" />
                Riego
              </button>
              <button
                type="button"
                onClick={() => setTarea('poda')}
                className={`inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                  tarea === 'poda'
                    ? 'bg-white text-amber-800 shadow-sm ring-1 ring-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Scissors className="h-4 w-4 text-amber-700" />
                Poda
              </button>
            </div>
            {errors.tarea && <p className="mt-1 text-xs text-red-700">{errors.tarea}</p>}
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4">
            <div className="mb-3 flex items-center gap-2 text-xs font-medium text-slate-700">
              <MapPin className="h-3.5 w-3.5 text-emerald-700" />
              Coordenadas en grados decimales
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="latitud" className="block text-xs font-medium text-slate-700">
                  Latitud (−90 a 90)
                </label>
                <input
                  id="latitud"
                  type="text"
                  inputMode="decimal"
                  value={latitud}
                  onChange={(e) => {
                    setLatitud(e.target.value);
                    validateSingleCoord('latitud', e.target.value);
                  }}
                  placeholder="-34.626910"
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/20"
                />
                {errors.latitud && <p className="mt-1 text-xs text-red-700">{errors.latitud}</p>}
              </div>

              <div>
                <label htmlFor="longitud" className="block text-xs font-medium text-slate-700">
                  Longitud (−180 a 180)
                </label>
                <input
                  id="longitud"
                  type="text"
                  inputMode="decimal"
                  value={longitud}
                  onChange={(e) => {
                    setLongitud(e.target.value);
                    validateSingleCoord('longitud', e.target.value);
                  }}
                  placeholder="-58.369420"
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/20"
                />
                {errors.longitud && (
                  <p className="mt-1 text-xs text-red-700">{errors.longitud}</p>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-emerald-700 whitespace-nowrap"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-800 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-emerald-700 whitespace-nowrap"
            >
              {saving
                ? 'Guardando...'
                : mode === 'create'
                  ? 'Guardar punto'
                  : 'Actualizar punto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
