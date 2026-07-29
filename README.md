# 🅿️ ParkingApp — Sistema de Parqueaderos SaaS Multitenant

Sistema de gestión de parqueaderos bajo arquitectura de microservicios (Spring Boot + NestJS), con SPA en React, ocupación en tiempo real vía **Server-Sent Events (SSE)**, auditoría de eventos por **RabbitMQ** y despliegue en **Kubernetes** tras un **API Gateway (Kong)**.

Todo el stack corre en **Docker** con un solo comando, o en **Kubernetes** con un script.

## 📚 Documentación

| Documento | Contenido |
|---|---|
| [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md) | Diagramas, microservicios, multitenancy, Kong, mensajería, SSE y decisiones de diseño |
| [docs/MANUAL-DESPLIEGUE.md](docs/MANUAL-DESPLIEGUE.md) | Despliegue en Compose y Kubernetes, operación, respaldos y diagnóstico |
| [k8s/README.md](k8s/README.md) | Manifiestos de Kubernetes y escalado |

## 🗂️ Estructura

```
App/               5 microservicios independientes
kong-config/       Configuración declarativa de Kong
Frontend/          SPA React + Vite + Tailwind
k8s/               Manifiestos de Kubernetes e Ingress
docs/              Arquitectura y manual de despliegue
.github/workflows/ Pipeline CI/CD
```

## Multi-tenant por empresa

La aplicacion usa una base compartida por microservicio y separa cada fila con `tenant_id`.
Todas las peticiones entran por Kong en `http://localhost:8000` y deben enviar
`X-Tenant-ID`. El login incluye ese valor dentro del JWT; si alguien cambia solo el
header para intentar entrar a otra empresa, el servicio rechaza el token.

Las unicidades ahora son compuestas. Por ejemplo, personas usa
`UNIQUE (tenant_id, dni)`: el mismo DNI puede existir una vez en `empresa-a` y una
vez en `empresa-b`, pero no puede duplicarse dentro de una misma empresa. La misma
regla se aplica a correo, telefono, username, placa, zonas y espacios.

Tenants demo: `empresa-a` y `empresa-b`. Ambos reciben el admin `admin/admin123`.
Se pueden configurar con `APP_TENANTS` en `.env`.

```bash
# Login de empresa A por el API Gateway
curl -X POST http://localhost:8000/api/auth/login \
  -H "X-Tenant-ID: empresa-a" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# Login independiente de empresa B
curl -X POST http://localhost:8000/api/auth/login \
  -H "X-Tenant-ID: empresa-b" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

Para demostrar el aislamiento en el frontend abre dos ventanas:

- `http://localhost:5500/?tenant=empresa-a`
- `http://localhost:5500/?tenant=empresa-b`

En Kubernetes el tenant también se detecta por subdominio
(`empresa-a.parqueadero.espe.edu.ec`).

Las consultas, caches Redis, llamadas entre servicios, eventos SSE y auditorias
tambien quedan particionados por tenant. La configuracion declarativa de Kong y las
imagenes independientes dejan el stack listo para traducirlo posteriormente a
Deployments/Services de Kubernetes sin cambiar el contrato HTTP.

---

## 🚀 Ejecución rápida

**Requisito único:** [Docker Desktop](https://www.docker.com/products/docker-desktop/) instalado y corriendo.

```bash
docker compose up -d --build
```

La primera vez tarda unos minutos (compila las imágenes de Java y Node). Cuando termine, abre:

### 👉 **http://localhost:5500**

Para desplegar en Kubernetes:

```powershell
.\k8s\deploy.ps1     # Windows
```
```bash
./k8s/deploy.sh      # Linux / macOS
```

---

## 🗺️ Vistas del frontend

| Vista | URL | Qué muestra |
|---|---|---|
| **Zonas y Espacios** | http://localhost:5500/zonas.html | Zonas del parqueadero. Clic en una zona → sus espacios y estados (disponible / ocupado / reservado / deshabilitado). |
| **Dashboard de Espacios** | http://localhost:5500/dashboard.html | Todos los espacios en una grilla + log de eventos SSE en vivo. |

Ambas se actualizan **en tiempo real**: al crear un ticket o reservar un espacio, la vista cambia sola (sin recargar).

---

## 🧩 Arquitectura

| Servicio | Tecnología | Puerto | Base de datos |
|---|---|---|---|
| `ms-usuarios-roles-auth` | Spring Boot | `8080` | PostgreSQL · `usuarios_db` |
| `ms-zonas-espacios` | Spring Boot | `8082` | MySQL · `db_zonas_espacios` |
| `ms-vehiculos` | NestJS | `3001` | PostgreSQL · `vehiculos_db` |
| `ms-tickets` | NestJS | `3002` | PostgreSQL · `tickets_db` |
| `ms-audith` | NestJS | `3004` | PostgreSQL · `db_audit` |
| `frontend` | Nginx (estático) | `5500` | — |

**Infraestructura:**

| Componente | Puerto | Credenciales |
|---|---|---|
| PostgreSQL | `5432` | `postgres` / `postgres` |
| MySQL | `3307` | `espe_user` / `espe_password` |
| RabbitMQ | `5672` · consola `15672` | `admin` / `admin123` |

### Flujo de eventos

- **Tickets → Zonas:** al crear un ticket, `ms-tickets` valida la persona (usuarios), la placa (vehículos) y el espacio (zonas), y marca el espacio como `OCUPADO`. Al cerrarlo, lo libera.
- **Zonas → Frontend (SSE):** cada cambio de estado de un espacio se emite por `GET /api/espacios/sse` (evento `espacio_cambiado`) y el dashboard se actualiza al instante.
- **Servicios → Auditoría (RabbitMQ):** usuarios y vehículos publican eventos al exchange `audit_exchange`, que `ms-audith` consume y persiste.

---

## 🔑 Credenciales

Se crea automáticamente un usuario administrador al arrancar:

```
usuario:    admin
contraseña: admin123
rol:        ADMIN
DNI:        9999999999
```

- Las **lecturas** requieren una sesion valida del mismo tenant; el frontend abre su formulario de login.
- Las **escrituras** (crear/editar/eliminar, reservar, crear ticket) requieren ademas el rol `ADMIN`.

Obtener el token:

```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "X-Tenant-ID: empresa-a" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

Usalo con ambos headers: `Authorization: Bearer <token>` y `X-Tenant-ID: empresa-a`.
El navegador recibe alternativamente una cookie `HttpOnly` distinta por tenant.

---

## 🌱 Datos de ejemplo

Al arrancar por primera vez se siembran automáticamente 2 zonas (`Zona VIP`, `Zona General`) con 7 espacios en distintos estados, para que el dashboard tenga contenido desde el minuto cero.

---

## 📮 Probar la API con Postman

Importa el archivo **`ParkingApp.postman_collection.json`** (Import → arrastra el archivo).

1. Ejecuta primero **Auth → Login admin** — guarda el token automáticamente.
2. Luego el resto: crear zonas, espacios, reservar, crear tickets, etc. Los IDs se auto-guardan entre requests.

**Flujo completo de un ticket:**

1. `Auth → Login admin`
2. `Vehículos → Crear vehículo Auto` (placa `ABC-1234`)
3. `Espacios → Listar espacios` → copia el `id` de uno **DISPONIBLE** y su `nombreZona`
4. `Tickets → Crear ticket` con `dni: 9999999999`, la placa y ese espacio

→ El espacio pasa a **OCUPADO** y lo verás cambiar en vivo en el dashboard.

### Reglas de negocio

- Una zona **deshabilitada** deshabilita **todos sus espacios**, y estos **no se pueden ocupar**.
- Un vehículo no puede tener dos tickets activos a la vez (ni una persona).
- Una motocicleta no puede ocupar un espacio de auto (y viceversa).
- Los vehículos eléctricos/híbridos reciben **50% de descuento** al cerrar el ticket.

---

## 🛠️ Comandos útiles

```bash
# Levantar todo (construyendo imágenes)
docker compose up -d --build

# Ver el estado de los contenedores
docker compose ps

# Ver logs de un servicio
docker compose logs -f ms-zonas

# Reconstruir y reiniciar un solo servicio
docker compose up -d --build ms-tickets

# Apagar todo (conserva los datos)
docker compose down

# Apagar y BORRAR las bases de datos (empezar de cero)
docker compose down -v
```

---

## 🧯 Problemas comunes

**Un puerto está ocupado**
Libera los puertos `8080`, `8082`, `3001`, `3002`, `3004`, `5500`, `5432`, `3307`, `5672` o cambia el mapeo en `docker-compose.yml`.

**El dashboard no muestra espacios**
Verifica que `ms-zonas` y `kong` esten arriba: `docker compose logs ms-zonas kong`.
Prueba la ruta `http://localhost:8000/api/espacios` con el tenant y el token.

**"Persona no encontrada" al crear un ticket**
El `dni` debe existir en `ms-usuarios`. Usa `9999999999` (el admin) o registra una persona primero.

**"Espacio no encontrado o no disponible"**
El espacio debe estar en estado `DISPONIBLE` y su zona **no** puede estar deshabilitada.

---

## 📁 Estructura

```
├── App/
│   ├── db/                      # Script de init de PostgreSQL (crea 1 BD por servicio)
│   ├── ms-usuarios-roles-auth/  # Spring Boot — usuarios, roles, auth (JWT)
│   ├── ms-zonas-espacios/       # Spring Boot — zonas, espacios, SSE
│   ├── ms-vehiculos/            # NestJS — vehículos
│   ├── ms-tickets/              # NestJS — tickets, SSE
│   └── ms-audith/               # NestJS — auditoría (consumidor RabbitMQ)
├── kong-config/                 # Configuración declarativa del API Gateway
├── Frontend/                    # SPA React + Vite + Tailwind (Nginx)
├── k8s/                         # Manifiestos de Kubernetes e Ingress
├── docs/                        # Arquitectura y manual de despliegue
├── .github/workflows/           # Pipeline CI/CD
├── docker-compose.yml           # Orquestación completa del stack
└── ParkingApp.postman_collection.json
```
