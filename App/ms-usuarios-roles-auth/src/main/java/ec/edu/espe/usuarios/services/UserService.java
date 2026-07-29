package ec.edu.espe.usuarios.services;

import ec.edu.espe.usuarios.dto.request.LoginRequest;
import ec.edu.espe.usuarios.dto.request.UserCreateRequest;
import ec.edu.espe.usuarios.dto.request.UserUpdateRequest;
import ec.edu.espe.usuarios.dto.response.LoginResponse;
import ec.edu.espe.usuarios.dto.response.UserResponse;
import ec.edu.espe.usuarios.dto.request.TenantRequestDto;
import ec.edu.espe.usuarios.dto.response.TenantResponseDto;

import java.util.List;
import java.util.UUID;

public interface UserService {
    UserResponse createUser(UserCreateRequest userRequest);
    List<UserResponse> getUsers();
    UserResponse getUserById(UUID id);
    UserResponse updateUser(UUID id, UserUpdateRequest userRequest);
    void deleteUser(UUID id);
    UserResponse assigneRole(UUID userId, UUID roleId);
    LoginResponse login(LoginRequest loginRequest);
    UserResponse register(UserCreateRequest registerRequest);
    TenantResponseDto createTenant(TenantRequestDto request);
    List<TenantResponseDto> getAllTenants();
    void deleteTenant(String tenantId);
}
