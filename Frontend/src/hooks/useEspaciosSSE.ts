import { useEffect, useRef, useState } from 'react';
import { leerToken } from '../lib/api';
import type { Espacio } from '../lib/types';

export type EstadoStream = 'conectando' | 'en-vivo' | 'sin-conexion';

interface ResultadoSSE {
  /** Espacios que cambiaron desde que se abrio el stream, por id. */
  cambios: Map<string, Espacio>;
  /** Id del ultimo espacio que cambio, para destacarlo brevemente. */
  ultimoCambio: string | null;
  estado: EstadoStream;
}

/**
 * Suscripcion al stream de disponibilidad de espacios.
 *
 * Kong publica el stream de ms-zonas en /api/sse. La API EventSource del
 * navegador no admite cabeceras propias, asi que el tenant y el token viajan
 * como parametros de la URL: tanto el plugin jwt de Kong (uri_param_names)
 * como el filtro de ms-zonas los leen desde ahi.
 *
 * EventSource reconecta solo; unicamente reflejamos el estado de la conexion
 * para que el operador sepa si lo que ve sigue siendo el dato en vivo.
 */
export function useEspaciosSSE(tenant: string): ResultadoSSE {
  const [cambios, setCambios] = useState<Map<string, Espacio>>(new Map());
  const [ultimoCambio, setUltimoCambio] = useState<string | null>(null);
  const [estado, setEstado] = useState<EstadoStream>('conectando');
  const temporizador = useRef<number | undefined>(undefined);

  useEffect(() => {
    const token = leerToken();
    if (!tenant || !token) return;

    const url = `/api/sse?tenant_id=${encodeURIComponent(tenant)}&jwt=${encodeURIComponent(token)}`;
    const fuente = new EventSource(url);

    fuente.addEventListener('INIT', () => setEstado('en-vivo'));
    fuente.onopen = () => setEstado('en-vivo');
    fuente.onerror = () => setEstado('sin-conexion');

    fuente.addEventListener('espacio_cambiado', (evento) => {
      try {
        const espacio = JSON.parse((evento as MessageEvent).data) as Espacio;
        setCambios((previos) => new Map(previos).set(espacio.id, espacio));
        setUltimoCambio(espacio.id);
        setEstado('en-vivo');

        // El destello dura lo mismo que la animacion de la bahia.
        window.clearTimeout(temporizador.current);
        temporizador.current = window.setTimeout(() => setUltimoCambio(null), 1000);
      } catch {
        // Un mensaje malformado no debe tumbar el dashboard.
      }
    });

    return () => {
      window.clearTimeout(temporizador.current);
      fuente.close();
    };
  }, [tenant]);

  return { cambios, ultimoCambio, estado };
}
