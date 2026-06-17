"use client"

import React from "react"
import { cn } from "@/lib/utils"
import { useAppState, CATEGORY_MAP } from "@/lib/app-state"
import {
  Leaf, Users, Languages, Calculator, Palette, Monitor,
  FolderKanban, BookOpen, PlayCircle, GraduationCap,
  Menu, X, Sprout, ShieldCheck,
} from "lucide-react"

const navigationGroups = [
  {
    title: "APRENDIZAJE (Ley 115)",
    items: [
      { name: "Ciencias y Naturaleza", icon: Leaf, description: "Naturales, Ambiental, Física, Química", href: "#ciencias" },
      { name: "Comunidad y Sociedad", icon: Users, description: "Sociales, Historia, Geografía, Ética", href: "#sociedad" },
      { name: "Lenguajes", icon: Languages, description: "Castellano, Inglés", href: "#lenguajes" },
      { name: "Lógica", icon: Calculator, description: "Matemáticas, Geometría, Álgebra", href: "#logica" },
      { name: "Cuerpo y Expresión", icon: Palette, description: "Artística, Educación Física", href: "#expresion" },
      { name: "Tecnología", icon: Monitor, description: "Informática y Lógica", href: "#tecnologia" },
    ],
  },
  {
    title: "PROYECTOS",
    items: [
      { name: "Transversales", icon: FolderKanban, description: "Educación Sexual, Ambiental, Paz", href: "#proyectos" },
    ],
  },
  {
  title: "RECURSOS EXTRA",
  items: [
    { name: "Biblioteca Digital", icon: BookOpen, description: "PDFs y libros en Markdown", href: "#biblioteca", emoji: "📚", view: "biblioteca" as const },
    { name: "Recursos Multimedia", icon: PlayCircle, description: "Simulaciones PhET y juegos interactivos", href: "#multimedia", emoji: "🎬", view: "videos" as const },
    { name: "YouTube Rural", icon: PlayCircle, description: "Videos educativos offline", href: "#youtube", emoji: "📺", view: "youtube" as const },
    { name: "Wikipedia Offline", icon: BookOpen, description: "Enciclopedia libre sin internet", href: "#wikipedia", emoji: "🌐", url: "/zim/" },
  ],
  },
  {
    title: "GESTIÓN DOCENTE",
    items: [
      { name: "Panel de Profesores", icon: GraduationCap, description: "Estadísticas, progreso, gestión", href: "#docentes", view: "profesores" as const },
    ],
  },
]

export function Sidebar() {
  const [isOpen, setIsOpen] = React.useState(false)
  const { activeCategory, setActiveCategory, setActiveView, isTeacher, setIsTeacher } = useAppState()

  // Filtrar secciones: ocultar "GESTIÓN DOCENTE" para estudiantes
  const visibleGroups = navigationGroups.filter(
    (g) => g.title !== "GESTIÓN DOCENTE" || isTeacher
  )

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed top-4 left-4 z-50 p-2 rounded-lg bg-sidebar text-sidebar-foreground lg:hidden shadow-lg"
        aria-label={isOpen ? "Cerrar menú" : "Abrir menú"}
      >
        {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={() => setIsOpen(false)} />
      )}

      <aside
        className={cn(
          "fixed left-0 top-0 h-full w-72 bg-sidebar text-sidebar-foreground z-40 transform transition-transform duration-300 ease-in-out overflow-y-auto",
          "lg:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="p-6 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-sidebar-primary flex items-center justify-center">
              <Sprout className="w-6 h-6 text-sidebar-primary-foreground" />
            </div>
            <div>
              <h1 className="font-semibold text-lg tracking-tight">EduConect Rural</h1>
              <p className="text-xs text-sidebar-foreground/70">Navegación Escolar</p>
            </div>
          </div>
        </div>

        <nav className="p-4 space-y-6">
          {/* Teacher mode toggle */}
          <div className="px-2 mb-2">
            <button
              onClick={() => setIsTeacher(!isTeacher)}
              className={`flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                isTeacher
                  ? "bg-amber-200 text-amber-900"
                  : "bg-sidebar-accent/50 text-sidebar-foreground/60"
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              {isTeacher ? "🔓 Modo Docente" : "👤 Modo Estudiante"}
            </button>
          </div>
          {visibleGroups.map((group) => (
            <div key={group.title}>
              <h2 className="text-xs font-semibold text-sidebar-foreground/60 uppercase tracking-wider mb-3 px-2">
                {group.title}
              </h2>
              <ul className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon
                  const catValue = CATEGORY_MAP[item.name]
                  const isActive = activeCategory === catValue

                  return (
                    <li key={item.name}>
                      <a
                        href={item.href}
                        onClick={(e) => {
                          e.preventDefault()
                          setIsOpen(false)

                          if ("url" in item && item.url) {
                            window.open(item.url, "_blank")
                            return
                          }

                          if ("view" in item && item.view) {
                            setActiveView(item.view)
                            setActiveCategory(null)
                          } else if (catValue) {
                            // Alternar filtro: si ya está activo, desactivar
                            setActiveCategory(isActive ? null : catValue)
                            setActiveView("dashboard")
                          }
                        }}
                        className={cn(
                          "flex items-start gap-3 px-3 py-2.5 rounded-lg transition-colors duration-150",
                          "hover:bg-sidebar-accent",
                          isActive && "bg-sidebar-accent font-semibold"
                        )}
                      >
                        <span className="flex-shrink-0 mt-0.5">
                          {"emoji" in item ? (
                            <span className="text-base" aria-hidden="true">{item.emoji}</span>
                          ) : (
                            <Icon className={cn("w-5 h-5", isActive ? "text-sidebar-primary" : "text-sidebar-primary")} />
                          )}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium leading-tight">{item.name}</p>
                          <p className="text-xs text-sidebar-foreground/60 mt-0.5 leading-snug">
                            {item.description}
                          </p>
                        </div>
                      </a>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </nav>
      </aside>
    </>
  )
}
