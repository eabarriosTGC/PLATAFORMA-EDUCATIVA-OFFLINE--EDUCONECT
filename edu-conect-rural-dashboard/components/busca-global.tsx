"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Search, X, Loader2 } from "lucide-react"
import { useAppState } from "@/lib/app-state"
import { buscar, type SearchResult } from "@/lib/api"

/** Ícono + etiqueta por tipo de recurso */
const TIPO_CONFIG: Record<string, { emoji: string; label: string; color: string }> = {
  curso:   { emoji: "📚", label: "Curso",  color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" },
  libro:   { emoji: "📖", label: "Libro",  color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300" },
  video:   { emoji: "🎬", label: "Video",  color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" },
}

/** Vista por defecto según tipo */
function vistaForTipo(tipo: string): "cursos" | "biblioteca" | "videos" {
  switch (tipo) {
    case "libro": return "biblioteca"
    case "video": return "videos"
    default:      return "cursos"
  }
}

/** Truncar texto a N caracteres */
function truncar(texto: string, max: number): string {
  if (!texto) return ""
  return texto.length > max ? texto.slice(0, max).trimEnd() + "…" : texto
}

export function BuscaGlobal() {
  const { setActiveView, setActiveCategory } = useAppState()

  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [showResults, setShowResults] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // --- Debounced search (300ms) ---
  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      setShowResults(false)
      return
    }

    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const data = await buscar(query)
        setResults(data)
        setShowResults(true)
      } catch {
        setResults([])
        setShowResults(true) // mostrar "sin resultados" aunque falle
      } finally {
        setLoading(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [query])

  // --- Cerrar al hacer clic fuera ---
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowResults(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  // --- Cerrar con Escape ---
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setShowResults(false)
      inputRef.current?.blur()
    }
  }, [])

  // --- Seleccionar resultado ---
  function handleSelect(result: SearchResult) {
    setShowResults(false)
    setQuery("")
    const vista = vistaForTipo(result.tipo)
    setActiveView(vista)
    if (result.categoria) {
      setActiveCategory(result.categoria)
    }
  }

  // --- Limpiar búsqueda ---
  function handleClear() {
    setQuery("")
    setResults([])
    setShowResults(false)
    inputRef.current?.focus()
  }

  const cfg = TIPO_CONFIG

  return (
    <div ref={containerRef} className="relative w-full sm:w-80 flex-shrink-0">
      {/* Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => { if (results.length > 0) setShowResults(true) }}
          onKeyDown={handleKeyDown}
          placeholder="Buscar cursos, libros, videos..."
          className="w-full pl-9 pr-8 py-2 text-sm bg-muted rounded-lg border border-border
                     focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary
                     transition-all placeholder:text-muted-foreground/60"
          aria-label="Buscar cursos, libros, videos"
        />
        {query && (
          <button
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded
                       hover:bg-muted-foreground/10 transition-colors"
            aria-label="Limpiar búsqueda"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Dropdown de resultados */}
      {showResults && (
        <div
          className="absolute top-full mt-1.5 left-0 right-0 z-50
                     bg-card border border-border rounded-xl shadow-xl
                     overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150"
        >
          {/* Spinner mientras carga */}
          {loading && (
            <div className="flex items-center gap-2.5 p-4 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              <span>Buscando...</span>
            </div>
          )}

          {/* Sin resultados */}
          {!loading && results.length === 0 && query.trim() && (
            <div className="flex flex-col items-center gap-2 py-6 px-4">
              <span className="text-2xl">🔍</span>
              <p className="text-sm text-muted-foreground text-center">
                No se encontraron resultados
              </p>
              <p className="text-xs text-muted-foreground/60 text-center">
                Prueba con otras palabras clave
              </p>
            </div>
          )}

          {/* Lista de resultados */}
          {!loading && results.length > 0 && (
            <div>
              {/* Cabecera con contador */}
              <div className="px-3 py-1.5 text-xs text-muted-foreground font-medium
                              border-b border-border bg-muted/30">
                {results.length} resultado{results.length !== 1 ? "s" : ""}
              </div>

              {/* Items */}
              <div className="max-h-80 overflow-y-auto scrollbar-thin">
                {results.map((r, i) => {
                  const tipoCfg = cfg[r.tipo] ?? cfg["curso"]
                  return (
                    <button
                      key={`${r.tipo}-${r.id}-${i}`}
                      onClick={() => handleSelect(r)}
                      className="w-full flex items-start gap-3 p-3 text-left
                                 hover:bg-muted/50 transition-colors
                                 border-b border-border/50 last:border-0
                                 focus:outline-none focus:bg-muted/70"
                    >
                      {/* Ícono de tipo */}
                      <span
                        className="mt-0.5 flex-shrink-0 w-8 h-8 rounded-lg
                                   flex items-center justify-center text-lg
                                   bg-muted/80"
                        aria-hidden="true"
                      >
                        {tipoCfg.emoji}
                      </span>

                      {/* Contenido */}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">
                          {r.titulo}
                        </p>
                        {r.descripcion && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {truncar(r.descripcion, 80)}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-1.5">
                          {/* Badge de tipo */}
                          <span
                            className={`inline-flex items-center px-1.5 py-0.5 rounded-full
                                        text-[10px] font-medium leading-none ${tipoCfg.color}`}
                          >
                            {tipoCfg.emoji} {tipoCfg.label}
                          </span>
                          {/* Badge de categoría */}
                          {r.categoria && (
                            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
                              {r.categoria}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
