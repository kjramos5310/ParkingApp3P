package ec.edu.espe.usuarios.config;

import ec.edu.espe.usuarios.entity.*;
import ec.edu.espe.usuarios.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.util.Optional;

@Component
@RequiredArgsConstructor
public class DataInitializer implements CommandLineRunner {

    private final RoleRepository roleRepository;
    private final UserRepository userRepository;
    private final PersonRepository personRepository;
    private final UserRoleRepository userRoleRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    public void run(String... args) throws Exception {
        // Seed ADMIN role
        Role adminRole = roleRepository.findByNameIgnoreCase("ADMIN")
                .orElseGet(() -> roleRepository.save(Role.builder()
                        .name("ADMIN")
                        .description("Administrator with full access")
                        .active(true)
                        .build()));

        // Seed USER role
        Role userRole = roleRepository.findByNameIgnoreCase("USER")
                .orElseGet(() -> roleRepository.save(Role.builder()
                        .name("USER")
                        .description("Default user role")
                        .active(true)
                        .build()));

        // Check if admin user exists
        if (userRepository.findByUsername("admin").isEmpty()) {
            // Create person for admin
            Person adminPerson = Person.builder()
                    .dni("9999999999")
                    .firstName("Admin")
                    .middleName("Sistema")
                    .lastName("System")
                    .email("admin@parqueadero.espe.edu.ec")
                    .phone("0999999999")
                    .address("ESPE Sangolqui")
                    .nationality("Ecuatoriana")
                    .active(true)
                    .build();

            adminPerson = personRepository.save(adminPerson);

            // Create admin user
            User adminUser = User.builder()
                    .person(adminPerson)
                    .username("admin")
                    .passwordHash(passwordEncoder.encode("admin123"))
                    .passwordHashColumn(passwordEncoder.encode("admin123"))
                    .active(true)
                    .build();

            adminUser = userRepository.save(adminUser);

            // Assign ADMIN role
            UserRoleId userRoleId = new UserRoleId(adminUser.getId(), adminRole.getId());
            UserRole userRoleAssigned = UserRole.builder()
                    .id(userRoleId)
                    .user(adminUser)
                    .role(adminRole)
                    .active(true)
                    .build();

            userRoleRepository.save(userRoleAssigned);
        }
    }
}
