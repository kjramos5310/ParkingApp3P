package ec.edu.espe.usuarios.security;

import ec.edu.espe.usuarios.entity.User;
import ec.edu.espe.usuarios.entity.UserRole;
import ec.edu.espe.usuarios.repository.UserRepository;
import ec.edu.espe.usuarios.tenant.TenantContext;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CustomUserDetailsService implements UserDetailsService {

    private final UserRepository userRepository;

    @Override
    @Transactional(readOnly = true)
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        User user = userRepository.findByTenantIdAndUsername(TenantContext.get(), username)
                .orElseThrow(() -> new UsernameNotFoundException("Usuario no encontrado con el username: " + username));

        if (!user.getActive()) {
            throw new UsernameNotFoundException("El usuario está inactivo: " + username);
        }

        List<SimpleGrantedAuthority> authorities = user.getUserRoles().stream()
                .filter(UserRole::getActive)
                .map(ur -> {
                    String roleName = ur.getRole().getName().toUpperCase();
                    if (!roleName.startsWith("ROLE_")) {
                        roleName = "ROLE_" + roleName;
                    }
                    return new SimpleGrantedAuthority(roleName);
                })
                .collect(Collectors.toList());

        return org.springframework.security.core.userdetails.User.builder()
                .username(user.getUsername())
                // Usamos passwordHash, que mapea a la columna password en la DB
                .password(user.getPasswordHash())
                .authorities(authorities)
                .disabled(!user.getActive())
                .build();
    }
}
