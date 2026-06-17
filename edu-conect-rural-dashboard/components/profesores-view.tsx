"use client"

import { useState, useEffect } from "react"
import { GraduationCap, Users, BookOpen, TrendingUp, LogIn, LogOut, BarChart3, RefreshCw } from "lucide-react"
import { useAppState } from "@/lib/app-state"

interface Estadisticas {
  total_cursos: number
  total_progresos: number
  version?: string
}

interface ProgresoEstudiante {
  id: number
  usuario: string
  curso_id: number
  porcentaje: number
  ultima_vez: string
}

export function ProfesoresView() {
  const { setActiveView, cursos } = useAppState()
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("educonect_admin_token"))
  const [usuario, setUsuario] = useState("")
  const [password, setPassword] = useState("")
  const [loginError, setLoginError] = useState("")
  const [loginLoading, setLoginLoading] = useState(false)
  const [stats, setStats] = useState<Estadisticas | null>(null)
  const [statsLoading, setStatsLoading] = useState(false)
  const [progresos, setProgresos] = useState<ProgresoEstudiante[]>([])

  // Cargar estadísticas al tener token
  useEffect(() => {
    if (token) {
      fetchStats(token)
    }
  }, [token])

  async function fetchStats(authToken: string) {
    setStatsLoading(true)
    try {
      const r = await fetch("/admin/estadisticas", {
        headers: { Authorization: `Bearer ${authToken}` },
      })
      if (r.ok) {
        const data = await r.json()
        setStats(data)
      } else if (r.status === 401) {
        // Token expirado
        localStorage.removeItem("educonect_admin_token")
        setToken(null)
      }
    } catch {}
    setStatsLoading(false)
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoginError("")
    setLoginLoading(true)
    try {
      const r = await fetch("/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuario, password }),
      })
      if (r.ok) {
        const data = await r.json()
        localStorage.setItem("educonect_admin_token", data.token)
        setToken(data.token)
        setUsuario("")
        setPassword("")
      } else {
        setLoginError("Usuario o contraseña incorrectos")
      }
    } catch {
      setLoginError("Error de conexión con el servidor")
    }
    setLoginLoading(false)
  }

  function handleLogout() {
    localStorage.removeItem("educonect_admin_token")
    setToken(null)
    setStats(null)
  }

  // Si no hay token, mostrar login
  if (!token) {
    return (
      <section aria-labelledby="profesores-title">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 id="profesores-title" className="text-2xl font-semibold text-foreground">
              👩‍🏫 Panel de Profesores
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Accede a estadísticas, progreso de estudiantes y gestión de contenido
            </p>
          </div>
          <button
            onClick={() => setActiveView("dashboard")}
            className="text-sm font-medium text-primary hover:underline"
          >
            ← Volver
          </button>
        </div>

        <div className="max-w-md mx-auto mt-12">
          <div className="bg-card rounded-xl border border-border p-8 shadow-sm">
            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <GraduationCap className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-foreground">Iniciar Sesión</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Ingresa con tus credenciales de docente
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Usuario
                </label>
                <input
                  type="text"
                  value={usuario}
                  onChange={(e) => setUsuario(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                  placeholder="admin"
                  required
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Contraseña
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                  placeholder="••••••••"
                  required
                />
              </div>

              {loginError && (
                <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-sm text-destructive">
                  {loginError}
                </div>
              )}

              <button
                type="submit"
                disabled={loginLoading}
                className="w-full py-2.5 px-4 bg-primary text-primary-foreground rounded-lg font-medium text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loginLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Ingresando...
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    Ingresar
                  </>
                )}
              </button>
            </form>

            <p className="text-xs text-muted-foreground text-center mt-4">
              Credenciales configuradas por el administrador del servidor
            </p>
          </div>
        </div>
      </section>
    )
  }

  // Dashboard del profesor
  return (
    <section aria-labelledby="profesores-title">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 id="profesores-title" className="text-2xl font-semibold text-foreground">
            👩‍🏫 Panel de Profesores
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Estadísticas, progreso y gestión de contenido
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => token && fetchStats(token)}
            className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
            title="Actualizar estadísticas"
          >
            <RefreshCw className={`w-4 h-4 ${statsLoading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-border hover:bg-muted transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Salir
          </button>
          <button
            onClick={() => setActiveView("dashboard")}
            className="text-sm font-medium text-primary hover:underline"
          >
            ← Volver
          </button>
        </div>
      </div>

      {/* Stats cards */}
      {statsLoading && !stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      )}

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div className="p-4 bg-card rounded-xl border border-border">
            <div className="flex items-center gap-2 mb-2">
              <BookOpen className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">Cursos</span>
            </div>
            <div className="text-3xl font-bold text-foreground">{stats.total_cursos}</div>
          </div>
          <div className="p-4 bg-card rounded-xl border border-border">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-emerald-500" />
              <span className="text-xs text-muted-foreground">Estudiantes</span>
            </div>
            <div className="text-3xl font-bold text-foreground">—</div>
          </div>
          <div className="p-4 bg-card rounded-xl border border-border">
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="w-4 h-4 text-amber-500" />
              <span className="text-xs text-muted-foreground">Registros Progreso</span>
            </div>
            <div className="text-3xl font-bold text-foreground">{stats.total_progresos || 0}</div>
          </div>
          <div className="p-4 bg-card rounded-xl border border-border">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-sky-500" />
              <span className="text-xs text-muted-foreground">Versión</span>
            </div>
            <div className="text-lg font-bold text-foreground">{stats.version || "—"}</div>
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <button
          onClick={() => setActiveView("cursos")}
          className="p-5 bg-card rounded-xl border border-border hover:border-primary/30 hover:shadow-sm transition-all text-left"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-medium text-foreground">Gestionar Cursos</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Ver y administrar los {stats?.total_cursos || cursos.length} cursos disponibles
              </p>
            </div>
          </div>
        </button>
        <button
          onClick={() => setActiveView("progreso")}
          className="p-5 bg-card rounded-xl border border-border hover:border-primary/30 hover:shadow-sm transition-all text-left"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h3 className="font-medium text-foreground">Progreso de Estudiantes</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Consulta el avance de cada estudiante por curso
              </p>
            </div>
          </div>
        </button>
      </div>

      {/* Acciones de contenido */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <a
          href="/biblioteca/"
          target="_blank"
          className="p-4 bg-card rounded-xl border border-border hover:border-primary/30 transition-all text-left"
        >
          <h3 className="font-medium text-foreground text-sm">📚 Biblioteca Digital</h3>
          <p className="text-xs text-muted-foreground mt-1">Gestionar PDFs y documentos</p>
        </a>
        <button
          onClick={() => setActiveView("youtube")}
          className="p-4 bg-card rounded-xl border border-border hover:border-primary/30 transition-all text-left"
        >
          <h3 className="font-medium text-foreground text-sm">📺 YouTube Rural</h3>
          <p className="text-xs text-muted-foreground mt-1">Administrar videos educativos</p>
        </button>
        <a
          href="/modulos/"
          target="_blank"
          className="p-4 bg-card rounded-xl border border-border hover:border-primary/30 transition-all text-left"
        >
          <h3 className="font-medium text-foreground text-sm">🎮 Módulos Interactivos</h3>
          <p className="text-xs text-muted-foreground mt-1">21 módulos educativos disponibles</p>
        </a>
      </div>

      {/* Info footer */}
      <div className="mt-6 p-4 bg-card rounded-xl border border-border">
        <div className="flex items-start gap-3">
          <GraduationCap className="w-5 h-5 text-primary mt-0.5" />
          <div>
            <h3 className="text-sm font-medium text-foreground">Información para docentes</h3>
            <ul className="text-xs text-muted-foreground mt-1 space-y-1">
              <li>• Los estudiantes acceden desde cualquier dispositivo conectado al WiFi del servidor</li>
              <li>• El progreso se guarda automáticamente al completar módulos</li>
              <li>• Para agregar contenido: usa el panel de administración en <code className="bg-muted px-1 rounded">/admin/contenido</code></li>
              <li>• Videos: copia archivos .mp4 a <code className="bg-muted px-1 rounded">data/videos/</code> y reinicia</li>
              <li>• Biblioteca: copia PDFs a <code className="bg-muted px-1 rounded">data/biblioteca/</code></li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}
