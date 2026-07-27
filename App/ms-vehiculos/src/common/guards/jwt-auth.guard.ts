import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly jwtSecret = process.env.JWT_SECRET || '9a7f34c2d6e9f1a0b3c8d7e6f5a4b3c2d1e0f9a8b7c6d5e4f3a2b1c0d9e8f7a6';

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const tenantId = String(request.headers['x-tenant-id'] || '').trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9-]{1,49}$/.test(tenantId)) {
      throw new UnauthorizedException('X-Tenant-ID es obligatorio y tiene un formato invalido');
    }
    const authHeader = request.headers['authorization'];
    const cookieName = `PARKING_TOKEN_${tenantId}=`;
    const cookieToken = String(request.headers.cookie || '').split(';')
      .map((part: string) => part.trim()).find((part: string) => part.startsWith(cookieName))?.slice(cookieName.length);
    if ((!authHeader || !authHeader.startsWith('Bearer ')) && !cookieToken) {
      throw new UnauthorizedException('Token no proporcionado o formato inválido');
    }

    const token = cookieToken || authHeader.split(' ')[1];
    try {
      const payload = jwt.verify(token, this.jwtSecret) as any;
      if (payload.tenant_id !== tenantId) {
        throw new UnauthorizedException('El token pertenece a otra empresa');
      }
      request.user = payload;
      request.tenantId = tenantId;

      const method = request.method;
      const roles: string[] = payload.roles || [];

      // Si es GET, cualquier usuario autenticado puede ingresar
      if (method === 'GET') {
        return true;
      }

      // Para otros métodos (POST, PUT, PATCH, DELETE), se requiere ADMIN
      const hasAdmin = roles.some(
        (role) => role.toUpperCase() === 'ROLE_ADMIN' || role.toUpperCase() === 'ADMIN'
      );
      if (!hasAdmin) {
        throw new UnauthorizedException('No tiene permisos para realizar esta operación');
      }

      return true;
    } catch (err) {
      throw new UnauthorizedException('Token inválido o expirado');
    }
  }
}
