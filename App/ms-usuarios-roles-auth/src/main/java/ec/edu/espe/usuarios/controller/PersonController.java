package ec.edu.espe.usuarios.controller;

import ec.edu.espe.usuarios.entity.Person;
import ec.edu.espe.usuarios.repository.PersonRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.HashMap;
import java.util.Map;
import ec.edu.espe.usuarios.tenant.TenantContext;

@RestController
@RequestMapping("/api/personas")
public class PersonController {

    @Autowired
    private PersonRepository personRepository;

    @GetMapping("/{dni}")
    public ResponseEntity<Map<String, Object>> getPersonByDni(@PathVariable String dni) {
        Person person = personRepository.findByTenantIdAndDni(TenantContext.get(), dni)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Persona no encontrada"));

        Map<String, Object> response = new HashMap<>();
        response.put("id", person.getId().toString());
        response.put("dni", person.getDni());
        
        // Construct full name if middleName exists
        String nombre = person.getFirstName();
        if (person.getMiddleName() != null && !person.getMiddleName().trim().isEmpty()) {
            nombre = nombre + " " + person.getMiddleName().trim();
        }
        
        response.put("nombre", nombre);
        response.put("apellido", person.getLastName());
        response.put("email", person.getEmail());
        response.put("telefono", person.getPhone());

        return ResponseEntity.ok(response);
    }
}
