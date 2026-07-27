package ec.edu.espe.zonas.utils;

import ec.edu.espe.zonas.dto.request.ZonaRequestDto;
import ec.edu.espe.zonas.dto.request.EspacioRequestDTO;
import ec.edu.espe.zonas.dto.response.ZonaResponseDto;
import ec.edu.espe.zonas.dto.response.EspacioResponseDto;
import ec.edu.espe.zonas.entity.Zona;
import ec.edu.espe.zonas.entity.Espacio;
import ec.edu.espe.zonas.repository.ZonaRepositorio;
import org.springframework.stereotype.Component;
import ec.edu.espe.zonas.tenant.TenantContext;

@Component
public class MapperUtils {

    public ZonaResponseDto zonaResponseDto(Zona objzona){
        if(objzona==null)return null;
        //para hacer unrollback manualmente

        return ZonaResponseDto.builder()
                .id(objzona.getId())
                .nombre(objzona.getNombre())
                .codigo(objzona.getCodigo())
                .descripcion(objzona.getDescripcion())
                .capacidad(objzona.getCapacidad())
                .tipo(objzona.getTipo())
                .active(objzona.isActive())
                .espaciosDisponibles(objzona.getEspacios() != null ? objzona.getEspacios().size() : 0)
                .build();
    }

    public String generateZoneCode(String tipo, ZonaRepositorio repositorio) {
        String prefix = "ZON";
        String t = tipo.trim().toUpperCase();
        
        int count = 1;
        String candidate = String.format("%s-%s-%02d", prefix, t, count);
        
        while (repositorio.existsByTenantIdAndCodigo(TenantContext.get(), candidate)) {
            count++;
            candidate = String.format("%s-%s-%02d", prefix, t, count);
        }
        return candidate;
    }

    public Zona toZonaEntity(ZonaRequestDto dto){
        if(dto==null)return null;

        return Zona.builder()
                .tenantId(TenantContext.get())
                .nombre(dto.getNombre())
                .codigo(dto.getCodigo())
                .descripcion(dto.getDescripcion())
                .capacidad(dto.getCapacidad())
                .tipo(dto.getTipo())
                .build();
    }

    public EspacioResponseDto espacioResponseDto(Espacio objespacio){
        if(objespacio==null)return null;

        return EspacioResponseDto.builder()
                .id(objespacio.getId())
                .nombre(objespacio.getNombre())
                .codigo(objespacio.getCodigo())
                .descripcion(objespacio.getDescripcion())
                .tipo(objespacio.getTipo())
                .estado(objespacio.getEstado())
                .active(objespacio.isActive())
                .nombreZona(objespacio.getZona() != null ? objespacio.getZona().getNombre() : null)
                .idZona(objespacio.getZona() != null ? objespacio.getZona().getId() : null)
                .build();
    }

    public Espacio toEspacioEntity(EspacioRequestDTO dto){
        if(dto==null)return null;

        return Espacio.builder()
                .tenantId(TenantContext.get())
                .nombre(dto.getNombre())
                .codigo(dto.getCodigo())
                .descripcion(dto.getDescripcion())
                .tipo(dto.getTipo())
                .build();
    }

    public Espacio toEspacioEntity(EspacioRequestDTO dto, Zona zona){
        if(dto==null)return null;

        return Espacio.builder()
                .tenantId(TenantContext.get())
                .nombre(dto.getNombre())
                .codigo(dto.getCodigo())
                .descripcion(dto.getDescripcion())
                .tipo(dto.getTipo())
                .zona(zona)
                .build();
    }

    // mapearle en el dto o mapper 
}

