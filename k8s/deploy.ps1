# =============================================================================
# Despliegue completo en minikube (Windows / PowerShell).
#
#   .\k8s\deploy.ps1              # construye imagenes y despliega todo
#   .\k8s\deploy.ps1 -SkipBuild   # solo aplica los manifiestos
#
# Requisitos: minikube, kubectl y Docker Desktop en ejecucion.
# =============================================================================
[CmdletBinding()]
param(
    [switch]$SkipBuild,
    [string]$Namespace = "parqueadero"
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot

Write-Host "==> Verificando minikube..." -ForegroundColor Cyan
$status = minikube status --format "{{.Host}}" 2>$null
if ($status -ne "Running") {
    Write-Host "    minikube no esta activo. Arrancando..." -ForegroundColor Yellow
    minikube start --cpus=4 --memory=8192
}

Write-Host "==> Habilitando addons (ingress, metrics-server)..." -ForegroundColor Cyan
minikube addons enable ingress
minikube addons enable metrics-server

if (-not $SkipBuild) {
    # Apunta el cliente Docker al daemon interno de minikube: las imagenes se
    # construyen directamente dentro del cluster y por eso los Deployments
    # pueden usar imagePullPolicy: Never sin necesidad de un registro.
    Write-Host "==> Conectando el cliente Docker al daemon de minikube..." -ForegroundColor Cyan
    & minikube -p minikube docker-env --shell powershell | Invoke-Expression

    $images = @(
        @{ Name = "parkingapp/ms-usuarios:latest";  Context = "App/ms-usuarios-roles-auth" },
        @{ Name = "parkingapp/ms-zonas:latest";     Context = "App/ms-zonas-espacios" },
        @{ Name = "parkingapp/ms-vehiculos:latest"; Context = "App/ms-vehiculos" },
        @{ Name = "parkingapp/ms-tickets:latest";   Context = "App/ms-tickets" },
        @{ Name = "parkingapp/ms-audith:latest";    Context = "App/ms-audith" },
        @{ Name = "parkingapp/frontend:latest";     Context = "Frontend" }
    )

    foreach ($img in $images) {
        Write-Host "==> Construyendo $($img.Name)..." -ForegroundColor Cyan
        docker build -t $img.Name (Join-Path $repoRoot $img.Context)
        if ($LASTEXITCODE -ne 0) { throw "Fallo la construccion de $($img.Name)" }
    }
}

Write-Host "==> Sincronizando la configuracion de Kong..." -ForegroundColor Cyan
python (Join-Path $PSScriptRoot "sync-kong-config.py")

Write-Host "==> Aplicando manifiestos..." -ForegroundColor Cyan
kubectl apply -f $PSScriptRoot

Write-Host "==> Esperando a que las bases de datos esten listas..." -ForegroundColor Cyan
kubectl -n $Namespace wait --for=condition=available --timeout=300s `
    deployment/postgres deployment/mysql deployment/rabbitmq

Write-Host "==> Esperando a los microservicios..." -ForegroundColor Cyan
kubectl -n $Namespace wait --for=condition=available --timeout=600s `
    deployment/ms-usuarios deployment/ms-zonas deployment/ms-vehiculos `
    deployment/ms-tickets deployment/ms-audith deployment/kong deployment/frontend

Write-Host ""
Write-Host "==> Despliegue completado." -ForegroundColor Green
kubectl -n $Namespace get pods,svc,ingress

$ip = minikube ip
Write-Host ""
Write-Host "Agrega esta linea a C:\Windows\System32\drivers\etc\hosts (como administrador):" -ForegroundColor Yellow
Write-Host "    $ip  parqueadero.espe.edu.ec" -ForegroundColor Yellow
Write-Host ""
Write-Host "Luego abre: https://parqueadero.espe.edu.ec" -ForegroundColor Green
