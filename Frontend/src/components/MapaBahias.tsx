import { COLOR_ESTADO } from './ui';
import type { Espacio } from '../lib/types';

interface Props {
  espacios: Espacio[];
  /** Id del espacio que acaba de cambiar, para destellarlo una vez. */
  destacado: string | null;
  onSeleccionar?: (espacio: Espacio) => void;
}

/**
 * Mapa de bahias: cada plaza se dibuja como la bahia pintada que el operador
 * ve en el piso —lineas laterales, codigo estarcido y el piloto LED de estado—
 * de modo que la pantalla y la rampa se lean igual.
 */
function Bahia({
  espacio,
  destacado,
  onSeleccionar,
}: {
  espacio: Espacio;
  destacado: boolean;
  onSeleccionar?: (espacio: Espacio) => void;
}) {
  const color = COLOR_ESTADO[espacio.estado];
  const interactiva = Boolean(onSeleccionar);

  return (
    <button
      type="button"
      disabled={!interactiva}
      onClick={() => onSeleccionar?.(espacio)}
      title={`${espacio.codigo} · ${espacio.estado}${espacio.nombreZona ? ` · ${espacio.nombreZona}` : ''}`}
      aria-label={`Espacio ${espacio.codigo}, ${espacio.estado.toLowerCase()}`}
      className={`
        relative h-20 bg-deck-raised rounded-t-[3px]
        border-x-2 border-b-2 border-line-strong border-t-0
        flex flex-col items-center justify-center gap-1.5
        transition-transform
        ${interactiva ? 'hover:-translate-y-0.5 cursor-pointer' : 'cursor-default'}
        ${destacado ? 'bay-flash' : ''}
      `}
    >
      {/* Franja superior del color del estado: el tope pintado de la bahia */}
      <span className="absolute inset-x-0 top-0 h-1.5" style={{ backgroundColor: color }} aria-hidden="true" />

      <span className="font-sign text-lg leading-none tracking-wide">{espacio.codigo}</span>
      <span className="font-sign uppercase text-[0.6rem] tracking-[0.12em] text-ink-faint">
        {espacio.tipo}
      </span>
    </button>
  );
}

export function MapaBahias({ espacios, destacado, onSeleccionar }: Props) {
  // Agrupadas por zona: es como esta senalizado el parqueadero fisicamente.
  const porZona = new Map<string, Espacio[]>();
  for (const espacio of espacios) {
    const zona = espacio.nombreZona ?? 'Sin zona';
    const lista = porZona.get(zona) ?? [];
    lista.push(espacio);
    porZona.set(zona, lista);
  }

  return (
    <div className="space-y-7">
      {[...porZona.entries()].map(([zona, plazas]) => {
        const libres = plazas.filter((plaza) => plaza.estado === 'DISPONIBLE').length;
        return (
          <div key={zona}>
            <div className="flex items-baseline justify-between border-b-2 border-line-strong pb-1.5 mb-3">
              <h3 className="text-base">{zona}</h3>
              <span className="font-data text-xs text-ink-muted tabular-nums">
                {libres} / {plazas.length} libres
              </span>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-8 xl:grid-cols-10 gap-2">
              {plazas.map((plaza) => (
                <Bahia
                  key={plaza.id}
                  espacio={plaza}
                  destacado={destacado === plaza.id}
                  onSeleccionar={onSeleccionar}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Leyenda de los pilotos LED, con el mismo codigo de color del piso. */
export function LeyendaEstados() {
  const estados = [
    { estado: 'DISPONIBLE', texto: 'Libre' },
    { estado: 'OCUPADO', texto: 'Ocupado' },
    { estado: 'RESERVADO', texto: 'Reservado' },
    { estado: 'MANTENIMIENTO', texto: 'Mantenimiento' },
  ] as const;

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
      {estados.map(({ estado, texto }) => (
        <span key={estado} className="flex items-center gap-2 text-xs text-ink-muted">
          <span
            className="inline-block w-4 h-1.5 rounded-full"
            style={{ backgroundColor: COLOR_ESTADO[estado] }}
            aria-hidden="true"
          />
          {texto}
        </span>
      ))}
    </div>
  );
}
