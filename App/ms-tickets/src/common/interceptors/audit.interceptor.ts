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
 * Publica un evento de auditoria por cada operacion sobre tickets.
 *
 * El ciclo de vida del ticket (entrada, cobro y salida del vehiculo) es la
 * traza mas sensible del sistema, de modo que se auditan tanto las respuestas
 * exitosas como los errores.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);
  private cachedPublicIp = '127.0.0.1';

  /** Debe cumplir la validacion /^[a-z_]+$/ con 4-15 caracteres. */
  private static readonly ENTIDAD = 'tickets';
  private static readonly SERVICIO = 'ms-tickets';
  private static readonly IPV4 = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/;

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

  private resolveAccion(method: string): string {
    if (method === 'POST') return 'CREATE';
    if (method === 'PUT' || method === 'PATCH') return 'UPDATE';
    if (method === 'DELETE') return 'DELETE';
    return 'READ';
  }

  private resolveIp(request: any): string {
    let clientIp =
      request.headers['x-forwarded-for']?.toString().split(',')[0].trim() ||
      request.headers['x-real-ip']?.toString() ||
      request.ip ||
      this.cachedPublicIp ||
      '127.0.0.1';

    // Direccion local IPv6: usar la IP publica cacheada del servidor.
    if (clientIp === '::1' || clientIp === '::ffff:127.0.0.1') {
      clientIp = this.cachedPublicIp !== '127.0.0.1' ? this.cachedPublicIp : '127.0.0.1';
    }

    return AuditInterceptor.IPV4.test(clientIp) ? clientIp : '127.0.0.1';
  }

  /** Normaliza al formato que exige el DTO: 3-100 chars, /^[a-zA-Z0-9._\-@ ]+$/ */
  private resolveUsuario(user: any): string {
    let usuario = user?.sub || user?.username || 'admin_user';
    if (usuario.length < 3) usuario = `${usuario}_user`;
    if (usuario.length > 100) usuario = usuario.substring(0, 100);
    return usuario;
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, body, params, user } = request;

    const accion = this.resolveAccion(method);
    const ip = this.resolveIp(request);
    const mac = this.getMacAddress();
    const usuario = this.resolveUsuario(user);
    const idUsuario = user?.id ? Number(user.id) : 1;

    const publicar = async (datos: Record<string, any>, idVehiculo?: string) => {
      try {
        const evento: AuditEvent = {
          tenant_id: request.tenantId,
          servicio: AuditInterceptor.SERVICIO,
          accion,
          entidad: AuditInterceptor.ENTIDAD,
          datos,
          fecha_hora: new Date(),
          id_usuario: idUsuario,
          usuario,
          ip,
          mac,
          id_vehiculo: idVehiculo,
        };
        await this.eventPublisher.publishAuditEvent(evento);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        this.logger.error(`Error publicando evento de auditoria: ${errMsg}`);
      }
    };

    return next.handle().pipe(
      tap({
        next: async (responseBody) => {
          // La placa permite rastrear que vehiculo genero el movimiento.
          const placa = responseBody?.placa ?? body?.placa;
          await publicar(
            {
              url,
              method,
              body: body ? JSON.parse(JSON.stringify(body)) : {},
              response: responseBody ? JSON.parse(JSON.stringify(responseBody)) : {},
            },
            typeof placa === 'string' ? placa : undefined,
          );
        },
        error: async (err) => {
          await publicar({
            url,
            method,
            params: params ?? {},
            body: body ? JSON.parse(JSON.stringify(body)) : {},
            error: err instanceof Error ? err.message : String(err),
          });
        },
      }),
    );
  }
}
