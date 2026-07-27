package ec.edu.espe.zonas.sse;

import ec.edu.espe.zonas.dto.response.EspacioResponseDto;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import ec.edu.espe.zonas.tenant.TenantContext;

/**
 * Gestiona las conexiones SSE del dashboard y difunde los cambios de estado
 * de los espacios en tiempo real (evento "espacio_cambiado").
 */
@Service
public class EspacioEventService {

    private final Map<String, List<SseEmitter>> emittersByTenant = new ConcurrentHashMap<>();

    public SseEmitter subscribe() {
        String tenantId = TenantContext.get();
        List<SseEmitter> emitters = emittersByTenant.computeIfAbsent(tenantId, ignored -> new CopyOnWriteArrayList<>());
        SseEmitter emitter = new SseEmitter(0L); // sin timeout: la conexion permanece abierta
        emitters.add(emitter);
        emitter.onCompletion(() -> emitters.remove(emitter));
        emitter.onTimeout(() -> emitters.remove(emitter));
        emitter.onError(e -> emitters.remove(emitter));
        try {
            emitter.send(SseEmitter.event()
                    .name("INIT")
                    .data("Conexion establecida con ms-zonas-espacios"));
        } catch (IOException e) {
            emitters.remove(emitter);
        }
        return emitter;
    }

    public void publishEspacioCambiado(EspacioResponseDto espacio) {
        List<SseEmitter> emitters = emittersByTenant.getOrDefault(TenantContext.get(), List.of());
        for (SseEmitter emitter : emitters) {
            try {
                emitter.send(SseEmitter.event()
                        .name("espacio_cambiado")
                        .data(espacio));
            } catch (IOException e) {
                emitter.completeWithError(e);
                emitters.remove(emitter);
            }
        }
    }
}
