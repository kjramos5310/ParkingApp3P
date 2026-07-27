package ec.edu.espe.zonas.cache;

import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.function.Supplier;
import ec.edu.espe.zonas.tenant.TenantContext;

/**
 * Cache basada en Redis para las lecturas de espacios.
 * Registra en logs: "Cache HIT", "Cache MISS", "Cache SET", "Cache EVICT".
 * Si Redis no esta disponible, degrada de forma transparente (consulta directa a la BD).
 */
@Service
public class RedisCacheService {

    private static final Logger log = LoggerFactory.getLogger("RedisCache");

    private final StringRedisTemplate redis;
    private final ObjectMapper mapper;
    private final long defaultTtl;

    public RedisCacheService(StringRedisTemplate redis,
                             ObjectMapper mapper,
                             @Value("${redis.ttl:60}") long defaultTtl) {
        this.redis = redis;
        this.mapper = mapper;
        this.defaultTtl = defaultTtl;
    }

    /**
     * Devuelve el valor de cache si existe (HIT); si no, ejecuta {@code factory},
     * cachea el resultado (SET) y lo devuelve (MISS).
     */
    public <T> T getOrSet(String key, TypeReference<T> type, Supplier<T> factory) {
        return getOrSet(key, type, factory, defaultTtl);
    }

    public <T> T getOrSet(String key, TypeReference<T> type, Supplier<T> factory, long ttlSeconds) {
        key = TenantContext.get() + ":" + key;
        try {
            String cached = redis.opsForValue().get(key);
            if (cached != null) {
                log.info("Cache HIT  {}", key);
                return mapper.readValue(cached, type);
            }
            log.info("Cache MISS {}", key);
        } catch (Exception e) {
            // Redis caido o error de parseo: seguimos sin cache
            log.warn("Redis no disponible para GET {} ({})", key, e.getMessage());
        }

        T value = factory.get();

        if (value != null) {
            try {
                redis.opsForValue().set(key, mapper.writeValueAsString(value), Duration.ofSeconds(ttlSeconds));
                log.info("Cache SET  {} (ttl={}s)", key, ttlSeconds);
            } catch (Exception e) {
                // No se pudo cachear, devolvemos el valor igualmente
                log.warn("Redis no disponible para SET {} ({})", key, e.getMessage());
            }
        }

        return value;
    }

    /** Invalida una clave (se llama cuando cambia algun espacio). */
    public void evict(String key) {
        key = TenantContext.get() + ":" + key;
        try {
            redis.delete(key);
            log.info("Cache EVICT {}", key);
        } catch (Exception e) {
            log.warn("Redis no disponible para EVICT {} ({})", key, e.getMessage());
        }
    }
}
