package ec.edu.espe.usuarios.controller;

import ec.edu.espe.usuarios.dto.request.TenantRequestDto;
import ec.edu.espe.usuarios.dto.response.TenantResponseDto;
import ec.edu.espe.usuarios.services.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/tenants")
@RequiredArgsConstructor
public class TenantController {

    private final UserService userService;

    @GetMapping
    public ResponseEntity<List<TenantResponseDto>> getTenants() {
        return ResponseEntity.ok(userService.getAllTenants());
    }

    @PostMapping
    public ResponseEntity<TenantResponseDto> createTenant(@Valid @RequestBody TenantRequestDto request) {
        TenantResponseDto response = userService.createTenant(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @DeleteMapping("/{tenantId}")
    public ResponseEntity<Void> deleteTenant(@PathVariable String tenantId) {
        userService.deleteTenant(tenantId);
        return ResponseEntity.noContent().build();
    }
}
