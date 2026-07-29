import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { EventPublisher, AuditEvent } from '../event.publisher.service';
import * as os from 'os';
import * as https from 'https';

/**
 * Publica un evento de auditoria por cada operacion sobre vehiculos.
 *
 * Igual que en ms-tickets, un intento rechazado NO se registra con la accion
 * que se pretendia ejecutar sino con REJECT: el segundo registro de una placa
 * ya existente en el tenant deja un REJECT (409), nunca un CREATE, de modo que
 * la auditoria no sugiere que el duplicado llego a persistirse.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);
  private cachedPublicIp = '127.0.0.1';

  /** Accion con la que se registran los intentos que el negocio rechazo. */
  private static readonly ACCION_RECHAZO = 'REJECT';

  /** Codigo HTTP con el que se respondio el rechazo (409, 403, ...). */
  private static resolveStatus(err: unknown): number {
    const status = (err as any)?.status ?? (err as any)?.getStatus?.();
    return typeof status === 'number' ? status : 500;
  }

  constructor(private readonly eventPublisher: EventPublisher) {
    this.fetchPublicIp();
  }

  private fetchPublicIp() {
    https.get('https://api.ipify.org', (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        this.cachedPublicIp = data.trim();
        this.logger.log(`Server Public IP cached: ${this.cachedPublicIp}`);
      });
    }).on('error', (err) => {
      this.logger.warn(`Could not fetch public IP on startup: ${err.message}`);
    });
  }

  private getMacAddress(): string {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      const iface = interfaces[name];
      if (iface) {
        for (const entry of iface) {
          if (!entry.internal && entry.mac && entry.mac !== '00:00:00:00:00:00') {
            return entry.mac;
          }
        }
      }
    }
    return '00:00:00:00:00:00';
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, body, params, user } = request;

    // Vocabulario unificado con ms-usuarios, ms-zonas y ms-tickets para que el
    // panel de auditoria pueda filtrar por accion en todos los servicios.
    let accion = 'READ';
    if (method === 'POST') accion = 'CREATE';
    if (method === 'PUT' || method === 'PATCH') accion = 'UPDATE';
    if (method === 'DELETE') accion = 'DELETE';

    // Must be lowercase and simple to pass entity regex validation /^[a-z_]+$/
    const entidad = 'vehiculo'; 

    let clientIp =
      request.headers['x-forwarded-for']?.toString().split(',')[0].trim() ||
      request.headers['x-real-ip']?.toString() ||
      request.ip ||
      this.cachedPublicIp ||
      '127.0.0.1';

    // If clientIp is an IPv6 local address, use the cached public IP or fallback to 127.0.0.1
    if (clientIp === '::1' || clientIp === '::ffff:127.0.0.1') {
      clientIp = this.cachedPublicIp !== '127.0.0.1' ? this.cachedPublicIp : '127.0.0.1';
    }

    // Ensure it conforms to class-validator IsIP('4') regex
    const ipv4Regex = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/;
    const formattedIp = ipv4Regex.test(clientIp) ? clientIp : '127.0.0.1';

    const mac = this.getMacAddress();

    return next.handle().pipe(
      tap({
        next: async (responseBody) => {
          try {
            // Retrieve id_vehiculo if it's set in route params or response body
            let id_vehiculo = responseBody?.id || params?.id;
            if (typeof id_vehiculo !== 'string') {
              id_vehiculo = undefined;
            }

            // Extract user information
            const id_usuario = user?.id ? Number(user.id) : 1;
            
            // Flexibly extract username, must pass length of 3-100 and regex /^[a-zA-Z0-9._\-@ ]+$/
            let usuarioStr = user?.sub || user?.username || 'admin_user';
            if (usuarioStr.length < 3) {
              usuarioStr = usuarioStr + '_user';
            }
            if (usuarioStr.length > 100) {
              usuarioStr = usuarioStr.substring(0, 100);
            }

            const auditEvent: AuditEvent = {
              tenant_id: request.tenantId,
              servicio: 'ms-vehiculos',
              accion,
              entidad,
              datos: {
                url,
                method,
                resultado: 'EXITOSO',
                body: body ? JSON.parse(JSON.stringify(body)) : {},
                response: responseBody ? JSON.parse(JSON.stringify(responseBody)) : {},
              },
              fecha_hora: new Date(),
              id_usuario,
              usuario: usuarioStr,
              ip: formattedIp,
              mac,
              id_vehiculo,
            };

            await this.eventPublisher.publishAuditEvent(auditEvent);
          } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            this.logger.error(`Error in audit interceptor after response: ${errMsg}`);
          }
        },
        error: async (err) => {
          // Log failed requests as well if needed
          try {
            const id_usuario = user?.id ? Number(user.id) : 1;
            let usuarioStr = user?.sub || user?.username || 'admin_user';
            
            const auditEvent: AuditEvent = {
              tenant_id: request.tenantId,
              servicio: 'ms-vehiculos',
              // El intento fallido nunca se audita como la operacion original.
              accion: AuditInterceptor.ACCION_RECHAZO,
              entidad,
              datos: {
                url,
                method,
                resultado: 'RECHAZADO',
                // Operacion que se pretendia ejecutar y que NO llego a ocurrir.
                operacion_intentada: accion,
                http_status: AuditInterceptor.resolveStatus(err),
                body: body ? JSON.parse(JSON.stringify(body)) : {},
                error: err instanceof Error ? err.message : String(err),
              },
              fecha_hora: new Date(),
              id_usuario,
              usuario: usuarioStr,
              ip: formattedIp,
              mac,
            };

            await this.eventPublisher.publishAuditEvent(auditEvent);
          } catch (interceptorErr) {
            // Silent error inside interceptor error callback to not hide actual request error
          }
        }
      })
    );
  }
}
