#!/usr/bin/env python3
"""
EduConect Content Manager — Gestor interactivo de contenido educativo
Uso: python3 content-manager.py [--url http://localhost:8080]
"""

import json
import os
import sys
import urllib.request
import urllib.error
import getpass

API_BASE = sys.argv[2] if len(sys.argv) > 2 and sys.argv[1] == "--url" else "http://localhost:8080"
TOKEN = None
USUARIO = "admin"

# ── Colores ───────────────────────────────────────────────────────────

VERDE = "\033[92m"
AMARILLO = "\033[93m"
AZUL = "\033[94m"
ROJO = "\033[91m"
MAGENTA = "\033[95m"
CYAN = "\033[96m"
GRIS = "\033[90m"
NEGRITA = "\033[1m"
RESET = "\033[0m"
LIMPIAR = "\033[2J\033[H"

# ── Utilidades de red ─────────────────────────────────────────────────

def api(method, path, data=None):
    """Llama a la API y retorna (datos_json | None, codigo_http)."""
    url = f"{API_BASE}{path}"
    headers = {"Content-Type": "application/json"}
    if TOKEN:
        headers["Authorization"] = f"Bearer {TOKEN}"
    body = json.dumps(data).encode() if data else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            contenido = resp.read().decode()
            return (json.loads(contenido) if contenido else {}, resp.status)
    except urllib.error.HTTPError as e:
        try:
            err = json.loads(e.read().decode())
            return (err, e.code)
        except Exception:
            return ({"error": str(e)}, e.code)
    except urllib.error.URLError:
        return ({"error": f"❌ No se pudo conectar a {API_BASE}"}, 0)
    except Exception as e:
        return ({"error": str(e)}, 0)

# ── Pantalla ──────────────────────────────────────────────────────────

def limpiar():
    os.system("clear" if os.name == "posix" else "cls")

def titulo(texto):
    print(f"\n{NEGRITA}{AZUL}{'='*60}{RESET}")
    print(f"{NEGRITA}{AZUL}  {texto}{RESET}")
    print(f"{NEGRITA}{AZUL}{'='*60}{RESET}\n")

def subrayado(texto):
    print(f"{CYAN}{'─'*50}{RESET}")
    print(f"  {NEGRITA}{texto}{RESET}")
    print(f"{CYAN}{'─'*50}{RESET}")

def ok(texto):
    print(f"  {VERDE}✅ {texto}{RESET}")

def error(texto):
    print(f"  {ROJO}❌ {texto}{RESET}")

def info(texto):
    print(f"  {AMARILLO}ℹ️  {texto}{RESET}")

def esperar():
    input(f"\n  {GRIS}Presiona Enter para continuar...{RESET}")

def preguntar(texto, default=None, obligatorio=False):
    while True:
        if default:
            resp = input(f"  {texto} [{GRIS}{default}{RESET}]: ").strip()
            if not resp:
                resp = default
        else:
            resp = input(f"  {texto}: ").strip()
        if obligatorio and not resp:
            error("Este campo es obligatorio")
            continue
        return resp

def menu(opciones, titulo_menu="MENÚ"):
    """Muestra menú numerado y retorna índice seleccionado."""
    print(f"\n{NEGRITA}{titulo_menu}{RESET}")
    print(f"{GRIS}{'─'*40}{RESET}")
    for i, (opcion, _) in enumerate(opciones, 1):
        print(f"  {NEGRITA}{i}{RESET}. {opcion}")
    print(f"  {NEGRITA}0{RESET}. Salir / Atrás")
    print(f"{GRIS}{'─'*40}{RESET}")
    while True:
        try:
            r = int(input(f"\n  Opción [{GRIS}0-{len(opciones)}{RESET}]: "))
            if r == 0:
                return 0
            if 1 <= r <= len(opciones):
                return r - 1
        except ValueError:
            pass
        error(f"Ingresa un número entre 0 y {len(opciones)}")

# ── Pantallas ─────────────────────────────────────────────────────────

def pantalla_login():
    limpiar()
    titulo("🔐 LOGIN ADMIN")
    global TOKEN, USUARIO
    USUARIO = preguntar("Usuario", default="admin")
    password = getpass.getpass("  Contraseña: ")
    datos, codigo = api("POST", "/admin/login", {"usuario": USUARIO, "password": password})
    if "token" in datos:
        TOKEN = datos["token"]
        ok(f"Login exitoso. Bienvenido {USUARIO}!")
        esperar()
        return True
    else:
        error(f"Login fallido: {datos.get('error', 'Credenciales inválidas')}")
        esperar()
        return False

def pantalla_menu_principal():
    limpiar()
    titulo(f"📚 GESTOR DE CONTENIDO EDUCONECT")
    print(f"  {GRIS}Conectado a:{RESET} {API_BASE}")
    print(f"  {GRIS}Usuario:{RESET} {USUARIO}\n")

    opciones = [
        ("📋  Ver cursos disponibles", ver_cursos),
        ("➕  Agregar un curso nuevo", agregar_curso),
        ("✏️   Editar un curso", editar_curso),
        ("🗑️   Eliminar un curso", eliminar_curso),
        ("🎬  Ver videos", ver_videos),
        ("➕  Agregar un video nuevo", agregar_video),
        ("🗑️   Eliminar un video", eliminar_video),
        ("📊  Estadísticas del sistema", ver_estadisticas),
    ]
    idx = menu(opciones, "¿QUÉ DESEAS HACER?")
    if idx == 0:
        return False  # salir
    opciones[idx][1]()
    return True  # continuar

# ── Funcionalidad ─────────────────────────────────────────────────────

def ver_cursos():
    limpiar()
    titulo("📋 CURSOS DISPONIBLES")
    datos, _ = api("GET", "/api/cursos")
    if isinstance(datos, list):
        if not datos:
            info("No hay cursos cargados aún.")
        else:
            for c in datos:
                print(f"  {NEGRITA}[{c['id']}]{RESET} {c['titulo']}")
                print(f"       {GRIS}Categoría:{RESET} {c['categoria']}  {GRIS}Archivo:{RESET} {c.get('archivo_path','-')}")
                print()
        print(f"  {VERDE}Total: {len(datos)} cursos{RESET}")
    else:
        error(f"Error: {datos.get('error', 'Error desconocido')}")
    esperar()

def agregar_curso():
    limpiar()
    titulo("➕ AGREGAR NUEVO CURSO")
    print(f"  {GRIS}Completa los datos del nuevo curso:{RESET}\n")

    tit = preguntar("📌 Título del curso", obligatorio=True)
    desc = preguntar("📝 Descripción", default="")
    cat = preguntar("🏷️  Categoría", default="general")
    arch = preguntar("📄 Ruta del archivo (opcional)", default="")

    datos, codigo = api("POST", "/admin/contenido/cursos", {
        "titulo": tit, "descripcion": desc,
        "categoria": cat, "archivo_path": arch
    })
    if codigo == 201:
        ok(f"Curso '{tit}' creado exitosamente!")
    else:
        error(f"Error: {datos.get('error', 'Error desconocido')} (código {codigo})")
    esperar()

def editar_curso():
    limpiar()
    titulo("✏️  EDITAR CURSO")
    try:
        cid = int(preguntar("🔢 ID del curso a editar", obligatorio=True))
    except ValueError:
        error("ID inválido")
        esperar()
        return

    # Obtener datos actuales
    datos, codigo = api("GET", f"/api/cursos/{cid}")
    if codigo == 404:
        error(f"Curso #{cid} no encontrado")
        esperar()
        return
    if not isinstance(datos, dict) or "id" not in datos:
        error(f"Error al obtener curso: {datos.get('error', 'Error')}")
        esperar()
        return

    print(f"  Editando: {NEGRITA}{datos['titulo']}{RESET}\n")
    tit = preguntar("📌 Nuevo título", default=datos["titulo"])
    desc = preguntar("📝 Nueva descripción", default=datos["descripcion"])
    cat = preguntar("🏷️  Nueva categoría", default=datos["categoria"])
    arch = preguntar("📄 Nueva ruta archivo", default=datos.get("archivo_path", ""))

    datos, codigo = api("PUT", f"/admin/contenido/cursos/{cid}", {
        "titulo": tit, "descripcion": desc,
        "categoria": cat, "archivo_path": arch
    })
    if codigo == 200:
        ok(f"Curso #{cid} actualizado!")
    else:
        error(f"Error: {datos.get('error', 'Error')}")
    esperar()

def eliminar_curso():
    limpiar()
    titulo("🗑️  ELIMINAR CURSO")
    try:
        cid = int(preguntar("🔢 ID del curso a eliminar", obligatorio=True))
    except ValueError:
        error("ID inválido")
        esperar()
        return

    # Confirmar
    datos, _ = api("GET", f"/api/cursos/{cid}")
    nom = datos.get("titulo", f"Curso #{cid}") if isinstance(datos, dict) else f"Curso #{cid}"
    print(f"\n  ¿Eliminar {NEGRITA}{nom}{RESET}?")
    conf = input(f"  Escribe {ROJO}SI{RESET} para confirmar: ").strip().upper()
    if conf != "SI":
        info("Cancelado")
        esperar()
        return

    datos, codigo = api("DELETE", f"/admin/contenido/cursos/{cid}")
    if codigo == 200:
        ok(f"'{nom}' eliminado!")
    else:
        error(f"Error: {datos.get('error', 'Error')}")
    esperar()

def ver_videos():
    """Muestra los videos guardados en la BD del backend."""
    limpiar()
    titulo("🎬 VIDEOS EDUCATIVOS")
    datos, _ = api("GET", "/admin/contenido/status")
    total = datos.get("total_videos", 0)
    print(f"  {GRIS}Videos registrados:{RESET} {total}\n")
    info("Los videos se muestran en el frontend (sección YouTube Rural).")
    info("Usa 'Agregar video' para añadir más.")
    esperar()

def agregar_video():
    limpiar()
    titulo("🎬 AGREGAR NUEVO VIDEO")
    print(f"  {GRIS}Completa los datos del video:{RESET}\n")

    tit = preguntar("📌 Título del video", obligatorio=True)
    can = preguntar("📺 Canal", default="EduConect")
    dur = preguntar("⏱️  Duración (ej: 10:30)", default="00:00")
    cat = preguntar("🏷️  Categoría", default="general")
    thumb = preguntar("🖼️  URL thumbnail (opcional)", default="")

    datos, codigo = api("POST", "/admin/contenido/videos", {
        "titulo": tit, "canal": can, "duracion": dur,
        "categoria": cat, "thumbnail": thumb,
    })
    if codigo == 201:
        ok(f"Video '{tit}' creado!")
    else:
        error(f"Error: {datos.get('error', 'Error')}")
    esperar()

def eliminar_video():
    limpiar()
    titulo("🗑️  ELIMINAR VIDEO")
    try:
        vid = int(preguntar("🔢 ID del video a eliminar", obligatorio=True))
    except ValueError:
        error("ID inválido")
        esperar()
        return

    conf = input(f"  Escribe {ROJO}SI{RESET} para confirmar: ").strip().upper()
    if conf != "SI":
        info("Cancelado")
        esperar()
        return

    datos, codigo = api("DELETE", f"/admin/contenido/videos/{vid}")
    if codigo == 200:
        ok(f"Video #{vid} eliminado!")
    else:
        error(f"Error: {datos.get('error', 'Error')}")
    esperar()

def ver_estadisticas():
    limpiar()
    titulo("📊 ESTADÍSTICAS DEL SISTEMA")
    pub, _ = api("GET", "/api/cursos")
    adm, _ = api("GET", "/admin/contenido/status")
    total_cursos = len(pub) if isinstance(pub, list) else 0
    total_videos = adm.get("total_videos", 0) if isinstance(adm, dict) else 0
    total_archivos = adm.get("total_archivos", 0) if isinstance(adm, dict) else 0
    espacio = adm.get("espacio_usado_kb", 0) if isinstance(adm, dict) else 0

    subrayado("CONTENIDO")
    print(f"  📚  Cursos:     {NEGRITA}{total_cursos}{RESET}")
    print(f"  🎬  Videos:     {NEGRITA}{total_videos}{RESET}")
    print(f"  📁  Archivos:   {NEGRITA}{total_archivos}{RESET}")
    print(f"  💾  Espacio:    {NEGRITA}{espacio} KB{RESET}")
    print()
    subrayado("SERVIDOR")
    print(f"  🌐  API URL:    {GRIS}{API_BASE}{RESET}")
    print(f"  👤  Admin:      {GRIS}{USUARIO}{RESET}")
    print()
    ok("Sistema funcionando correctamente!")
    esperar()

# ── Main ──────────────────────────────────────────────────────────────

def main():
    limpiar()
    print(f"""{NEGRITA}{CYAN}
╔══════════════════════════════════════════════════╗
║        📚 EDUCONECT RURAL                        ║
║     GESTOR DE CONTENIDO INTERACTIVO              ║
║                                                  ║
║  Plataforma educativa offline para La Guajira    ║
╚══════════════════════════════════════════════════╝{RESET}
""")
    print(f"  {GRIS}Conectando a:{RESET} {API_BASE}")
    print()

    # Login
    if not pantalla_login():
        return

    # Menú principal (loop)
    while pantalla_menu_principal():
        pass

    limpiar()
    print(f"\n  {VERDE}¡Hasta pronto!{RESET}\n")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print(f"\n\n  {AMARILLO}Operación cancelada.{RESET}\n")
