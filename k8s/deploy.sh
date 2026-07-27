#!/usr/bin/env bash
# =============================================================================
# Despliegue completo en minikube (Linux / macOS / Git Bash).
#
#   ./k8s/deploy.sh              # construye imagenes y despliega todo
#   ./k8s/deploy.sh --skip-build # solo aplica los manifiestos
#
# Requisitos: minikube, kubectl y Docker en ejecucion.
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
NAMESPACE="parqueadero"
SKIP_BUILD=false

[[ "${1:-}" == "--skip-build" ]] && SKIP_BUILD=true

echo "==> Verificando minikube..."
if [[ "$(minikube status --format '{{.Host}}' 2>/dev/null || true)" != "Running" ]]; then
  echo "    minikube no esta activo. Arrancando..."
  minikube start --cpus=4 --memory=8192
fi

echo "==> Habilitando addons (ingress, metrics-server)..."
minikube addons enable ingress
minikube addons enable metrics-server

if [[ "$SKIP_BUILD" == false ]]; then
  # Construye las imagenes dentro del daemon de minikube, de modo que
  # imagePullPolicy: Never las encuentre sin pasar por un registro.
  echo "==> Conectando el cliente Docker al daemon de minikube..."
  eval "$(minikube -p minikube docker-env)"

  build() {
    echo "==> Construyendo $1..."
    docker build -t "$1" "$REPO_ROOT/$2"
  }

  build parkingapp/ms-usuarios:latest  App/ms-usuarios-roles-auth
  build parkingapp/ms-zonas:latest     App/ms-zonas-espacios
  build parkingapp/ms-vehiculos:latest App/ms-vehiculos
  build parkingapp/ms-tickets:latest   App/ms-tickets
  build parkingapp/ms-audith:latest    App/ms-audith
  build parkingapp/frontend:latest     Frontend
fi

echo "==> Sincronizando la configuracion de Kong..."
python3 "$SCRIPT_DIR/sync-kong-config.py"

echo "==> Aplicando manifiestos..."
kubectl apply -f "$SCRIPT_DIR"

echo "==> Esperando a que las bases de datos esten listas..."
kubectl -n "$NAMESPACE" wait --for=condition=available --timeout=300s \
  deployment/postgres deployment/mysql deployment/rabbitmq

echo "==> Esperando a los microservicios..."
kubectl -n "$NAMESPACE" wait --for=condition=available --timeout=600s \
  deployment/ms-usuarios deployment/ms-zonas deployment/ms-vehiculos \
  deployment/ms-tickets deployment/ms-audith deployment/kong deployment/frontend

echo
echo "==> Despliegue completado."
kubectl -n "$NAMESPACE" get pods,svc,ingress

echo
echo "Agrega esta linea a /etc/hosts:"
echo "    $(minikube ip)  parqueadero.espe.edu.ec"
echo
echo "Luego abre: https://parqueadero.espe.edu.ec"
