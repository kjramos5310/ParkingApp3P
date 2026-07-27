import { useCallback, useEffect, useState } from 'react';

interface EstadoRecurso<T> {
  datos: T | null;
  cargando: boolean;
  error: string | null;
  recargar: () => void;
}

/**
 * Carga un recurso de la API y expone su estado.
 *
 * `cargar` debe ser estable (envuelto en useCallback por quien lo usa), ya que
 * es la dependencia que decide cuando se vuelve a pedir el dato.
 */
export function useRecurso<T>(cargar: () => Promise<T>): EstadoRecurso<T> {
  const [datos, setDatos] = useState<T | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  const recargar = useCallback(() => setVersion((actual) => actual + 1), []);

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    setError(null);

    cargar()
      .then((resultado) => {
        if (vigente) setDatos(resultado);
      })
      .catch((fallo: unknown) => {
        if (vigente) setError(fallo instanceof Error ? fallo.message : 'No se pudo cargar la informacion.');
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });

    // Evita que una respuesta lenta pise el estado de una peticion posterior.
    return () => {
      vigente = false;
    };
  }, [cargar, version]);

  return { datos, cargando, error, recargar };
}
