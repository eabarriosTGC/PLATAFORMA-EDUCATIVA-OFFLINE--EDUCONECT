"use client"

import { useState, useEffect } from "react"
import { FileText, Filter, X, ChevronDown } from "lucide-react"
import { useAppState } from "@/lib/app-state"

interface Libro {
  archivo_path: string
  titulo: string
  descripcion: string
  idioma: string
  edad: string
  fuente: string
  categoria: string
  id: number
}

interface CatalogoResponse {
  wayuu: Libro[]
  cuentos: Libro[]
}

const CATEGORIAS = [
  { key: "wayuu", label: "🏜️ Wayuu", color: "bg-amber-100 text-amber-800 border-amber-200" },
  { key: "cuentos", label: "📖 Cuentos", color: "bg-emerald-100 text-emerald-800 border-emerald-200" },
] as const

export function BibliotecaView() {
  const { setActiveView } = useAppState()
  const [catalogo, setCatalogo] = useState<CatalogoResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filtro, setFiltro] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  useEffect(() => {
    let cancelled = false
    fetch("/api/biblioteca")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((data) => {
        if (!cancelled) {
          // Transformar array plano a categorías
          const libros = data.libros || []
          // DEDUP: la migración inserta duplicados — filtrar por archivo_path único
          const seen = new Set<string>()
          const unicos = libros.filter((l: Libro) => {
            if (seen.has(l.archivo_path)) return false
            seen.add(l.archivo_path)
            return true
          })
          const wayuu = unicos.filter((l: Libro) => l.archivo_path?.includes("/wayuu/"))
          const cuentos = unicos.filter((l: Libro) => l.archivo_path?.includes("/cuentos/"))
          setCatalogo({ wayuu, cuentos })
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
  }, [])

  function getLibros() {
    if (!catalogo) return []
    if (!filtro) return [...catalogo.wayuu, ...catalogo.cuentos]
    return catalogo[filtro as keyof CatalogoResponse] || []
  }

  function toggleExpand(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const libros = getLibros()
  const totalWayuu = catalogo?.wayuu.length || 0
  const totalCuentos = catalogo?.cuentos.length || 0
  const total = totalWayuu + totalCuentos

  return (
    <section aria-labelledby="biblioteca-title">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 id="biblioteca-title" className="text-2xl font-semibold text-foreground">
            📖 Biblioteca Digital
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {total > 0
              ? `${total} libros gratuitos del Plan Nacional de Lectura de Colombia — disponibles sin internet`
              : "Documentos PDF disponibles para lectura offline"}
          </p>
        </div>
        <button
          onClick={() => setActiveView("dashboard")}
          className="text-sm font-medium text-primary hover:underline underline-offset-2"
        >
          ← Volver al inicio
        </button>
      </div>

      {/* Stats */}
      {!loading && !error && total > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="p-3 bg-card rounded-lg border border-border text-center">
            <div className="text-2xl font-bold text-foreground">{total}</div>
            <div className="text-xs text-muted-foreground">Libros</div>
          </div>
          <div className="p-3 bg-card rounded-lg border border-border text-center">
            <div className="text-2xl font-bold text-amber-600">{totalWayuu}</div>
            <div className="text-xs text-muted-foreground">Cultura Wayuu</div>
          </div>
          <div className="p-3 bg-card rounded-lg border border-border text-center">
            <div className="text-2xl font-bold text-emerald-600">{totalCuentos}</div>
            <div className="text-xs text-muted-foreground">Cuentos</div>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => setFiltro(null)}
          className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
            !filtro
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-card text-muted-foreground border-border hover:bg-muted"
          }`}
        >
          Todos ({total})
        </button>
        {CATEGORIAS.map((cat) => {
          const count = cat.key === "wayuu" ? totalWayuu : totalCuentos
          return (
            <button
              key={cat.key}
              onClick={() => setFiltro(filtro === cat.key ? null : cat.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                filtro === cat.key ? cat.color : "bg-card text-muted-foreground border-border hover:bg-muted"
              }`}
            >
              {cat.label} ({count})
            </button>
          )
        })}
        {filtro && (
          <button
            onClick={() => setFiltro(null)}
            className="px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-3 h-3 inline" /> Limpiar
          </button>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-6 bg-destructive/10 rounded-lg border border-destructive/30">
          <p className="text-destructive font-medium">Error al cargar la biblioteca</p>
          <p className="text-sm text-muted-foreground mt-1">{error}</p>
        </div>
      )}

      {/* Empty */}
      {!loading && !error && libros.length === 0 && (
        <div className="p-6 bg-card rounded-lg border border-border text-center">
          <FileText className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-muted-foreground">No hay libros en esta categoría.</p>
        </div>
      )}

      {/* Lista de libros */}
      {!loading && !error && libros.length > 0 && (
        <div className="space-y-3">
          {libros.map((libro, i) => {
            const pdfUrl = "/modulos/comun/visor-pdf.html?file=/biblioteca/" + libro.archivo_path.replace("data/biblioteca/", "")
            const isExpanded = expanded.has(libro.archivo_path)
            const isWayuu = libro.archivo_path.includes("/wayuu/")
            const catColor = isWayuu
              ? "bg-amber-100 text-amber-700"
              : "bg-emerald-100 text-emerald-700"

            return (
              <a
                key={libro.archivo_path}
                href={pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block bg-card rounded-lg border border-border hover:border-primary/30 hover:shadow-md transition-all duration-200 overflow-hidden card-clickable"
                onClick={(e) => {
                  // Si hacen clic en botón interno, no prevenir
                  if ((e.target as HTMLElement).closest("button")) return
                }}
              >
                {/* Main row */}
                <div className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    {/* Thumbnail con fondo colorido */}
                    <div
                      className={`w-12 h-16 rounded-lg flex items-center justify-center flex-shrink-0 text-2xl shadow-sm ${
                        isWayuu ? "thumb-bg-1" : "thumb-bg-" + (i % 5)
                      }`}
                    >
                      {isWayuu ? "🏜️" : "📖"}
                    </div>

                    {/* Info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-medium text-sm text-foreground truncate">
                          {libro.titulo}
                        </h4>
                        <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${catColor}`}>
                          {isWayuu ? "Wayuu" : "Cuento"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 flex-wrap">
                        <span className="truncate max-w-[300px]">{libro.descripcion}</span>
                      </div>
                      {/* Metadatos rápidos */}
                      <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground/70">
                        <span title="Idioma">🌐 {libro.idioma}</span>
                        <span title="Edad recomendada">👤 {libro.edad}</span>
                        <span title="Tamaño">📦 PDF</span>
                        <button
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            toggleExpand(libro.archivo_path)
                          }}
                          className="flex items-center gap-0.5 hover:text-foreground transition-colors"
                        >
                          <span>Más info</span>
                          <ChevronDown
                            className={`w-3 h-3 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                          />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Badge PDF */}
                  <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                    <span className="px-2 py-1 text-[10px] font-semibold uppercase rounded bg-primary/10 text-primary">
                      PDF
                    </span>
                  </div>
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-border/50 pt-3 bg-muted/30">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                      <div>
                        <span className="text-xs text-muted-foreground block">Idioma</span>
                        <span className="font-medium">{libro.idioma}</span>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground block">Edad</span>
                        <span className="font-medium">{libro.edad} años</span>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground block">Tamaño</span>
                        <span className="font-medium">PDF</span>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground block">Fuente</span>
                        <span className="font-medium">{libro.fuente}</span>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-border/50">
                      <p className="text-xs text-muted-foreground">{libro.descripcion}</p>
                    </div>
                  </div>
                )}
              </a>
            )
          })}
        </div>
      )}

      {/* Footer informativo */}
      {!loading && !error && total > 0 && (
        <div className="mt-6 p-4 bg-card rounded-lg border border-border text-center">
          <p className="text-xs text-muted-foreground">
            📚 Estos libros son gratuitos y de dominio público, proporcionados por el{" "}
            <strong>Plan Nacional de Lectura de Colombia</strong>,{" "}
            <strong>Maguaré (Ministerio de Cultura)</strong> y el{" "}
            <strong>ICBF</strong>. Descargados para uso offline en EduConect Rural.
          </p>
        </div>
      )}
    </section>
  )
}
