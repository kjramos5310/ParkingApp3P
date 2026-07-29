import type { EstadoStream } from '../hooks/useEspaciosSSE';

interface Props {
  libres: number;
  ocupados: number;
  reservados: number;
  capacidad: number;
  estadoStream: EstadoStream;
}

const TEXTO_STREAM: Record<EstadoStream, string> = {
  conectando: 'Conectando',
  'en-vivo': 'En vivo',
  'sin-conexion': 'Reconectando',
};

const COLOR_STREAM: Record<EstadoStream, string> = {
  conectando: 'var(--color-hivis)',
  'en-vivo': 'var(--color-led-free)',
  'sin-conexion': 'var(--color-led-taken)',
};

function Lectura({ etiqueta, valor, color }: { etiqueta: string; valor: number; color: string }) {
  return (
    <div className="px-5 py-4 flex-1 min-w-[7rem]">
      <div className="font-sign text-4xl sm:text-5xl leading-none tabular-nums" style={{ color }}>
        {valor}
      </div>
      <div className="font-sign uppercase tracking-[0.18em] text-[0.65rem] text-white/55 mt-1.5">
        {etiqueta}
      </div>
    </div>
  );
}

/**
 * Tablero de ingreso: replica el panel luminoso que anuncia la disponibilidad
 * en la rampa de entrada. Es la primera lectura del operador, asi que muestra
 * los cuatro numeros que decide mirar y nada mas.
 */
export function TableroIngreso({ libres, ocupados, reservados, capacidad, estadoStream }: Props) {
  const ocupacion = capacidad > 0 ? Math.round(((ocupados + reservados) / capacidad) * 100) : 0;

  return (
    <section
      className="bg-board rounded-[3px] overflow-hidden"
      aria-label="Disponibilidad actual del parqueadero"
    >
      <div className="flex items-center justify-between px-5 py-2 border-b border-white/10">
        <span className="font-sign uppercase tracking-[0.2em] text-[0.65rem] text-white/50">
          Disponibilidad ahora
        </span>
        <span className="flex items-center gap-2 font-sign uppercase tracking-[0.15em] text-[0.65rem] text-white/70">
          <span
            className={`inline-block size-2 rounded-full ${estadoStream === 'en-vivo' ? 'live-pulse' : ''}`}
            style={{ backgroundColor: COLOR_STREAM[estadoStream] }}
            aria-hidden="true"
          />
          {TEXTO_STREAM[estadoStream]}
        </span>
      </div>

      <div className="flex flex-wrap divide-x divide-white/10">
        <Lectura etiqueta="Libres" valor={libres} color="var(--color-hivis)" />
        <Lectura etiqueta="Ocupados" valor={ocupados} color="#ffffff" />
        <Lectura etiqueta="Reservados" valor={reservados} color="#ffffff" />
        <Lectura etiqueta="Espacios totales" valor={capacidad} color="rgba(255,255,255,0.45)" />
      </div>

      {/* Franja de ocupacion: la misma lectura, en forma de barra */}
      <div className="px-5 pb-4">
        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-hivis transition-[width] duration-500"
            style={{ width: `${Math.min(ocupacion, 100)}%` }}
          />
        </div>
        <p className="font-sign uppercase tracking-[0.15em] text-[0.65rem] text-white/45 mt-2">
          {ocupacion}% de ocupacion
        </p>
      </div>
    </section>
  );
}
