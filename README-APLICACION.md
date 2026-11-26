# Panel de Profesores — paquete de cambios

Base esperada: rama `fix/portable-runtime-baseline`, commit `8527990`.

## Contenido

- `edu-conect-rural-server/src/main.rs`: protege toda la API docente con JWT.
- `edu-conect-rural-server/static/profesor.html`: acceso, sesión, estadísticas, estudiantes, alertas, filtros, detalle y CSV autenticado.
- `edu-conect-rural-server/static/dashboard.html`: abre el panel real y añade identificación local del estudiante.
- `edu-conect-rural-server/static/js/dashboard.js`: administra la identidad local y el acceso docente.
- `edu-conect-rural-server/static/js/state.js`: conserva el estudiante en `localStorage`.
- `tests/e2e/professor-panel.spec.js`: pruebas pública, autenticada y de identidad estudiantil.

## Aplicación

Desde la raíz del repositorio, revise primero el contenido del ZIP y después copie sus carpetas sobre el repositorio conservando las rutas.

Antes de iniciar, `.env` debe contener la contraseña administrativa segura ya creada en la fase 2D. Para ejecutar también la prueba autenticada:

```bash
export E2E_ADMIN_PASSWORD='la-misma-clave-administrativa'
```

No escriba la contraseña en archivos versionados ni en el comando de Docker Compose.

## Verificación recomendada

```bash
git diff --check
docker compose build
docker compose up -d --force-recreate
docker compose ps
curl -sS -o /dev/null -w '%{http_code}\n' http://localhost:8080/api/profesor/reporte
```

La última orden debe responder `401` sin token. Después:

```bash
docker run --rm -v "$PWD/edu-conect-rural-server:/code" -w /code rust:1.88-bookworm cargo test --all-targets
cd tests/e2e
E2E_ADMIN_PASSWORD="$E2E_ADMIN_PASSWORD" npm test
```

En el navegador compruebe:

1. `/app/` solicita el nombre del estudiante la primera vez.
2. Cambiar el estudiante pulsando su nombre en la cabecera separa el progreso.
3. `/profesor/` exige credenciales.
4. Las pestañas muestran datos reales, búsqueda, filtros y detalle.
5. El CSV se descarga después de autenticar y no mediante una URL pública.
6. Cerrar sesión elimina el JWT de `sessionStorage`.

## Decisiones de privacidad

La identidad estudiantil es local y solo requiere un nombre visible; no crea contraseñas infantiles ni recopila correo, teléfono o documento. El JWT docente permanece en `sessionStorage`, por lo que desaparece al cerrar la pestaña o al cerrar sesión.
