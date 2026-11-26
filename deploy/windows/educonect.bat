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
rem ==========================================================================
setlocal

set "APP_ROOT=%~dp0"
if "%APP_ROOT:~-1%"=="\" set "APP_ROOT=%APP_ROOT:~0,-1%"

if not defined DATA_DIR set "DATA_DIR=%LOCALAPPDATA%\EduConect"
if not defined LISTEN_ADDR set "LISTEN_ADDR=0.0.0.0:8080"

rem Secretos: config\educonect.env, una variable por línea, sin comillas.
rem Nunca se versiona. Si falta, el servidor lo dice y no arranca.
if exist "%APP_ROOT%\config\educonect.env" (
    for /f "usebackq eol=# tokens=1,* delims==" %%A in ("%APP_ROOT%\config\educonect.env") do set "%%A=%%B"
)

echo EduConect Rural
echo   APP_ROOT : %APP_ROOT%
echo   DATA_DIR : %DATA_DIR%
echo   Escucha  : %LISTEN_ADDR%
echo   Panel    : http://localhost:8080/app/
echo.

"%APP_ROOT%\edu-conect-rural-server.exe" %*
endlocal
