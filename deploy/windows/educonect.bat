@echo off
rem ==========================================================================
rem  EduConect Rural — lanzador para Windows sin privilegios
rem
rem  Estructura plana de D-03.A: este archivo y edu-conect-rural-server.exe
rem  viven en la RAÍZ de la aplicación, junto a modulos\ static\ frontend\.
rem  La raíz se declara aquí de forma explícita; el binario además la deriva del
rem  directorio del ejecutable, así que un acceso directo o una tarea programada
rem  con otro directorio de trabajo encuentra los recursos igual.
rem
rem  DATA_DIR: %LOCALAPPDATA%\EduConect (perfil del usuario, sin administrador).
rem  Para un equipo compartido de colegio se puede fijar antes de lanzar:
rem      set DATA_DIR=%ProgramData%\EduConect
rem
rem  Secretos: %DATA_DIR%\educonect.env, una variable por línea, sin comillas.
rem  Vive junto a los datos (perfil del usuario) y no en el paquete, que en un
rem  equipo de colegio puede ser una carpeta compartida legible por todos.
rem  Se acepta el formato anterior %APP_ROOT%\config\educonect.env como respaldo.
rem  El archivo nunca se versiona. Si falta, el servidor lo dice y no arranca.
rem ==========================================================================
setlocal

set "APP_ROOT=%~dp0"
if "%APP_ROOT:~-1%"=="\" set "APP_ROOT=%APP_ROOT:~0,-1%"

if not defined DATA_DIR set "DATA_DIR=%LOCALAPPDATA%\EduConect"
if not defined LISTEN_ADDR set "LISTEN_ADDR=0.0.0.0:8080"

set "ENV_FILE=%DATA_DIR%\educonect.env"
if not exist "%ENV_FILE%" set "ENV_FILE=%APP_ROOT%\config\educonect.env"

if exist "%ENV_FILE%" (
    for /f "usebackq eol=# tokens=1,* delims==" %%A in ("%ENV_FILE%") do set "%%A=%%B"
) else (
    echo AVISO: no se encontro "%DATA_DIR%\educonect.env".
    echo        El servidor no arrancara sin JWT_SECRET y ADMIN_INITIAL_PASSWORD.
    echo        Generarlos con: powershell -ExecutionPolicy Bypass -File instalar-tarea.ps1
)

echo EduConect Rural
echo   APP_ROOT : %APP_ROOT%
echo   DATA_DIR : %DATA_DIR%
echo   Secretos : %ENV_FILE%
echo   Escucha  : %LISTEN_ADDR%
echo   Panel    : http://localhost:8080/app/
echo.

"%APP_ROOT%\edu-conect-rural-server.exe" %*
endlocal
