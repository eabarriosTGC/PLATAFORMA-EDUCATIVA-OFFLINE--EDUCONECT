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
#  Secretos: se generan y se guardan en `<DATA_DIR>\educonect.env`, con un ACL
#  que solo deja leer al usuario actual, a SYSTEM y a Administradores. NO se
#  escriben en `%APP_ROOT%\config\`: en un equipo de colegio el paquete puede
#  estar en una ruta compartida y legible por todos los usuarios del equipo.
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
# "DOMINIO\usuario": identifica al usuario actual sin pedir credenciales.
$Identidad = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name

function New-TextoAleatorio {
    param([int]$Bytes)
    $buffer = New-Object byte[] $Bytes
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try {
        $rng.GetBytes($buffer)
    } finally {
        $rng.Dispose()
    }
    [Convert]::ToBase64String($buffer)
}

function Protect-EnvFile {
    param([string]$Ruta)
    # Herencia fuera y solo tres entradas: el usuario que corre el servidor,
    # SYSTEM y Administradores (SID, no el nombre, que está traducido en cada
    # idioma de Windows).
    & icacls.exe $Ruta /inheritance:r `
        /grant:r "${Identidad}:(R,W)" `
        /grant:r "SYSTEM:(R,W)" `
        /grant:r "*S-1-5-32-544:(R,W)" | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "No se pudo restringir el ACL de $Ruta (icacls devolvió $LASTEXITCODE)."
    }
}

# ── Quitar la tarea ──────────────────────────────────────────────────
if ($Quitar) {
    # Unregister-ScheduledTask lanza si la tarea no existe y
    # $ErrorActionPreference="Stop" abortaría el script: se comprueba antes.
    $tarea = Get-ScheduledTask -TaskName $NombreTarea -ErrorAction SilentlyContinue
    if ($null -eq $tarea) {
        Write-Host "La tarea '$NombreTarea' no existe: nada que quitar."
    } else {
        try {
            Unregister-ScheduledTask -TaskName $NombreTarea -Confirm:$false -ErrorAction Stop
            Write-Host "Tarea '$NombreTarea' eliminada."
        } catch {
            # No se oculta: si no se pudo quitar, el usuario tiene que saberlo.
            Write-Host "ERROR: no se pudo eliminar la tarea '$NombreTarea': $($_.Exception.Message)"
            exit 1
        }
    }

    # La variable persistente de usuario sobrevive a la tarea. Se elimina solo si
    # apunta al DATA_DIR que este script fijó: una ruta distinta es del operador.
    $actual = [Environment]::GetEnvironmentVariable("DATA_DIR", "User")
    if ($null -ne $actual -and $actual -eq $DataDir) {
        [Environment]::SetEnvironmentVariable("DATA_DIR", $null, "User")
        Write-Host "Variable de usuario DATA_DIR eliminada (apuntaba a $DataDir)."
    } elseif ($null -ne $actual) {
        Write-Host "Se conserva DATA_DIR=$actual: no la fijó este script."
    }

    Write-Host "Los datos en $DataDir no se tocaron."
    exit 0
}

# ── Instalar / reinstalar ────────────────────────────────────────────
if (-not (Test-Path $Exe)) {
    throw "No se encontró el ejecutable en $Exe. Este script debe copiarse en la raíz de la aplicación, junto a edu-conect-rural-server.exe."
}

New-Item -ItemType Directory -Force -Path $DataDir | Out-Null

$EnvFile = Join-Path $DataDir "educonect.env"
if (-not (Test-Path $EnvFile)) {
    # Las validaciones del servidor NO se relajan: JWT_SECRET mínimo 32
    # caracteres y ADMIN_INITIAL_PASSWORD mínimo 12. Aquí se generan por encima
    # de esos mínimos (64 y 24 caracteres base64).
    $jwt = New-TextoAleatorio -Bytes 48
    $admin = New-TextoAleatorio -Bytes 18
    @(
        "# EduConect Rural — secretos del servicio. Solo $Identidad puede leerlo."
        "JWT_SECRET=$jwt"
        "ADMIN_INITIAL_PASSWORD=$admin"
    ) | Set-Content -Path $EnvFile -Encoding ASCII
    Write-Host "Secretos generados en $EnvFile"
} else {
    Write-Host "Secretos existentes en $EnvFile (no se sobrescriben)."
}
# Se aplica siempre: un archivo creado a mano puede traer el ACL heredado del
# directorio, y en %ProgramData% eso son todos los usuarios del equipo.
Protect-EnvFile -Ruta $EnvFile

$EnvFileViejo = Join-Path $AppRoot "config\educonect.env"
if (Test-Path $EnvFileViejo) {
    Write-Warning "Existe $EnvFileViejo (formato anterior, legible por el paquete compartido). El lanzador usa $EnvFile; conviene borrar el viejo."
}

[Environment]::SetEnvironmentVariable("DATA_DIR", $DataDir, "User")

$Accion = New-ScheduledTaskAction -Execute $Exe -WorkingDirectory $AppRoot
# -User acota el disparador al inicio de sesión de ESTE usuario. Sin -User,
# Windows lo interpreta como «cualquier usuario» y registrarlo exige elevación.
$Disparador = New-ScheduledTaskTrigger -AtLogOn -User $Identidad
$Configuracion = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
$Principal = New-ScheduledTaskPrincipal -UserId $Identidad -LogonType Interactive -RunLevel Limited

# -Force: reejecutar el script sobre una tarea ya registrada actualiza la
# definición en lugar de fallar con «ya existe».
try {
    Register-ScheduledTask -TaskName $NombreTarea `
        -Action $Accion `
        -Trigger $Disparador `
        -Settings $Configuracion `
        -Principal $Principal `
        -Description "EduConect Rural — plataforma educativa offline" `
        -Force | Out-Null
} catch {
    Write-Host "ERROR: no se pudo registrar la tarea '$NombreTarea': $($_.Exception.Message)"
    Write-Host "Si Windows pide elevación, comprobar que la tarea no esté registrada para otro usuario:"
    Write-Host "  Get-ScheduledTask -TaskName '$NombreTarea' | Format-List *"
    exit 1
}

Write-Host "Tarea '$NombreTarea' registrada."
Write-Host "  APP_ROOT : $AppRoot"
Write-Host "  DATA_DIR : $DataDir"
Write-Host "  Secretos : $EnvFile  (solo $Identidad)"
Write-Host "  Panel    : http://localhost:8080/app/"
Write-Host ""
Write-Host "Si Windows bloquea conexiones entrantes, habilitar el puerto 8080 en el firewall:"
Write-Host "  New-NetFirewallRule -DisplayName 'EduConect Rural' -Direction Inbound -LocalPort 8080 -Protocol TCP -Action Allow"
