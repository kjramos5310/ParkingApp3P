# =============================================================================
# Prueba de humo end-to-end contra el API Gateway.
#
#   .\scripts\smoke-test.ps1                       # docker compose (Kong en :8000)
#   .\scripts\smoke-test.ps1 -BaseUrl https://parqueadero.espe.edu.ec
#
# Recorre el camino real del sistema: login, rechazo de peticiones sin token,
# aislamiento entre empresas, alta de zona/espacio/vehiculo, ciclo de un ticket,
# llegada de los eventos a auditoria y rate limiting.
# =============================================================================
[CmdletBinding()]
param(
    [string]$BaseUrl = "http://localhost:8000",
    [string]$Tenant = "empresa-a",
    [string]$OtroTenant = "empresa-b",
    [string]$Usuario = "admin",
    [string]$Clave = "admin123"
)

$ErrorActionPreference = "Stop"

# Certificado autofirmado en el despliegue de Kubernetes
if ($BaseUrl -like "https://*") {
    try {
        Add-Type @"
using System.Net;
using System.Security.Cryptography.X509Certificates;
public class AceptarTodoCert : ICertificatePolicy {
    public bool CheckValidationResult(ServicePoint sp, X509Certificate cert, WebRequest req, int problem) { return true; }
}
"@
        [System.Net.ServicePointManager]::CertificatePolicy = New-Object AceptarTodoCert
        [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12
    } catch {}
}

$script:Pasadas = 0
$script:Fallidas = 0

function Registrar($ok, $nombre, $detalle) {
    if ($ok) {
        $script:Pasadas++
        Write-Host "  [OK]    $nombre" -ForegroundColor Green
    } else {
        $script:Fallidas++
        Write-Host "  [FALLA] $nombre" -ForegroundColor Red
        if ($detalle) { Write-Host "          $detalle" -ForegroundColor DarkGray }
    }
}

function Seccion($titulo) {
    Write-Host ""
    Write-Host "== $titulo" -ForegroundColor Cyan
}

# Devuelve el codigo HTTP de una peticion que se espera que falle.
function CodigoDeError($bloque) {
    try {
        & $bloque | Out-Null
        return 200
    } catch {
        if ($_.Exception.Response) { return [int]$_.Exception.Response.StatusCode }
        return -1
    }
}

function Cabeceras($token, $tenant) {
    $h = @{ "X-Tenant-ID" = $tenant }
    if ($token) { $h["Authorization"] = "Bearer $token" }
    return $h
}

Write-Host "Probando $BaseUrl (tenant: $Tenant)" -ForegroundColor White

# ---------------------------------------------------------------------------
Seccion "1. Gateway disponible"
# ---------------------------------------------------------------------------
$listo = $false
foreach ($intento in 1..30) {
    $codigo = CodigoDeError { Invoke-RestMethod -Uri "$BaseUrl/api/zonas" -Headers (Cabeceras $null $Tenant) -TimeoutSec 5 }
    # 401 significa que Kong responde y esta exigiendo el token: el gateway vive.
    if ($codigo -eq 401 -or $codigo -eq 200) { $listo = $true; break }
    Start-Sleep -Seconds 2
}
Registrar $listo "Kong responde en $BaseUrl" "No hubo respuesta tras 60s. Esta levantado el stack?"
if (-not $listo) {
    Write-Host "`nAborto: sin gateway no se puede probar nada mas." -ForegroundColor Red
    exit 1
}

# ---------------------------------------------------------------------------
Seccion "2. Seguridad del gateway"
# ---------------------------------------------------------------------------
$codigo = CodigoDeError { Invoke-RestMethod -Uri "$BaseUrl/api/zonas" -Headers (Cabeceras $null $Tenant) }
Registrar ($codigo -eq 401) "Sin token, Kong rechaza con 401" "Se obtuvo $codigo"

# ---------------------------------------------------------------------------
Seccion "3. Autenticacion"
# ---------------------------------------------------------------------------
$token = $null
try {
    $cuerpo = @{ username = $Usuario; password = $Clave } | ConvertTo-Json
    $sesion = Invoke-RestMethod -Uri "$BaseUrl/api/auth/login" -Method POST `
        -Headers (Cabeceras $null $Tenant) -Body $cuerpo -ContentType "application/json"
    $token = $sesion.token
    Registrar ([bool]$token) "Login de $Usuario en $Tenant devuelve token"
} catch {
    Registrar $false "Login de $Usuario en $Tenant" $_.Exception.Message
}
if (-not $token) {
    Write-Host "`nAborto: sin token no se puede continuar." -ForegroundColor Red
    exit 1
}

# El token lleva el claim iss que Kong usa para localizar al consumer.
$carga = $token.Split(".")[1].Replace("-", "+").Replace("_", "/")
while ($carga.Length % 4) { $carga += "=" }
$claims = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($carga)) | ConvertFrom-Json
Registrar ($claims.iss -eq "parqueadero-auth") "El token incluye iss=parqueadero-auth (lo exige Kong)" "iss=$($claims.iss)"
Registrar ($claims.tenant_id -eq $Tenant) "El token queda ligado al tenant $Tenant" "tenant_id=$($claims.tenant_id)"

# ---------------------------------------------------------------------------
Seccion "4. Aislamiento entre empresas"
# ---------------------------------------------------------------------------
$codigo = CodigoDeError { Invoke-RestMethod -Uri "$BaseUrl/api/zonas" -Headers (Cabeceras $token $OtroTenant) }
Registrar ($codigo -eq 403 -or $codigo -eq 401) "Un token de $Tenant no sirve contra $OtroTenant" "Se obtuvo $codigo"

# ---------------------------------------------------------------------------
Seccion "5. Zonas y espacios"
# ---------------------------------------------------------------------------
$sufijo = Get-Random -Minimum 1000 -Maximum 9999
$h = Cabeceras $token $Tenant
$zona = $null; $espacio = $null

try {
    $cuerpo = @{ nombre = "Zona Humo $sufijo"; capacidad = 5; tipo = "GENERAL" } | ConvertTo-Json
    $zona = Invoke-RestMethod -Uri "$BaseUrl/api/zonas" -Method POST -Headers $h -Body $cuerpo -ContentType "application/json"
    Registrar ([bool]$zona.id) "Zona creada ($($zona.codigo))"
} catch { Registrar $false "Crear zona" $_.Exception.Message }

if ($zona.id) {
    try {
        $cuerpo = @{ nombre = "Plaza $sufijo"; tipo = "AUTO"; idZona = $zona.id } | ConvertTo-Json
        $espacio = Invoke-RestMethod -Uri "$BaseUrl/api/espacios" -Method POST -Headers $h -Body $cuerpo -ContentType "application/json"
        Registrar ($espacio.estado -eq "DISPONIBLE") "Espacio creado y nace DISPONIBLE ($($espacio.codigo))"
    } catch { Registrar $false "Crear espacio" $_.Exception.Message }
}

# ---------------------------------------------------------------------------
Seccion "6. Vehiculos"
# ---------------------------------------------------------------------------
$placa = "S" + (Get-Random -Minimum 10 -Maximum 99) + "X-" + $sufijo
try {
    $cuerpo = @{
        tipo  = "Auto"
        datos = @{
            marca = "Toyota"; placa = $placa; modelo = "Corolla"; color = "Blanco"
            anio = 2020; numeroPuertas = 4; capacidadMaletero = 3
        }
    } | ConvertTo-Json -Depth 5
    $vehiculo = Invoke-RestMethod -Uri "$BaseUrl/api/vehiculos" -Method POST -Headers $h -Body $cuerpo -ContentType "application/json"
    Registrar ([bool]$vehiculo) "Vehiculo $placa registrado"
} catch { Registrar $false "Registrar vehiculo $placa" $_.Exception.Message }

# ---------------------------------------------------------------------------
Seccion "7. Ciclo de un ticket"
# ---------------------------------------------------------------------------
$ticket = $null
if ($espacio.id) {
    try {
        $cuerpo = @{ placa = $placa; dni = "9999999999"; idEspacio = $espacio.id; nombreZona = $zona.nombre } | ConvertTo-Json
        $ticket = Invoke-RestMethod -Uri "$BaseUrl/api/tickets" -Method POST -Headers $h -Body $cuerpo -ContentType "application/json"
        Registrar ([bool]$ticket.id) "Ingreso registrado para $placa"
    } catch { Registrar $false "Registrar ingreso" $_.Exception.Message }

    # El ingreso debe haber ocupado la plaza: es la integracion tickets -> zonas.
    try {
        $revisado = Invoke-RestMethod -Uri "$BaseUrl/api/espacios/$($espacio.id)" -Headers $h
        Registrar ($revisado.estado -eq "OCUPADO") "El espacio paso a OCUPADO" "estado=$($revisado.estado)"
    } catch { Registrar $false "Consultar el espacio tras el ingreso" $_.Exception.Message }
}

if ($ticket.id) {
    try {
        $cerrado = Invoke-RestMethod -Uri "$BaseUrl/api/tickets/$($ticket.id)" -Method PATCH -Headers $h -Body "{}" -ContentType "application/json"
        $ok = ($cerrado.activo -eq $false) -and ($null -ne $cerrado.fechaHoraSalida)
        Registrar $ok "Salida registrada y ticket cerrado (cobro: $($cerrado.valorRecaudado))"
    } catch { Registrar $false "Registrar salida" $_.Exception.Message }
}

# ---------------------------------------------------------------------------
Seccion "8. Auditoria (RabbitMQ -> ms-audith)"
# ---------------------------------------------------------------------------
# El consumo es asincrono: se concede margen para que los eventos aterricen.
Start-Sleep -Seconds 5
try {
    $eventos = Invoke-RestMethod -Uri "$BaseUrl/api/auditoria" -Headers $h
    Registrar ($eventos.Count -gt 0) "El historial de auditoria tiene $($eventos.Count) eventos"

    foreach ($servicio in @("ms-zonas", "ms-tickets", "ms-vehiculos")) {
        $delServicio = @($eventos | Where-Object { $_.servicio -eq $servicio })
        Registrar ($delServicio.Count -gt 0) "Llegaron eventos de $servicio ($($delServicio.Count))"
    }

    $ajenos = @($eventos | Where-Object { $_.tenant_id -ne $Tenant })
    Registrar ($ajenos.Count -eq 0) "Ningun evento pertenece a otra empresa" "$($ajenos.Count) eventos ajenos"
} catch { Registrar $false "Consultar auditoria" $_.Exception.Message }

# ---------------------------------------------------------------------------
Seccion "9. Rate limiting en /api/auth"
# ---------------------------------------------------------------------------
# El limite configurado es de 10 intentos por minuto por IP.
$bloqueado = $false
foreach ($i in 1..14) {
    $cuerpo = @{ username = "inexistente"; password = "malo" } | ConvertTo-Json
    $codigo = CodigoDeError {
        Invoke-RestMethod -Uri "$BaseUrl/api/auth/login" -Method POST `
            -Headers (Cabeceras $null $Tenant) -Body $cuerpo -ContentType "application/json"
    }
    if ($codigo -eq 429) { $bloqueado = $true; break }
}
Registrar $bloqueado "Kong corta con 429 tras superar el limite de intentos" "No se alcanzo el limite en 14 intentos"

# ---------------------------------------------------------------------------
Write-Host ""
Write-Host ("=" * 60)
Write-Host "  Pasadas: $script:Pasadas   Fallidas: $script:Fallidas" -ForegroundColor White
Write-Host ("=" * 60)

if ($script:Fallidas -gt 0) {
    Write-Host "Revisa los detalles arriba." -ForegroundColor Yellow
    exit 1
}
Write-Host "Todo el flujo funciona." -ForegroundColor Green
exit 0
