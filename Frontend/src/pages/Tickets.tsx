import { useCallback, useMemo, useState, type FormEvent } from 'react';
import {
  Aviso,
  Boton,
  Campo,
  Celda,
  Dialogo,
  EncabezadoPagina,
  Entrada,
  Fila,
  Panel,
  Placa,
  Seleccion,
  SinDatos,
  Tabla,
} from '../components/ui';
import { useRecurso } from '../hooks/useRecurso';
import { espacios as apiEspacios, tickets as apiTickets, type TicketPayload } from '../lib/api';
import { useTenant } from '../lib/auth';
import type { Espacio, Ticket } from '../lib/types';

function formatearFecha(valor?: string): string {
  if (!valor) return '—';
  return new Date(valor).toLocaleString('es-EC', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatearValor(valor?: number): string {
  return typeof valor === 'number' ? `$ ${valor.toFixed(2)}` : '—';
}

/** Tiempo transcurrido desde el ingreso, en el formato que usa el operador. */
function permanencia(desde: string, hasta?: string): string {
  const inicio = new Date(desde).getTime();
  const fin = hasta ? new Date(hasta).getTime() : Date.now();
  const minutos = Math.max(0, Math.floor((fin - inicio) / 60000));
  const horas = Math.floor(minutos / 60);
  return horas > 0 ? `${horas} h ${minutos % 60} min` : `${minutos} min`;
}

export function Tickets() {
  const tenant = useTenant();

  const cargarTickets = useCallback(() => apiTickets.listar(tenant), [tenant]);
  const cargarEspacios = useCallback(() => apiEspacios.listar(tenant), [tenant]);

  const { datos, cargando, error, recargar } = useRecurso<Ticket[]>(cargarTickets);
  const { datos: espacios } = useRecurso<Espacio[]>(cargarEspacios);

  const [soloActivos, setSoloActivos] = useState(true);
  const [dialogoAbierto, setDialogoAbierto] = useState(false);
  const [formulario, setFormulario] = useState<TicketPayload>({
    placa: '',
    dni: '',
    idEspacio: '',
    nombreZona: '',
  });
  const [errorFormulario, setErrorFormulario] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const disponibles = useMemo(
    () => (espacios ?? []).filter((espacio) => espacio.active && espacio.estado === 'DISPONIBLE'),
    [espacios],
  );

  const lista = useMemo(() => {
    const base = datos ?? [];
    return soloActivos ? base.filter((ticket) => ticket.activo) : base;
  }, [datos, soloActivos]);

  function abrirIngreso() {
    const primero = disponibles[0];
    setFormulario({
      placa: '',
      dni: '',
      idEspacio: primero?.id ?? '',
      nombreZona: primero?.nombreZona ?? '',
    });
    setErrorFormulario(null);
    setDialogoAbierto(true);
  }

  function seleccionarEspacio(idEspacio: string) {
    const espacio = disponibles.find((candidato) => candidato.id === idEspacio);
    // La zona se deriva del espacio: el operador no deberia teclearla dos veces.
    setFormulario((actual) => ({
      ...actual,
      idEspacio,
      nombreZona: espacio?.nombreZona ?? '',
    }));
  }

  async function registrarIngreso(evento: FormEvent) {
    evento.preventDefault();
    setErrorFormulario(null);
    setGuardando(true);
    try {
      await apiTickets.crear(tenant, {
        ...formulario,
        placa: formulario.placa.trim().toUpperCase(),
        dni: formulario.dni.trim(),
      });
      setDialogoAbierto(false);
      recargar();
    } catch (fallo) {
      setErrorFormulario(fallo instanceof Error ? fallo.message : 'No se pudo registrar el ingreso.');
    } finally {
      setGuardando(false);
    }
  }

  async function registrarSalida(ticket: Ticket) {
    if (!confirm(`Registrar la salida del vehiculo ${ticket.placa}?`)) return;
    try {
      await apiTickets.registrarSalida(tenant, ticket.id);
      recargar();
    } catch (fallo) {
      alert(fallo instanceof Error ? fallo.message : 'No se pudo registrar la salida.');
    }
  }

  return (
    <>
      <EncabezadoPagina
        titulo="Tickets"
        descripcion="Entrada y salida de vehiculos. El cobro se calcula al cerrar el ticket."
        acciones={
          <Boton variante="primario" onClick={abrirIngreso} disabled={disponibles.length === 0}>
            Registrar ingreso
          </Boton>
        }
      />

      {error && <Aviso tipo="error">{error}</Aviso>}

      {disponibles.length === 0 && !cargando && (
        <div className="mb-4">
          <Aviso tipo="info">
            No hay plazas libres en este momento, asi que no se puede registrar un ingreso nuevo.
          </Aviso>
        </div>
      )}

      <label className="flex items-center gap-2 mb-4 text-sm select-none w-fit">
        <input
          type="checkbox"
          checked={soloActivos}
          onChange={(evento) => setSoloActivos(evento.target.checked)}
          className="size-4 accent-[var(--color-hivis)]"
        />
        Ver solo los tickets abiertos
      </label>

      <Panel>
        {cargando ? (
          <SinDatos mensaje="Cargando tickets..." />
        ) : lista.length === 0 ? (
          <SinDatos
            mensaje={
              soloActivos
                ? 'No hay vehiculos dentro del parqueadero en este momento.'
                : 'Todavia no se ha emitido ningun ticket.'
            }
          />
        ) : (
          <Tabla columnas={['Placa', 'Documento', 'Zona', 'Ingreso', 'Salida', 'Permanencia', 'Cobro', '']}>
            {lista.map((ticket) => (
              <Fila key={ticket.id}>
                <Celda>
                  <Placa valor={ticket.placa} />
                </Celda>
                <Celda className="font-data text-xs">{ticket.dni}</Celda>
                <Celda>{ticket.nombreZona}</Celda>
                <Celda className="font-data text-xs whitespace-nowrap">
                  {formatearFecha(ticket.fechaHoraIngreso)}
                </Celda>
                <Celda className="font-data text-xs whitespace-nowrap">
                  {formatearFecha(ticket.fechaHoraSalida)}
                </Celda>
                <Celda className="font-data text-xs whitespace-nowrap">
                  {permanencia(ticket.fechaHoraIngreso, ticket.fechaHoraSalida)}
                </Celda>
                <Celda className="font-data text-xs tabular-nums">
                  {formatearValor(ticket.valorRecaudado)}
                </Celda>
                <Celda>
                  {ticket.activo && (
                    <div className="flex justify-end">
                      <Boton onClick={() => registrarSalida(ticket)}>Registrar salida</Boton>
                    </div>
                  )}
                </Celda>
              </Fila>
            ))}
          </Tabla>
        )}
      </Panel>

      {dialogoAbierto && (
        <Dialogo titulo="Registrar ingreso" onCerrar={() => setDialogoAbierto(false)}>
          <form onSubmit={registrarIngreso} className="space-y-4">
            {errorFormulario && <Aviso tipo="error">{errorFormulario}</Aviso>}

            <Campo label="Placa">
              <Entrada
                value={formulario.placa}
                onChange={(evento) => setFormulario({ ...formulario, placa: evento.target.value })}
                placeholder="ABC-1234"
                className="font-data uppercase"
                required
              />
            </Campo>

            <Campo label="Documento del conductor">
              <Entrada
                value={formulario.dni}
                onChange={(evento) => setFormulario({ ...formulario, dni: evento.target.value })}
                placeholder="1712345678"
                className="font-data"
                required
              />
            </Campo>

            <Campo label="Espacio asignado">
              <Seleccion
                value={formulario.idEspacio}
                onChange={(evento) => seleccionarEspacio(evento.target.value)}
                required
              >
                {disponibles.map((espacio) => (
                  <option key={espacio.id} value={espacio.id}>
                    {espacio.codigo} · {espacio.nombreZona} · {espacio.tipo}
                  </option>
                ))}
              </Seleccion>
            </Campo>

            <p className="text-xs text-ink-faint">
              El vehiculo y el conductor deben estar registrados previamente. Al confirmar, la plaza
              pasa a ocupada y el cambio aparece en el mapa al instante.
            </p>

            <div className="flex justify-end gap-2 pt-1">
              <Boton type="button" onClick={() => setDialogoAbierto(false)}>
                Cancelar
              </Boton>
              <Boton type="submit" variante="primario" disabled={guardando}>
                {guardando ? 'Registrando...' : 'Registrar ingreso'}
              </Boton>
            </div>
          </form>
        </Dialogo>
      )}
    </>
  );
}
