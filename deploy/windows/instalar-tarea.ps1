# ==========================================================================
#  EduConect Rural — inicio automático en Windows sin privilegios
#
#  No se registra un *servicio* de Windows a propósito: `sc.exe` exige que el
#  binario implemente el protocolo del SCM, y edu-conect-rural-server es una
#  aplicación de consola. Registrarlo con `sc create` produce un servicio que
#  falla al arrancar (error 1053). Las dos vías honestas son:
#
#    1. Tarea programada al iniciar sesión (este script, sin administrador).
#    2. NSSM como envoltorio de servicio (requiere instalar NSSM y ser
#       administrador); ver docs/sprint2/d03-*.md.
#
#  Estructura plana de D-03.A: la raíz de la aplicación es el directorio que
#  contiene edu-conect-rural-server.exe y este script se copia allí.
#
#  Uso:
#      powershell -ExecutionPolicy Bypass -File instalar-tarea.ps1
#      powershell -ExecutionPolicy Bypass -File instalar-tarea.ps1 -Quitar
# ==========================================================================

[CmdletBinding()]
param(
    [switch]$Quitar,
    [string]$NombreTarea = "EduConect Rural",
    # %LOCALAPPDATA%\EduConect para un usuario; %ProgramData%\EduConect si el
    # equipo es compartido y varios profesores deben ver los mismos datos.
    [string]$DataDir = (Join-Path $env:LOCALAPPDATA "EduConect")
)

$ErrorActionPreference = "Stop"
$AppRoot = Split-Path -Parent $PSCommandPath
$Exe = Join-Path $AppRoot "edu-conect-rural-server.exe"

if ($Quitar) {
    Unregister-ScheduledTask -TaskName $NombreTarea -Confirm:$false -ErrorAction SilentlyContinue
    Write-Host "Tarea '$NombreTarea' eliminada. Los datos en $DataDir no se tocaron."
    exit 0
}

if (-not (Test-Path $Exe)) {
    throw "No se encontró el ejecutable en $Exe. Este script debe copiarse en la raíz de la aplicación, junto a edu-conect-rural-server.exe."
}

# Los secretos viven en config\educonect.env, no en la tarea programada.
$EnvFile = Join-Path $AppRoot "config\educonect.env"
if (-not (Test-Path $EnvFile)) {
    Write-Warning "Falta $EnvFile con JWT_SECRET y ADMIN_INITIAL_PASSWORD. El servidor no arrancará hasta crearlo."
}

New-Item -ItemType Directory -Force -Path $DataDir | Out-Null

$Accion = New-ScheduledTaskAction -Execute $Exe -WorkingDirectory $AppRoot
$Disparador = New-ScheduledTaskTrigger -AtLogOn
$Configuracion = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)

# El entorno se fija en el perfil del usuario, no en la tarea: `DATA_DIR` es lo
# único que decide dónde viven los datos, y una tarea sin esta variable usaría el
# valor por defecto (que para un usuario es el mismo que se pasa aquí).
[Environment]::SetEnvironmentVariable("DATA_DIR", $DataDir, "User")

Register-ScheduledTask -TaskName $NombreTarea -Action $Accion -Trigger $Disparador -Settings $Configuracion -Description "EduConect Rural — plataforma educativa offline" | Out-Null

Write-Host "Tarea '$NombreTarea' registrada."
Write-Host "  APP_ROOT : $AppRoot"
Write-Host "  DATA_DIR : $DataDir"
Write-Host "  Panel    : http://localhost:8080/app/"
Write-Host ""
Write-Host "Si Windows bloquea conexiones entrantes, habilitar el puerto 8080 en el firewall:"
Write-Host "  New-NetFirewallRule -DisplayName 'EduConect Rural' -Direction Inbound -LocalPort 8080 -Protocol TCP -Action Allow"
