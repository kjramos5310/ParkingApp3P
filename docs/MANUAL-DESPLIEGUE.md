# Manual de despliegue y operación

## Requisitos

| Herramienta | Versión | Para qué |
|---|---|---|
| Docker | 24+ | Construir imágenes y entorno local |
| Java (JDK) | 21 | Microservicios Spring Boot |
| Node.js | 22+ | Microservicios NestJS y frontend |
| Python | 3.9+ | Sincronizar la configuración de Kong |
| minikube | 1.32+ | Clúster local |
| kubectl | 1.29+ | Operar el clúster |

---

## Opción A — Entorno local con Docker Compose

La vía más rápida para levantar todo el sistema.

```bash
# 1. Variables de entorno (opcional: hay valores por defecto)
cp .env.example .env

# 2. Levantar toda la plataforma
docker compose up --build -d

# 3. Seguir el arranque
docker compose logs -f
```

### Puntos de acceso

| Servicio | URL |
|---|---|
| **Frontend** | http://localhost:5500 |
| API Gateway (Kong) | http://localhost:8000 |
| Consola de RabbitMQ | http://localhost:15672 (`admin` / `admin123`) |
| Swagger `ms-usuarios` | http://localhost:8080/swagger-ui.html |
| Swagger `ms-zonas` | http://localhost:8082/swagger-ui.html |
| Swagger `ms-vehiculos` | http://localhost:3001/docs |
| Swagger `ms-tickets` | http://localhost:3002/docs |
| Swagger `ms-audith` | http://localhost:3004/docs |

### Detener

```bash
docker compose down          # conserva los datos
docker compose down -v       # elimina también los volúmenes
```

---

## Opción B — Kubernetes (minikube)

### Despliegue automático

```powershell
# Windows
.\k8s\deploy.ps1
```

```bash
# Linux / macOS / Git Bash
./k8s/deploy.sh
```

El script arranca minikube, habilita `ingress` y `metrics-server`, construye las
seis imágenes dentro del daemon de minikube, regenera el ConfigMap de Kong y
aplica todos los manifiestos.

### Despliegue manual

```bash
# 1. Clúster y addons
minikube start --cpus=4 --memory=8192
minikube addons enable ingress
minikube addons enable metrics-server

# 2. Imágenes dentro del clúster (imagePullPolicy: Never no usa registro)
eval $(minikube docker-env)
docker build -t parkingapp/ms-usuarios:latest  App/ms-usuarios-roles-auth
docker build -t parkingapp/ms-zonas:latest     App/ms-zonas-espacios
docker build -t parkingapp/ms-vehiculos:latest App/ms-vehiculos
docker build -t parkingapp/ms-tickets:latest   App/ms-tickets
docker build -t parkingapp/ms-audith:latest    App/ms-audith
docker build -t parkingapp/frontend:latest     Frontend

# 3. Manifiestos
python k8s/sync-kong-config.py
kubectl apply -f k8s/

# 4. Esperar
kubectl -n parqueadero wait --for=condition=available --timeout=600s deployment --all
```

### Acceso

Agrega la IP de minikube a tu archivo `hosts`:

```
# Windows: C:\Windows\System32\drivers\etc\hosts  (como administrador)
# Linux/macOS: /etc/hosts
<minikube-ip>  parqueadero.espe.edu.ec
```

Obtén la IP con `minikube ip`. Luego abre **https://parqueadero.espe.edu.ec**.

### Certificado TLS

```bash
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout tls.key -out tls.crt \
  -subj "/CN=parqueadero.espe.edu.ec" \
  -addext "subjectAltName=DNS:parqueadero.espe.edu.ec,DNS:*.parqueadero.espe.edu.ec"

kubectl -n parqueadero create secret tls parqueadero-tls --cert=tls.crt --key=tls.key
```

Si aún no tienes certificado, pon
`nginx.ingress.kubernetes.io/ssl-redirect: "false"` en `k8s/30-ingress.yaml`
para entrar por HTTP mientras tanto.

---

## Primer uso

1. Abre el frontend.
2. Indica la **empresa** (`empresa-a` por defecto) e inicia sesión con las
   credenciales que siembra `DataInitializer`.
3. Crea una **zona**, agrega sus **espacios** y registra un **vehículo**.
4. En **Tickets**, registra un ingreso: el mapa de bahías del panel de
   ocupación cambia al instante por SSE.
5. En **Auditoría** (solo rol ADMIN) verás los eventos que cada microservicio
   publicó por RabbitMQ.

---

## Operación

### Estado del sistema

```bash
kubectl -n parqueadero get pods,svc,ingress,hpa
kubectl -n parqueadero top pods            # requiere metrics-server
```

### Logs

```bash
kubectl -n parqueadero logs -l app=ms-tickets --tail=100 -f
kubectl -n parqueadero logs -l app=ms-audith --tail=100 -f
```

### Escalar

```bash
kubectl -n parqueadero scale deployment/ms-vehiculos --replicas=5
```

> No escales `ms-zonas` ni `ms-tickets` por encima de 1 réplica: mantienen los
> emisores SSE en memoria y los clientes recibirían datos incompletos. Ver la
> sección de tiempo real en [ARQUITECTURA.md](ARQUITECTURA.md).

### Cambiar la configuración de Kong

`App/kong.yml` es la única fuente de verdad:

```bash
python k8s/sync-kong-config.py
kubectl apply -f k8s/07-kong-config.yaml
kubectl -n parqueadero rollout restart deployment/kong
```

### Actualizar un microservicio

```bash
eval $(minikube docker-env)
docker build -t parkingapp/ms-tickets:latest App/ms-tickets
kubectl -n parqueadero rollout restart deployment/ms-tickets
kubectl -n parqueadero rollout status deployment/ms-tickets
```

### Consola de RabbitMQ

```bash
kubectl -n parqueadero port-forward svc/rabbitmq 15672:15672
# http://localhost:15672 — admin / admin123
```

### Copia de seguridad

```bash
# PostgreSQL
kubectl -n parqueadero exec deployment/postgres -- \
  pg_dumpall -U postgres > respaldo-postgres.sql

# MySQL
kubectl -n parqueadero exec deployment/mysql -- \
  mysqldump -uroot -proot --all-databases > respaldo-mysql.sql
```

---

## Incorporar un tenant nuevo

El aislamiento es lógico (columna `tenant_id`), así que **no hay que
redesplegar**:

1. Agrega el identificador a `APP_TENANTS` en `k8s/01-configmap.yaml`.
2. Aplica y reinicia los servicios Java:
   ```bash
   kubectl apply -f k8s/01-configmap.yaml
   kubectl -n parqueadero rollout restart deployment/ms-usuarios deployment/ms-zonas
   ```
3. Crea el usuario administrador de la empresa desde la consola.
4. Opcional: apunta `empresa-nueva.parqueadero.espe.edu.ec` al Ingress; el
   frontend detecta el tenant por subdominio.

---

## CI/CD

El pipeline (`.github/workflows/ci.yml`) ejecuta:

1. **Compilar y probar** — Maven `verify` y Jest en los tres servicios NestJS y el frontend.
2. **SonarCloud** — análisis estático y lectura del Quality Gate.
3. **Validar K8s** — `kubeconform` sobre `k8s/` y verificación de que el ConfigMap de Kong esté sincronizado con `App/kong.yml`.
4. **Imágenes Docker** — build y push a GHCR (solo en `main` y `dev`).
5. **Desplegar** — `kubectl apply` sobre `main` (requiere el secret `KUBECONFIG`).
6. **Telegram** — resumen con el resultado de cada etapa y el Quality Gate.

### Secrets requeridos

| Secret | Para qué | Obligatorio |
|---|---|---|
| `SONAR_TOKEN` | Análisis en SonarCloud | Sí |
| `TELEGRAM_BOT_TOKEN` | Notificaciones | Sí |
| `TELEGRAM_CHAT_ID` | Notificaciones | Sí |
| `KUBECONFIG` | Despliegue automático (base64) | No — si falta, el despliegue se omite |

```bash
# Generar el KUBECONFIG en base64
base64 -w0 ~/.kube/config
```

---

## Diagnóstico

**Un pod no arranca**
```bash
kubectl -n parqueadero describe pod <nombre>
kubectl -n parqueadero logs <nombre> --previous
```

**`ImagePullBackOff` con imágenes locales**
Las imágenes se construyeron fuera del daemon de minikube. Ejecuta
`eval $(minikube docker-env)` antes de `docker build`.

**Kong devuelve 401 en todo**
El `JWT_SECRET` del Secret debe ser el mismo que usan los microservicios, y el
claim `iss` del token debe valer `parqueadero-auth`. Comprueba que el pod de
Kong reciba la variable:
```bash
kubectl -n parqueadero exec deployment/kong -- env | grep JWT_SECRET
```

**El dashboard no recibe eventos en vivo**
1. Confirma que la conexión SSE esté abierta en la pestaña Network del navegador.
2. Revisa que el Ingress tenga `proxy-buffering: "off"`.
3. Verifica que `ms-zonas` tenga una sola réplica.

**Kong responde 429**
Es el rate limiting funcionando: 120 peticiones por minuto en general y 10 por
minuto en `/api/auth`. Ajusta los valores en `App/kong.yml` si necesitas más.

**Los eventos no llegan a auditoría**
```bash
kubectl -n parqueadero logs -l app=ms-audith --tail=50
kubectl -n parqueadero port-forward svc/rabbitmq 15672:15672
# Revisa la profundidad de audit_queue en la consola
```
Si la cola crece, el consumidor está caído. Si está vacía y no hay registros,
los publicadores no están conectando: revisa las credenciales de RabbitMQ.
