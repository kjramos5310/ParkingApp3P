import { SetMetadata } from '@nestjs/common';

/**
 * Marca un endpoint como público para que el JwtAuthGuard global lo omita.
 * Necesario, por ejemplo, para el stream SSE que consume el navegador
 * (EventSource no puede enviar el header Authorization).
 */
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
