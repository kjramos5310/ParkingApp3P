package ec.edu.espe.usuarios.audit;

import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import jakarta.servlet.http.HttpServletRequest;
import java.net.NetworkInterface;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.Enumeration;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * Publica eventos de auditoria a RabbitMQ. Captura automaticamente
 * el usuario autenticado, la IP y la MAC del solicitante.
 *
 * Sigue el mismo estilo que el interceptor de ms-vehiculos:
 *  - usa la IP publica del servidor cuando el request es local (localhost/IPv6)
 *  - toma la MAC de la primera tarjeta de red real
 *
 * Es resiliente: si RabbitMQ no esta disponible, solo registra el error
 * y NO interrumpe la operacion de negocio que disparo el evento.
 */
@Slf4j
@Service
public class AuditPublisher {

    private static final Pattern IPV4 = Pattern.compile("^(?:[0-9]{1,3}\\.){3}[0-9]{1,3}$");

    private final RabbitTemplate rabbitTemplate;
    private final String exchange;
    private final String routingKey;
    private final String servicio;

    /** IP publica del servidor, cacheada al arrancar (como en ms-vehiculos). */
    private volatile String cachedPublicIp = "127.0.0.1";

    public AuditPublisher(RabbitTemplate auditRabbitTemplate,
                          @Value("${app.audit.exchange:audit_exchange}") String exchange,
                          @Value("${app.audit.routing-key:audit_routing_key}") String routingKey,
                          @Value("${app.audit.servicio:ms-usuarios}") String servicio) {
        this.rabbitTemplate = auditRabbitTemplate;
        this.exchange = exchange;
        this.routingKey = routingKey;
        this.servicio = servicio;
    }

    /** Consulta la IP publica en segundo plano para no bloquear el arranque. */
    @PostConstruct
    void fetchPublicIp() {
        Thread t = new Thread(() -> {
            try {
                HttpClient client = HttpClient.newBuilder()
                        .connectTimeout(Duration.ofSeconds(3))
                        .build();
                HttpRequest req = HttpRequest.newBuilder()
                        .uri(URI.create("https://api.ipify.org"))
                        .timeout(Duration.ofSeconds(3))
                        .GET()
                        .build();
                HttpResponse<String> res = client.send(req, HttpResponse.BodyHandlers.ofString());
                String ip = res.body().trim();
                if (IPV4.matcher(ip).matches()) {
                    this.cachedPublicIp = ip;
                    log.info("IP publica del servidor cacheada para auditoria: {}", ip);
                }
            } catch (Exception ex) {
                log.warn("No se pudo obtener la IP publica al arrancar: {}", ex.getMessage());
            }
        }, "audit-public-ip");
        t.setDaemon(true);
        t.start();
    }

    /**
     * Publica un evento de auditoria.
     *
     * @param accion  CREATE, UPDATE, DELETE, ...
     * @param entidad tabla afectada (solo minusculas/guion bajo, 4-15 chars). Ej: "roles"
     * @param datos   detalle del cambio (id, nombre, etc.)
     */
    public void publish(String accion, String entidad, Map<String, Object> datos) {
        try {
            HttpServletRequest request = currentRequest();

            AuditEvent event = AuditEvent.builder()
                    .servicio(servicio)
                    .accion(accion)
                    .entidad(entidad)
                    .datos(datos)
                    .fechaHora(OffsetDateTime.now().toString())
                    .idUsuario(currentUserId())
                    .usuario(currentUser())
                    .ip(resolveIp(request))
                    .mac(resolveMac(request))
                    .build();

            rabbitTemplate.convertAndSend(exchange, routingKey, event);
            log.info("Evento de auditoria publicado: {} {} por {}", accion, entidad, event.getUsuario());
        } catch (Exception ex) {
            log.error("No se pudo publicar el evento de auditoria ({} {}): {}", accion, entidad, ex.getMessage());
        }
    }

    private HttpServletRequest currentRequest() {
        try {
            ServletRequestAttributes attrs =
                    (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
            return attrs != null ? attrs.getRequest() : null;
        } catch (Exception ex) {
            return null;
        }
    }

    private String currentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated() && auth.getName() != null
                && !"anonymousUser".equals(auth.getName())) {
            return auth.getName();
        }
        return "sistema";
    }

    /**
     * El sistema identifica a los usuarios por UUID, pero el DTO de auditoria
     * espera un entero. Igual que ms-vehiculos, usamos 1 por defecto.
     */
    private Integer currentUserId() {
        return 1;
    }

    /** Devuelve una IPv4 valida (el DTO de audit exige IPv4). */
    private String resolveIp(HttpServletRequest request) {
        String ip = null;
        if (request != null) {
            String fwd = request.getHeader("X-Forwarded-For");
            if (fwd != null && !fwd.isBlank()) {
                ip = fwd.split(",")[0].trim();
            } else if (request.getHeader("X-Real-IP") != null) {
                ip = request.getHeader("X-Real-IP").trim();
            } else {
                ip = request.getRemoteAddr();
            }
        }
        // Request local (loopback / IPv6) -> usar la IP publica cacheada, como ms-vehiculos
        if (ip == null || ip.isBlank() || ip.contains(":") || "127.0.0.1".equals(ip)) {
            ip = cachedPublicIp;
        }
        return IPV4.matcher(ip).matches() ? ip : "127.0.0.1";
    }

    /**
     * MAC de la primera tarjeta de red real del servidor (no loopback,
     * no virtual, con direccion fisica valida). Igual que ms-vehiculos.
     */
    private String resolveMac(HttpServletRequest request) {
        if (request != null) {
            String headerMac = request.getHeader("X-Client-MAC");
            if (headerMac != null && headerMac.matches("([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}")) {
                return headerMac.replace('-', ':').toUpperCase();
            }
        }
        try {
            Enumeration<NetworkInterface> ifaces = NetworkInterface.getNetworkInterfaces();
            while (ifaces.hasMoreElements()) {
                NetworkInterface ni = ifaces.nextElement();
                if (ni.isLoopback() || !ni.isUp()) {
                    continue;
                }
                byte[] mac = ni.getHardwareAddress();
                if (mac != null && mac.length == 6 && !isZeroMac(mac)) {
                    StringBuilder sb = new StringBuilder();
                    for (int i = 0; i < mac.length; i++) {
                        sb.append(String.format("%02X%s", mac[i], (i < mac.length - 1) ? ":" : ""));
                    }
                    return sb.toString();
                }
            }
        } catch (Exception ignored) {
            // sin acceso a la MAC: usamos el fallback
        }
        return "00:00:00:00:00:00";
    }

    private boolean isZeroMac(byte[] mac) {
        for (byte b : mac) {
            if (b != 0) {
                return false;
            }
        }
        return true;
    }
}
