"use client"

import { useState, useEffect } from "react"
import { BookOpen, TrendingUp, Clock, Award } from "lucide-react"
import { useAppState } from "@/lib/app-state"
import { getProgreso } from "@/lib/api"
import type { Progreso } from "@/lib/types"

export function ProgresoView() {
  const { usuario, cursos, setActiveView } = useAppState()
  const [progreso, setProgreso] = useState<Progreso[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getProgreso(usuario)
      .then((data) => {
        if (!cancelled) {
          setProgreso(data)
          setLoading(false)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message)
          setLoading(false)
        }
      })
    return () => { cancelled = true }
  }, [usuario])

  // Calcular estadísticas
  const totalCursos = cursos.length
  const cursosIniciados = progreso.length
  const promedio = cursosIniciados > 0
    ? Math.round(progreso.reduce((sum, p) => sum + p.porcentaje, 0) / cursosIniciados)
    : 0
  const completados = progreso.filter((p) => p.porcentaje >= 100).length

  function getCursoTitulo(cursoId: number): string {
    return cursos.find((c) => c.id === cursoId)?.titulo ?? `Curso #${cursoId}`
  }

  return (
    <section aria-labelledby="progreso-title">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 id="progreso-title" className="text-2xl font-semibold text-foreground">
            📊 Mi Progreso
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Estudiante: <span className="font-medium">{usuario}</span>
          </p>
        </div>
        <button
          onClick={() => setActiveView("dashboard")}
          className="text-sm font-medium text-primary hover:underline underline-offset-2"
        >
          ← Volver al inicio
        </button>
      </div>

      {/* Tarjetas de estadísticas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="p-4 bg-card rounded-lg border border-border">
          <div className="flex items-center gap-3">
            <BookOpen className="w-8 h-8 text-primary" />
            <div>
              <p className="text-2xl font-bold">{cursosIniciados}</p>
              <p className="text-xs text-muted-foreground">Cursos iniciados</p>
            </div>
          </div>
        </div>
        <div className="p-4 bg-card rounded-lg border border-border">
          <div className="flex items-center gap-3">
            <Award className="w-8 h-8 text-secondary" />
            <div>
              <p className="text-2xl font-bold">{completados}</p>
              <p className="text-xs text-muted-foreground">Completados</p>
            </div>
          </div>
        </div>
        <div className="p-4 bg-card rounded-lg border border-border">
          <div className="flex items-center gap-3">
            <TrendingUp className="w-8 h-8 text-accent-foreground" />
            <div>
              <p className="text-2xl font-bold">{promedio}%</p>
              <p className="text-xs text-muted-foreground">Promedio general</p>
            </div>
          </div>
        </div>
        <div className="p-4 bg-card rounded-lg border border-border">
          <div className="flex items-center gap-3">
            <Clock className="w-8 h-8 text-muted-foreground" />
            <div>
              <p className="text-2xl font-bold">{totalCursos}</p>
              <p className="text-xs text-muted-foreground">Cursos totales</p>
            </div>
          </div>
        </div>
      </div>

      {/* Lista de progreso por curso */}
      <h3 className="text-lg font-semibold mb-4">Avance por curso</h3>

      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      )}

      {error && (
        <div className="p-4 bg-destructive/10 rounded-lg border border-destructive/30">
          <p className="text-destructive font-medium">Error al cargar progreso</p>
          <p className="text-sm text-muted-foreground mt-1">
            No se pudo conectar con el servidor. Los datos locales no están disponibles.
          </p>
        </div>
      )}

      {!loading && !error && progreso.length === 0 && (
        <div className="p-6 bg-card rounded-lg border border-border text-center">
          <p className="text-muted-foreground">Aún no has iniciado ningún curso.</p>
          <button
            onClick={() => setActiveView("cursos")}
            className="mt-3 text-sm font-medium text-primary hover:underline"
          >
            Explorar cursos disponibles →
          </button>
        </div>
      )}

      {!loading && !error && progreso.length > 0 && (
        <div className="space-y-3">
          {progreso.map((p) => {
            const titulo = getCursoTitulo(p.curso_id)
            const colorBar =
              p.porcentaje >= 100 ? "bg-green-500"
              : p.porcentaje >= 50 ? "bg-primary"
              : "bg-secondary"

            return (
              <div
                key={p.id}
                className="p-4 bg-card rounded-lg border border-border"
              >
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-sm text-foreground truncate">
                    {titulo}
                  </h4>
                  <span className="text-sm font-semibold text-foreground ml-4">
                    {p.porcentaje}%
                  </span>
                </div>
                <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${colorBar}`}
                    style={{ width: `${p.porcentaje}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1.5">
                  Última actividad: {p.ultima_vez ? new Date(p.ultima_vez).toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}
                </p>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
