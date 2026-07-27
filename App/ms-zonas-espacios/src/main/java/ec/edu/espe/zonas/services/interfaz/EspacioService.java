package ec.edu.espe.zonas.services.interfaz;

import ec.edu.espe.zonas.dto.request.EspacioRequestDTO;
import ec.edu.espe.zonas.dto.response.EspacioResponseDto;
import ec.edu.espe.zonas.entity.EstadoEspacio;

import java.util.List;
import java.util.Map;
import java.util.UUID;

public interface EspacioService {

    List<EspacioResponseDto> obtenerEspacios();

    EspacioResponseDto crearEspacio(EspacioRequestDTO requestDTO);

    EspacioResponseDto actualizarEspacio(UUID id, EspacioRequestDTO requestDTO);

    void eliminarEspacio(UUID id);

    EspacioResponseDto obtenerEspacio(UUID id);

    List<EspacioResponseDto> obtenerEspaciosPorEstado(EstadoEspacio estado);

    List<EspacioResponseDto> obtenerEspaciosPorZona(UUID idZona);

    void deshabilitarEspaciosDeZona(UUID idZona);

    List<EspacioResponseDto> obtenerEspaciosPorZonaYPorEstado(UUID idZona, EstadoEspacio estado);

    Map<String, List<EspacioResponseDto>> obtenerEspaciosPorEstadoAgrupadosPorZona(EstadoEspacio estado);

    EspacioResponseDto cambiarEstado(UUID id, EstadoEspacio estado);
}
