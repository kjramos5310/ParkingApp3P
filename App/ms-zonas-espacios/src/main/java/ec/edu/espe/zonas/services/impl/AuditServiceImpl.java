package ec.edu.espe.zonas.services.impl;

import ec.edu.espe.zonas.dto.response.AuditEventResponseDto;
import ec.edu.espe.zonas.entity.AuditEvent;
import ec.edu.espe.zonas.repository.AuditEventRepository;
import ec.edu.espe.zonas.services.interfaz.AuditService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuditServiceImpl implements AuditService {

    private static final String UNKNOWN_USER = "unknown";

    private final AuditEventRepository auditEventRepository;

    @Override
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordEvent(String action, String entityType, UUID entityId, String description) {
        try {
            HttpServletRequest request = currentRequest();

            AuditEvent auditEvent = AuditEvent.builder()
                    .username(resolveUsername(request))
                    .ipAddress(resolveIpAddress(request))
                    .macAddress(resolveMacAddress(request))
                    .httpMethod(request != null ? request.getMethod() : null)
                    .action(action)
                    .entityType(entityType)
                    .entityId(entityId != null ? entityId.toString() : null)
                    .description(description)
                    .requestPath(request != null ? request.getRequestURI() : null)
                    .build();

            auditEventRepository.save(auditEvent);
        } catch (RuntimeException ex) {
            log.warn("No se pudo registrar el evento de auditoria {} sobre {} {}", action, entityType, entityId, ex);
        }
    }

    @Override
    @Transactional(readOnly = true)
    public List<AuditEventResponseDto> listEvents() {
        return auditEventRepository.findAllByOrderByCreatedAtDesc().stream()
                .map(this::mapToResponse)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<AuditEventResponseDto> listEventsByEntityType(String entityType) {
        return auditEventRepository.findByEntityTypeOrderByCreatedAtDesc(entityType.toUpperCase()).stream()
                .map(this::mapToResponse)
                .toList();
    }

    private HttpServletRequest currentRequest() {
        if (RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes attributes) {
            return attributes.getRequest();
        }
        return null;
    }

    private String resolveUsername(HttpServletRequest request) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.isAuthenticated()) {
            Object principal = authentication.getPrincipal();
            if (principal instanceof UserDetails userDetails && StringUtils.hasText(userDetails.getUsername())) {
                return userDetails.getUsername();
            }
            if (principal instanceof String principalName && StringUtils.hasText(principalName)
                    && !"anonymousUser".equalsIgnoreCase(principalName)) {
                return principalName;
            }
            if (StringUtils.hasText(authentication.getName())
                    && !"anonymousUser".equalsIgnoreCase(authentication.getName())) {
                return authentication.getName();
            }
        }

        String usernameHeader = headerValue(request, "X-Username");
        if (StringUtils.hasText(usernameHeader)) {
            return usernameHeader;
        }

        String userIdHeader = headerValue(request, "X-User-Id");
        if (StringUtils.hasText(userIdHeader)) {
            return userIdHeader;
        }

        return UNKNOWN_USER;
    }

    private String resolveIpAddress(HttpServletRequest request) {
        String forwardedFor = headerValue(request, "X-Forwarded-For");
        if (StringUtils.hasText(forwardedFor)) {
            return forwardedFor.split(",")[0].trim();
        }

        String realIp = headerValue(request, "X-Real-IP");
        if (StringUtils.hasText(realIp)) {
            return realIp;
        }

        return request != null ? request.getRemoteAddr() : null;
    }

    private String resolveMacAddress(HttpServletRequest request) {
        // La MAC del cliente normalmente no se puede obtener de forma confiable por HTTP fuera de la red local.
        String clientMac = headerValue(request, "X-Client-Mac");
        return StringUtils.hasText(clientMac) ? clientMac : null;
    }

    private String headerValue(HttpServletRequest request, String headerName) {
        return request != null ? request.getHeader(headerName) : null;
    }

    private AuditEventResponseDto mapToResponse(AuditEvent event) {
        return AuditEventResponseDto.builder()
                .id(event.getId())
                .username(event.getUsername())
                .ipAddress(event.getIpAddress())
                .macAddress(event.getMacAddress())
                .httpMethod(event.getHttpMethod())
                .action(event.getAction())
                .entityType(event.getEntityType())
                .entityId(event.getEntityId())
                .description(event.getDescription())
                .requestPath(event.getRequestPath())
                .createdAt(event.getCreatedAt())
                .build();
    }
}
