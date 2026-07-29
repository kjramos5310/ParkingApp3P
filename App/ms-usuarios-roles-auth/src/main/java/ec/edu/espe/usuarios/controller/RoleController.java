package ec.edu.espe.usuarios.controller;

import ec.edu.espe.usuarios.audit.AuditPublisher;
import ec.edu.espe.usuarios.dto.request.RoleRequest;
import ec.edu.espe.usuarios.dto.response.RoleResponse;
import ec.edu.espe.usuarios.services.RoleService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/roles")
public class RoleController {

    @Autowired
    private RoleService roleService;

    @Autowired
    private AuditPublisher auditPublisher;

    @GetMapping
    public ResponseEntity<List<RoleResponse>> getAllRoles() {
        return ResponseEntity.ok(roleService.getRoles());
    }

    @PostMapping
    public ResponseEntity<RoleResponse> createRole(@Valid @RequestBody RoleRequest roleRequest) {
        RoleResponse response = roleService.createRole(roleRequest);
        auditPublisher.publish("CREATE", "roles", Map.of(
                "id", String.valueOf(response.getId()),
                "name", response.getName()
        ));
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping("/{id}")
    public ResponseEntity<RoleResponse> getRoleById(@PathVariable UUID id) {
        return ResponseEntity.ok(roleService.getRoleById(id));
    }

    @PutMapping("/{id}")
    public ResponseEntity<RoleResponse> updateRole(@PathVariable UUID id, @Valid @RequestBody RoleRequest roleRequest) {
        RoleResponse response = roleService.updateRole(id, roleRequest);
        auditPublisher.publish("UPDATE", "roles", Map.of(
                "id", String.valueOf(response.getId()),
                "name", response.getName()
        ));
        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteRole(@PathVariable UUID id) {
        roleService.deleteRole(id);
        auditPublisher.publish("DELETE", "roles", Map.of("id", String.valueOf(id)));
        return ResponseEntity.noContent().build();
    }
}
