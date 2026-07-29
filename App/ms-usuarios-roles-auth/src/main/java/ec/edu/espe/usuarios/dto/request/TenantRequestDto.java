package ec.edu.espe.usuarios.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TenantRequestDto {

    @NotBlank(message = "El identificador del tenant es obligatorio")
    @Pattern(regexp = "^[a-z0-9][a-z0-9-]{1,49}$", message = "El slug del tenant debe usar de 2 a 50 caracteres: letras minusculas, numeros o guiones")
    private String tenantId;

    @NotBlank(message = "El nombre de la empresa es obligatorio")
    private String nombreEmpresa;

    @NotBlank(message = "El DNI del administrador es obligatorio")
    private String adminDni;

    @NotBlank(message = "El primer nombre del administrador es obligatorio")
    private String adminFirstName;

    private String adminMiddleName;

    @NotBlank(message = "El apellido del administrador es obligatorio")
    private String adminLastName;

    @NotBlank(message = "El email del administrador es obligatorio")
    private String adminEmail;

    private String adminPhone;

    private String adminAddress;

    private String adminNationality;

    @NotBlank(message = "El nombre de usuario del admin es obligatorio")
    private String adminUsername;

    @NotBlank(message = "La contraseña del administrador es obligatoria")
    private String adminPassword;
}
