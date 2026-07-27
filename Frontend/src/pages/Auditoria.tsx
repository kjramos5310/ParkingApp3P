import { useCallback, useMemo, useState } from 'react';
import {
  Aviso,
  Boton,
  Campo,
  Celda,
  EncabezadoPagina,
  Entrada,
  Fila,
  Panel,
  Seleccion,
  SinDatos,
  Tabla,
} from '../components/ui';
import { useRecurso } from '../hooks/useRecurso';
import { auditoria as apiAuditoria } from '../lib/api';
import { useTenant } from '../lib/auth';
import type { EventoAuditoria } from '../lib/types';

/** Color por accion: distingue de un vistazo lo que crea, cambia o borra. */
const COLOR_ACCION: Record<string, string> = {
  CREATE: 'var(--color-led-free)',
  UPDATE: 'var(--color-led-held)',
  DELETE: 'var(--color-led-taken)',
  READ: 'var(--color-ink-faint)',
};

function colorDeAccion(accion: string): string {
  return COLOR_ACCION[accion.toUpperCase()] ?? 'var(--color-ink-faint)';
}

function formatearFecha(valor: string): string {
  const fecha = new Date(valor);
  return Number.isNaN(fecha.getTime())
    ? valor
    : fecha.toLocaleString('es-EC', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
}

export function Auditoria() {
  const tenant = useTenant();

  const cargar = useCallback(() => apiAuditoria.listar(tenant), [tenant]);
  const { datos, cargando, error, recargar } = useRecurso<EventoAuditoria[]>(cargar);

  const [servicio, setServicio] = useState('');
  const [accion, setAccion] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [detalle, setDetalle] = useState<number | null>(null);

  const eventos = useMemo(() => datos ?? [], [datos]);

  const servicios = useMemo(
    () => [...new Set(eventos.map((evento) => evento.servicio))].sort(),
    [eventos],
  );
  const acciones = useMemo(
    () => [...new Set(eventos.map((evento) => evento.accion))].sort(),
    [eventos],
  );

  const filtrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return eventos.filter((evento) => {
      if (servicio && evento.servicio !== servicio) return false;
      if (accion && evento.accion !== accion) return false;
      if (!texto) return true;
      return [evento.usuario, evento.entidad, evento.ip, evento.id_vehiculo]
        .filter(Boolean)
        .some((campo) => String(campo).toLowerCase().includes(texto));
    });
  }, [eventos, servicio, accion, busqueda]);

  return (
    <>
      <EncabezadoPagina
        titulo="Auditoria"
        descripcion="Quien hizo que, cuando y desde donde. Cada microservicio publica sus eventos a RabbitMQ y ms-auditoria los conserva."
        acciones={<Boton onClick={recargar}>Actualizar</Boton>}
      />

      {error && <Aviso tipo="error">{error}</Aviso>}

      <div className="grid sm:grid-cols-3 gap-4 mb-5">
        <Campo label="Servicio">
          <Seleccion value={servicio} onChange={(evento) => setServicio(evento.target.value)}>
            <option value="">Todos</option>
            {servicios.map((nombre) => (
              <option key={nombre} value={nombre}>
                {nombre}
              </option>
            ))}
          </Seleccion>
        </Campo>

        <Campo label="Accion">
          <Seleccion value={accion} onChange={(evento) => setAccion(evento.target.value)}>
            <option value="">Todas</option>
            {acciones.map((nombre) => (
              <option key={nombre} value={nombre}>
                {nombre}
              </option>
            ))}
          </Seleccion>
        </Campo>

        <Campo label="Buscar por usuario, entidad o IP">
          <Entrada
            value={busqueda}
            onChange={(evento) => setBusqueda(evento.target.value)}
            placeholder="admin, espacios, 190.0..."
          />
        </Campo>
      </div>

      <Panel>
        {cargando ? (
          <SinDatos mensaje="Cargando el historial de eventos..." />
        ) : filtrados.length === 0 ? (
          <SinDatos
            mensaje={
              eventos.length === 0
                ? 'Aun no hay eventos registrados para esta empresa.'
                : 'Ningun evento coincide con los filtros aplicados.'
            }
          />
        ) : (
          <Tabla columnas={['Fecha', 'Accion', 'Servicio', 'Entidad', 'Usuario', 'Origen', '']}>
            {filtrados.map((evento) => (
              <Fila key={evento.id}>
                <Celda className="font-data text-xs whitespace-nowrap">
                  {formatearFecha(evento.timestamp)}
                </Celda>
                <Celda>
                  <span className="inline-flex items-center gap-1.5 font-sign uppercase tracking-wider text-xs">
                    <span
                      className="inline-block size-2 rounded-full"
                      style={{ backgroundColor: colorDeAccion(evento.accion) }}
                      aria-hidden="true"
                    />
                    {evento.accion}
                  </span>
                </Celda>
                <Celda className="font-data text-xs">{evento.servicio}</Celda>
                <Celda>{evento.entidad}</Celda>
                <Celda>{evento.usuario ?? '—'}</Celda>
                <Celda className="font-data text-xs whitespace-nowrap">
                  {evento.ip}
                  <span className="block text-ink-faint">{evento.mac}</span>
                </Celda>
                <Celda>
                  {evento.datos && (
                    <div className="flex justify-end">
                      <Boton
                        onClick={() => setDetalle(detalle === evento.id ? null : evento.id)}
                        className="py-1"
                      >
                        {detalle === evento.id ? 'Ocultar' : 'Ver datos'}
                      </Boton>
                    </div>
                  )}
                </Celda>
              </Fila>
            ))}
          </Tabla>
        )}
      </Panel>

      {/* El payload completo del evento seleccionado */}
      {detalle !== null && (
        <Panel className="mt-4">
          <div className="px-4 py-3 border-b-2 border-line flex items-center justify-between">
            <span className="eyebrow">Datos del evento #{detalle}</span>
            <Boton onClick={() => setDetalle(null)} className="py-1">
              Cerrar
            </Boton>
          </div>
          <pre className="font-data text-xs p-4 overflow-x-auto whitespace-pre-wrap break-words">
            {JSON.stringify(filtrados.find((evento) => evento.id === detalle)?.datos ?? {}, null, 2)}
          </pre>
        </Panel>
      )}

      <p className="text-xs text-ink-faint mt-4">
        Mostrando {filtrados.length} de {eventos.length} eventos de <strong>{tenant}</strong>.
      </p>
    </>
  );
}
