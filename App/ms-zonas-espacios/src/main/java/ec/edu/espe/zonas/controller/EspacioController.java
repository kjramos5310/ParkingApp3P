package ec.edu.espe.zonas.controller;

import ec.edu.espe.zonas.dto.request.EspacioRequestDTO;
import ec.edu.espe.zonas.dto.response.EspacioResponseDto;
import ec.edu.espe.zonas.entity.EstadoEspacio;
import ec.edu.espe.zonas.services.interfaz.EspacioService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@CrossOrigin("*")
@RestController
@RequestMapping("/api/espacios")
@RequiredArgsConstructor
public class EspacioController {

    private final EspacioService espacioService;

    @GetMapping
    public ResponseEntity<List<EspacioResponseDto>> obtenerEspacios() {
        return ResponseEntity.ok(espacioService.obtenerEspacios());
    }

    @GetMapping("/{id}")
    public ResponseEntity<EspacioResponseDto> obtenerEspacio(@PathVariable UUID id) {
        return ResponseEntity.ok(espacioService.obtenerEspacio(id));
    }

    @PostMapping
    public ResponseEntity<EspacioResponseDto> crearEspacio(@Valid @RequestBody EspacioRequestDTO requestDTO) {
        return new ResponseEntity<>(espacioService.crearEspacio(requestDTO), HttpStatus.CREATED);
    }

    @PutMapping("/{id}")
    public ResponseEntity<EspacioResponseDto> actualizarEspacio(@PathVariable UUID id, @Valid @RequestBody EspacioRequestDTO requestDTO) {
        return ResponseEntity.ok(espacioService.actualizarEspacio(id, requestDTO));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> eliminarEspacio(@PathVariable UUID id) {
        espacioService.eliminarEspacio(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/estado/{estado}")
    public ResponseEntity<List<EspacioResponseDto>> obtenerEspaciosPorEstado(@PathVariable EstadoEspacio estado) {
        return ResponseEntity.ok(espacioService.obtenerEspaciosPorEstado(estado));
    }

    @GetMapping("/zona/{idZona}/estado/{estado}")
    public ResponseEntity<List<EspacioResponseDto>> obtenerEspaciosPorZonaYPorEstado(
            @PathVariable UUID idZona, 
            @PathVariable EstadoEspacio estado) {
        return ResponseEntity.ok(espacioService.obtenerEspaciosPorZonaYPorEstado(idZona, estado));
    }

    @GetMapping("/agrupados/estado/{estado}")
    public ResponseEntity<Map<String, List<EspacioResponseDto>>> obtenerEspaciosPorEstadoAgrupadosPorZona(
            @PathVariable EstadoEspacio estado) {
        return ResponseEntity.ok(espacioService.obtenerEspaciosPorEstadoAgrupadosPorZona(estado));
    }

    @PatchMapping("/{id}/estado/{estado}")
    public ResponseEntity<EspacioResponseDto> cambiarEstado(@PathVariable UUID id, @PathVariable EstadoEspacio estado) {
        return ResponseEntity.ok(espacioService.cambiarEstado(id, estado));
    }

    @PatchMapping("/{id}/reservar")
    public ResponseEntity<EspacioResponseDto> reservarEspacio(@PathVariable UUID id) {
        return ResponseEntity.ok(espacioService.cambiarEstado(id, EstadoEspacio.RESERVADO));
    }

    @PatchMapping("/{id}/liberar")
    public ResponseEntity<EspacioResponseDto> liberarEspacio(@PathVariable UUID id) {
        return ResponseEntity.ok(espacioService.cambiarEstado(id, EstadoEspacio.DISPONIBLE));
    }

    @GetMapping(value = "/sse", produces = org.springframework.http.MediaType.TEXT_EVENT_STREAM_VALUE)
    public org.springframework.web.servlet.mvc.method.annotation.SseEmitter registrarSse() {
        return espacioService.registrarSse();
    }
}

