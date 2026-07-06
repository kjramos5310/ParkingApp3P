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

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);
  private cachedPublicIp = '127.0.0.1';

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

    // Mapping HTTP method to auditoria accion: crear, actualizar, eliminar, consultar
    let accion = 'consultar';
    if (method === 'POST') accion = 'crear';
    if (method === 'PUT' || method === 'PATCH') accion = 'actualizar';
    if (method === 'DELETE') accion = 'eliminar';

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
              servicio: 'ms-vehiculos',
              accion,
              entidad,
              datos: {
                url,
                method,
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
              servicio: 'ms-vehiculos',
              accion,
              entidad,
              datos: {
                url,
                method,
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
