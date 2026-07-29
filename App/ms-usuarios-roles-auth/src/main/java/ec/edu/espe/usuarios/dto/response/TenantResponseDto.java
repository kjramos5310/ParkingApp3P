package ec.edu.espe.usuarios.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TenantResponseDto {
    private String tenantId;
    private String nombreEmpresa;
    private String adminUsername;
    private String adminEmail;
    private long userCount;
    private String subdominioUrl;
    private String parametroUrl;
}
