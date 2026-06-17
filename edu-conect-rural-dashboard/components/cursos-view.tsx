"use client"

import { ExternalLink, BookOpen, FileText } from "lucide-react"
import { useAppState } from "@/lib/app-state"
import { saveProgreso } from "@/lib/api"
import { useState } from "react"

export function CursosView() {
  const { cursos, loadingCursos, errorCursos, usuario, setActiveView } = useAppState()
  const [iniciando, setIniciando] = useState<number | null>(null)

  async function handleIniciar(cursoId: number) {
    setIniciando(cursoId)
    try {
      await saveProgreso(usuario, cursoId, 0)
      alert(`✅ Curso iniciado. Tu progreso se ha guardado.`)
    } catch {
      alert(`⚠️ No se pudo guardar el progreso. El servidor local podría no estar disponible.`)
    } finally {
      setIniciando(null)
    }
  }

  return (
    <section aria-labelledby="cursos-title">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 id="cursos-title" className="text-2xl font-semibold text-foreground">
            📚 Todos los Cursos
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Explora el contenido disponible en la plataforma
          </p>
        </div>
        <button
          onClick={() => setActiveView("dashboard")}
          className="text-sm font-medium text-primary hover:underline underline-offset-2"
        >
          ← Volver al inicio
        </button>
      </div>

      {loadingCursos && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      )}

      {errorCursos && (
        <div className="p-6 bg-destructive/10 rounded-lg border border-destructive/30">
          <p className="text-destructive font-medium">Error al cargar cursos</p>
          <p className="text-sm text-muted-foreground mt-1">{errorCursos}</p>
          <p className="text-xs text-muted-foreground mt-2">
            Verifica que el servidor esté encendido.
          </p>
        </div>
      )}

      {!loadingCursos && !errorCursos && cursos.length === 0 && (
        <div className="p-6 bg-card rounded-lg border border-border text-center">
          <p className="text-muted-foreground">No hay cursos disponibles en este momento.</p>
        </div>
      )}

      {!loadingCursos && !errorCursos && cursos.length > 0 && (
        <div className="space-y-4">
          {cursos.map((curso) => (
            <div
              key={curso.id}
              className="flex items-center justify-between p-5 bg-card rounded-lg border border-border hover:border-primary/30 hover:shadow-sm transition-all duration-200"
            >
              <div className="flex items-center gap-4 min-w-0 flex-1">
                <div className="w-12 h-12 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                  <BookOpen className="w-6 h-6" />
                </div>

                <div className="min-w-0">
                  <h4 className="font-medium text-foreground truncate">
                    {curso.titulo}
                  </h4>
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                    {curso.descripcion}
                  </p>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full uppercase font-medium">
                      {curso.categoria}
                    </span>
                    {curso.archivo_path && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <FileText className="w-3 h-3" />
                        {curso.archivo_path.split("/").pop()}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                <button
                  onClick={() => handleIniciar(curso.id)}
                  disabled={iniciando === curso.id}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {iniciando === curso.id ? "Guardando..." : "Iniciar"}
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
