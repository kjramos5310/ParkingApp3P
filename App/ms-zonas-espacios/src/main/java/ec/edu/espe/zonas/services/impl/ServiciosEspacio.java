package ec.edu.espe.zonas.services.impl;

import ec.edu.espe.zonas.dto.request.EspacioRequestDTO;
import ec.edu.espe.zonas.dto.response.EspacioResponseDto;
import ec.edu.espe.zonas.entity.EstadoEspacio;
import ec.edu.espe.zonas.entity.Espacio;
import ec.edu.espe.zonas.entity.Zona;
import ec.edu.espe.zonas.repository.EspacioRepository;
import ec.edu.espe.zonas.repository.ZonaRepositorio;
import ec.edu.espe.zonas.services.interfaz.AuditService;
import ec.edu.espe.zonas.services.interfaz.EspacioService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ServiciosEspacio implements EspacioService {

    private final EspacioRepository espacioRepository;
    private final ZonaRepositorio zonaRepositorio;
    private final AuditService auditService;

    @Override
    @Transactional(readOnly = true)
    public List<EspacioResponseDto> obtenerEspacios() {
        return espacioRepository.findAll().stream()
                .filter(Espacio::isActive)
                .map(this::mapToEspacioResponseDto)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional
    public EspacioResponseDto crearEspacio(EspacioRequestDTO requestDTO) {
        Zona zona = zonaRepositorio.findById(requestDTO.getIdZona())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "La zona especificada no existe"));

        // Validar capacidad de la zona
        long activeSpacesCount = espacioRepository.findByZonaId(zona.getId()).stream()
                .filter(Espacio::isActive)
                .count();

        if (activeSpacesCount >= zona.getCapacidad()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, 
                    "No se puede crear el espacio. La zona '" + zona.getNombre() + "' ha alcanzado su capacidad máxima de " + zona.getCapacidad() + " espacios.");
        }

        if (espacioRepository.existsByNombre(requestDTO.getNombre())) {
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
        while (espacioRepository.existsByCodigo(codigo)) {
            codigo = String.format("%s-%02d", zona.getCodigo(), nextIndex + offset);
            offset++;
        }

        String nombre = codigo;

        Espacio espacio = Espacio.builder()
                .nombre(nombre)
                .codigo(codigo.toUpperCase())
                .descripcion(requestDTO.getDescripcion())
                .tipo(requestDTO.getTipo())
                .zona(zona)
                .estado(EstadoEspacio.DISPONIBLE)
                .build();

        espacio = espacioRepository.save(espacio);
        auditService.recordEvent(
                "CREATE",
                "ESPACIO",
                espacio.getId(),
                "Se creo el espacio '" + espacio.getNombre() + "' en la zona '" + zona.getNombre() + "'"
        );
        return mapToEspacioResponseDto(espacio);
    }

    @Override
    @Transactional
    public EspacioResponseDto actualizarEspacio(UUID id, EspacioRequestDTO requestDTO) {
        Espacio espacio = espacioRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Espacio no encontrado"));

        if (!espacio.getNombre().equalsIgnoreCase(requestDTO.getNombre()) && 
                espacioRepository.existsByNombre(requestDTO.getNombre())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Ya existe otro espacio con el nombre: " + requestDTO.getNombre());
        }

        if (requestDTO.getCodigo() != null && !requestDTO.getCodigo().equalsIgnoreCase(espacio.getCodigo()) && 
                espacioRepository.existsByCodigo(requestDTO.getCodigo())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Ya existe otro espacio con el codigo: " + requestDTO.getCodigo());
        }

        Zona zona = espacio.getZona();
        // Si cambia de zona, validar la capacidad de la nueva zona
        if (!zona.getId().equals(requestDTO.getIdZona())) {
            zona = zonaRepositorio.findById(requestDTO.getIdZona())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "La nueva zona especificada no existe"));

            long activeSpacesInNewZone = espacioRepository.findByZonaId(zona.getId()).stream()
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
        auditService.recordEvent(
                "UPDATE",
                "ESPACIO",
                espacio.getId(),
                "Se actualizo el espacio '" + espacio.getNombre() + "' en la zona '" + zona.getNombre() + "'"
        );
        return mapToEspacioResponseDto(espacio);
    }

    @Override
    @Transactional
    public void eliminarEspacio(UUID id) {
        Espacio espacio = espacioRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Espacio no encontrado"));
        espacio.setActive(false);
        Espacio espacioEliminado = espacioRepository.save(espacio);
        auditService.recordEvent(
                "DELETE",
                "ESPACIO",
                espacioEliminado.getId(),
                "Se elimino logicamente el espacio '" + espacioEliminado.getNombre() + "'"
        );
    }

    @Override
    @Transactional(readOnly = true)
    public EspacioResponseDto obtenerEspacio(UUID id) {
        Espacio espacio = espacioRepository.findById(id)
                .filter(Espacio::isActive)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Espacio no encontrado"));
        return mapToEspacioResponseDto(espacio);
    }

    @Override
    @Transactional(readOnly = true)
    public List<EspacioResponseDto> obtenerEspaciosPorEstado(EstadoEspacio estado) {
        return espacioRepository.findByEstado(estado).stream()
                .filter(Espacio::isActive)
                .map(this::mapToEspacioResponseDto)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public List<EspacioResponseDto> obtenerEspaciosPorZonaYPorEstado(UUID idZona, EstadoEspacio estado) {
        if (!zonaRepositorio.existsById(idZona)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "La zona especificada no existe");
        }
        return espacioRepository.findByZonaIdAndEstado(idZona, estado).stream()
                .filter(Espacio::isActive)
                .map(this::mapToEspacioResponseDto)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public Map<String, List<EspacioResponseDto>> obtenerEspaciosPorEstadoAgrupadosPorZona(EstadoEspacio estado) {
        // Obtenemos los espacios optimizadamente con JOIN FETCH para evitar N+1 queries de JPA
        List<Espacio> espacios = espacioRepository.findByEstadoWithZona(estado);
        
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
        Espacio espacio = espacioRepository.findById(id)
                .filter(Espacio::isActive)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Espacio no encontrado"));
        
        if (estado == EstadoEspacio.RESERVADO && espacio.getEstado() != EstadoEspacio.DISPONIBLE) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "El espacio no se puede reservar porque su estado actual es: " + espacio.getEstado());
        }

        if (estado == EstadoEspacio.OCUPADO && espacio.getEstado() == EstadoEspacio.OCUPADO) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "El espacio ya se encuentra ocupado");
        }

        espacio.setEstado(estado);
        espacio = espacioRepository.save(espacio);
        auditService.recordEvent(
                "UPDATE",
                "ESPACIO",
                espacio.getId(),
                "Se cambio el estado del espacio '" + espacio.getNombre() + "' a " + espacio.getEstado()
        );
        return mapToEspacioResponseDto(espacio);
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
