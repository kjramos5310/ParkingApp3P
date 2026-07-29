package ec.edu.espe.usuarios.config;

import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.stream.Collectors;

/*
 * Tarea de arranque: migra el esquema y siembra los datos iniciales contra la
 * base real. Se desactiva con app.bootstrap.enabled=false, que es lo que hacen
 * las pruebas para no ejecutar DDL especifico del motor sobre la BD embebida.
 */
@ConditionalOnProperty(name = "app.bootstrap.enabled", havingValue = "true", matchIfMissing = true)
@Component
@RequiredArgsConstructor
@Order(0)
public class MultiTenantSchemaMigration implements ApplicationRunner {
    private final JdbcTemplate jdbc;

    @Override public void run(ApplicationArguments args) {
        jdbc.execute("ALTER TABLE person ADD COLUMN IF NOT EXISTS tenant_id varchar(50) DEFAULT 'empresa-a'");
        jdbc.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS tenant_id varchar(50) DEFAULT 'empresa-a'");
        jdbc.update("UPDATE person SET tenant_id='empresa-a' WHERE tenant_id IS NULL");
        jdbc.update("UPDATE users u SET tenant_id=p.tenant_id FROM person p WHERE u.id_person=p.id AND u.tenant_id IS NULL");
        dropSingleColumnUnique("person", List.of("dni", "email", "phone"));
        dropSingleColumnUnique("users", List.of("username"));
        addConstraintIfMissing("person", "uk_person_tenant_dni", "tenant_id, dni");
        addConstraintIfMissing("person", "uk_person_tenant_email", "tenant_id, email");
        addConstraintIfMissing("person", "uk_person_tenant_phone", "tenant_id, phone");
        addConstraintIfMissing("users", "uk_users_tenant_username", "tenant_id, username");
        jdbc.execute("ALTER TABLE person ALTER COLUMN tenant_id SET NOT NULL");
        jdbc.execute("ALTER TABLE users ALTER COLUMN tenant_id SET NOT NULL");
    }

    private void dropSingleColumnUnique(String table, List<String> columns) {
        String allowedColumns = columns.stream()
                .map(column -> "'" + column.replace("'", "") + "'")
                .collect(Collectors.joining(","));
        List<String> constraints = jdbc.queryForList(
                "SELECT con.conname FROM pg_constraint con " +
                "JOIN unnest(con.conkey) key(attnum) ON true " +
                "JOIN pg_attribute att ON att.attrelid=con.conrelid AND att.attnum=key.attnum " +
                "WHERE con.conrelid=to_regclass(?) AND con.contype='u' " +
                "GROUP BY con.conname HAVING COUNT(*)=1 AND MAX(att.attname) IN (" + allowedColumns + ")",
                String.class, table);
        constraints.forEach(name -> jdbc.execute("ALTER TABLE " + table + " DROP CONSTRAINT \"" + name.replace("\"", "") + "\""));
    }

    private void addConstraintIfMissing(String table, String name, String columns) {
        Integer count = jdbc.queryForObject("SELECT COUNT(*) FROM pg_constraint WHERE conname=?", Integer.class, name);
        if (count != null && count == 0) {
            jdbc.execute("ALTER TABLE " + table + " ADD CONSTRAINT " + name + " UNIQUE (" + columns + ")");
        }
    }
}
