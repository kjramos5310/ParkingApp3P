import { useCallback, useState, type FormEvent } from 'react';
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
  Seleccion,
  SinDatos,
  Tabla,
} from '../components/ui';
import { useRecurso } from '../hooks/useRecurso';
import { zonas as apiZonas, type ZonaPayload } from '../lib/api';
import { useAuth, useTenant } from '../lib/auth';
import type { TipoZona, Zona } from '../lib/types';

const TIPOS: TipoZona[] = ['GENERAL', 'VIP', 'VISITANTES', 'PREFERENCIAL'];

const VALORES_INICIALES: ZonaPayload = {
  nombre: '',
  descripcion: '',
  capacidad: 20,
  tipo: 'GENERAL',
};

export function Zonas() {
  const tenant = useTenant();
  const { esAdmin } = useAuth();

  const cargar = useCallback(() => apiZonas.listar(tenant), [tenant]);
  const { datos, cargando, error, recargar } = useRecurso<Zona[]>(cargar);

  const [dialogoAbierto, setDialogoAbierto] = useState(false);
  const [enEdicion, setEnEdicion] = useState<Zona | null>(null);
  const [formulario, setFormulario] = useState<ZonaPayload>(VALORES_INICIALES);
  const [errorFormulario, setErrorFormulario] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  function abrirCreacion() {
    setEnEdicion(null);
    setFormulario(VALORES_INICIALES);
    setErrorFormulario(null);
    setDialogoAbierto(true);
  }

  function abrirEdicion(zona: Zona) {
    setEnEdicion(zona);
    setFormulario({
      nombre: zona.nombre,
      codigo: zona.codigo,
      descripcion: zona.descripcion ?? '',
      capacidad: zona.capacidad,
      tipo: zona.tipo,
    });
    setErrorFormulario(null);
    setDialogoAbierto(true);
  }

  async function guardar(evento: FormEvent) {
    evento.preventDefault();
    setErrorFormulario(null);
    setGuardando(true);
    try {
      if (enEdicion) {
        await apiZonas.actualizar(tenant, enEdicion.id, formulario);
      } else {
        await apiZonas.crear(tenant, formulario);
      }
      setDialogoAbierto(false);
      recargar();
    } catch (fallo) {
      setErrorFormulario(fallo instanceof Error ? fallo.message : 'No se pudo guardar la zona.');
    } finally {
      setGuardando(false);
    }
  }

  async function eliminar(zona: Zona) {
    if (!confirm(`Deshabilitar la zona ${zona.nombre}? Sus espacios dejaran de poder ocuparse.`)) return;
    try {
      await apiZonas.eliminar(tenant, zona.id);
      recargar();
    } catch (fallo) {
      alert(fallo instanceof Error ? fallo.message : 'No se pudo deshabilitar la zona.');
    }
  }

  const lista = datos ?? [];

  return (
    <>
      <EncabezadoPagina
        titulo="Zonas"
        descripcion="Agrupaciones fisicas del parqueadero y su capacidad maxima de plazas."
        acciones={
          esAdmin && (
            <Boton variante="primario" onClick={abrirCreacion}>
              Crear zona
            </Boton>
          )
        }
      />

      {error && <Aviso tipo="error">{error}</Aviso>}

      <Panel>
        {cargando ? (
          <SinDatos mensaje="Cargando zonas..." />
        ) : lista.length === 0 ? (
          <SinDatos
            mensaje="Aun no hay zonas. Crea la primera para empezar a distribuir el parqueadero."
            accion={esAdmin && <Boton variante="primario" onClick={abrirCreacion}>Crear zona</Boton>}
          />
        ) : (
          <Tabla columnas={['Codigo', 'Nombre', 'Tipo', 'Capacidad', 'Libres', 'Estado', '']}>
            {lista.map((zona) => (
              <Fila key={zona.id}>
                <Celda className="font-data text-xs">{zona.codigo}</Celda>
                <Celda className="font-medium">{zona.nombre}</Celda>
                <Celda className="font-sign uppercase tracking-wider text-xs">{zona.tipo}</Celda>
                <Celda className="tabular-nums">{zona.capacidad}</Celda>
                <Celda className="tabular-nums">{zona.espaciosDisponibles}</Celda>
                <Celda className="font-sign uppercase text-xs tracking-wider">
                  {zona.active ? 'Activa' : 'Deshabilitada'}
                </Celda>
                <Celda>
                  {esAdmin && (
                    <div className="flex gap-2 justify-end">
                      <Boton onClick={() => abrirEdicion(zona)}>Editar</Boton>
                      {zona.active && (
                        <Boton variante="peligro" onClick={() => eliminar(zona)}>
                          Deshabilitar
                        </Boton>
                      )}
                    </div>
                  )}
                </Celda>
              </Fila>
            ))}
          </Tabla>
        )}
      </Panel>

      {dialogoAbierto && (
        <Dialogo
          titulo={enEdicion ? `Editar ${enEdicion.nombre}` : 'Crear zona'}
          onCerrar={() => setDialogoAbierto(false)}
        >
          <form onSubmit={guardar} className="space-y-4">
            {errorFormulario && <Aviso tipo="error">{errorFormulario}</Aviso>}

            <Campo label="Nombre">
              <Entrada
                value={formulario.nombre}
                onChange={(evento) => setFormulario({ ...formulario, nombre: evento.target.value })}
                required
              />
            </Campo>

            <Campo label="Tipo">
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

            <Campo label="Capacidad (1 a 200 plazas)">
              <Entrada
                type="number"
                min={1}
                max={200}
                value={formulario.capacidad}
                onChange={(evento) =>
                  setFormulario({ ...formulario, capacidad: Number(evento.target.value) })
                }
                required
              />
            </Campo>

            <Campo label="Descripcion (opcional)">
              <Entrada
                value={formulario.descripcion ?? ''}
                onChange={(evento) => setFormulario({ ...formulario, descripcion: evento.target.value })}
              />
            </Campo>

            <p className="text-xs text-ink-faint">
              Si dejas el codigo vacio, el sistema lo genera a partir del tipo de zona.
            </p>

            <div className="flex justify-end gap-2 pt-1">
              <Boton type="button" onClick={() => setDialogoAbierto(false)}>
                Cancelar
              </Boton>
              <Boton type="submit" variante="primario" disabled={guardando}>
                {guardando ? 'Guardando...' : enEdicion ? 'Guardar cambios' : 'Crear zona'}
              </Boton>
            </div>
          </form>
        </Dialogo>
      )}
    </>
  );
}
