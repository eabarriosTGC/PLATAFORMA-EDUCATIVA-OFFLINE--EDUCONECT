"use client"

import { useState, useEffect } from "react"
import { Play, Clock, ExternalLink, X } from "lucide-react"
import { useAppState } from "@/lib/app-state"

interface RealVideo {
  id: string
  title: string
  file: string
  url: string
  size: number
  type: string
}

export function YouTubeRuralView() {
  const { setActiveView } = useAppState()
  const [videos, setVideos] = useState<RealVideo[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<RealVideo | null>(null)

  useEffect(() => {
    fetch("/api/videos")
      .then((r) => r.json())
      .then((data) => {
        setVideos(data.videos || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  function formatSize(bytes: number) {
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + " KB"
    return (bytes / (1024 * 1024)).toFixed(1) + " MB"
  }

  return (
    <section aria-labelledby="youtube-title">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 id="youtube-title" className="text-2xl font-semibold text-foreground">
            📺 YouTube Rural
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {videos.length > 0
              ? `${videos.length} videos educativos disponibles sin internet`
              : "Coloca archivos .mp4 en la carpeta data/videos/"}
          </p>
        </div>
        <button
          onClick={() => setActiveView("dashboard")}
          className="text-sm font-medium text-primary hover:underline underline-offset-2"
        >
          ← Volver al inicio
        </button>
      </div>

      {/* Video player modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
             onClick={() => setSelected(null)}>
          <div className="bg-card rounded-xl border border-border shadow-2xl max-w-4xl w-full overflow-hidden"
               onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="font-semibold text-foreground truncate pr-4">
                {selected.title}
              </h3>
              <button onClick={() => setSelected(null)}
                className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="bg-black">
              <video
                controls
                autoPlay
                className="w-full max-h-[70vh]"
                src={selected.url}
                style={{ display: "block" }}
              >
                Tu navegador no soporta reproducción de video.
              </video>
            </div>
            <div className="p-3 text-xs text-muted-foreground flex justify-between">
              <span>{formatSize(selected.size)} · {selected.type.toUpperCase()}</span>
              <a href={selected.url} download className="text-primary hover:underline">
                Descargar video
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      )}

      {/* Empty */}
      {!loading && videos.length === 0 && (
        <div className="p-6 bg-card rounded-lg border border-border text-center">
          <p className="text-muted-foreground mb-3">
            No hay videos disponibles. Coloca archivos .mp4 en la carpeta{" "}
            <code className="bg-muted px-1 rounded">data/videos/</code>
          </p>
          <p className="text-xs text-muted-foreground">
            Puedes descargar videos educativos con:{" "}
            <code className="bg-muted px-1 rounded">yt-dlp "URL"</code>
          </p>
        </div>
      )}

      {/* Video grid */}
      {!loading && videos.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {videos.map((video) => (
            <button
              key={video.id}
              onClick={() => setSelected(video)}
              className="group bg-card rounded-lg border border-border overflow-hidden hover:shadow-md transition-shadow text-left"
            >
              {/* Thumbnail placeholder */}
              <div className="relative aspect-video bg-gradient-to-br from-red-900/30 to-red-600/20 flex items-center justify-center">
                <span className="text-5xl">📺</span>
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="w-14 h-14 rounded-full bg-primary/90 flex items-center justify-center">
                    <Play className="w-7 h-7 text-primary-foreground ml-1" />
                  </div>
                </div>
                <div className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/80 text-white text-xs font-medium rounded flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatSize(video.size)}
                </div>
              </div>
              <div className="p-3">
                <h4 className="font-medium text-sm text-foreground line-clamp-2 leading-snug mb-1 group-hover:text-primary transition-colors">
                  {video.title.replace(/[_-]/g, " ")}
                </h4>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Video educativo</span>
                  <span className="font-medium uppercase">{video.type}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Instrucciones */}
      <div className="mt-6 p-4 bg-card rounded-lg border border-border">
        <h3 className="text-sm font-medium text-foreground mb-2">📥 ¿Cómo agregar más videos?</h3>
        <div className="text-xs text-muted-foreground space-y-1">
          <p>1. Copia archivos <code className="bg-muted px-1 rounded">.mp4</code> a la carpeta <code className="bg-muted px-1 rounded">data/videos/</code></p>
          <p>2. O descarga desde YouTube: <code className="bg-muted px-1 rounded">yt-dlp "URL_DEL_VIDEO" -o "data/videos/%(title)s.%(ext)s"</code></p>
          <p>3. Reinicia el servidor para que los detecte</p>
        </div>
      </div>
    </section>
  )
}
