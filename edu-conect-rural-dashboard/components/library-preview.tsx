"use client"

import { useState, useEffect } from "react"
import { FileText, BookOpen, ArrowRight } from "lucide-react"
import { useAppState } from "@/lib/app-state"

interface LibroBib {
  archivo_path: string
  titulo: string
  descripcion: string
  categoria: string
}

export function LibraryPreview() {
  const { setActiveView } = useAppState()
  const [libros, setLibros] = useState<LibroBib[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)

  useEffect(() => {
    let cancelled = false
    fetch("/api/biblioteca")
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) {
          const all = data.libros || []
          // DEDUP
          const seen = new Set<string>()
          const unicos = all.filter((l: LibroBib) => {
            if (seen.has(l.archivo_path)) return false
            seen.add(l.archivo_path)
            return true
          })
          setTotal(unicos.length)
          setLibros(unicos.slice(0, 5))
          setLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  return (
    <section aria-labelledby="library-preview-title">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 id="library-preview-title" className="text-lg font-semibold text-foreground">
            📖 Biblioteca Digital
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {total > 0
              ? `${total} libros gratuitos del Plan Nacional de Lectura`
              : "Documentos PDF disponibles para lectura offline"}
          </p>
        </div>
        <button
          onClick={() => setActiveView("biblioteca")}
          className="flex items-center gap-1 text-sm font-medium text-primary hover:underline underline-offset-2"
        >
          Ver catálogo <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="space-y-3">
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />
            ))}
          </div>
        )}

        {!loading && libros.length === 0 && (
          <p className="text-sm text-muted-foreground py-4">
            Cargando biblioteca...
          </p>
        )}

        {!loading && libros.map((libro, i) => {
          const isWayuu = libro.archivo_path?.includes("/wayuu/")
          const pdfUrl = "/modulos/comun/visor-pdf.html?file=/biblioteca/" + libro.archivo_path.replace("data/biblioteca/", "")

          return (
            <a
              key={libro.archivo_path}
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-4 bg-card rounded-lg border border-border hover:border-primary/30 hover:shadow-md transition-all duration-200 card-clickable"
            >
              <div className="flex items-center gap-4 min-w-0">
                <div className={`w-12 h-16 rounded-lg flex items-center justify-center flex-shrink-0 text-2xl shadow-sm ${
                  isWayuu ? "thumb-bg-1" : "thumb-bg-" + (i % 5)
                }`}>
                  {isWayuu ? "🏜️" : "📖"}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-sm text-foreground truncate">
                      {libro.titulo}
                    </h4>
                    <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded flex-shrink-0 ${
                      isWayuu ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
                    }`}>
                      {isWayuu ? "Wayuu" : "Cuento"}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {libro.descripcion}
                  </p>
                </div>
              </div>

              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex-shrink-0 ml-3">
                Abrir
              </span>
            </a>
          )
        })}
      </div>
    </section>
  )
}
