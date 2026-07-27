import { useState, type FormEvent } from 'react';
import { Aviso, Boton, Campo, Entrada } from '../components/ui';
import { useAuth } from '../lib/auth';
import { esTenantValido, resolverTenant, tenantFijadoPorDominio } from '../lib/tenant';

export function Login() {
  const { iniciarSesion } = useAuth();
  const dominioFijaTenant = tenantFijadoPorDominio();

  const [empresa, setEmpresa] = useState(() => resolverTenant() ?? '');
  const [usuario, setUsuario] = useState('');
  const [clave, setClave] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function alEnviar(evento: FormEvent) {
    evento.preventDefault();
    setError(null);

    const tenant = empresa.trim().toLowerCase();
    if (!esTenantValido(tenant)) {
      setError('El identificador de empresa usa 2 a 50 caracteres: letras minusculas, numeros o guiones.');
      return;
    }

    setEnviando(true);
    try {
      await iniciarSesion(tenant, usuario.trim(), clave);
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : 'No se pudo iniciar sesion.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-[1.1fr_1fr]">
      {/* Panel de senalizacion: el mismo lenguaje visual de la rampa */}
      <div className="bg-board text-white flex flex-col justify-between p-8 sm:p-12">
        <div className="flex items-center gap-3">
          <span className="text-hivis font-sign text-2xl leading-none" aria-hidden="true">
            &raquo;
          </span>
          <span className="font-sign uppercase tracking-[0.24em] text-sm">Parqueadero</span>
        </div>

        <div className="py-12">
          <h1 className="font-sign text-5xl sm:text-7xl leading-[0.92] text-white">
            Cada plaza,
            <br />
            <span className="text-hivis">en tiempo real.</span>
          </h1>
          <p className="text-white/60 mt-6 max-w-md">
            Ocupacion en vivo, tickets de entrada y salida, y la traza completa de quien hizo que.
            Cada empresa opera sobre sus propios datos.
          </p>
        </div>

        {/* Leyenda de los pilotos de bahia: adelanta el codigo de color del sistema */}
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {[
            ['Libre', 'var(--color-led-free)'],
            ['Ocupado', 'var(--color-led-taken)'],
            ['Reservado', 'var(--color-led-held)'],
          ].map(([texto, color]) => (
            <span
              key={texto}
              className="flex items-center gap-2 font-sign uppercase tracking-[0.15em] text-[0.65rem] text-white/50"
            >
              <span
                className="inline-block w-5 h-1.5 rounded-full"
                style={{ backgroundColor: color }}
                aria-hidden="true"
              />
              {texto}
            </span>
          ))}
        </div>
      </div>

      {/* Formulario */}
      <div className="flex items-center justify-center p-6 sm:p-12">
        <form onSubmit={alEnviar} className="w-full max-w-sm space-y-5">
          <div>
            <h2 className="text-2xl">Iniciar sesion</h2>
            <p className="text-ink-muted text-sm mt-1">
              Usa las credenciales que te entrego el administrador de tu empresa.
            </p>
          </div>

          {error && <Aviso tipo="error">{error}</Aviso>}

          {dominioFijaTenant ? (
            <Campo label="Empresa">
              <div className="font-data text-sm bg-deck-sunken border-2 border-line-strong rounded-[3px] px-3 py-2">
                {empresa}
              </div>
            </Campo>
          ) : (
            <Campo label="Empresa">
              <Entrada
                value={empresa}
                onChange={(evento) => setEmpresa(evento.target.value)}
                placeholder="empresa-a"
                autoComplete="organization"
                required
              />
            </Campo>
          )}

          <Campo label="Usuario">
            <Entrada
              value={usuario}
              onChange={(evento) => setUsuario(evento.target.value)}
              autoComplete="username"
              required
            />
          </Campo>

          <Campo label="Contrasena">
            <Entrada
              type="password"
              value={clave}
              onChange={(evento) => setClave(evento.target.value)}
              autoComplete="current-password"
              required
            />
          </Campo>

          <Boton type="submit" variante="primario" disabled={enviando} className="w-full">
            {enviando ? 'Entrando...' : 'Entrar'}
          </Boton>

          <p className="text-xs text-ink-faint">
            Tu sesion queda ligada a la empresa indicada. Un token emitido para otra empresa es
            rechazado por el sistema.
          </p>
        </form>
      </div>
    </div>
  );
}
