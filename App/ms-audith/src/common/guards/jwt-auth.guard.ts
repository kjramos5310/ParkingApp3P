import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly secret = process.env.JWT_SECRET || '9a7f34c2d6e9f1a0b3c8d7e6f5a4b3c2d1e0f9a8b7c6d5e4f3a2b1c0d9e8f7a6';
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const tenantId = String(request.headers['x-tenant-id'] || '').trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9-]{1,49}$/.test(tenantId)) throw new UnauthorizedException('X-Tenant-ID invalido');
    const auth = String(request.headers.authorization || '');
    const cookieName = `PARKING_TOKEN_${tenantId}=`;
    const cookieToken = String(request.headers.cookie || '').split(';')
      .map((part: string) => part.trim()).find((part: string) => part.startsWith(cookieName))?.slice(cookieName.length);
    if (!auth.startsWith('Bearer ') && !cookieToken) throw new UnauthorizedException('Token no proporcionado');
    try {
      const payload = jwt.verify(cookieToken || auth.slice(7), this.secret) as any;
      if (payload.tenant_id !== tenantId) throw new Error('tenant mismatch');
      request.user = payload;
      request.tenantId = tenantId;
      return true;
    } catch { throw new UnauthorizedException('Token invalido o de otra empresa'); }
  }
}
