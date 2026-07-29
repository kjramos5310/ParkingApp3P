import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';
import type { EstadoEspacio } from '../lib/types';

/* -------------------------------------------------------------------------- */
/* Botones                                                                    */
/* -------------------------------------------------------------------------- */

type VarianteBoton = 'primario' | 'secundario' | 'peligro';

const ESTILOS_BOTON: Record<VarianteBoton, string> = {
  primario: 'bg-hivis text-ink border-hivis-deep hover:bg-hivis-deep hover:text-white',
  secundario: 'bg-deck-raised text-ink border-line-strong hover:bg-deck-sunken',
  peligro: 'bg-deck-raised text-led-taken border-led-taken hover:bg-led-taken hover:text-white',
};

interface PropsBoton extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: VarianteBoton;
}

export function Boton({ variante = 'secundario', className = '', ...props }: PropsBoton) {
  return (
    <button
      {...props}
      className={`font-sign uppercase tracking-widest text-xs px-4 py-2 border-2 rounded-[3px] transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${ESTILOS_BOTON[variante]} ${className}`}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Formularios                                                                */
/* -------------------------------------------------------------------------- */

export function Campo({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="eyebrow block mb-1.5">{label}</span>
      {children}
    </label>
  );
}

const ESTILO_CONTROL =
  'w-full bg-white border-2 border-line-strong rounded-[3px] px-3 py-2 text-ink placeholder:text-ink-faint focus:border-ink outline-none';

export function Entrada(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${ESTILO_CONTROL} ${props.className ?? ''}`} />;
}

export function Seleccion(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${ESTILO_CONTROL} ${props.className ?? ''}`} />;
}

/* -------------------------------------------------------------------------- */
/* Estado de los espacios                                                     */
/* -------------------------------------------------------------------------- */

export const COLOR_ESTADO: Record<EstadoEspacio, string> = {
  DISPONIBLE: 'var(--color-led-free)',
  OCUPADO: 'var(--color-led-taken)',
  RESERVADO: 'var(--color-led-held)',
  MANTENIMIENTO: '#6b7280',
};

/** Piloto LED: el mismo codigo de color que cuelga sobre cada bahia real. */
export function Led({ estado }: { estado: EstadoEspacio }) {
  return (
    <span
      className="inline-block size-2.5 rounded-full shrink-0"
      style={{ backgroundColor: COLOR_ESTADO[estado] }}
      aria-hidden="true"
    />
  );
}

export function EtiquetaEstado({ estado }: { estado: EstadoEspacio }) {
  return (
    <span className="inline-flex items-center gap-1.5 font-sign uppercase tracking-wider text-xs">
      <Led estado={estado} />
      {estado}
    </span>
  );
}

/** Placa vehicular, renderizada como el artefacto fisico. */
export function Placa({ valor }: { valor: string }) {
  return <span className="plate">{valor}</span>;
}

/* -------------------------------------------------------------------------- */
/* Contenedores                                                               */
/* -------------------------------------------------------------------------- */

export function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <section className={`bg-deck-raised border-2 border-line rounded-[3px] ${className}`}>
      {children}
    </section>
  );
}

export function EncabezadoPagina({
  titulo,
  descripcion,
  acciones,
}: {
  titulo: string;
  descripcion: string;
  acciones?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 mb-6">
      <div>
        <h1 className="text-3xl leading-none">{titulo}</h1>
        <p className="text-ink-muted mt-1.5 max-w-prose">{descripcion}</p>
      </div>
      {acciones}
    </header>
  );
}

/** Una pantalla vacia es una invitacion a actuar, no un mensaje de error. */
export function SinDatos({ mensaje, accion }: { mensaje: string; accion?: ReactNode }) {
  return (
    <div className="text-center py-14 px-6">
      <p className="text-ink-muted">{mensaje}</p>
      {accion && <div className="mt-4">{accion}</div>}
    </div>
  );
}

export function Aviso({ tipo, children }: { tipo: 'error' | 'info'; children: ReactNode }) {
  const estilo =
    tipo === 'error'
      ? 'border-led-taken text-led-taken bg-led-taken/5'
      : 'border-line-strong text-ink-muted bg-deck-sunken';
  return (
    <div role={tipo === 'error' ? 'alert' : 'status'} className={`border-l-4 px-4 py-2.5 text-sm ${estilo}`}>
      {children}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Tabla                                                                      */
/* -------------------------------------------------------------------------- */

export function Tabla({ columnas, children }: { columnas: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b-2 border-line-strong">
            {columnas.map((columna) => (
              <th key={columna} className="eyebrow text-left px-4 py-2.5 whitespace-nowrap">
                {columna}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function Fila({ children }: { children: ReactNode }) {
  return <tr className="border-b border-line last:border-0 hover:bg-deck-sunken/60">{children}</tr>;
}

export function Celda({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <td className={`px-4 py-2.5 align-middle ${className}`}>{children}</td>;
}

/* -------------------------------------------------------------------------- */
/* Dialogo                                                                    */
/* -------------------------------------------------------------------------- */

export function Dialogo({
  titulo,
  onCerrar,
  children,
}: {
  titulo: string;
  onCerrar: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-board/70 flex items-start sm:items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label={titulo}
      onClick={onCerrar}
    >
      <div
        className="bg-deck-raised border-2 border-ink rounded-[3px] w-full max-w-lg my-8"
        onClick={(evento) => evento.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b-2 border-line px-5 py-3">
          <h2 className="text-lg">{titulo}</h2>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="text-ink-muted hover:text-ink text-xl leading-none px-1"
          >
            ×
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
