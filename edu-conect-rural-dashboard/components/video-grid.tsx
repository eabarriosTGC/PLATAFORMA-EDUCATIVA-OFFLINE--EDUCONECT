"use client"

import { useState, useEffect } from "react"
import { Clock, Play, ExternalLink, FlaskConical, Puzzle, Trophy, Globe } from "lucide-react"
import { useAppState, getInitialVideos, VideoItem, CATEGORY_MAP } from "@/lib/app-state"

// Fondos coloridos para thumbnails de videos (fallback)
const THUMB_VIDEO = [
  "thumb-bg-0", "thumb-bg-1", "thumb-bg-2", "thumb-bg-3", "thumb-bg-4"
]

interface RealVideo {
  id: string
  title: string
  file: string
  url: string
  size: number
  type: string
  thumbnail?: string
}

interface VideoGridProps {
  showAll?: boolean
}

const tipoIcons: Record<string, typeof FlaskConical> = {
  simulacion: FlaskConical,
  modulo: Puzzle,
  audio: Play,
}

function VideoCard({ video, onClick, index }: { video: VideoItem; onClick: () => void; index: number }) {
  const thumbClass = THUMB_VIDEO[index % THUMB_VIDEO.length]
  return (
    <button
      onClick={onClick}
      className="group flex-shrink-0 w-64 sm:w-72 bg-card rounded-lg border border-border overflow-hidden hover:shadow-md transition-shadow duration-200 text-left"
    >
      {/* Thumbnail: imagen real o gradiente fallback */}
      <div className="relative aspect-video bg-muted flex items-center justify-center overflow-hidden">
        {video.thumbnail ? (
          <img
            src={video.thumbnail}
            alt={video.title}
            className="absolute inset-0 w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className={`absolute inset-0 ${thumbClass}`} />
        )}
        {/* Overlay: emoji + badge de tipo — va encima de la imagen/gradiente */}
        <div className="relative z-10 text-center">
          <span className="text-5xl block mb-1 drop-shadow-lg">{video.emoji || "🎬"}</span>
          <span className="text-xs text-white font-medium px-2 py-0.5 rounded-full bg-black/30 backdrop-blur-sm">
            {video.tipo === "simulacion" ? "Simulación" : video.tipo === "modulo" ? "Juego" : "Audio"}
          </span>
        </div>
        {/* Duration badge */}
        <div className="absolute z-10 bottom-2 right-2 px-1.5 py-0.5 bg-black/60 text-white text-xs font-medium rounded flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {video.duration}
        </div>
      </div>

      {/* Info */}
      <div className="p-3">
        <h4 className="font-medium text-sm text-foreground line-clamp-2 leading-snug mb-1.5 group-hover:text-primary transition-colors">
          {video.title}
        </h4>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="font-medium">{video.channel}</span>
          {video.views && <span className="text-primary font-medium">{video.views}</span>}
        </div>
      </div>
    </button>
  )
}

export function VideoGrid({ showAll = false }: VideoGridProps) {
  const { activeCategory, setSelectedVideo, setActiveView } = useAppState()
  const allVideos = getInitialVideos()
  const [realVideos, setRealVideos] = useState<VideoItem[]>([])

  // Fetch real videos from data/videos/
  useEffect(() => {
    fetch("/api/videos")
      .then((r) => r.json())
      .then((data) => {
        const videos: VideoItem[] = (data.videos || []).map((v: RealVideo) => ({
          id: v.id,
          title: v.title,
          channel: "Video Local",
          duration: (v.size / (1024 * 1024)).toFixed(1) + " MB",
          thumbnail: v.thumbnail || "",
          views: v.type.toUpperCase(),
          categoria: "videos",
          tipo: "video",
          url: v.url,
          emoji: "🎥",
        }))
        setRealVideos(videos)
      })
      .catch(() => {})
  }, [])

  // Merge both lists: real videos first, then curated
  const mergedVideos = [...realVideos, ...allVideos]

  // Filtrar por categoría activa del sidebar
  let filteredVideos = mergedVideos
  if (activeCategory) {
    filteredVideos = mergedVideos.filter((v) => v.categoria === activeCategory)
  }

  // En modo no-showAll, mostrar solo los primeros 5
  const displayVideos = showAll ? filteredVideos : filteredVideos.slice(0, 5)

  return (
    <section aria-labelledby="videos-title" id="videos-section">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 id="videos-title" className="text-lg font-semibold text-foreground">
            🎬 Recursos Multimedia
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Simulaciones interactivas, juegos y actividades offline
            {activeCategory && (
              <span className="ml-2 text-primary text-xs">
                (Filtrando: {activeCategory})
              </span>
            )}
          </p>
        </div>

        {!showAll && filteredVideos.length > 5 && (
          <button
            onClick={() => setActiveView("videos")}
            className="text-sm font-medium text-primary hover:underline underline-offset-2"
          >
            Ver todos →
          </button>
        )}

        {showAll && (
          <button
            onClick={() => setActiveView("dashboard")}
            className="text-sm font-medium text-primary hover:underline underline-offset-2"
          >
            ← Ver menos
          </button>
        )}
      </div>

      {filteredVideos.length === 0 && (
        <div className="p-6 bg-card rounded-lg border border-border text-center">
          <p className="text-muted-foreground">
            No hay recursos disponibles para esta categoría.
          </p>
        </div>
      )}

      {filteredVideos.length > 0 && (
        <div className="relative -mx-4 sm:-mx-6 px-4 sm:px-6">
          <div className={showAll
            ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-4"
            : "flex gap-4 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent"
          }>
            {displayVideos.map((video) => (
              <VideoCard
                key={video.id}
                video={video}
                index={displayVideos.indexOf(video)}
                onClick={() => setSelectedVideo(video)}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
