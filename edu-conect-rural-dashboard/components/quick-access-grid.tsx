"use client"

import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import { BookOpen, PlayCircle, GraduationCap, Save, type LucideIcon } from "lucide-react"
import { getCursos } from "@/lib/api"
import { useAppState } from "@/lib/app-state"

interface QuickAccessCardProps {
  title: string
  description: string
  icon: LucideIcon
  color: "primary" | "secondary" | "accent" | "muted"
  onClick: () => void
}

const colorVariants = {
  primary: "bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer",
  secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/90 cursor-pointer",
  accent: "bg-accent text-accent-foreground hover:bg-accent/90 cursor-pointer",
  muted: "bg-muted text-muted-foreground hover:bg-muted/80 cursor-pointer",
}

const iconBgVariants = {
  primary: "bg-primary-foreground/20",
  secondary: "bg-secondary-foreground/20",
  accent: "bg-accent-foreground/20",
  muted: "bg-foreground/10",
}

function QuickAccessCard({ title, description, icon: Icon, color, onClick }: QuickAccessCardProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "block p-5 sm:p-6 rounded-xl transition-all duration-200 shadow-sm hover:shadow-md text-left w-full",
        colorVariants[color]
      )}
    >
      <div className={cn("w-12 h-12 rounded-lg flex items-center justify-center mb-4", iconBgVariants[color])}>
        <Icon className="w-6 h-6" />
      </div>
      <h3 className="font-semibold text-lg mb-1">{title}</h3>
      <p className="text-sm opacity-80 leading-relaxed">{description}</p>
    </button>
  )
}

export function QuickAccessGrid() {
  const { setActiveView, setActiveCategory, progreso, cursos } = useAppState()
  const [cursoCount, setCursoCount] = useState<number | null>(null)
  const [loadingCount, setLoadingCount] = useState(true)
  const [countError, setCountError] = useState(false)

  // Calcular métricas reales de progreso
  const cursosIniciados = progreso.filter((p) => p.porcentaje > 0).length
  const completados = progreso.filter((p) => p.porcentaje >= 100).length
  const promedio = cursosIniciados > 0
    ? Math.round(progreso.filter((p) => p.porcentaje > 0).reduce((sum, p) => sum + p.porcentaje, 0) / cursosIniciados)
    : 0
  const hayProgreso = cursosIniciados > 0

  useEffect(() => {
    let cancelled = false
    async function fetchCount() {
      try {
        const data = await getCursos()
        if (!cancelled) {
          setCursoCount(data.length)
          setLoadingCount(false)
        }
      } catch {
        if (!cancelled) {
          setCountError(true)
          setLoadingCount(false)
        }
      }
    }
    fetchCount()
    return () => { cancelled = true }
  }, [])

  const cards: QuickAccessCardProps[] = [
    {
      title: "Mis Clases",
      description: loadingCount
        ? "Cargando..."
        : countError
        ? "Accede a tus materias y contenido"
        : `${cursoCount} cursos disponibles — Explora y comienza a aprender`,
      icon: GraduationCap,
      color: "primary",
      onClick: () => { setActiveView("cursos"); setActiveCategory(null) },
    },
    {
      title: "Biblioteca de Lectura",
      description: "PDFs, libros y textos en formato digital",
      icon: BookOpen,
      color: "secondary",
      onClick: () => { setActiveView("biblioteca"); setActiveCategory(null) },
    },
    {
      title: "Recursos Multimedia",
      description: "Simulaciones interactivas, juegos y actividades offline",
      icon: PlayCircle,
      color: "accent",
      onClick: () => {
        setActiveView("dashboard")
        setActiveCategory(null)
        // Scroll suave hasta la sección de videos
        setTimeout(() => {
          document.getElementById("videos-section")?.scrollIntoView({ behavior: "smooth" })
        }, 100)
      },
    },
    {
      title: "Progreso Guardado",
      description: hayProgreso
        ? `${completados} de ${cursosIniciados} cursos · ${promedio}% promedio`
        : "Tu avance y actividades completadas",
      icon: Save,
      color: hayProgreso ? "secondary" : "muted",
      onClick: () => { setActiveView("progreso"); setActiveCategory(null) },
    },
  ]

  return (
    <section aria-labelledby="quick-access-title">
      <h2 id="quick-access-title" className="text-lg font-semibold text-foreground mb-4">
        Acceso Rápido
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <QuickAccessCard key={card.title} {...card} />
        ))}
      </div>
    </section>
  )
}
