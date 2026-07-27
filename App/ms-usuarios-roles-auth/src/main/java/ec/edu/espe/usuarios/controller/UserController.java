package ec.edu.espe.usuarios.controller;

import ec.edu.espe.usuarios.audit.AuditPublisher;
import ec.edu.espe.usuarios.dto.request.UserCreateRequest;
import ec.edu.espe.usuarios.dto.response.UserResponse;
import ec.edu.espe.usuarios.services.UserService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/users")
public class UserController {

    @Autowired
    private UserService userService;

    @Autowired
    private AuditPublisher auditPublisher;

    @GetMapping
    public ResponseEntity<List<UserResponse>> getAllUsers() { return ResponseEntity.ok(userService.getUsers()); }

    @PostMapping
    public ResponseEntity<UserResponse> createUser(@Valid @RequestBody UserCreateRequest request) {
        UserResponse response = userService.createUser(request);
        auditPublisher.publish("CREATE", "usuarios", Map.of(
                "id", String.valueOf(response.getId()),
                "username", response.getUsername()
        ));
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    //formato uuid: 8-4-4-4-12
    //localhost:8080/api/users/{userId}/roles/{roleId}
    //localhost:8080/api/users/8be4df61-93ca-11d2-aa0d-00e098032b8c/roles/8be4df61-93ca-11d2-aa0d-00e098032b8c
    @PostMapping("/{userId}/roles/{roleId}")
    public ResponseEntity<UserResponse> assigneRoleUser(@PathVariable UUID userId, @PathVariable UUID roleId) {
        UserResponse response = userService.assigneRole(userId, roleId);
        auditPublisher.publish("UPDATE", "usuarios", Map.of(
                "id", String.valueOf(userId),
                "roleId", String.valueOf(roleId),
                "detalle", "asignacion de rol"
        ));
        return ResponseEntity.ok(response);
    }
}
