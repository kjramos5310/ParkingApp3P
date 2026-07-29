package ec.edu.espe.zonas.services.impl;

import ec.edu.espe.zonas.audit.AuditPublisher;
import ec.edu.espe.zonas.dto.request.ZonaRequestDto;
import ec.edu.espe.zonas.dto.response.ZonaResponseDto;
import ec.edu.espe.zonas.entity.EstadoEspacio;
import ec.edu.espe.zonas.entity.Zona;
import ec.edu.espe.zonas.repository.ZonaRepositorio;
import ec.edu.espe.zonas.services.interfaz.EspacioService;
import ec.edu.espe.zonas.services.interfaz.ZonaService;
import ec.edu.espe.zonas.utils.MapperUtils;
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
public class ServiciosZona implements ZonaService {

    /** Entidad reportada a auditoria (debe cumplir ^[a-z_]{4,15}$). */
    private static final String ENTIDAD_AUDIT = "zonas";

    private final MapperUtils mapper;

    private final ZonaRepositorio zonaRepositorio;

    private final EspacioService espacioService;

    private final AuditPublisher auditPublisher;

    // @Override
    // @Transactional(readOnly = true)
    // public List<ZonaResponseDto> listarZonas() {
    //     return zonaRepositorio.findAll().stream()
    //             .map(this::mapToZonaResponseDto)
    //             .collect(Collectors.toList());
    // }

    @Override
    @Transactional(readOnly = true)
    public List<ZonaResponseDto> listarZonas() {
        return zonaRepositorio.findAllByTenantId(TenantContext.get()).stream()
                .map(mapper::zonaResponseDto)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public ZonaResponseDto obtenerZonaPorId(UUID id) {
        Zona zona = zonaRepositorio.findByTenantIdAndId(TenantContext.get(), id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Zona no encontrada"));
        return mapToZonaResponseDto(zona);
    }

    // @Override
    // @Transactional
    // public ZonaResponseDto crearZona(ZonaRequestDto requestDto) {
    //     if (zonaRepositorio.existsByNombre(requestDto.getNombre())) {
    //         throw new ResponseStatusException(HttpStatus.CONFLICT, "Ya existe una zona con el nombre: " + requestDto.getNombre());
    //     }
    //     if (requestDto.getCodigo() != null && zonaRepositorio.existsByCodigo(requestDto.getCodigo())) {
    //         throw new ResponseStatusException(HttpStatus.CONFLICT, "Ya existe una zona con el codigo: " + requestDto.getCodigo());
    //     }

    //     String codigo = requestDto.getCodigo();
    //     if (codigo == null || codigo.trim().isEmpty()) {
    //         codigo = generateZoneCode(requestDto.getNombre(), requestDto.getTipo().name());
    //     }

    //     Zona zona = Zona.builder()
    //             .nombre(requestDto.getNombre())
    //             .codigo(codigo.toUpperCase())
    //             .descripcion(requestDto.getDescripcion())
    //             .capacidad(requestDto.getCapacidad())
    //             .tipo(requestDto.getTipo())
    //             .build();

    //     zona = zonaRepositorio.save(zona);
    //     return mapToZonaResponseDto(zona);
    // }

    @Override
    @Transactional
    public ZonaResponseDto crearZona(ZonaRequestDto requestDto){
        if (zonaRepositorio.existsByTenantIdAndNombre(TenantContext.get(), requestDto.getNombre())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Ya existe una zona con el nombre: " + requestDto.getNombre());
        }
        if (requestDto.getCodigo() != null && zonaRepositorio.existsByTenantIdAndCodigo(TenantContext.get(), requestDto.getCodigo())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Ya existe una zona con el codigo: " + requestDto.getCodigo());
        }

        // Generar código de zona si no se proporciona (ej: ZON-VIP-01) - Delegado en MapperUtils para SRP
        String codigo = requestDto.getCodigo();
        if (codigo == null || codigo.trim().isEmpty()) {
            codigo = mapper.generateZoneCode(requestDto.getTipo().name(), zonaRepositorio);
        }
        requestDto.setCodigo(codigo.toUpperCase());

        /*
         * Flujo de varias líneas (comentado para estudio):
         * Zona objZona = mapper.toZonaEntity(requestDto);
         * Zona zonaSaved = zonaRepositorio.save(objZona);
         * return mapper.zonaResponseDto(zonaSaved);
         */

        // Flujo en una sola línea sugerido por el docente (corregido y óptimo):
        ZonaResponseDto creada = mapper.zonaResponseDto(zonaRepositorio.save(mapper.toZonaEntity(requestDto)));

        auditPublisher.publish("CREATE", ENTIDAD_AUDIT, Map.of(
                "id", creada.getId().toString(),
                "nombre", creada.getNombre(),
                "codigo", creada.getCodigo(),
                "capacidad", creada.getCapacidad()));

        return creada;
    }


    @Override
    @Transactional
    public ZonaResponseDto actualizarZona(UUID id, ZonaRequestDto requestDto) {
        Zona zona = zonaRepositorio.findByTenantIdAndId(TenantContext.get(), id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Zona no encontrada"));

        if (!zona.getNombre().equalsIgnoreCase(requestDto.getNombre()) &&
                zonaRepositorio.existsByTenantIdAndNombre(TenantContext.get(), requestDto.getNombre())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Ya existe otra zona con el nombre: " + requestDto.getNombre());
        }

        if (requestDto.getCodigo() != null && !requestDto.getCodigo().equalsIgnoreCase(zona.getCodigo()) &&
                zonaRepositorio.existsByTenantIdAndCodigo(TenantContext.get(), requestDto.getCodigo())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Ya existe otra zona con el codigo: " + requestDto.getCodigo());
        }

        zona.setNombre(requestDto.getNombre());
        if (requestDto.getCodigo() != null && !requestDto.getCodigo().trim().isEmpty()) {
            zona.setCodigo(requestDto.getCodigo().toUpperCase());
        }
        zona.setDescripcion(requestDto.getDescripcion());
        zona.setCapacidad(requestDto.getCapacidad());
        zona.setTipo(requestDto.getTipo());

        zona = zonaRepositorio.save(zona);

        auditPublisher.publish("UPDATE", ENTIDAD_AUDIT, Map.of(
                "id", zona.getId().toString(),
                "nombre", zona.getNombre(),
                "codigo", zona.getCodigo(),
                "capacidad", zona.getCapacidad()));

        return mapToZonaResponseDto(zona);
    }

    @Override
    @Transactional
    public void eliminarZona(UUID id) {
        Zona zona = zonaRepositorio.findByTenantIdAndId(TenantContext.get(), id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Zona no encontrada"));
        zona.setActive(false);
        zonaRepositorio.save(zona);

        // Al deshabilitar la zona, se deshabilitan todos sus espacios (no se podran ocupar)
        espacioService.deshabilitarEspaciosDeZona(id);

        auditPublisher.publish("DELETE", ENTIDAD_AUDIT, Map.of(
                "id", zona.getId().toString(),
                "nombre", zona.getNombre(),
                "codigo", zona.getCodigo()));
    }

    // private String generateZoneCode(String nombre, String tipo) {
    //         String prefix = "ZON";
    //         String t = tipo.length() >= 3 ? tipo.substring(0, 3) : tipo;
    //         String n = nombre.replaceAll("\\s+", "").toUpperCase();
    //         String suffix = n.length() >= 3 ? n.substring(0, 3) : n;
    //         String candidate = prefix + "-" + t.toUpperCase() + "-" + suffix;
            
    //         int count = 1;
    //         String finalCode = candidate;
    //         while (zonaRepositorio.existsByCodigo(finalCode)) {
    //             finalCode = candidate + count;
    //             count++;
    //         }
    //         return finalCode;
    //     }


    private ZonaResponseDto mapToZonaResponseDto(Zona zona) {
        int disponibles = 0;
        if (zona.getEspacios() != null) {
            disponibles = (int) zona.getEspacios().stream()
                    .filter(e -> e.isActive() && e.getEstado() == EstadoEspacio.DISPONIBLE)
                    .count();
        }

        return ZonaResponseDto.builder()
                .id(zona.getId())
                .nombre(zona.getNombre())
                .codigo(zona.getCodigo())
                .descripcion(zona.getDescripcion())
                .capacidad(zona.getCapacidad())
                .espaciosDisponibles(disponibles)
                .tipo(zona.getTipo())
                .active(zona.isActive())
                .build();
    }


}
