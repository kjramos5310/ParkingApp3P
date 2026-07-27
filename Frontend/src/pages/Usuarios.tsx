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
import { roles as apiRoles, usuarios as apiUsuarios } from '../lib/api';
import { useAuth, useTenant } from '../lib/auth';
import type { Rol, Usuario } from '../lib/types';

interface FormularioUsuario {
  dni: string;
  firstName: string;
  middleName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  nationality: string;
  username: string;
  password: string;
}

const INICIAL: FormularioUsuario = {
  dni: '',
  firstName: '',
  middleName: '',
  lastName: '',
  email: '',
  phone: '',
  address: '',
  nationality: 'Ecuatoriana',
  username: '',
  password: '',
};

export function Usuarios() {
  const tenant = useTenant();
  const { esAdmin } = useAuth();

  const cargarUsuarios = useCallback(() => apiUsuarios.listar(tenant), [tenant]);
  const cargarRoles = useCallback(() => apiRoles.listar(tenant), [tenant]);

  const { datos, cargando, error, recargar } = useRecurso<Usuario[]>(cargarUsuarios);
  const { datos: roles } = useRecurso<Rol[]>(cargarRoles);

  const [dialogoAbierto, setDialogoAbierto] = useState(false);
  const [formulario, setFormulario] = useState<FormularioUsuario>(INICIAL);
  const [errorFormulario, setErrorFormulario] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  function actualizar<K extends keyof FormularioUsuario>(campo: K, valor: FormularioUsuario[K]) {
    setFormulario((actual) => ({ ...actual, [campo]: valor }));
  }

  async function crear(evento: FormEvent) {
    evento.preventDefault();
    setErrorFormulario(null);
    setGuardando(true);
    try {
      await apiUsuarios.crear(tenant, { ...formulario });
      setDialogoAbierto(false);
      recargar();
    } catch (fallo) {
      setErrorFormulario(fallo instanceof Error ? fallo.message : 'No se pudo crear el usuario.');
    } finally {
      setGuardando(false);
    }
  }

  async function asignarRol(usuario: Usuario, idRol: string) {
    if (!idRol) return;
    try {
      await apiUsuarios.asignarRol(tenant, usuario.id, idRol);
      recargar();
    } catch (fallo) {
      alert(fallo instanceof Error ? fallo.message : 'No se pudo asignar el rol.');
    }
  }

  const lista = datos ?? [];

  return (
    <>
      <EncabezadoPagina
        titulo="Usuarios"
        descripcion="Personas con acceso a la consola de esta empresa y los roles que tienen."
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
              Crear usuario
            </Boton>
          )
        }
      />

      {error && <Aviso tipo="error">{error}</Aviso>}

      <Panel>
        {cargando ? (
          <SinDatos mensaje="Cargando usuarios..." />
        ) : lista.length === 0 ? (
          <SinDatos mensaje="No hay usuarios registrados en esta empresa." />
        ) : (
          <Tabla columnas={['Usuario', 'Nombre', 'Correo', 'Roles', 'Estado', '']}>
            {lista.map((usuario) => (
              <Fila key={usuario.id}>
                <Celda className="font-data text-xs">{usuario.username}</Celda>
                <Celda>
                  {usuario.person ? `${usuario.person.firstName} ${usuario.person.lastName}` : '—'}
                </Celda>
                <Celda className="text-ink-muted">{usuario.person?.email ?? '—'}</Celda>
                <Celda>
                  <div className="flex flex-wrap gap-1">
                    {(usuario.roles ?? []).length === 0 ? (
                      <span className="text-ink-faint text-xs">Sin rol</span>
                    ) : (
                      usuario.roles.map((rol) => (
                        <span
                          key={rol}
                          className="font-sign uppercase tracking-wider text-[0.65rem] border border-line-strong px-1.5 py-0.5 rounded-[3px]"
                        >
                          {rol.replace(/^ROLE_/, '')}
                        </span>
                      ))
                    )}
                  </div>
                </Celda>
                <Celda className="font-sign uppercase text-xs tracking-wider">
                  {usuario.active ? 'Activo' : 'Inactivo'}
                </Celda>
                <Celda>
                  {esAdmin && (roles ?? []).length > 0 && (
                    <div className="flex justify-end">
                      <Seleccion
                        aria-label={`Asignar rol a ${usuario.username}`}
                        defaultValue=""
                        onChange={(evento) => {
                          asignarRol(usuario, evento.target.value);
                          evento.target.value = '';
                        }}
                        className="w-40 py-1 text-xs"
                      >
                        <option value="">Asignar rol...</option>
                        {(roles ?? []).map((rol) => (
                          <option key={rol.id} value={rol.id}>
                            {rol.name}
                          </option>
                        ))}
                      </Seleccion>
                    </div>
                  )}
                </Celda>
              </Fila>
            ))}
          </Tabla>
        )}
      </Panel>

      {dialogoAbierto && (
        <Dialogo titulo="Crear usuario" onCerrar={() => setDialogoAbierto(false)}>
          <form onSubmit={crear} className="space-y-4">
            {errorFormulario && <Aviso tipo="error">{errorFormulario}</Aviso>}

            <div className="grid grid-cols-2 gap-4">
              <Campo label="Cedula">
                <Entrada
                  value={formulario.dni}
                  onChange={(evento) => actualizar('dni', evento.target.value)}
                  maxLength={10}
                  pattern="[0-9]+"
                  className="font-data"
                  required
                />
              </Campo>
              <Campo label="Nacionalidad">
                <Entrada
                  value={formulario.nationality}
                  onChange={(evento) => actualizar('nationality', evento.target.value)}
                />
              </Campo>
              <Campo label="Nombres">
                <Entrada
                  value={formulario.firstName}
                  onChange={(evento) => actualizar('firstName', evento.target.value)}
                  maxLength={25}
                  required
                />
              </Campo>
              <Campo label="Apellidos">
                <Entrada
                  value={formulario.lastName}
                  onChange={(evento) => actualizar('lastName', evento.target.value)}
                  maxLength={25}
                  required
                />
              </Campo>
            </div>

            <Campo label="Correo">
              <Entrada
                type="email"
                value={formulario.email}
                onChange={(evento) => actualizar('email', evento.target.value)}
                maxLength={50}
                required
              />
            </Campo>

            <div className="grid grid-cols-2 gap-4">
              <Campo label="Telefono">
                <Entrada
                  value={formulario.phone}
                  onChange={(evento) => actualizar('phone', evento.target.value)}
                  className="font-data"
                />
              </Campo>
              <Campo label="Direccion">
                <Entrada
                  value={formulario.address}
                  onChange={(evento) => actualizar('address', evento.target.value)}
                />
              </Campo>
              <Campo label="Nombre de usuario">
                <Entrada
                  value={formulario.username}
                  onChange={(evento) => actualizar('username', evento.target.value)}
                  autoComplete="off"
                  className="font-data"
                  required
                />
              </Campo>
              <Campo label="Contrasena">
                <Entrada
                  type="password"
                  value={formulario.password}
                  onChange={(evento) => actualizar('password', evento.target.value)}
                  autoComplete="new-password"
                  required
                />
              </Campo>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Boton type="button" onClick={() => setDialogoAbierto(false)}>
                Cancelar
              </Boton>
              <Boton type="submit" variante="primario" disabled={guardando}>
                {guardando ? 'Creando...' : 'Crear usuario'}
              </Boton>
            </div>
          </form>
        </Dialogo>
      )}
    </>
  );
}
