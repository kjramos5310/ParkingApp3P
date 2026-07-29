# Despliegue en Kubernetes

Manifiestos de despliegue del sistema de parqueaderos SaaS multitenant.
Todo vive en el namespace `parqueadero`.

## Contenido

| Archivo | Recursos |
|---|---|
| `00-namespace.yaml` | Namespace `parqueadero` |
| `01-configmap.yaml` | `parking-config` (config comun), `parking-endpoints` (URLs servicio-a-servicio) |
| `02-secret.yaml` | `parking-secrets` (JWT, credenciales de BD y RabbitMQ) |
| `03-postgres.yaml` | PVC + ConfigMap de init + Deployment + Service |
| `04-mysql.yaml` | PVC + Deployment + Service |
| `05-redis.yaml` | `redis-tickets` y `redis-zonas` (Deployment + Service c/u) |
| `06-rabbitmq.yaml` | PVC + Deployment + Service (AMQP 5672, consola 15672) |
| `07-kong-config.yaml` | ConfigMap con la configuracion declarativa (**generado**) |
| `08-kong.yaml` | Deployment + Service `kong-proxy` |
| `10..14-ms-*.yaml` | Un Deployment + Service por microservicio |
| `20-frontend.yaml` | Deployment + Service de la SPA |
| `30-ingress.yaml` | Ingress `parqueadero.espe.edu.ec` (+ comodin por subdominio) |
| `40-hpa.yaml` | HorizontalPodAutoscalers |

## Despliegue rapido

```powershell
# Windows
.\k8s\deploy.ps1
```

```bash
# Linux / macOS / Git Bash
./k8s/deploy.sh
```

El script arranca minikube, habilita `ingress` y `metrics-server`, construye las
seis imagenes **dentro del daemon Docker de minikube**, regenera el ConfigMap de
Kong y aplica todos los manifiestos.

Al terminar, agrega la direccion que imprime a tu archivo `hosts`.

En Windows con el driver Docker, deja este comando ejecutandose en otra
PowerShell como administrador:

```powershell
minikube tunnel
```

En ese caso la entrada de `hosts` es:

```
127.0.0.1  parqueadero.espe.edu.ec
```

La aplicacion local queda disponible en
`http://parqueadero.espe.edu.ec`. Otros drivers y sistemas pueden exponer el
Ingress directamente en la IP de `minikube ip`; el script muestra la entrada
adecuada.

## Despliegue manual

```bash
# 1. Imagenes dentro del cluster (imagePullPolicy: Never no usa registro)
eval $(minikube docker-env)
docker build -t parkingapp/ms-usuarios:latest  App/ms-usuarios-roles-auth
docker build -t parkingapp/ms-zonas:latest     App/ms-zonas-espacios
docker build -t parkingapp/ms-vehiculos:latest App/ms-vehiculos
docker build -t parkingapp/ms-tickets:latest   App/ms-tickets
docker build -t parkingapp/ms-audith:latest    App/ms-audith
docker build -t parkingapp/frontend:latest     Frontend

# 2. Configuracion de Kong y manifiestos
python k8s/sync-kong-config.py
kubectl apply -f k8s/

# 3. Estado
kubectl -n parqueadero get pods -w
```

## Certificado TLS

El Ingress espera un Secret `parqueadero-tls`. Para un certificado autofirmado
de laboratorio:

```bash
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout tls.key -out tls.crt \
  -subj "/CN=parqueadero.espe.edu.ec" \
  -addext "subjectAltName=DNS:parqueadero.espe.edu.ec,DNS:*.parqueadero.espe.edu.ec"

kubectl -n parqueadero create secret tls parqueadero-tls \
  --cert=tls.crt --key=tls.key
```

En produccion, instala cert-manager, descomenta la anotacion
`cert-manager.io/cluster-issuer` y cambia
`nginx.ingress.kubernetes.io/ssl-redirect` a `"true"` en `30-ingress.yaml`.

Sin el Secret, el despliegue local conserva
`nginx.ingress.kubernetes.io/ssl-redirect: "false"` para permitir el acceso por
HTTP.

## Configuracion de Kong

`kong-config/kong.yml` es la **unica fuente de verdad**. `07-kong-config.yaml` se genera
a partir de el; no lo edites a mano:

```bash
python k8s/sync-kong-config.py
kubectl apply -f k8s/07-kong-config.yaml
kubectl -n parqueadero rollout restart deployment/kong
```

## Escalado

`40-hpa.yaml` escala automaticamente `ms-usuarios`, `ms-vehiculos`, `ms-audith`,
`kong` y `frontend` por CPU. Escalado manual:

```bash
kubectl -n parqueadero scale deployment/ms-vehiculos --replicas=5
```

### Por que `ms-zonas` y `ms-tickets` estan fijos en 1 replica

Ambos mantienen los emisores SSE (`SseEmitter` / `Subject`) **en memoria del
pod**. Con varias replicas, un navegador queda conectado a un solo pod y solo
recibe los eventos que ese pod genera; los cambios de estado atendidos por otra
replica nunca le llegan.

Para escalarlos horizontalmente hay que difundir los eventos entre replicas,
por ejemplo con un exchange `fanout` de RabbitMQ al que se suscriba cada pod y
reemita a sus emisores locales. La infraestructura de mensajeria ya esta
desplegada; falta el fan-out. Mientras tanto, mantenerlos en 1 replica es lo
correcto: es preferible a un dashboard que muestra datos incompletos.

## Verificacion

```bash
# Estado general
kubectl -n parqueadero get pods,svc,ingress,hpa

# Logs
kubectl -n parqueadero logs -l app=ms-audith --tail=50 -f

# Consola de RabbitMQ (admin / admin123)
kubectl -n parqueadero port-forward svc/rabbitmq 15672:15672

# Probar el gateway sin pasar por el Ingress
kubectl -n parqueadero port-forward svc/kong-proxy 8000:8000
curl -X POST http://localhost:8000/api/auth/login \
  -H 'Content-Type: application/json' -H 'X-Tenant-ID: empresa-a' \
  -d '{"username":"admin","password":"admin123"}'
```

## Notas de seguridad

- `02-secret.yaml` trae valores en claro **solo para la demo academica**. En un
  entorno real, crea el Secret fuera de Git (`kubectl create secret`,
  Sealed Secrets o External Secrets Operator) y elimina el archivo del repo.
- El puerto Admin de Kong escucha en `127.0.0.1` y no se expone como Service:
  la configuracion es inmutable y proviene del ConfigMap.
- Todo el trafico externo entra por el Ingress y pasa por Kong, que valida el
  JWT antes de alcanzar cualquier microservicio.
