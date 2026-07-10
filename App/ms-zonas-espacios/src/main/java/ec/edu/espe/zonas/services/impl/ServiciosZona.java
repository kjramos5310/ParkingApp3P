package ec.edu.espe.zonas.services.impl;

import ec.edu.espe.zonas.dto.request.ZonaRequestDto;
import ec.edu.espe.zonas.dto.response.ZonaResponseDto;
import ec.edu.espe.zonas.entity.EstadoEspacio;
import ec.edu.espe.zonas.entity.Zona;
import ec.edu.espe.zonas.repository.ZonaRepositorio;
import ec.edu.espe.zonas.services.interfaz.ZonaService;
import ec.edu.espe.zonas.utils.MapperUtils;
import ec.edu.espe.zonas.services.interfaz.EspacioService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ServiciosZona implements ZonaService {

    private final MapperUtils mapper;

    private final ZonaRepositorio zonaRepositorio;
    private final EspacioService espacioService;

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
        return zonaRepositorio.findAll().stream()
                .map(mapper::zonaResponseDto)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public ZonaResponseDto obtenerZonaPorId(UUID id) {
        Zona zona = zonaRepositorio.findById(id)
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
        if (zonaRepositorio.existsByNombre(requestDto.getNombre())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Ya existe una zona con el nombre: " + requestDto.getNombre());
        }
        if (requestDto.getCodigo() != null && zonaRepositorio.existsByCodigo(requestDto.getCodigo())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Ya existe una zona con el codigo: " + requestDto.getCodigo());
        }

        // Generar código de zona si no se proporciona (ej: ZON-VIP-01) - Delegado en MapperUtils para SRP
        String codigo = requestDto.getCodigo();
        if (codigo == null || codigo.trim().isEmpty()) {
            codigo = mapper.generateZoneCode(requestDto.getTipo().name(), zonaRepositorio);
        }
        requestDto.setCodigo(codigo.toUpperCase());
        // zonaResponseDto(zonaRepositorio.save(mapper.toZonaEntity(requestDto)));
        ZonaResponseDto responseDto = mapper.zonaResponseDto(zonaRepositorio.save(mapper.toZonaEntity(requestDto)));
        espacioService.notificarCambioZona(responseDto, "zona_creada");
        return responseDto;
    }


    @Override
    @Transactional
    public ZonaResponseDto actualizarZona(UUID id, ZonaRequestDto requestDto) {
        Zona zona = zonaRepositorio.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Zona no encontrada"));

        if (!zona.getNombre().equalsIgnoreCase(requestDto.getNombre()) &&
                zonaRepositorio.existsByNombre(requestDto.getNombre())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Ya existe otra zona con el nombre: " + requestDto.getNombre());
        }

        if (requestDto.getCodigo() != null && !requestDto.getCodigo().equalsIgnoreCase(zona.getCodigo()) &&
                zonaRepositorio.existsByCodigo(requestDto.getCodigo())) {
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
        ZonaResponseDto responseDto = mapToZonaResponseDto(zona);
        espacioService.notificarCambioZona(responseDto, "zona_actualizada");
        return responseDto;
    }

    @Override
    @Transactional
    public void eliminarZona(UUID id) {
        Zona zona = zonaRepositorio.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Zona no encontrada"));
        zona.setActive(false);
        zona = zonaRepositorio.save(zona);
        
        // Notificar desactivación de la zona
        ZonaResponseDto responseDto = mapToZonaResponseDto(zona);
        espacioService.notificarCambioZona(responseDto, "zona_desactivada");
        
        // Desactivar todos los espacios de esta zona y emitir eventos SSE
        espacioService.desactivarEspaciosDeZona(id);
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
