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
  Placa,
  Seleccion,
  SinDatos,
  Tabla,
} from '../components/ui';
import { useRecurso } from '../hooks/useRecurso';
import { vehiculos as apiVehiculos } from '../lib/api';
import { useAuth, useTenant } from '../lib/auth';
import type { Vehiculo } from '../lib/types';

type TipoVehiculo = 'Auto' | 'Motocicleta' | 'Camioneta';

const TIPOS: TipoVehiculo[] = ['Auto', 'Motocicleta', 'Camioneta'];

const TIPOS_MOTO = ['SCOOTER', 'DEPORTIVA', 'TURISMO', 'CHOw', 'CUATRIMOTO', 'ENDURO'];

/** El backend valida un formato de placa distinto para motos. */
const AYUDA_PLACA: Record<TipoVehiculo, string> = {
  Auto: 'Formato ABC-1234',
  Camioneta: 'Formato ABC-1234',
  Motocicleta: 'Formato AB-123C',
};

interface FormularioVehiculo {
  tipo: TipoVehiculo;
  marca: string;
  placa: string;
  modelo: string;
  color: string;
  anio: number;
  // Auto
  numeroPuertas: number;
  capacidadMaletero: number;
  // Camioneta
  cilindraje: number;
  cabina: string;
  capacidadCarga: number;
  // Motocicleta
  tipoMoto: string;
}

const INICIAL: FormularioVehiculo = {
  tipo: 'Auto',
  marca: '',
  placa: '',
  modelo: '',
  color: '',
  anio: new Date().getFullYear(),
  numeroPuertas: 4,
  capacidadMaletero: 3,
  cilindraje: 2000,
  cabina: 'Doble',
  capacidadCarga: 2,
  tipoMoto: 'SCOOTER',
};

/** Arma el payload anidado que espera CreateVehiculoDto segun el tipo. */
function construirPayload(formulario: FormularioVehiculo) {
  const base = {
    marca: formulario.marca.trim(),
    placa: formulario.placa.trim().toUpperCase(),
    modelo: formulario.modelo.trim(),
    color: formulario.color.trim(),
    anio: Number(formulario.anio),
  };

  switch (formulario.tipo) {
    case 'Auto':
      return {
        tipo: 'Auto',
        datos: {
          ...base,
          numeroPuertas: Number(formulario.numeroPuertas),
          capacidadMaletero: Number(formulario.capacidadMaletero),
        },
      };
    case 'Camioneta':
      return {
        tipo: 'Camioneta',
        datos: {
          ...base,
          cilindraje: Number(formulario.cilindraje),
          cabina: formulario.cabina.trim(),
          capacidadCarga: Number(formulario.capacidadCarga),
        },
      };
    case 'Motocicleta':
      return { tipo: 'Motocicleta', datos: { ...base, tipo: formulario.tipoMoto } };
  }
}

export function Vehiculos() {
  const tenant = useTenant();
  const { esAdmin } = useAuth();

  const cargar = useCallback(() => apiVehiculos.listar(tenant), [tenant]);
  const { datos, cargando, error, recargar } = useRecurso<Vehiculo[]>(cargar);

  const [dialogoAbierto, setDialogoAbierto] = useState(false);
  const [formulario, setFormulario] = useState<FormularioVehiculo>(INICIAL);
  const [errorFormulario, setErrorFormulario] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  function actualizar<K extends keyof FormularioVehiculo>(campo: K, valor: FormularioVehiculo[K]) {
    setFormulario((actual) => ({ ...actual, [campo]: valor }));
  }

  async function crear(evento: FormEvent) {
    evento.preventDefault();
    setErrorFormulario(null);
    setGuardando(true);
    try {
      await apiVehiculos.crear(tenant, construirPayload(formulario));
      setDialogoAbierto(false);
      recargar();
    } catch (fallo) {
      setErrorFormulario(fallo instanceof Error ? fallo.message : 'No se pudo registrar el vehiculo.');
    } finally {
      setGuardando(false);
    }
  }

  async function eliminar(vehiculo: Vehiculo) {
    if (!confirm(`Eliminar el vehiculo ${vehiculo.placa}?`)) return;
    try {
      await apiVehiculos.eliminar(tenant, vehiculo.id);
      recargar();
    } catch (fallo) {
      alert(fallo instanceof Error ? fallo.message : 'No se pudo eliminar el vehiculo.');
    }
  }

  const lista = datos ?? [];

  return (
    <>
      <EncabezadoPagina
        titulo="Vehiculos"
        descripcion="Catalogo de vehiculos habilitados para ingresar al parqueadero."
        acciones={
          esAdmin && (
            <Boton
              variante="primario"
              onClick={() => {
                setFormulario(INICIAL);
                setErrorFormulario(null);
                setDialogoAbierto(true);
              }}
            >
              Registrar vehiculo
            </Boton>
          )
        }
      />

      {error && <Aviso tipo="error">{error}</Aviso>}

      <Panel>
        {cargando ? (
          <SinDatos mensaje="Cargando vehiculos..." />
        ) : lista.length === 0 ? (
          <SinDatos mensaje="Todavia no hay vehiculos registrados en esta empresa." />
        ) : (
          <Tabla columnas={['Placa', 'Tipo', 'Marca', 'Modelo', 'Color', 'Anio', '']}>
            {lista.map((vehiculo) => (
              <Fila key={vehiculo.id}>
                <Celda>
                  <Placa valor={vehiculo.placa} />
                </Celda>
                <Celda className="font-sign uppercase tracking-wider text-xs">{vehiculo.tipo}</Celda>
                <Celda>{vehiculo.marca}</Celda>
                <Celda>{vehiculo.modelo}</Celda>
                <Celda>{vehiculo.color}</Celda>
                <Celda className="tabular-nums">{vehiculo.anio}</Celda>
                <Celda>
                  {esAdmin && (
                    <div className="flex justify-end">
                      <Boton variante="peligro" onClick={() => eliminar(vehiculo)}>
                        Eliminar
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
        <Dialogo titulo="Registrar vehiculo" onCerrar={() => setDialogoAbierto(false)}>
          <form onSubmit={crear} className="space-y-4">
            {errorFormulario && <Aviso tipo="error">{errorFormulario}</Aviso>}

            <Campo label="Tipo de vehiculo">
              <Seleccion
                value={formulario.tipo}
                onChange={(evento) => actualizar('tipo', evento.target.value as TipoVehiculo)}
              >
                {TIPOS.map((tipo) => (
                  <option key={tipo} value={tipo}>
                    {tipo}
                  </option>
                ))}
              </Seleccion>
            </Campo>

            <div className="grid grid-cols-2 gap-4">
              <Campo label="Marca">
                <Entrada
                  value={formulario.marca}
                  onChange={(evento) => actualizar('marca', evento.target.value)}
                  required
                />
              </Campo>
              <Campo label={`Placa · ${AYUDA_PLACA[formulario.tipo]}`}>
                <Entrada
                  value={formulario.placa}
                  onChange={(evento) => actualizar('placa', evento.target.value.toUpperCase())}
                  className="font-data uppercase"
                  required
                />
              </Campo>
              <Campo label="Modelo">
                <Entrada
                  value={formulario.modelo}
                  onChange={(evento) => actualizar('modelo', evento.target.value)}
                  required
                />
              </Campo>
              <Campo label="Color">
                <Entrada
                  value={formulario.color}
                  onChange={(evento) => actualizar('color', evento.target.value)}
                  required
                />
              </Campo>
              <Campo label="Anio">
                <Entrada
                  type="number"
                  min={1900}
                  max={new Date().getFullYear() + 1}
                  value={formulario.anio}
                  onChange={(evento) => actualizar('anio', Number(evento.target.value))}
                  required
                />
              </Campo>
            </div>

            {/* Campos propios de cada tipo */}
            {formulario.tipo === 'Auto' && (
              <div className="grid grid-cols-2 gap-4">
                <Campo label="Numero de puertas">
                  <Entrada
                    type="number"
                    min={2}
                    max={5}
                    value={formulario.numeroPuertas}
                    onChange={(evento) => actualizar('numeroPuertas', Number(evento.target.value))}
                  />
                </Campo>
                <Campo label="Capacidad de maletero">
                  <Entrada
                    type="number"
                    min={1}
                    max={10}
                    value={formulario.capacidadMaletero}
                    onChange={(evento) => actualizar('capacidadMaletero', Number(evento.target.value))}
                  />
                </Campo>
              </div>
            )}

            {formulario.tipo === 'Camioneta' && (
              <div className="grid grid-cols-2 gap-4">
                <Campo label="Cilindraje">
                  <Entrada
                    type="number"
                    min={1}
                    value={formulario.cilindraje}
                    onChange={(evento) => actualizar('cilindraje', Number(evento.target.value))}
                  />
                </Campo>
                <Campo label="Cabina">
                  <Entrada
                    value={formulario.cabina}
                    onChange={(evento) => actualizar('cabina', evento.target.value)}
                  />
                </Campo>
                <Campo label="Capacidad de carga">
                  <Entrada
                    type="number"
                    min={1}
                    max={10}
                    value={formulario.capacidadCarga}
                    onChange={(evento) => actualizar('capacidadCarga', Number(evento.target.value))}
                  />
                </Campo>
              </div>
            )}

            {formulario.tipo === 'Motocicleta' && (
              <Campo label="Tipo de motocicleta">
                <Seleccion
                  value={formulario.tipoMoto}
                  onChange={(evento) => actualizar('tipoMoto', evento.target.value)}
                >
                  {TIPOS_MOTO.map((tipo) => (
                    <option key={tipo} value={tipo}>
                      {tipo}
                    </option>
                  ))}
                </Seleccion>
              </Campo>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Boton type="button" onClick={() => setDialogoAbierto(false)}>
                Cancelar
              </Boton>
              <Boton type="submit" variante="primario" disabled={guardando}>
                {guardando ? 'Guardando...' : 'Registrar vehiculo'}
              </Boton>
            </div>
          </form>
        </Dialogo>
      )}
    </>
  );
}
