import { useCallback, useMemo, useState, type FormEvent } from 'react';
import {
  Aviso,
  Boton,
  Campo,
  Celda,
  Dialogo,
  EncabezadoPagina,
  Entrada,
  EtiquetaEstado,
  Fila,
  Panel,
  Seleccion,
  SinDatos,
  Tabla,
} from '../components/ui';
import { useRecurso } from '../hooks/useRecurso';
import { espacios as apiEspacios, zonas as apiZonas, type EspacioPayload } from '../lib/api';
import { useAuth, useTenant } from '../lib/auth';
import type { Espacio, EstadoEspacio, TipoEspacio, Zona } from '../lib/types';

const TIPOS: TipoEspacio[] = ['AUTO', 'MOTO', 'BUSETA', 'BUS', 'CAMION'];
const ESTADOS: EstadoEspacio[] = ['DISPONIBLE', 'OCUPADO', 'RESERVADO'];

export function Espacios() {
  const tenant = useTenant();
  const { esAdmin } = useAuth();

  const cargarEspacios = useCallback(() => apiEspacios.listar(tenant), [tenant]);
  const cargarZonas = useCallback(() => apiZonas.listar(tenant), [tenant]);

  const { datos, cargando, error, recargar } = useRecurso<Espacio[]>(cargarEspacios);
  const { datos: zonas } = useRecurso<Zona[]>(cargarZonas);

  const [filtroZona, setFiltroZona] = useState('');
  const [dialogoAbierto, setDialogoAbierto] = useState(false);
  const [formulario, setFormulario] = useState<EspacioPayload>({ nombre: '', tipo: 'AUTO', idZona: '' });
  const [errorFormulario, setErrorFormulario] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const zonasActivas = useMemo(() => (zonas ?? []).filter((zona) => zona.active), [zonas]);

  const lista = useMemo(() => {
    const base = datos ?? [];
    return filtroZona ? base.filter((espacio) => espacio.idZona === filtroZona) : base;
  }, [datos, filtroZona]);

  function abrirCreacion() {
    setFormulario({ nombre: '', tipo: 'AUTO', idZona: zonasActivas[0]?.id ?? '' });
    setErrorFormulario(null);
    setDialogoAbierto(true);
  }

  async function crear(evento: FormEvent) {
    evento.preventDefault();
    setErrorFormulario(null);
    setGuardando(true);
    try {
      await apiEspacios.crear(tenant, formulario);
      setDialogoAbierto(false);
      recargar();
    } catch (fallo) {
      setErrorFormulario(fallo instanceof Error ? fallo.message : 'No se pudo crear el espacio.');
    } finally {
      setGuardando(false);
    }
  }

  async function cambiarEstado(espacio: Espacio, estado: EstadoEspacio) {
    try {
      await apiEspacios.cambiarEstado(tenant, espacio.id, estado);
      recargar();
    } catch (fallo) {
      alert(fallo instanceof Error ? fallo.message : 'No se pudo cambiar el estado.');
    }
  }

  async function eliminar(espacio: Espacio) {
    if (!confirm(`Deshabilitar el espacio ${espacio.codigo}?`)) return;
    try {
      await apiEspacios.eliminar(tenant, espacio.id);
      recargar();
    } catch (fallo) {
      alert(fallo instanceof Error ? fallo.message : 'No se pudo deshabilitar el espacio.');
    }
  }

  return (
    <>
      <EncabezadoPagina
        titulo="Espacios"
        descripcion="Plazas individuales, su tipo de vehiculo y su estado de ocupacion."
        acciones={
          esAdmin && (
            <Boton variante="primario" onClick={abrirCreacion} disabled={zonasActivas.length === 0}>
              Agregar espacio
            </Boton>
          )
        }
      />

      {error && <Aviso tipo="error">{error}</Aviso>}

      <div className="mb-4 max-w-xs">
        <Campo label="Filtrar por zona">
          <Seleccion value={filtroZona} onChange={(evento) => setFiltroZona(evento.target.value)}>
            <option value="">Todas las zonas</option>
            {(zonas ?? []).map((zona) => (
              <option key={zona.id} value={zona.id}>
                {zona.nombre}
              </option>
            ))}
          </Seleccion>
        </Campo>
      </div>

      <Panel>
        {cargando ? (
          <SinDatos mensaje="Cargando espacios..." />
        ) : lista.length === 0 ? (
          <SinDatos
            mensaje={
              zonasActivas.length === 0
                ? 'Primero crea una zona: cada espacio pertenece a una.'
                : 'No hay espacios que coincidan con el filtro.'
            }
          />
        ) : (
          <Tabla columnas={['Codigo', 'Zona', 'Tipo', 'Estado', 'Activo', '']}>
            {lista.map((espacio) => (
              <Fila key={espacio.id}>
                <Celda className="font-data text-xs">{espacio.codigo}</Celda>
                <Celda>{espacio.nombreZona}</Celda>
                <Celda className="font-sign uppercase tracking-wider text-xs">{espacio.tipo}</Celda>
                <Celda>
                  <EtiquetaEstado estado={espacio.estado} />
                </Celda>
                <Celda className="font-sign uppercase text-xs tracking-wider">
                  {espacio.active ? 'Si' : 'No'}
                </Celda>
                <Celda>
                  {esAdmin && espacio.active && (
                    <div className="flex flex-wrap gap-2 justify-end">
                      <Seleccion
                        aria-label={`Cambiar estado de ${espacio.codigo}`}
                        value={espacio.estado}
                        onChange={(evento) =>
                          cambiarEstado(espacio, evento.target.value as EstadoEspacio)
                        }
                        className="w-36 py-1 text-xs"
                      >
                        {ESTADOS.map((estado) => (
                          <option key={estado} value={estado}>
                            {estado}
                          </option>
                        ))}
                      </Seleccion>
                      <Boton variante="peligro" onClick={() => eliminar(espacio)}>
                        Quitar
                      </Boton>
                    </div>
                  )}
                </Celda>
              </Fila>
            ))}
          </Tabla>
        )}
      </Panel>

      {dialogoAbierto && (
        <Dialogo titulo="Agregar espacio" onCerrar={() => setDialogoAbierto(false)}>
          <form onSubmit={crear} className="space-y-4">
            {errorFormulario && <Aviso tipo="error">{errorFormulario}</Aviso>}

            <Campo label="Zona">
              <Seleccion
                value={formulario.idZona}
                onChange={(evento) => setFormulario({ ...formulario, idZona: evento.target.value })}
                required
              >
                {zonasActivas.map((zona) => (
                  <option key={zona.id} value={zona.id}>
                    {zona.nombre} ({zona.espaciosDisponibles} libres de {zona.capacidad})
                  </option>
                ))}
              </Seleccion>
            </Campo>

            <Campo label="Nombre de referencia">
              <Entrada
                value={formulario.nombre}
                onChange={(evento) => setFormulario({ ...formulario, nombre: evento.target.value })}
                required
              />
            </Campo>

            <Campo label="Tipo de vehiculo">
              <Seleccion
                value={formulario.tipo}
                onChange={(evento) => setFormulario({ ...formulario, tipo: evento.target.value })}
              >
                {TIPOS.map((tipo) => (
                  <option key={tipo} value={tipo}>
                    {tipo}
                  </option>
                ))}
              </Seleccion>
            </Campo>

            <p className="text-xs text-ink-faint">
              El codigo se genera automaticamente a partir del codigo de la zona y del numero de
              plaza. La zona no puede superar su capacidad.
            </p>

            <div className="flex justify-end gap-2 pt-1">
              <Boton type="button" onClick={() => setDialogoAbierto(false)}>
                Cancelar
              </Boton>
              <Boton type="submit" variante="primario" disabled={guardando}>
                {guardando ? 'Guardando...' : 'Agregar espacio'}
              </Boton>
            </div>
          </form>
        </Dialogo>
      )}
    </>
  );
}
