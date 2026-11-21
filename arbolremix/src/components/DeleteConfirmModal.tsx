import { Trash2, X } from 'lucide-react';
import type { PuntoArbolado } from '../types/punto.ts';

interface DeleteConfirmModalProps {
  punto: PuntoArbolado | null;
  deleting: boolean;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}

export function DeleteConfirmModal({
  punto,
  deleting,
  onCancel,
  onConfirm,
}: DeleteConfirmModalProps) {
  if (!punto) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-modal-title"
    >
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-lg">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-700">
              <Trash2 className="h-5 w-5" />
            </div>
            <div>
              <h2 id="delete-modal-title" className="font-display text-base font-semibold text-slate-900">
                Eliminar punto de arbolado
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                ¿Confirmás eliminar <span className="font-medium text-slate-900">{punto.nombre_punto}</span>{' '}
                (<span className="font-mono text-xs">{punto.codigo_arbol}</span>)?
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Cerrar confirmación"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={deleting}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={deleting}
            className="rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-800 disabled:opacity-60 whitespace-nowrap"
          >
            {deleting ? 'Eliminando...' : 'Eliminar registro'}
          </button>
        </div>
      </div>
    </div>
  );
}
