import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Droplets,
  MapPin,
  Pencil,
  Plus,
  RotateCcw,
  Scissors,
  Search,
  Trash2,
} from 'lucide-react';
import { ApiDeployPanel } from './components/ApiDeployPanel.tsx';
import { DeleteConfirmModal } from './components/DeleteConfirmModal.tsx';
import { PuntoFormModal } from './components/PuntoFormModal.tsx';
import { TreeMapView } from './components/TreeMapView.tsx';
import {
  ApiError,
  createPuntoApi,
  deletePuntoApi,
  fetchPublicConfig,
  fetchPuntos,
  seedPuntosApi,
  updatePuntoApi,
} from './lib/api.ts';
import type { PuntoArbolado, PuntoPayload, TareaTipo, ValidationErrors } from './types/punto.ts';

type WorkspaceSection = 'mapa' | 'api' | 'supabase' | 'render';
type FilterTarea = 'todas' | TareaTipo;

export default function App() {
  const [activeSection, setActiveSection] = useState<WorkspaceSection>('mapa');
  const [puntos, setPuntos] = useState<PuntoArbolado[]>([]);
  const [allCounts, setAllCounts] = useState({ total: 0, riego: 0, poda: 0 });
  const [filterTarea, setFilterTarea] = useState<FilterTarea>('todas');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [storageMode, setStorageMode] = useState<'supabase' | 'local'>('local');
  const [mapsApiKey, setMapsApiKey] = useState<string>(
    (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined)?.trim() || ''
  );
  const [quotaExceeded, setQuotaExceeded] = useState(false);

  // Create / Edit modal state
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [editingPunto, setEditingPunto] = useState<PuntoArbolado | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formFields, setFormFields] = useState<ValidationErrors | undefined>(undefined);

  // Delete modal state
  const [deletingPunto, setDeletingPunto] = useState<PuntoArbolado | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const onQuotaExceeded = () => setQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', onQuotaExceeded);
    return () => window.removeEventListener('gmp-quota-exceeded', onQuotaExceeded);
  }, []);

  const refreshCounts = useCallback(async () => {
    try {
      const res = await fetchPuntos('todas', '');
      const riego = res.data.filter((p) => p.tarea === 'riego').length;
      const poda = res.data.filter((p) => p.tarea === 'poda').length;
      setAllCounts({ total: res.data.length, riego, poda });
    } catch {
      // Keep existing counts if background count refresh fails
    }
  }, []);

  const loadPuntos = useCallback(
    async (tarea: FilterTarea, search: string, preferredSelectId?: string | null) => {
      setLoading(true);
      setLoadError(null);
      try {
        const res = await fetchPuntos(tarea, search);
        setPuntos(res.data);
        setStorageMode(res.meta.storageMode);

        setSelectedId((prevSelected) => {
          const target = preferredSelectId !== undefined ? preferredSelectId : prevSelected;
          if (target && res.data.some((p) => p.id === target)) {
            return target;
          }
          return res.data[0]?.id ?? null;
        });
      } catch (err) {
        setLoadError(
          err instanceof Error ? err.message : 'No se pudo conectar con la API de puntos.'
        );
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    fetchPublicConfig()
      .then((cfg) => {
        setStorageMode(cfg.storageMode);
        if (!mapsApiKey && cfg.googleMapsApiKey) {
          setMapsApiKey(cfg.googleMapsApiKey);
        }
      })
      .catch(() => {
        // Public config fallback handled cleanly
      });
  }, [mapsApiKey]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadPuntos(filterTarea, searchQuery);
    }, 150);
    return () => clearTimeout(timer);
  }, [filterTarea, searchQuery, loadPuntos]);

  useEffect(() => {
    refreshCounts();
  }, [refreshCounts]);

  const selectedPunto = useMemo(
    () => puntos.find((p) => p.id === selectedId) ?? null,
    [puntos, selectedId]
  );

  const openCreateModal = () => {
    setFormMode('create');
    setEditingPunto(null);
    setFormError(null);
    setFormFields(undefined);
    setFormOpen(true);
  };

  const openEditModal = (punto: PuntoArbolado) => {
    setFormMode('edit');
    setEditingPunto(punto);
    setFormError(null);
    setFormFields(undefined);
    setFormOpen(true);
  };

  const handleSavePunto = async (payload: PuntoPayload) => {
    setSaving(true);
    setFormError(null);
    setFormFields(undefined);
    try {
      let saved: PuntoArbolado;
      if (formMode === 'create') {
        saved = await createPuntoApi(payload);
      } else if (editingPunto) {
        saved = await updatePuntoApi(editingPunto.id, payload);
      } else {
        return;
      }

      setFormOpen(false);
      // If current filter hides the newly saved task, switch to 'todas' so user sees it
      const nextFilter =
        filterTarea !== 'todas' && saved.tarea !== filterTarea ? 'todas' : filterTarea;
      if (nextFilter !== filterTarea) {
        setFilterTarea(nextFilter);
      }
      await Promise.all([loadPuntos(nextFilter, searchQuery, saved.id), refreshCounts()]);
      setActiveSection('mapa');
    } catch (err) {
      if (err instanceof ApiError) {
        setFormError(err.message);
        setFormFields(err.fields);
      } else {
        setFormError('Ocurrió un error al guardar el punto.');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingPunto) return;
    setDeleting(true);
    try {
      await deletePuntoApi(deletingPunto.id);
      const removedId = deletingPunto.id;
      setDeletingPunto(null);
      await Promise.all([
        loadPuntos(filterTarea, searchQuery, selectedId === removedId ? null : selectedId),
        refreshCounts(),
      ]);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'No se pudo eliminar el registro.');
      setDeletingPunto(null);
    } finally {
      setDeleting(false);
    }
  };

  const handleRestoreSeed = async () => {
    setLoading(true);
    try {
      await seedPuntosApi();
      setFilterTarea('todas');
      setSearchQuery('');
      await Promise.all([loadPuntos('todas', ''), refreshCounts()]);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'No se pudieron restaurar los ejemplos.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAF9] text-slate-900">
      {quotaExceeded && (
        <div className="sticky top-0 z-50 border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-center text-xs text-amber-900 shadow-sm md:text-sm">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-amber-950 underline hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}

      {/* Strict 3-Zone Top Bar */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-8 px-4 py-3.5 sm:px-6">
          <button
            type="button"
            onClick={() => setActiveSection('mapa')}
            className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-emerald-700"
          >
            Arboleda GIS
          </button>

          <nav className="hidden items-center gap-6 text-sm font-medium text-slate-600 md:flex">
            <button
              type="button"
              onClick={() => setActiveSection('mapa')}
              className={`border-b-2 py-1 transition-colors whitespace-nowrap shrink-0 ${
                activeSection === 'mapa'
                  ? 'border-emerald-700 text-slate-900'
                  : 'border-transparent hover:text-slate-900'
              }`}
            >
              Mapa y puntos
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('api')}
              className={`border-b-2 py-1 transition-colors whitespace-nowrap shrink-0 ${
                activeSection === 'api'
                  ? 'border-emerald-700 text-slate-900'
                  : 'border-transparent hover:text-slate-900'
              }`}
            >
              API REST
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('supabase')}
              className={`border-b-2 py-1 transition-colors whitespace-nowrap shrink-0 ${
                activeSection === 'supabase'
                  ? 'border-emerald-700 text-slate-900'
                  : 'border-transparent hover:text-slate-900'
              }`}
            >
              Supabase SQL
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('render')}
              className={`border-b-2 py-1 transition-colors whitespace-nowrap shrink-0 ${
                activeSection === 'render'
                  ? 'border-emerald-700 text-slate-900'
                  : 'border-transparent hover:text-slate-900'
              }`}
            >
              Deploy Render
            </button>
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-emerald-700 whitespace-nowrap shrink-0"
            >
              <Plus className="h-3.5 w-3.5" />
              Agregar punto
            </button>
          </div>
        </div>

        {/* Mobile navigation row */}
        <div className="flex items-center gap-4 overflow-x-auto border-t border-slate-100 px-4 py-2 text-xs font-medium text-slate-600 md:hidden">
          {(['mapa', 'api', 'supabase', 'render'] as const).map((sec) => (
            <button
              key={sec}
              type="button"
              onClick={() => setActiveSection(sec)}
              className={`whitespace-nowrap shrink-0 py-1 ${
                activeSection === sec ? 'font-semibold text-emerald-700' : 'text-slate-600'
              }`}
            >
              {sec === 'mapa'
                ? 'Mapa y puntos'
                : sec === 'api'
                  ? 'API REST'
                  : sec === 'supabase'
                    ? 'Supabase SQL'
                    : 'Deploy Render'}
            </button>
          ))}
        </div>
      </header>

      <main className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6">
        {activeSection !== 'mapa' ? (
          <ApiDeployPanel
            activeTab={activeSection}
            storageMode={storageMode}
            puntos={puntos}
          />
        ) : (
          <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-12">
            {/* Left Sidebar: Search, Task Filter, and Tree Points List */}
            <section
              aria-label="Listado de puntos de arbolado"
              className="flex flex-col rounded-xl border border-slate-200 bg-white lg:col-span-5 xl:col-span-4 lg:h-[calc(100vh-128px)] lg:min-h-[540px]"
            >
              <div className="border-b border-slate-200 p-4 space-y-3">
                <div className="flex items-baseline justify-between gap-2">
                  <h1 className="font-display text-base font-semibold text-slate-900">
                    Puntos de arbolado
                  </h1>
                  <span className="text-xs text-slate-500 tabular-nums">
                    {storageMode === 'supabase' ? 'Supabase' : 'Vista previa local'} ·{' '}
                    {allCounts.total} registros
                  </span>
                </div>

                {/* Search input */}
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar nombre, código o especie..."
                    aria-label="Buscar puntos de arbolado"
                    className="w-full rounded-lg border border-slate-200 bg-slate-50/70 py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700/20"
                  />
                </div>

                {/* Segmented task filter: Todas / Riego / Poda */}
                <div
                  role="group"
                  aria-label="Filtrar por tarea"
                  className="grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1"
                >
                  <button
                    type="button"
                    onClick={() => setFilterTarea('todas')}
                    className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                      filterTarea === 'todas'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Todas ({allCounts.total})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterTarea('riego')}
                    className={`inline-flex items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                      filterTarea === 'riego'
                        ? 'bg-white text-sky-800 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Droplets className="h-3.5 w-3.5 text-sky-700" />
                    Riego ({allCounts.riego})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterTarea('poda')}
                    className={`inline-flex items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                      filterTarea === 'poda'
                        ? 'bg-white text-amber-800 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Scissors className="h-3.5 w-3.5 text-amber-700" />
                    Poda ({allCounts.poda})
                  </button>
                </div>
              </div>

              {loadError && (
                <div className="mx-4 mt-3 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-800">
                  {loadError}
                </div>
              )}

              {/* Scrollable points list */}
              <div className="flex-1 divide-y divide-slate-100 overflow-y-auto">
                {loading ? (
                  <div className="space-y-3 p-4">
                    {[1, 2, 3].map((idx) => (
                      <div key={idx} className="animate-pulse space-y-2 py-2">
                        <div className="h-4 w-3/4 rounded bg-slate-200" />
                        <div className="h-3 w-1/2 rounded bg-slate-100" />
                        <div className="h-3 w-1/3 rounded bg-slate-100" />
                      </div>
                    ))}
                  </div>
                ) : puntos.length === 0 ? (
                  <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
                    <MapPin className="mb-3 h-7 w-7 text-slate-300" />
                    <p className="font-display text-sm font-semibold text-slate-900">
                      No hay puntos para mostrar
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Agregá un nuevo punto o restaurá los tres ejemplos iniciales.
                    </p>
                    <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={openCreateModal}
                        className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-800 whitespace-nowrap"
                      >
                        Agregar punto
                      </button>
                      <button
                        type="button"
                        onClick={handleRestoreSeed}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Cargar 3 ejemplos
                      </button>
                    </div>
                  </div>
                ) : (
                  puntos.map((punto) => {
                    const isSelected = punto.id === selectedId;
                    const isRiego = punto.tarea === 'riego';
                    return (
                      <div
                        key={punto.id}
                        onClick={() => setSelectedId(punto.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setSelectedId(punto.id);
                          }
                        }}
                        role="button"
                        tabIndex={0}
                        aria-pressed={isSelected}
                        className={`group cursor-pointer px-4 py-3.5 transition-colors focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-emerald-700 ${
                          isSelected
                            ? 'bg-emerald-50/75 ring-1 ring-inset ring-emerald-700/20'
                            : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-display text-sm font-semibold text-slate-900">
                              {punto.nombre_punto}
                            </div>

                            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-600">
                              <span className="font-mono font-medium text-slate-800">
                                {punto.codigo_arbol}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span className="truncate italic">{punto.especie}</span>
                              <span aria-hidden="true">·</span>
                              <span
                                className={`inline-flex items-center gap-1 font-medium ${
                                  isRiego ? 'text-sky-700' : 'text-amber-700'
                                }`}
                              >
                                {isRiego ? (
                                  <Droplets className="h-3 w-3" />
                                ) : (
                                  <Scissors className="h-3 w-3" />
                                )}
                                {isRiego ? 'Riego' : 'Poda'}
                              </span>
                            </div>

                            <div className="mt-1.5 font-mono text-xs tabular-nums text-slate-500">
                              {punto.latitud.toFixed(6)}, {punto.longitud.toFixed(6)}
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openEditModal(punto);
                              }}
                              aria-label={`Editar ${punto.nombre_punto}`}
                              title="Editar punto"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-white hover:text-emerald-700 focus-visible:outline-2 focus-visible:outline-emerald-700"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeletingPunto(punto);
                              }}
                              aria-label={`Eliminar ${punto.nombre_punto}`}
                              title="Eliminar punto"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-white hover:text-red-700 focus-visible:outline-2 focus-visible:outline-emerald-700"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </section>

            {/* Right Main Viewport: Google Maps */}
            <section
              aria-label="Mapa interactivo de Google Maps"
              className="lg:col-span-7 xl:col-span-8 lg:h-[calc(100vh-128px)] lg:min-h-[540px]"
            >
              <TreeMapView
                apiKey={mapsApiKey}
                puntos={puntos}
                selectedPunto={selectedPunto}
                onSelectPunto={(p) => setSelectedId(p.id)}
              />
            </section>
          </div>
        )}
      </main>

      <PuntoFormModal
        open={formOpen}
        mode={formMode}
        initialPunto={editingPunto}
        saving={saving}
        serverError={formError}
        serverFields={formFields}
        onClose={() => setFormOpen(false)}
        onSubmit={handleSavePunto}
      />

      <DeleteConfirmModal
        punto={deletingPunto}
        deleting={deleting}
        onCancel={() => setDeletingPunto(null)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
