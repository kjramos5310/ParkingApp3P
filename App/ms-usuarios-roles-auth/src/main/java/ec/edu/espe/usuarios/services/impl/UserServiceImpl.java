package ec.edu.espe.usuarios.services.impl;

import ec.edu.espe.usuarios.dto.request.LoginRequest;
import ec.edu.espe.usuarios.dto.request.UserCreateRequest;
import ec.edu.espe.usuarios.dto.request.UserUpdateRequest;
import ec.edu.espe.usuarios.dto.response.LoginResponse;
import ec.edu.espe.usuarios.dto.response.PersonResponse;
import ec.edu.espe.usuarios.dto.response.UserResponse;
import ec.edu.espe.usuarios.entity.*;
import ec.edu.espe.usuarios.repository.PersonRepository;
import ec.edu.espe.usuarios.repository.RoleRepository;
import ec.edu.espe.usuarios.repository.UserRepository;
import ec.edu.espe.usuarios.repository.UserRoleRepository;
import ec.edu.espe.usuarios.security.JwtTokenProvider;
import ec.edu.espe.usuarios.services.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import ec.edu.espe.usuarios.tenant.TenantContext;

@Service
@RequiredArgsConstructor
public class UserServiceImpl implements UserService {

    private final UserRepository userRepository;
    private final PersonRepository personRepository;
    private final RoleRepository roleRepository;
    private final UserRoleRepository userRoleRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final JwtTokenProvider jwtTokenProvider;

    @Override
    @Transactional
    public UserResponse createUser(UserCreateRequest userRequest) {
        String tenantId = TenantContext.get();
        if (personRepository.existsByTenantIdAndDni(tenantId, userRequest.getDni())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "DNI already exists");
        }
        if (personRepository.existsByTenantIdAndEmail(tenantId, userRequest.getEmail())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email already exists");
        }

        Person person = Person.builder()
                .tenantId(tenantId)
                .dni(userRequest.getDni())
                .firstName(userRequest.getFirstName())
                .middleName(userRequest.getMiddleName())
                .lastName(userRequest.getLastName())
                .email(userRequest.getEmail())
                .phone(userRequest.getPhone())
                .address(userRequest.getAddress())
                .nationality(userRequest.getNationality())
                .build();

        person = personRepository.save(person);
        
        String rawPassword = (userRequest.getPassword() != null && !userRequest.getPassword().trim().isEmpty())
                ? userRequest.getPassword().trim()
                : userRequest.getDni();
        String encodedPassword = passwordEncoder.encode(rawPassword);

        User user = User.builder()
                .tenantId(tenantId)
                .person(person)
                .username(generarUsername(userRequest.getFirstName(), 
                userRequest.getMiddleName(), 
                userRequest.getLastName()))
                .passwordHash(encodedPassword)
                .passwordHashColumn(encodedPassword)
                .active(true)
                .build();
        
        user = userRepository.save(user);

        return mapToUserResponse(user);
    }

    private String generarUsername(String fn, String mn, String ln) {
        if (fn == null || fn.trim().isEmpty() || ln == null || ln.trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Nombres y apellidos son obligatorios para generar el usuario");
        }

        StringBuilder sb = new StringBuilder();
        
        // Primera letra del primer nombre
        sb.append(fn.trim().toLowerCase().charAt(0));
        
        // Primera letra del segundo nombre (si existe)
        if (mn != null && !mn.trim().isEmpty()) {
            sb.append(mn.trim().toLowerCase().charAt(0));
        }
        
        // Primer apellido completo
        String[] surnames = ln.trim().split("\\s+");
        sb.append(surnames[0].toLowerCase());
        
        // Primera letra del segundo apellido (si existe)
        if (surnames.length > 1 && !surnames[1].isEmpty()) {
            sb.append(surnames[1].toLowerCase().charAt(0));
        }

        String baseUsername = sb.toString();
        String finalUsername = baseUsername;
        
        int count = 1;
        while (userRepository.findByTenantIdAndUsername(TenantContext.get(), finalUsername).isPresent()) {
            finalUsername = baseUsername + count;
            count++;
        }
        
        return finalUsername;
    }

    @Override
    @Transactional(readOnly = true)
    public List<UserResponse> getUsers() {
        return userRepository.findAllByTenantId(TenantContext.get()).stream()
                .map(this::mapToUserResponse)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public UserResponse getUserById(UUID id) {
        User user = userRepository.findByTenantIdAndId(TenantContext.get(), id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuario no encontrado"));
        return mapToUserResponse(user);
    }

    @Override
    @Transactional
    public UserResponse updateUser(UUID id, UserUpdateRequest userRequest) {
        User user = userRepository.findByTenantIdAndId(TenantContext.get(), id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuario no encontrado"));
        
        Person person = user.getPerson();

        // Validar si el email cambió y si el nuevo ya existe
        if (!person.getEmail().equalsIgnoreCase(userRequest.getEmail())) {
            if (personRepository.existsByTenantIdAndEmail(TenantContext.get(), userRequest.getEmail())) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Email already exists");
            }
        }

        // Si los nombres cambiaron, regeneramos el username como en el create
        boolean nameChanged = !person.getFirstName().equalsIgnoreCase(userRequest.getFirstName()) ||
                              (person.getMiddleName() != null && !person.getMiddleName().equalsIgnoreCase(userRequest.getMiddleName())) ||
                              (person.getMiddleName() == null && userRequest.getMiddleName() != null) ||
                              !person.getLastName().equalsIgnoreCase(userRequest.getLastName());

        if (nameChanged) {
            String newUsername = generarUsername(userRequest.getFirstName(), userRequest.getMiddleName(), userRequest.getLastName());
            user.setUsername(newUsername);
        }

        person.setFirstName(userRequest.getFirstName());
        person.setMiddleName(userRequest.getMiddleName());
        person.setLastName(userRequest.getLastName());
        person.setEmail(userRequest.getEmail());
        person.setPhone(userRequest.getPhone());
        person.setAddress(userRequest.getAddress());
        person.setNationality(userRequest.getNationality());
        
        personRepository.save(person);
        User updatedUser = userRepository.save(user);
        
        return mapToUserResponse(updatedUser);
    }

    @Override
    @Transactional
    public void deleteUser(UUID id) {
        User user = userRepository.findByTenantIdAndId(TenantContext.get(), id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuario no encontrado"));
        user.setActive(false);
        userRepository.save(user);
    }

    @Override
    @Transactional
    public UserResponse assigneRole(UUID userId, UUID roleId) {
        User user = userRepository.findByTenantIdAndId(TenantContext.get(), userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuario no encontrado"));
        Role role = roleRepository.findById(roleId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Rol no encontrado"));

        if (userRoleRepository.existsByUserIdAndRoleId(userId, roleId)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "El rol ya esta asignado al usuario");
        }

        UserRoleId userRoleId = new UserRoleId(userId, roleId);
        UserRole userRole = UserRole.builder()
                .id(userRoleId)
                .user(user)
                .role(role)
                .active(true)
                .build();

        // Agregamos a la lista del usuario y guardamos el usuario (aprovechando CascadeType.ALL)
        user.getUserRoles().add(userRole);
        userRepository.save(user);

        return mapToUserResponse(user);
    }

    private UserResponse mapToUserResponse(User user) {
        List<String> roles = user.getUserRoles().stream()
                .filter(UserRole::getActive)
                .map(ur -> ur.getRole().getName())
                .collect(Collectors.toList());

        Person person = user.getPerson();
        PersonResponse personResponse = PersonResponse.builder()
                .id(person.getId())
                .dni(person.getDni())
                .firstName(person.getFirstName())
                .middleName(person.getMiddleName())
                .lastName(person.getLastName())
                .email(person.getEmail())
                .phone(person.getPhone())
                .address(person.getAddress())
                .nationality(person.getNationality())
                .active(person.getActive())
                .build();

        return UserResponse.builder()
                .id(user.getId())
                .username(user.getUsername())
                .active(user.getActive())
                .lastLogin(user.getLastLogin())
                .createdAt(user.getCreatedAt())
                .person(personResponse)
                .roles(roles)
                .build();
    }

    @Override
    @Transactional
    public LoginResponse login(LoginRequest loginRequest) {
        try {
            Authentication authentication = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(
                            loginRequest.getUsername(),
                            loginRequest.getPassword()
                    )
            );

            SecurityContextHolder.getContext().setAuthentication(authentication);
            String jwt = jwtTokenProvider.generateToken(authentication);

            User user = userRepository.findByTenantIdAndUsername(TenantContext.get(), loginRequest.getUsername())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuario no encontrado"));
            
            user.setLastLogin(java.time.LocalDateTime.now());
            userRepository.save(user);

            List<String> roles = user.getUserRoles().stream()
                    .filter(UserRole::getActive)
                    .map(ur -> ur.getRole().getName())
                    .collect(Collectors.toList());

            return LoginResponse.builder()
                    .token(jwt)
                    .username(user.getUsername())
                    .roles(roles)
                    .expiresIn(jwtTokenProvider.getExpiryDuration())
                    .build();
        } catch (org.springframework.security.core.AuthenticationException e) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Credenciales incorrectas: " + e.getMessage());
        }
    }

    @Override
    @Transactional
    public UserResponse register(UserCreateRequest registerRequest) {
        // 1. Crear el usuario usando la lógica existente
        UserResponse userResponse = createUser(registerRequest);

        // 2. Buscar o crear el rol por defecto "USER"
        Role role = roleRepository.findByNameIgnoreCase("USER")
                .orElseGet(() -> roleRepository.save(Role.builder()
                        .name("USER")
                        .description("Default client/user role")
                        .active(true)
                        .build()));

        // 3. Asignar el rol al usuario
        return assigneRole(userResponse.getId(), role.getId());
    }
}
