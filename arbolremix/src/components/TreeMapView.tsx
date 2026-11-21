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
import { Compass, Droplets, LocateFixed, MapPin, Scissors } from 'lucide-react';
import type { PuntoArbolado } from '../types/punto.ts';

interface TreeMapViewProps {
  apiKey: string;
  puntos: PuntoArbolado[];
  selectedPunto: PuntoArbolado | null;
  onSelectPunto: (punto: PuntoArbolado) => void;
  onPickCoordinates?: (lat: number, lng: number) => void;
  pickMode?: boolean;
}

const DEFAULT_CENTER = { lat: -34.5958, lng: -58.4021 };

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
            habilitada para Maps JavaScript API y sin restricciones que bloqueen este dominio.
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
          maxWidth={290}
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
            <div className="border-t border-slate-100 pt-1.5 font-mono text-[11px] text-slate-500">
              {punto.latitud.toFixed(6)}, {punto.longitud.toFixed(6)}
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
          variables de entorno para visualizar el mapa interactivo y los marcadores.
        </p>
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
          streetViewControl={false}
          fullscreenControl={true}
          internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
          className="h-full w-full"
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

      {/* Overlay controls */}
      <div className="pointer-events-none absolute inset-x-3 bottom-3 flex flex-wrap items-end justify-between gap-3">
        {selectedPunto ? (
          <div className="pointer-events-auto max-w-md rounded-lg border border-slate-200 bg-white/95 px-3.5 py-2.5 shadow-sm backdrop-blur-sm">
            <div className="flex items-center gap-2 text-xs text-slate-500">
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
            <div className="mt-0.5 truncate font-display text-sm font-semibold text-slate-900">
              {selectedPunto.nombre_punto}
            </div>
          </div>
        ) : (
          <div className="pointer-events-auto rounded-lg border border-slate-200 bg-white/95 px-3.5 py-2 text-xs text-slate-600 shadow-sm backdrop-blur-sm">
            Seleccioná un punto del listado para centrar el marcador en el mapa.
          </div>
        )}

        {puntos.length > 0 && (
          <button
            type="button"
            onClick={() => setFitTrigger((c) => c + 1)}
            className="pointer-events-auto inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-xs font-medium text-slate-800 shadow-sm transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-emerald-700 whitespace-nowrap shrink-0"
          >
            <LocateFixed className="h-3.5 w-3.5 text-emerald-700" />
            Encuadrar todos
          </button>
        )}
      </div>
    </div>
  );
}
