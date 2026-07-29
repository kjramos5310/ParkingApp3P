import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * Cache basada en Redis para las validaciones de persona/vehiculo de ms-tickets.
 * Registra en logs: "Cache HIT", "Cache MISS", "Cache SET".
 * Si Redis no esta disponible, degrada de forma transparente (consulta directa).
 */
@Injectable()
export class RedisCacheService implements OnModuleDestroy {
  private readonly logger = new Logger('RedisCache');
  private readonly client: Redis;
  private readonly defaultTtl: number;
  private conectado = false;

  constructor(config: ConfigService) {
    const host = config.get<string>('REDIS_HOST') || 'localhost';
    const port = parseInt(config.get<string>('REDIS_PORT') || '6379', 10);
    this.defaultTtl = parseInt(config.get<string>('REDIS_TTL') || '60', 10);

    this.client = new Redis({
      host,
      port,
      // Fallar rapido si Redis no responde, en vez de encolar comandos
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      retryStrategy: (times) => Math.min(times * 300, 3000),
    });

    this.client.on('ready', () => {
      if (!this.conectado) this.logger.log(`Conectado a Redis en ${host}:${port}`);
      this.conectado = true;
    });
    this.client.on('error', (e) => {
      if (this.conectado) this.logger.warn(`Redis no disponible: ${e.message}`);
      this.conectado = false;
    });
  }

  /**
   * Devuelve el valor de cache si existe (HIT); si no, ejecuta `factory`,
   * cachea el resultado (SET) y lo devuelve (MISS).
   * Los errores de `factory` se propagan y NO se cachean.
   */
  async getOrSet<T>(tenantId: string, key: string, factory: () => Promise<T>, ttlSeconds?: number): Promise<T> {
    key = `${tenantId}:${key}`;
    const ttl = ttlSeconds ?? this.defaultTtl;

    try {
      const cached = await this.client.get(key);
      if (cached !== null) {
        this.logger.log(`Cache HIT  ${key}`);
        return JSON.parse(cached) as T;
      }
      this.logger.log(`Cache MISS ${key}`);
    } catch {
      // Redis caido: seguimos sin cache
    }

    const value = await factory();

    if (value !== null && value !== undefined) {
      try {
        await this.client.set(key, JSON.stringify(value), 'EX', ttl);
        this.logger.log(`Cache SET  ${key} (ttl=${ttl}s)`);
      } catch {
        // Redis caido: no se cachea, pero devolvemos el valor igualmente
      }
    }

    return value;
  }

  /** Invalida una clave (util cuando cambia el recurso). */
  async del(key: string): Promise<void> {
    try {
      await this.client.del(key);
    } catch {
      /* noop */
    }
  }

  onModuleDestroy(): void {
    this.client.quit().catch(() => this.client.disconnect());
  }
}
