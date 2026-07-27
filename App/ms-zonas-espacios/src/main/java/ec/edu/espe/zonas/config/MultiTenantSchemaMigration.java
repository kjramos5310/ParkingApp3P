package ec.edu.espe.zonas.config;

import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.core.annotation.Order;

import java.util.List;

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
        migrate("zonas", List.of("nombre", "codigo"));
        migrate("espacios", List.of("nombre", "codigo"));
    }

    private void migrate(String table, List<String> formerlyGlobalColumns) {
        addTenantColumnIfMissing(table);
        jdbc.update("UPDATE " + table + " SET tenant_id = 'empresa-a' WHERE tenant_id IS NULL OR tenant_id = ''");
        List<String> indexes = jdbc.queryForList(
                "SELECT index_name FROM information_schema.statistics WHERE table_schema = DATABASE() " +
                "AND table_name = ? AND non_unique = 0 GROUP BY index_name " +
                "HAVING COUNT(*) = 1 AND MAX(column_name) IN (?, ?)",
                String.class, table, formerlyGlobalColumns.get(0), formerlyGlobalColumns.get(1));
        indexes.stream().filter(name -> !"PRIMARY".equalsIgnoreCase(name))
                .forEach(name -> jdbc.execute("ALTER TABLE " + table + " DROP INDEX `" + name.replace("`", "") + "`"));
        addIndexIfMissing(table, "uk_" + singular(table) + "_tenant_nombre", "tenant_id, nombre");
        addIndexIfMissing(table, "uk_" + singular(table) + "_tenant_codigo", "tenant_id, codigo");
        jdbc.execute("ALTER TABLE " + table + " MODIFY tenant_id VARCHAR(50) NOT NULL");
    }

    private void addTenantColumnIfMissing(String table) {
        Integer count = jdbc.queryForObject(
                "SELECT COUNT(*) FROM information_schema.columns " +
                "WHERE table_schema = DATABASE() AND table_name = ? AND column_name = 'tenant_id'",
                Integer.class, table);
        if (count != null && count == 0) {
            jdbc.execute("ALTER TABLE " + table + " ADD COLUMN tenant_id VARCHAR(50) NULL");
        }
    }

    private void addIndexIfMissing(String table, String index, String columns) {
        Integer count = jdbc.queryForObject(
                "SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name=? AND index_name=?",
                Integer.class, table, index);
        if (count != null && count == 0) jdbc.execute("ALTER TABLE " + table + " ADD CONSTRAINT " + index + " UNIQUE (" + columns + ")");
    }

    private String singular(String table) { return table.equals("zonas") ? "zona" : "espacio"; }
}
