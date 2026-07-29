import { useEffect, useState } from 'react';
import { empresas } from '../lib/api';
import { guardarTenant } from '../lib/tenant';
import type { CrearEmpresaDto, EmpresaTenant } from '../lib/types';

interface ConfirmacionCredenciales {
  tenantId: string;
  nombreEmpresa: string;
  adminUsername: string;
  adminPassword: string;
  adminDni: string;
  adminEmail: string;
  subdominioUrl: string;
  parametroUrl: string;
}

export function SuperAdmin() {
  const [lista, setLista] = useState<EmpresaTenant[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [exito, setExito] = useState<string | null>(null);
  const [confirmacion, setConfirmacion] = useState<ConfirmacionCredenciales | null>(null);

  const [form, setForm] = useState<CrearEmpresaDto>({
    tenantId: '',
    nombreEmpresa: '',
    adminDni: '',
    adminFirstName: '',
    adminMiddleName: '',
    adminLastName: '',
    adminEmail: '',
    adminPhone: '',
    adminAddress: '',
    adminNationality: '',
    adminUsername: 'admin',
    adminPassword: '',
  });

  const cargarEmpresas = async () => {
    try {
      setCargando(true);
      setError(null);
      const datos = await empresas.listar();
      setLista(datos);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar lista de empresas');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    void cargarEmpresas();
  }, []);

  const handleSlugChange = (valor: string) => {
    const slug = valor.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    setForm((f) => ({ ...f, tenantId: slug }));
  };

  const handleCrear = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.tenantId || form.tenantId.length < 2) {
      setError('El subdominio debe tener al menos 2 caracteres (letras minusculas, numeros o guiones)');
      return;
    }

    try {
      setEnviando(true);
      setError(null);
      const nueva = await empresas.crear(form);
      
      // Guardar confirmacion explicita para mostrarla en pantalla
      setConfirmacion({
        tenantId: nueva.tenantId,
        nombreEmpresa: nueva.nombreEmpresa,
        adminUsername: nueva.adminUsername,
        adminPassword: form.adminPassword,
        adminDni: form.adminDni,
        adminEmail: nueva.adminEmail,
        subdominioUrl: nueva.subdominioUrl,
        parametroUrl: nueva.parametroUrl,
      });

      setExito(`Empresa "${nueva.nombreEmpresa}" creada exitosamente con su usuario administrador.`);
      setModalAbierto(false);
      setForm({
        tenantId: '',
        nombreEmpresa: '',
        adminDni: '',
        adminFirstName: '',
        adminMiddleName: '',
        adminLastName: '',
        adminEmail: '',
        adminPhone: '',
        adminAddress: '',
        adminNationality: '',
        adminUsername: 'admin',
        adminPassword: '',
      });
      await cargarEmpresas();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear la empresa');
    } finally {
      setEnviando(false);
    }
  };

  const handleEliminar = async (tenantId: string, nombre: string) => {
    const seguro = window.confirm(
      `¿Esta seguro de eliminar la empresa "${nombre}" (${tenantId})?\n\nEsta accion eliminara los usuarios y datos asociados.`
    );
    if (!seguro) return;

    try {
      setError(null);
      await empresas.eliminar(tenantId);
      setExito(`Empresa "${nombre}" eliminada correctamente.`);
      await cargarEmpresas();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar la empresa');
    }
  };

  const entrarATenant = (tenantId: string) => {
    guardarTenant(tenantId);
    window.location.href = `/?tenant=${tenantId}`;
  };

  return (
    <div className="space-y-6">
      {/* Encabezado Principal */}
      <div className="bg-board border border-white/10 p-6 rounded-lg text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-hivis font-sign text-xl">&raquo;</span>
            <span className="font-sign uppercase tracking-widest text-xs text-hivis font-semibold">
              Modulo de Administracion Global
            </span>
          </div>
          <h1 className="text-2xl font-bold font-sign">Portal SuperAdmin - Gestion de Empresas (Tenants)</h1>
          <p className="text-sm text-white/70 mt-1">
            Aprovisionamiento de nuevos parqueaderos, aislamiento multitenant y generacion dinamica de subdominios.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setError(null);
            setExito(null);
            setModalAbierto(true);
          }}
          className="bg-hivis text-board font-sign font-bold uppercase tracking-wider text-xs px-5 py-3 rounded-md hover:bg-yellow-400 transition-colors shadow-lg self-start md:self-auto shrink-0"
        >
          + Crear Nueva Empresa
        </button>
      </div>

      {/* Modal/Tarjeta de Confirmacion de Credenciales Generadas */}
      {confirmacion && (
        <div className="p-6 bg-board border-2 border-hivis rounded-lg shadow-2xl space-y-4 text-white">
          <div className="flex items-center justify-between border-b border-hivis/30 pb-3">
            <div className="flex items-center gap-2">
              <span className="text-hivis text-xl">&check;</span>
              <h2 className="font-sign font-bold text-lg text-hivis uppercase tracking-wide">
                ¡Empresa y Usuario Creados Exitosamente!
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setConfirmacion(null)}
              className="text-white/50 hover:text-white text-xs uppercase font-sign"
            >
              Cerrar Resumen &times;
            </button>
          </div>

          <p className="text-xs text-white/80">
            Guarda estas credenciales. Son las requeridas para ingresar en la pantalla de Login de la empresa:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 bg-black/50 p-4 rounded border border-white/10 font-data text-xs">
            <div className="space-y-1">
              <span className="text-white/40 block text-[0.7rem]">Empresa / Tenant:</span>
              <span className="text-hivis font-bold font-mono text-sm block">{confirmacion.tenantId}</span>
            </div>
            <div className="space-y-1">
              <span className="text-white/40 block text-[0.7rem]">Usuario Admin:</span>
              <span className="text-white font-bold font-mono text-sm block">{confirmacion.adminUsername}</span>
            </div>
            <div className="space-y-1">
              <span className="text-white/40 block text-[0.7rem]">Contraseña Admin:</span>
              <span className="text-yellow-300 font-bold font-mono text-sm block">{confirmacion.adminPassword}</span>
            </div>
            <div className="space-y-1">
              <span className="text-white/40 block text-[0.7rem]">DNI Administrador:</span>
              <span className="text-white font-mono text-sm block">{confirmacion.adminDni}</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
            <div className="text-xs font-data">
              <span className="text-white/50">Enlace de acceso: </span>
              <span className="text-cyan-400 font-mono">{confirmacion.parametroUrl}</span>
            </div>
            <button
              type="button"
              onClick={() => entrarATenant(confirmacion.tenantId)}
              className="bg-hivis text-board font-sign font-bold uppercase tracking-wider text-xs px-4 py-2.5 rounded hover:bg-yellow-400 shrink-0"
            >
              Iniciar Sesion en esta Empresa &raquo;
            </button>
          </div>
        </div>
      )}

      {/* Alertas */}
      {exito && (
        <div className="p-4 bg-emerald-900/40 border border-emerald-500/50 text-emerald-200 text-sm rounded-md flex items-center justify-between">
          <span>{exito}</span>
          <button type="button" onClick={() => setExito(null)} className="text-xs uppercase hover:underline">
            Cerrar
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-900/40 border border-rose-500/50 text-rose-200 text-sm rounded-md flex items-center justify-between">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="text-xs uppercase hover:underline">
            Cerrar
          </button>
        </div>
      )}

      {/* Contenido / Tarjetas de Empresas */}
      {cargando ? (
        <div className="p-12 text-center text-white/60 font-data">Cargando empresas registradas...</div>
      ) : lista.length === 0 ? (
        <div className="bg-white/5 border border-white/10 p-8 rounded-lg text-center text-white/60">
          No hay empresas registradas aun. Presiona "+ Crear Nueva Empresa" para aprovisionar una.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {lista.map((emp) => (
            <div
              key={emp.tenantId}
              className="bg-board border border-white/15 rounded-lg p-5 flex flex-col justify-between hover:border-hivis/50 transition-all shadow-md group"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <span className="font-data text-[0.7rem] uppercase tracking-widest text-hivis bg-hivis/10 px-2 py-0.5 rounded border border-hivis/20">
                      ID: {emp.tenantId}
                    </span>
                    <h2 className="text-lg font-bold text-white mt-1 group-hover:text-hivis transition-colors font-sign">
                      {emp.nombreEmpresa}
                    </h2>
                  </div>
                  <span className="text-xs font-data text-white/60 bg-white/5 px-2 py-1 rounded">
                    {emp.userCount} usuario(s)
                  </span>
                </div>

                <div className="space-y-2 my-4 text-xs font-data text-white/70 bg-black/30 p-3 rounded border border-white/5">
                  <div className="flex justify-between border-b border-white/5 pb-1">
                    <span className="text-white/40">Usuario Admin:</span>
                    <span className="text-white font-medium font-mono">{emp.adminUsername}</span>
                  </div>
                  <div className="flex justify-between border-b border-white/5 pb-1">
                    <span className="text-white/40">Email Admin:</span>
                    <span className="text-white/80 truncate max-w-[150px]">{emp.adminEmail}</span>
                  </div>
                  <div className="flex flex-col gap-1 pt-1">
                    <span className="text-white/40">Subdominio Dedicado:</span>
                    <a
                      href={emp.subdominioUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-cyan-400 hover:underline truncate font-mono text-[0.7rem]"
                    >
                      {emp.subdominioUrl}
                    </a>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-white/10 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => handleEliminar(emp.tenantId, emp.nombreEmpresa)}
                  className="bg-rose-950/50 hover:bg-rose-900 text-rose-300 border border-rose-800/50 font-sign text-[0.7rem] uppercase font-bold px-3 py-2 rounded transition-colors"
                  title="Eliminar empresa y sus usuarios"
                >
                  Eliminar
                </button>

                <button
                  type="button"
                  onClick={() => entrarATenant(emp.tenantId)}
                  className="flex-1 bg-white/10 hover:bg-white/20 text-white font-sign text-xs font-bold uppercase tracking-wider py-2 px-3 rounded transition-colors text-center border border-white/20"
                >
                  Ingresar al Portal &raquo;
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de Creacion de Empresa */}
      {modalAbierto && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-board border border-white/20 text-white w-full max-w-xl rounded-lg p-6 shadow-2xl space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h2 className="text-lg font-bold font-sign text-hivis">Registrar Nueva Empresa (Tenant)</h2>
              <button
                type="button"
                onClick={() => setModalAbierto(false)}
                className="text-white/50 hover:text-white font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCrear} className="space-y-4 text-xs font-data">
              <div>
                <label className="block text-white/70 mb-1">Nombre de la Empresa *</label>
                <input
                  type="text"
                  required
                  placeholder="ej. Parqueadero Mall del Sol"
                  value={form.nombreEmpresa}
                  onChange={(e) => setForm({ ...form, nombreEmpresa: e.target.value })}
                  className="w-full bg-black/40 border border-white/20 rounded px-3 py-2 text-white focus:border-hivis outline-none"
                />
              </div>

              <div>
                <label className="block text-white/70 mb-1">Identificador de Subdominio (Slug) *</label>
                <input
                  type="text"
                  required
                  placeholder="ej. mall-del-sol"
                  value={form.tenantId}
                  onChange={(e) => handleSlugChange(e.target.value)}
                  className="w-full bg-black/40 border border-white/20 rounded px-3 py-2 text-white font-mono focus:border-hivis outline-none"
                />
                <p className="text-[0.7rem] text-white/50 mt-1">
                  Se usa en URLs. Formato: minusculas, numeros y guiones.
                </p>
                {form.tenantId && (
                  <div className="mt-2 p-2 bg-black/60 rounded border border-white/10 text-[0.7rem] space-y-1">
                    <span className="text-white/40 block">Previsualizacion del Enlace generado:</span>
                    <span className="text-cyan-400 font-mono block">http://{form.tenantId}.parqueadero.espe.edu.ec</span>
                    <span className="text-yellow-400 font-mono block">http://localhost:5500/?tenant={form.tenantId}</span>
                  </div>
                )}
              </div>

              <div className="border-t border-white/10 pt-3">
                <h3 className="text-sm font-bold text-white font-sign mb-3">Datos del Administrador Inicial</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-white/70 mb-1">DNI / Cedula *</label>
                    <input
                      type="text"
                      required
                      placeholder="1712345678"
                      value={form.adminDni}
                      onChange={(e) => setForm({ ...form, adminDni: e.target.value })}
                      className="w-full bg-black/40 border border-white/20 rounded px-3 py-2 text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-white/70 mb-1">Usuario Admin para Login *</label>
                    <input
                      type="text"
                      required
                      placeholder="admin"
                      value={form.adminUsername}
                      onChange={(e) => setForm({ ...form, adminUsername: e.target.value })}
                      className="w-full bg-black/40 border border-white/20 rounded px-3 py-2 text-white outline-none font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-white/70 mb-1">Primer Nombre *</label>
                    <input
                      type="text"
                      required
                      placeholder="Carlos"
                      value={form.adminFirstName}
                      onChange={(e) => setForm({ ...form, adminFirstName: e.target.value })}
                      className="w-full bg-black/40 border border-white/20 rounded px-3 py-2 text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-white/70 mb-1">Segundo Nombre</label>
                    <input
                      type="text"
                      placeholder="Alberto"
                      value={form.adminMiddleName ?? ''}
                      onChange={(e) => setForm({ ...form, adminMiddleName: e.target.value })}
                      className="w-full bg-black/40 border border-white/20 rounded px-3 py-2 text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-white/70 mb-1">Apellido *</label>
                    <input
                      type="text"
                      required
                      placeholder="Mendoza"
                      value={form.adminLastName}
                      onChange={(e) => setForm({ ...form, adminLastName: e.target.value })}
                      className="w-full bg-black/40 border border-white/20 rounded px-3 py-2 text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-white/70 mb-1">Telefono</label>
                    <input
                      type="text"
                      placeholder="0998765432"
                      value={form.adminPhone ?? ''}
                      onChange={(e) => setForm({ ...form, adminPhone: e.target.value })}
                      className="w-full bg-black/40 border border-white/20 rounded px-3 py-2 text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-white/70 mb-1">Direccion</label>
                    <input
                      type="text"
                      placeholder="Av. Amazonas y Colon"
                      value={form.adminAddress ?? ''}
                      onChange={(e) => setForm({ ...form, adminAddress: e.target.value })}
                      className="w-full bg-black/40 border border-white/20 rounded px-3 py-2 text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-white/70 mb-1">Nacionalidad</label>
                    <input
                      type="text"
                      placeholder="Ecuatoriana"
                      value={form.adminNationality ?? ''}
                      onChange={(e) => setForm({ ...form, adminNationality: e.target.value })}
                      className="w-full bg-black/40 border border-white/20 rounded px-3 py-2 text-white outline-none"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-white/70 mb-1">Email del Administrador *</label>
                    <input
                      type="email"
                      required
                      placeholder="carlos.mendoza@empresa.com"
                      value={form.adminEmail}
                      onChange={(e) => setForm({ ...form, adminEmail: e.target.value })}
                      className="w-full bg-black/40 border border-white/20 rounded px-3 py-2 text-white outline-none"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-white/70 mb-1">Contraseña del Administrador para Login *</label>
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={form.adminPassword}
                      onChange={(e) => setForm({ ...form, adminPassword: e.target.value })}
                      className="w-full bg-black/40 border border-white/20 rounded px-3 py-2 text-white outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setModalAbierto(false)}
                  className="px-4 py-2 rounded text-white/70 hover:text-white uppercase font-sign text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={enviando}
                  className="bg-hivis text-board font-sign font-bold uppercase text-xs px-5 py-2 rounded hover:bg-yellow-400 disabled:opacity-50"
                >
                  {enviando ? 'Creando...' : 'Crear Empresa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
