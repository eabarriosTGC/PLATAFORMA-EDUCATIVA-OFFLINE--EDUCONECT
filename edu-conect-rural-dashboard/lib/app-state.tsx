"use client"

import { createContext, useContext, useState, useCallback, ReactNode } from "react"
import { Curso, Progreso } from "@/lib/types"

export type ViewType = "dashboard" | "cursos" | "biblioteca" | "progreso" | "videos" | "youtube" | "profesores"

export interface VideoItem {
  id: string
  title: string
  channel: string
  duration: string
  thumbnail: string
  views?: string
  categoria?: string
  tipo?: "simulacion" | "modulo" | "audio"  // tipo real de recurso
  url?: string  // URL real para abrir
  emoji?: string  // ícono representativo
}

interface AppState {
  activeCategory: string | null
  activeView: ViewType
  selectedVideo: VideoItem | null
  usuario: string
  isTeacher: boolean
  cursos: Curso[]
  progreso: Progreso[]
  loadingCursos: boolean
  errorCursos: string | null
}

interface AppActions {
  setActiveCategory: (cat: string | null) => void
  setActiveView: (view: ViewType) => void
  setSelectedVideo: (video: VideoItem | null) => void
  setUsuario: (user: string) => void
  setIsTeacher: (t: boolean) => void
  setCursos: (cursos: Curso[]) => void
  setProgreso: (progreso: Progreso[]) => void
  setLoadingCursos: (loading: boolean) => void
  setErrorCursos: (error: string | null) => void
}

type AppContextType = AppState & AppActions

const AppContext = createContext<AppContextType | null>(null)

const initialVideos: VideoItem[] = [
  { id: "phet1", title: "Construye una Molécula", channel: "Simulación PhET", duration: "Interactivo", thumbnail: "", views: "Interactivo", categoria: "ciencias", tipo: "simulacion", url: "/modulos/phet/build-a-molecule/index.html", emoji: "🧪" },
  { id: "phet2", title: "Globos y Electricidad Estática", channel: "Simulación PhET", duration: "Interactivo", thumbnail: "", views: "Interactivo", categoria: "ciencias", tipo: "simulacion", url: "/modulos/phet/balloons-and-static-electricity/index.html", emoji: "⚡" },
  { id: "phet3", title: "Estados de la Materia", channel: "Simulación PhET", duration: "Interactivo", thumbnail: "", views: "Interactivo", categoria: "ciencias", tipo: "simulacion", url: "/modulos/phet/states-of-matter/index.html", emoji: "🔬" },
  { id: "phet4", title: "Gravedad y Órbitas", channel: "Simulación PhET", duration: "Interactivo", thumbnail: "", views: "Interactivo", categoria: "ciencias", tipo: "simulacion", url: "/modulos/phet/gravity-and-orbits/index.html", emoji: "🪐" },
  { id: "phet5", title: "Selección Natural", channel: "Simulación PhET", duration: "Interactivo", thumbnail: "", views: "Interactivo", categoria: "ciencias", tipo: "simulacion", url: "/modulos/phet/natural-selection/index.html", emoji: "🧬" },
  { id: "3d1", title: "La Guajira en 3D — Explora el Desierto", channel: "Módulo Interactivo", duration: "Exploración 3D", thumbnail: "", views: "Interactivo", categoria: "ciencias", tipo: "modulo", url: "/modulos/mundo-3d-701/index.html", emoji: "🏜️" },
  { id: "puzzle1", title: "Puzzle: Mapa de La Guajira", channel: "Juego Interactivo", duration: "Interactivo", thumbnail: "", views: "Puzzle", categoria: "historia", tipo: "modulo", url: "/modulos/puzzle-501/index.html", emoji: "🧩" },
  { id: "quiz1", title: "Quiz Saber 11 — Pon a prueba tus conocimientos", channel: "Juego Interactivo", duration: "Interactivo", thumbnail: "", views: "Quiz", categoria: "lenguaje", tipo: "modulo", url: "/modulos/quiz-601/index.html", emoji: "🏆" },
]

export function AppProvider({ children }: { children: ReactNode }) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [activeView, setActiveView] = useState<ViewType>("dashboard")
  const [selectedVideo, setSelectedVideo] = useState<VideoItem | null>(null)
  const [usuario, setUsuario] = useState("estudiante")
  const [isTeacher, setIsTeacher] = useState(false)
  const [cursos, setCursos] = useState<Curso[]>([])
  const [progreso, setProgreso] = useState<Progreso[]>([])
  const [loadingCursos, setLoadingCursos] = useState(true)
  const [errorCursos, setErrorCursos] = useState<string | null>(null)

  return (
    <AppContext.Provider
      value={{
        activeCategory, setActiveCategory,
        activeView, setActiveView,
        selectedVideo, setSelectedVideo,
        usuario, setUsuario,
        isTeacher, setIsTeacher,
        cursos, setCursos,
        progreso, setProgreso,
        loadingCursos, setLoadingCursos,
        errorCursos, setErrorCursos,
      }}
    >
      {children}
    </AppContext.Provider>
  )
}

export function useAppState(): AppContextType {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error("useAppState must be used within AppProvider")
  return ctx
}

export function getInitialVideos(): VideoItem[] {
  return [...initialVideos]
}

/** Mapea nombres de categorías de sidebar a valores del backend */
export const CATEGORY_MAP: Record<string, string> = {
  "Ciencias y Naturaleza": "ciencias",
  "Comunidad y Sociedad": "historia",
  "Lenguajes": "lenguaje",
  "Lógica": "matematicas",
  "Tecnología": "tecnologia",
  "Cuerpo y Expresión": "general",
}
