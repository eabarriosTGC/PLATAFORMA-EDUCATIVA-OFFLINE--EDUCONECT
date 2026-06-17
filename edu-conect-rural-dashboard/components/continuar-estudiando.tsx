"use client"

import { useAppState } from "@/lib/app-state"
import { type Curso, type Progreso } from "@/lib/types"
import { BookOpen, Play, Clock, ChevronRight } from "lucide-react"
import { useEffect, useState } from "react"

interface PausedVideo {
  videoId: string
  title: string
  currentTime: number
  duration: number
  thumbnail?: string
}

function formatTime(seconds: number): string {
  if (!seconds || !isFinite(seconds)) return "00:00"
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{
          width: `${Math.min(100, Math.max(0, value))}%`,
          background: "linear-gradient(90deg, #F4A100, #E86820, #D4322F)",
        }}
      />
    </div>
  )
}

export function ContinuarEstudiando() {
  const { cursos, progreso, setActiveView } = useAppState()
  const [pausedVideos, setPausedVideos] = useState<PausedVideo[]>([])

  // Leer videos pausados desde localStorage
  useEffect(() => {
    try {
      const keys = Object.keys(localStorage).filter((k) =>
        k.startsWith("video-progress-")
      )
      const videos: PausedVideo[] = keys
        .map((k) => {
          try {
            const raw = localStorage.getItem(k)
            if (!raw) return null
            const parsed = JSON.parse(raw)
            return {
              videoId: parsed.videoId || k.replace("video-progress-", ""),
              title: parsed.title || "Video sin título",
              currentTime: typeof parsed.position === "number" ? parsed.position : 0,
              duration: typeof parsed.duration === "number" ? parsed.duration : 0,
              thumbnail: parsed.thumbnail || undefined,
            } as PausedVideo
          } catch {
            return null
          }
        })
        .filter((v): v is PausedVideo => v !== null && v.currentTime > 0)
      setPausedVideos(videos)
    } catch {
      setPausedVideos([])
    }
  }, [])

  // Filtrar cursos en progreso (porcentaje > 0 y < 100)
  const enProgreso: Array<{ progreso: Progreso; curso: Curso | undefined }> = progreso
    .filter((p) => p.porcentaje > 0 && p.porcentaje < 100)
    .sort((a, b) => new Date(b.ultima_vez).getTime() - new Date(a.ultima_vez).getTime())
    .slice(0, 3)
    .map((p) => ({
      progreso: p,
      curso: cursos.find((c) => c.id === p.curso_id),
    }))
    .filter((item) => item.curso !== undefined)

  // Si no hay nada en progreso ni videos pausados, no mostrar nada
  if (enProgreso.length === 0 && pausedVideos.length === 0) {
    return null
  }

  return (
    <section aria-labelledby="continuar-title" className="mb-6">
      <h2
        id="continuar-title"
        className="flex items-center gap-2 text-lg font-semibold text-foreground mb-4"
      >
        <Play className="w-5 h-5 text-primary" />
        Continuar donde lo dejaste
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Cursos en progreso */}
        {enProgreso.map(({ progreso, curso }) => (
          <div
            key={`curso-${progreso.id}`}
            className="flex flex-col p-5 bg-card rounded-xl border border-border hover:border-primary/30 hover:shadow-md transition-all duration-200 card-clickable"
          >
            <div className="flex items-start gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                <BookOpen className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-medium text-foreground text-sm leading-tight truncate">
                  📚 {curso!.titulo}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {progreso.porcentaje}% completado
                </p>
              </div>
              <span className="text-sm font-bold text-primary whitespace-nowrap ml-1">
                {progreso.porcentaje}%
              </span>
            </div>

            <ProgressBar value={progreso.porcentaje} />

            <button
              onClick={() => setActiveView("cursos")}
              className="mt-3 flex items-center justify-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors self-end"
            >
              Continuar
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}

        {/* Videos pausados */}
        {pausedVideos.slice(0, Math.max(0, 3 - enProgreso.length)).map((video) => (
          <div
            key={`video-${video.videoId}`}
            className="flex flex-col p-5 bg-card rounded-xl border border-border hover:border-accent/30 hover:shadow-md transition-all duration-200 card-clickable"
          >
            <div className="flex items-start gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-accent/10 text-accent flex items-center justify-center flex-shrink-0">
                <Play className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-medium text-foreground text-sm leading-tight truncate">
                  🎬 {video.title}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  en {formatTime(video.currentTime)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Video · {formatTime(video.duration)} total
                </p>
              </div>
            </div>

            {/* Barra de progreso del video */}
            <ProgressBar
              value={
                video.duration > 0
                  ? (video.currentTime / video.duration) * 100
                  : 0
              }
            />

            <button
              onClick={() => setActiveView("videos")}
              className="mt-3 flex items-center justify-center gap-1.5 text-xs font-medium text-accent hover:text-accent/80 transition-colors self-end"
            >
              Continuar
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}
