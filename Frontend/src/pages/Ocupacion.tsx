import { useCallback, useMemo } from 'react';
import { LeyendaEstados, MapaBahias } from '../components/MapaBahias';
import { TableroIngreso } from '../components/TableroIngreso';
import { Aviso, EncabezadoPagina, Panel, SinDatos } from '../components/ui';
import { useEspaciosSSE } from '../hooks/useEspaciosSSE';
import { useRecurso } from '../hooks/useRecurso';
import { espacios as apiEspacios } from '../lib/api';
import { useTenant } from '../lib/auth';
import type { Espacio } from '../lib/types';

export function Ocupacion() {
  const tenant = useTenant();

  const cargar = useCallback(() => apiEspacios.listar(tenant), [tenant]);
  const { datos, cargando, error } = useRecurso<Espacio[]>(cargar);

  const { cambios, ultimoCambio, estado } = useEspaciosSSE(tenant);

  // La carga inicial da la foto; el stream SSE la mantiene al dia sin recargar.
  const espacios = useMemo(() => {
    const base = datos ?? [];
    if (cambios.size === 0) return base;
    return base.map((espacio) => cambios.get(espacio.id) ?? espacio);
  }, [datos, cambios]);

  const conteos = useMemo(() => {
    const activos = espacios.filter((espacio) => espacio.active);
    return {
      libres: activos.filter((espacio) => espacio.estado === 'DISPONIBLE').length,
      ocupados: activos.filter((espacio) => espacio.estado === 'OCUPADO').length,
      reservados: activos.filter((espacio) => espacio.estado === 'RESERVADO').length,
      capacidad: activos.length,
    };
  }, [espacios]);

  return (
    <>
      <EncabezadoPagina
        titulo="Ocupacion"
        descripcion="Estado de cada plaza, actualizado en el momento en que cambia."
      />

      <TableroIngreso {...conteos} estadoStream={estado} />

      {estado === 'sin-conexion' && (
        <div className="mt-4">
          <Aviso tipo="info">
            Se perdio el stream en vivo. Los numeros corresponden a la ultima lectura recibida;
            la conexion se reintenta sola.
          </Aviso>
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-3 mt-8 mb-4">
        <h2 className="text-xl">Mapa de bahias</h2>
        <LeyendaEstados />
      </div>

      {error && <Aviso tipo="error">{error}</Aviso>}

      {cargando ? (
        <Panel>
          <SinDatos mensaje="Cargando el mapa del parqueadero..." />
        </Panel>
      ) : espacios.length === 0 ? (
        <Panel>
          <SinDatos mensaje="Todavia no hay espacios registrados. Crea una zona y agrega sus plazas para verlas aqui." />
        </Panel>
      ) : (
        <MapaBahias espacios={espacios.filter((espacio) => espacio.active)} destacado={ultimoCambio} />
      )}
    </>
  );
}
