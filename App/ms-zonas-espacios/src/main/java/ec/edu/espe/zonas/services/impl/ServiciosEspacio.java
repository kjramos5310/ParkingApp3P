package ec.edu.espe.zonas.services.impl;

import tools.jackson.core.type.TypeReference;
import ec.edu.espe.zonas.audit.AuditPublisher;
import ec.edu.espe.zonas.cache.RedisCacheService;
import ec.edu.espe.zonas.dto.request.EspacioRequestDTO;
import ec.edu.espe.zonas.dto.response.EspacioResponseDto;
import ec.edu.espe.zonas.entity.EstadoEspacio;
import ec.edu.espe.zonas.entity.Espacio;
import ec.edu.espe.zonas.entity.Zona;
import ec.edu.espe.zonas.repository.EspacioRepository;
import ec.edu.espe.zonas.repository.ZonaRepositorio;
import ec.edu.espe.zonas.services.interfaz.EspacioService;
import ec.edu.espe.zonas.sse.EspacioEventService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import ec.edu.espe.zonas.tenant.TenantContext;

@Service
@RequiredArgsConstructor
public class ServiciosEspacio implements EspacioService {

    private static final String CACHE_ESPACIOS = "espacios:all";

    /** Entidad reportada a auditoria (debe cumplir ^[a-z_]{4,15}$). */
    private static final String ENTIDAD_AUDIT = "espacios";

    private final EspacioRepository espacioRepository;
    private final ZonaRepositorio zonaRepositorio;
    private final EspacioEventService espacioEventService;
    private final RedisCacheService cache;
    private final AuditPublisher auditPublisher;

    @Override
    @Transactional(readOnly = true)
    public List<EspacioResponseDto> obtenerEspacios() {
        // Cache Redis: la 1ra lectura consulta la BD (MISS+SET); las siguientes salen de Redis (HIT).
        // Se invalida (EVICT) cada vez que un espacio cambia (crear/actualizar/eliminar/cambiar estado).
        return cache.getOrSet(
                CACHE_ESPACIOS,
                new TypeReference<List<EspacioResponseDto>>() {},
                () -> espacioRepository.findAllByTenantId(TenantContext.get()).stream()
                        .filter(Espacio::isActive)
                        .map(this::mapToEspacioResponseDto)
                        .collect(Collectors.toList()));
    }

    @Override
    @Transactional
    public EspacioResponseDto crearEspacio(EspacioRequestDTO requestDTO) {
        Zona zona = zonaRepositorio.findByTenantIdAndId(TenantContext.get(), requestDTO.getIdZona())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "La zona especificada no existe"));

        // Validar capacidad de la zona
        long activeSpacesCount = espacioRepository.findByTenantIdAndZonaId(TenantContext.get(), zona.getId()).stream()
                .filter(Espacio::isActive)
                .count();

        if (activeSpacesCount >= zona.getCapacidad()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, 
                    "No se puede crear el espacio. La zona '" + zona.getNombre() + "' ha alcanzado su capacidad máxima de " + zona.getCapacidad() + " espacios.");
        }

        if (espacioRepository.existsByTenantIdAndNombre(TenantContext.get(), requestDTO.getNombre())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Ya existe un espacio con el nombre: " + requestDTO.getNombre());
        }

        long nextIndex = activeSpacesCount + 1;
        
        // Validar que el secuencial incremental del espacio no sea superior a la capacidad de la zona
        if (nextIndex > zona.getCapacidad()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, 
                    "No se puede crear el espacio. El secuencial del espacio (" + nextIndex + ") supera la capacidad máxima de la zona (" + zona.getCapacidad() + ").");
        }

        // El código y el nombre del espacio se autogeneran obligatoriamente con el formato Zon-TipoZona-Incremental-Incremental,
        // relacionándose directamente con la zona asociada
        String codigo = String.format("%s-%02d", zona.getCodigo(), nextIndex);
        
        // Garantizar unicidad en caso de que existan códigos similares
        int offset = 1;
        while (espacioRepository.existsByTenantIdAndCodigo(TenantContext.get(), codigo)) {
            codigo = String.format("%s-%02d", zona.getCodigo(), nextIndex + offset);
            offset++;
        }

        String nombre = codigo;

        Espacio espacio = Espacio.builder()
                .tenantId(TenantContext.get())
                .nombre(nombre)
                .codigo(codigo.toUpperCase())
                .descripcion(requestDTO.getDescripcion())
                .tipo(requestDTO.getTipo())
                .zona(zona)
                .estado(EstadoEspacio.DISPONIBLE)
                .build();

        espacio = espacioRepository.save(espacio);
        EspacioResponseDto dto = mapToEspacioResponseDto(espacio);
        espacioEventService.publishEspacioCambiado(dto);
        cache.evict(CACHE_ESPACIOS);
        auditPublisher.publish("CREATE", ENTIDAD_AUDIT, datosDe(dto));
        return dto;
    }

    @Override
    @Transactional
    public EspacioResponseDto actualizarEspacio(UUID id, EspacioRequestDTO requestDTO) {
        Espacio espacio = espacioRepository.findByTenantIdAndId(TenantContext.get(), id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Espacio no encontrado"));

        if (!espacio.getNombre().equalsIgnoreCase(requestDTO.getNombre()) && 
                espacioRepository.existsByTenantIdAndNombre(TenantContext.get(), requestDTO.getNombre())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Ya existe otro espacio con el nombre: " + requestDTO.getNombre());
        }

        if (requestDTO.getCodigo() != null && !requestDTO.getCodigo().equalsIgnoreCase(espacio.getCodigo()) && 
                espacioRepository.existsByTenantIdAndCodigo(TenantContext.get(), requestDTO.getCodigo())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Ya existe otro espacio con el codigo: " + requestDTO.getCodigo());
        }

        Zona zona = espacio.getZona();
        // Si cambia de zona, validar la capacidad de la nueva zona
        if (!zona.getId().equals(requestDTO.getIdZona())) {
            zona = zonaRepositorio.findByTenantIdAndId(TenantContext.get(), requestDTO.getIdZona())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "La nueva zona especificada no existe"));

            long activeSpacesInNewZone = espacioRepository.findByTenantIdAndZonaId(TenantContext.get(), zona.getId()).stream()
                    .filter(Espacio::isActive)
                    .count();

            if (activeSpacesInNewZone >= zona.getCapacidad()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, 
                        "No se puede transferir el espacio. La zona '" + zona.getNombre() + "' ha alcanzado su capacidad máxima de " + zona.getCapacidad() + " espacios.");
            }
            espacio.setZona(zona);
        }

        espacio.setNombre(requestDTO.getNombre());
        if (requestDTO.getCodigo() != null && !requestDTO.getCodigo().trim().isEmpty()) {
            espacio.setCodigo(requestDTO.getCodigo().toUpperCase());
        }
        espacio.setDescripcion(requestDTO.getDescripcion());
        espacio.setTipo(requestDTO.getTipo());

        espacio = espacioRepository.save(espacio);
        EspacioResponseDto dto = mapToEspacioResponseDto(espacio);
        espacioEventService.publishEspacioCambiado(dto);
        cache.evict(CACHE_ESPACIOS);
        auditPublisher.publish("UPDATE", ENTIDAD_AUDIT, datosDe(dto));
        return dto;
    }

    @Override
    @Transactional
    public void eliminarEspacio(UUID id) {
        Espacio espacio = espacioRepository.findByTenantIdAndId(TenantContext.get(), id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Espacio no encontrado"));
        espacio.setActive(false);
        espacio = espacioRepository.save(espacio);
        EspacioResponseDto dto = mapToEspacioResponseDto(espacio);
        espacioEventService.publishEspacioCambiado(dto);
        cache.evict(CACHE_ESPACIOS);
        auditPublisher.publish("DELETE", ENTIDAD_AUDIT, datosDe(dto));
    }

    @Override
    @Transactional(readOnly = true)
    public EspacioResponseDto obtenerEspacio(UUID id) {
        Espacio espacio = espacioRepository.findByTenantIdAndId(TenantContext.get(), id)
                .filter(Espacio::isActive)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Espacio no encontrado"));
        return mapToEspacioResponseDto(espacio);
    }

    @Override
    @Transactional(readOnly = true)
    public List<EspacioResponseDto> obtenerEspaciosPorEstado(EstadoEspacio estado) {
        return espacioRepository.findByTenantIdAndEstado(TenantContext.get(), estado).stream()
                .filter(Espacio::isActive)
                .map(this::mapToEspacioResponseDto)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public List<EspacioResponseDto> obtenerEspaciosPorZona(UUID idZona) {
        if (!zonaRepositorio.existsByTenantIdAndId(TenantContext.get(), idZona)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "La zona especificada no existe");
        }
        // Incluye espacios deshabilitados para poder mostrarlos en la vista de zona
        return espacioRepository.findByTenantIdAndZonaId(TenantContext.get(), idZona).stream()
                .map(this::mapToEspacioResponseDto)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional
    public void deshabilitarEspaciosDeZona(UUID idZona) {
        List<Espacio> espacios = espacioRepository.findByTenantIdAndZonaId(TenantContext.get(), idZona);
        for (Espacio espacio : espacios) {
            if (espacio.isActive()) {
                espacio.setActive(false);
                espacio = espacioRepository.save(espacio);
                espacioEventService.publishEspacioCambiado(mapToEspacioResponseDto(espacio));
            }
        }
        cache.evict(CACHE_ESPACIOS);
    }

    @Override
    @Transactional(readOnly = true)
    public List<EspacioResponseDto> obtenerEspaciosPorZonaYPorEstado(UUID idZona, EstadoEspacio estado) {
        if (!zonaRepositorio.existsByTenantIdAndId(TenantContext.get(), idZona)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "La zona especificada no existe");
        }
        return espacioRepository.findByTenantIdAndZonaIdAndEstado(TenantContext.get(), idZona, estado).stream()
                .filter(Espacio::isActive)
                .map(this::mapToEspacioResponseDto)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public Map<String, List<EspacioResponseDto>> obtenerEspaciosPorEstadoAgrupadosPorZona(EstadoEspacio estado) {
        // Obtenemos los espacios optimizadamente con JOIN FETCH para evitar N+1 queries de JPA
        List<Espacio> espacios = espacioRepository.findByEstadoWithZona(TenantContext.get(), estado);
        
        return espacios.stream()
                .filter(Espacio::isActive)
                .collect(Collectors.groupingBy(
                        e -> e.getZona().getNombre(),
                        Collectors.mapping(this::mapToEspacioResponseDto, Collectors.toList())
                ));
    }

    @Override
    @Transactional
    public EspacioResponseDto cambiarEstado(UUID id, EstadoEspacio estado) {
        Espacio espacio = espacioRepository.findByTenantIdAndId(TenantContext.get(), id)
                .filter(Espacio::isActive)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Espacio no encontrado"));

        // No se puede ocupar/reservar un espacio cuya zona esta deshabilitada
        if (espacio.getZona() != null && !espacio.getZona().isActive()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La zona del espacio esta deshabilitada");
        }

        EstadoEspacio actual = espacio.getEstado();
        boolean transicionPermitida = switch (actual) {
            case DISPONIBLE -> estado == EstadoEspacio.OCUPADO
                    || estado == EstadoEspacio.RESERVADO
                    || estado == EstadoEspacio.MANTENIMIENTO;
            case RESERVADO -> estado == EstadoEspacio.DISPONIBLE
                    || estado == EstadoEspacio.OCUPADO;
            case OCUPADO -> estado == EstadoEspacio.DISPONIBLE;
            case MANTENIMIENTO -> estado == EstadoEspacio.DISPONIBLE;
        };

        if (!transicionPermitida) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Transicion de estado no permitida: " + actual + " -> " + estado);
        }

        int actualizados = espacioRepository.cambiarEstadoSiCoincide(
                TenantContext.get(), id, actual, estado);
        if (actualizados != 1) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Espacio no disponible: su estado cambio por otra operacion concurrente");
        }

        espacio = espacioRepository.findByTenantIdAndId(TenantContext.get(), id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Espacio no encontrado"));
        EspacioResponseDto dto = mapToEspacioResponseDto(espacio);
        espacioEventService.publishEspacioCambiado(dto);
        cache.evict(CACHE_ESPACIOS);
        // El cambio de estado es el evento mas relevante para la trazabilidad:
        // es el que refleja la ocupacion real del parqueadero.
        auditPublisher.publish("UPDATE", ENTIDAD_AUDIT, datosDe(dto));
        return dto;
    }

    /** Detalle del espacio que se adjunta al evento de auditoria. */
    private Map<String, Object> datosDe(EspacioResponseDto dto) {
        Map<String, Object> datos = new java.util.HashMap<>();
        datos.put("id", dto.getId().toString());
        datos.put("nombre", dto.getNombre());
        datos.put("codigo", dto.getCodigo());
        datos.put("estado", dto.getEstado() != null ? dto.getEstado().name() : null);
        datos.put("zona", dto.getNombreZona());
        return datos;
    }

    private EspacioResponseDto mapToEspacioResponseDto(Espacio espacio) {
        return EspacioResponseDto.builder()
                .id(espacio.getId())
                .nombre(espacio.getNombre())
                .codigo(espacio.getCodigo())
                .descripcion(espacio.getDescripcion())
                .tipo(espacio.getTipo())
                .estado(espacio.getEstado())
                .active(espacio.isActive())
                .nombreZona(espacio.getZona() != null ? espacio.getZona().getNombre() : null)
                .idZona(espacio.getZona() != null ? espacio.getZona().getId() : null)
                .build();
    }
}
