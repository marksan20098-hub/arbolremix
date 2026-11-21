import { useEffect, useState } from 'react';
import {
  APILoadingStatus,
  APIProvider,
  AdvancedMarker,
  InfoWindow,
  Map as GoogleMap,
  Pin,
  useAdvancedMarkerRef,
  useApiLoadingStatus,
  useMap,
} from '@vis.gl/react-google-maps';
import {
  Compass,
  Crosshair,
  Droplets,
  ExternalLink,
  LocateFixed,
  MapPin,
  Scissors,
} from 'lucide-react';
import type { PuntoArbolado } from '../types/punto.ts';

interface TreeMapViewProps {
  apiKey: string;
  puntos: PuntoArbolado[];
  selectedPunto: PuntoArbolado | null;
  onSelectPunto: (punto: PuntoArbolado) => void;
  onPickCoordinates?: (lat: number, lng: number) => void;
  pickMode?: boolean;
  onTogglePickMode?: () => void;
}

const DEFAULT_CENTER = { lat: -34.5958, lng: -58.4021 };

function buildGoogleMapsExternalUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng}`)}`;
}

function MapStatusGuard() {
  const status = useApiLoadingStatus();
  if (status === APILoadingStatus.FAILED || status === APILoadingStatus.AUTH_FAILURE) {
    return (
      <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-50/95 p-6 text-center">
        <div className="max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <MapPin className="mx-auto mb-3 h-7 w-7 text-slate-400" />
          <h3 className="font-display text-base font-semibold text-slate-900">
            No se pudo cargar Google Maps
          </h3>
          <p className="mt-1.5 text-sm text-slate-600">
            Verificá que <code className="font-mono text-xs">VITE_GOOGLE_MAPS_API_KEY</code> esté
            habilitada para Maps JavaScript API y autorice este dominio.
          </p>
        </div>
      </div>
    );
  }
  return null;
}

function MapCameraController({
  puntos,
  selectedPunto,
  fitTrigger,
}: {
  puntos: PuntoArbolado[];
  selectedPunto: PuntoArbolado | null;
  fitTrigger: number;
}) {
  const map = useMap();

  useEffect(() => {
    if (!map || !selectedPunto) return;
    map.panTo({ lat: selectedPunto.latitud, lng: selectedPunto.longitud });
    const currentZoom = map.getZoom() ?? 12;
    if (currentZoom < 15) {
      map.setZoom(15);
    }
  }, [map, selectedPunto]);

  useEffect(() => {
    if (!map || fitTrigger === 0 || puntos.length === 0) return;
    if (puntos.length === 1) {
      map.panTo({ lat: puntos[0].latitud, lng: puntos[0].longitud });
      map.setZoom(15);
      return;
    }
    const lats = puntos.map((p) => p.latitud);
    const lngs = puntos.map((p) => p.longitud);
    map.fitBounds(
      {
        north: Math.max(...lats),
        south: Math.min(...lats),
        east: Math.max(...lngs),
        west: Math.min(...lngs),
      },
      72
    );
  }, [map, puntos, fitTrigger]);

  return null;
}

function TreeMarkerItem({
  punto,
  isSelected,
  onSelect,
}: {
  punto: PuntoArbolado;
  isSelected: boolean;
  onSelect: (punto: PuntoArbolado) => void;
}) {
  const [markerRef, marker] = useAdvancedMarkerRef();

  const isRiego = punto.tarea === 'riego';
  const background = isSelected ? '#15803D' : isRiego ? '#0284C7' : '#D97706';
  const borderColor = isSelected ? '#14532D' : isRiego ? '#075985' : '#92400E';

  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={{ lat: punto.latitud, lng: punto.longitud }}
        title={`${punto.nombre_punto} (${punto.codigo_arbol})`}
        zIndex={isSelected ? 100 : 10}
        onClick={() => onSelect(punto)}
      >
        <Pin
          background={background}
          borderColor={borderColor}
          glyphColor="#FFFFFF"
          scale={isSelected ? 1.25 : 1}
        />
      </AdvancedMarker>

      {isSelected && marker && (
        <InfoWindow
          anchor={marker}
          maxWidth={300}
          headerContent={
            <div className="pr-2 font-display text-sm font-semibold text-slate-900">
              {punto.nombre_punto}
            </div>
          }
        >
          <div className="space-y-1.5 pt-1 text-xs text-slate-700">
            <div className="flex items-center gap-1.5 text-slate-600">
              <span className="font-mono font-medium text-slate-900">{punto.codigo_arbol}</span>
              <span aria-hidden="true">·</span>
              <span className="italic">{punto.especie}</span>
            </div>
            <div className="flex items-center gap-1.5 font-medium text-slate-800">
              {isRiego ? (
                <Droplets className="h-3.5 w-3.5 text-sky-700" />
              ) : (
                <Scissors className="h-3.5 w-3.5 text-amber-700" />
              )}
              <span>Tarea: {isRiego ? 'Riego' : 'Poda'}</span>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-1.5">
              <span className="font-mono text-[11px] tabular-nums text-slate-500">
                {punto.latitud.toFixed(6)}, {punto.longitud.toFixed(6)}
              </span>
              <a
                href={buildGoogleMapsExternalUrl(punto.latitud, punto.longitud)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-medium text-emerald-700 hover:underline whitespace-nowrap"
              >
                Google Maps
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        </InfoWindow>
      )}
    </>
  );
}

export function TreeMapView({
  apiKey,
  puntos,
  selectedPunto,
  onSelectPunto,
  onPickCoordinates,
  pickMode = false,
  onTogglePickMode,
}: TreeMapViewProps) {
  const [fitTrigger, setFitTrigger] = useState(0);

  if (!apiKey) {
    return (
      <div className="flex h-full min-h-[480px] w-full flex-col items-center justify-center rounded-xl border border-slate-200 bg-white p-8 text-center">
        <Compass className="mb-3 h-8 w-8 text-slate-400" />
        <h3 className="font-display text-base font-semibold text-slate-900">
          Clave de Google Maps pendiente
        </h3>
        <p className="mt-1.5 max-w-md text-sm text-slate-600">
          Configurá <code className="font-mono text-xs">VITE_GOOGLE_MAPS_API_KEY</code> en las
          variables de entorno de Render para visualizar el mapa interactivo y los marcadores.
        </p>
        {selectedPunto && (
          <a
            href={buildGoogleMapsExternalUrl(selectedPunto.latitud, selectedPunto.longitud)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-800"
          >
            Abrir {selectedPunto.nombre_punto} en Google Maps
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="relative h-full min-h-[480px] w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
      <APIProvider apiKey={apiKey} libraries={['marker']} language="es" region="AR">
        <MapStatusGuard />

        <GoogleMap
          mapId="DEMO_MAP_ID"
          defaultCenter={
            selectedPunto
              ? { lat: selectedPunto.latitud, lng: selectedPunto.longitud }
              : DEFAULT_CENTER
          }
          defaultZoom={selectedPunto ? 15 : 12}
          gestureHandling="greedy"
          mapTypeControl={true}
          streetViewControl={true}
          fullscreenControl={true}
          internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
          style={{ width: '100%', height: '100%' }}
          onClick={(ev) => {
            if (pickMode && onPickCoordinates && ev.detail.latLng) {
              onPickCoordinates(
                Number(ev.detail.latLng.lat.toFixed(6)),
                Number(ev.detail.latLng.lng.toFixed(6))
              );
            }
          }}
        >
          <MapCameraController
            puntos={puntos}
            selectedPunto={selectedPunto}
            fitTrigger={fitTrigger}
          />

          {puntos.map((punto) => (
            <TreeMarkerItem
              key={punto.id}
              punto={punto}
              isSelected={selectedPunto?.id === punto.id}
              onSelect={onSelectPunto}
            />
          ))}
        </GoogleMap>
      </APIProvider>

      {/* Pick mode helper banner */}
      {pickMode && (
        <div className="pointer-events-none absolute inset-x-3 top-14 flex justify-center">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/95 px-3.5 py-2 text-xs font-medium text-emerald-900 shadow-sm backdrop-blur-sm">
            Hacé clic en cualquier ubicación del mapa para crear un nuevo punto en esas coordenadas.
          </div>
        </div>
      )}

      {/* Overlay controls */}
      <div className="pointer-events-none absolute inset-x-3 bottom-3 flex flex-wrap items-end justify-between gap-3">
        {selectedPunto ? (
          <div className="pointer-events-auto max-w-md rounded-lg border border-slate-200 bg-white/95 px-3.5 py-2.5 shadow-sm backdrop-blur-sm">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="font-mono font-medium text-emerald-700">
                {selectedPunto.codigo_arbol}
              </span>
              <span aria-hidden="true">·</span>
              <span>{selectedPunto.tarea === 'riego' ? 'Riego' : 'Poda'}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                {selectedPunto.latitud.toFixed(6)}, {selectedPunto.longitud.toFixed(6)}
              </span>
            </div>
            <div className="mt-0.5 flex items-center justify-between gap-3">
              <span className="truncate font-display text-sm font-semibold text-slate-900">
                {selectedPunto.nombre_punto}
              </span>
              <a
                href={buildGoogleMapsExternalUrl(selectedPunto.latitud, selectedPunto.longitud)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-emerald-700 hover:underline whitespace-nowrap"
              >
                Abrir
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        ) : (
          <div className="pointer-events-auto rounded-lg border border-slate-200 bg-white/95 px-3.5 py-2 text-xs text-slate-600 shadow-sm backdrop-blur-sm">
            Seleccioná un punto del listado para centrar el marcador en Google Maps.
          </div>
        )}

        <div className="pointer-events-auto flex items-center gap-2">
          {onTogglePickMode && (
            <button
              type="button"
              onClick={onTogglePickMode}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium shadow-sm transition-colors focus-visible:outline-2 focus-visible:outline-emerald-700 whitespace-nowrap shrink-0 ${
                pickMode
                  ? 'border-emerald-700 bg-emerald-700 text-white hover:bg-emerald-800'
                  : 'border-slate-200 bg-white/95 text-slate-800 hover:bg-slate-50'
              }`}
            >
              <Crosshair className="h-3.5 w-3.5" />
              {pickMode ? 'Cancelar selección' : 'Marcar en mapa'}
            </button>
          )}

          {puntos.length > 0 && (
            <button
              type="button"
              onClick={() => setFitTrigger((c) => c + 1)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-xs font-medium text-slate-800 shadow-sm transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-emerald-700 whitespace-nowrap shrink-0"
            >
              <LocateFixed className="h-3.5 w-3.5 text-emerald-700" />
              Encuadrar todos
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
