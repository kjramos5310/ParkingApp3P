package ec.edu.espe.zonas.tenant;

public final class TenantContext {
    public static final String HEADER = "X-Tenant-ID";
    private static final ThreadLocal<String> CURRENT = new ThreadLocal<>();
    private TenantContext() {}
    public static void set(String tenantId) { CURRENT.set(normalize(tenantId)); }
    public static String get() {
        String value = CURRENT.get();
        if (value == null) throw new IllegalStateException("No existe un tenant en el contexto actual");
        return value;
    }
    public static void clear() { CURRENT.remove(); }
    public static String normalize(String value) {
        if (value == null || !value.trim().toLowerCase().matches("[a-z0-9][a-z0-9-]{1,49}"))
            throw new IllegalArgumentException("X-Tenant-ID es obligatorio y debe usar 2-50 caracteres: letras, numeros o guiones");
        return value.trim().toLowerCase();
    }
}
