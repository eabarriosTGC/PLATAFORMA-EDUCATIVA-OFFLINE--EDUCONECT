"use client"

import { X, ExternalLink } from "lucide-react"
import type { VideoItem } from "@/lib/app-state"
import { useRef, useState, useEffect, useCallback } from "react"

interface VideoModalProps {
  video: VideoItem
  onClose: () => void
}

interface VideoProgress {
  position: number
  duration: number
  timestamp: number
}

const LS_KEY = (id: string) => `video-progress-${id}`

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "0:00"
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, "0")}`
}

export function VideoModal({ video, onClose }: VideoModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null)

  const [resumePosition, setResumePosition] = useState<number | null>(null)
  const [showResume, setShowResume] = useState(false)

  const hasUrl = !!video.url
  const tipoLabel =
    video.tipo === "simulacion"
      ? "Simulación interactiva"
      : video.tipo === "modulo"
      ? "Juego educativo"
      : video.tipo === "audio"
      ? "Audio"
      : "Video"
  const isVideo = video.tipo === "video"

  // ── localStorage: cargar progreso guardado ──────────────────────
  useEffect(() => {
    if (!isVideo || !hasUrl) return
    try {
      const raw = localStorage.getItem(LS_KEY(video.id))
      if (!raw) return
      const progress: VideoProgress = JSON.parse(raw)
      // Solo ofrecer continuar si quedan al menos 3 segundos de video
      if (
        progress.position > 0 &&
        progress.duration > 0 &&
        progress.position < progress.duration - 3
      ) {
        setResumePosition(progress.position)
        setShowResume(true)
      }
    } catch {
      // ignorar datos corruptos
    }
  }, [video.id, isVideo, hasUrl])

  // ── localStorage: guardar posición ──────────────────────────────
  const saveProgress = useCallback(() => {
    if (!isVideo || !videoRef.current) return
    const el = videoRef.current
    if (el.duration > 0 && !el.ended) {
      try {
        localStorage.setItem(
          LS_KEY(video.id),
          JSON.stringify({
            videoId: video.id,
            title: video.title,
            position: el.currentTime,
            duration: el.duration,
            timestamp: Date.now(),
          } satisfies VideoProgress & { videoId: string; title: string })
        )
      } catch {
        // localStorage lleno o no disponible
      }
    }
  }, [isVideo, video.id])

  // ── Handlers del video ──────────────────────────────────────────
  const handleClose = useCallback(() => {
    saveProgress()
    onClose()
  }, [saveProgress, onClose])

  const handleResume = () => {
    const el = videoRef.current
    if (!el || resumePosition === null) return
    el.currentTime = resumePosition
    el.play().catch(() => {})
    setShowResume(false)
  }

  const handleDismissResume = () => {
    setShowResume(false)
    setResumePosition(null)
  }

  const handlePause = () => {
    saveProgress()
  }

  const handleEnded = () => {
    try {
      localStorage.removeItem(LS_KEY(video.id))
    } catch {}
  }

  // Cerrar con tecla Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [handleClose])

  // ── Vista: recurso de video real ────────────────────────────────
  if (isVideo && hasUrl) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
        onClick={handleClose}
      >
        <div
          className="bg-card rounded-xl border border-border shadow-2xl max-w-3xl w-full overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* ── Encabezado ── */}
          <div className="flex items-center justify-between p-4 border-b border-border bg-gradient-to-r from-primary/5 to-secondary/10">
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-2xl flex-shrink-0">{video.emoji || "🎬"}</span>
              <div className="min-w-0">
                <h3 className="font-semibold text-foreground truncate">
                  {video.title}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {video.channel} · {video.duration}
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="p-1.5 rounded-lg hover:bg-muted transition-colors flex-shrink-0 ml-2"
              aria-label="Cerrar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* ── Área de video ── */}
          <div className="relative bg-black">
            {/* Banner "Continuar desde X:XX" */}
            {showResume && resumePosition !== null && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 bg-card/95 backdrop-blur border border-primary/30 rounded-full px-4 py-2 shadow-lg animate-in fade-in slide-in-from-top-2">
                <span className="text-sm font-medium text-foreground whitespace-nowrap">
                  Continuar desde {formatTime(resumePosition)}
                </span>
                <button
                  onClick={handleResume}
                  className="px-3 py-1 bg-primary text-primary-foreground rounded-full text-xs font-semibold hover:bg-primary/90 transition-colors"
                >
                  Continuar
                </button>
                <button
                  onClick={handleDismissResume}
                  className="p-0.5 rounded-full hover:bg-muted transition-colors"
                  aria-label="Empezar desde el principio"
                >
                  <X className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              </div>
            )}

            <video
              ref={videoRef}
              src={video.url}
              className="w-full aspect-video"
              controls
              playsInline
              preload="metadata"
              onPause={handlePause}
              onEnded={handleEnded}
              data-video-id={video.id}
            >
              Tu navegador no soporta reproducción de video.
            </video>
          </div>

          {/* ── Info del video ── */}
          <div className="p-4 space-y-3 bg-gradient-to-b from-card to-secondary/5">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{tipoLabel}</span>
              <span>·</span>
              <span>MP4</span>
              <span>·</span>
              <span>{video.duration}</span>
            </div>

            <p className="text-sm text-muted-foreground leading-relaxed">
              Video educativo de EduConect Rural. Reproducción offline desde el
              almacenamiento local del dispositivo.
            </p>

            <div className="flex gap-2 pt-1">
              <button
                onClick={handleClose}
                className="py-2.5 px-4 border border-border rounded-lg font-medium text-sm hover:bg-muted transition-colors"
              >
                Cerrar reproductor
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Vista: simulación, módulo o audio (iframe integrado) ────────
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={handleClose}
    >
      <div
        className="bg-card rounded-xl border border-border shadow-2xl max-w-3xl w-full overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Encabezado ── */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-gradient-to-r from-primary/5 to-secondary/10">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-3xl flex-shrink-0">{video.emoji || "📦"}</span>
            <div className="min-w-0">
              <h3 className="font-semibold text-foreground truncate">
                {video.title}
              </h3>
              <p className="text-xs text-muted-foreground">
                {video.channel} · {video.duration}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors flex-shrink-0 ml-2"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Contenido embebido ── */}
        <div className="relative bg-muted/20">
          {hasUrl ? (
            <iframe
              src={video.url}
              title={video.title}
              className="w-full aspect-video border-0"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              allowFullScreen
            />
          ) : (
            <div className="aspect-video bg-gradient-to-br from-primary/10 to-secondary/20 flex items-center justify-center">
              <div className="text-center">
                <span className="text-7xl block mb-4">
                  {video.emoji || "🎬"}
                </span>
                <span className="px-3 py-1 bg-background/70 rounded-full text-sm font-medium text-foreground">
                  {tipoLabel}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* ── Info + Acciones ── */}
        <div className="p-4 space-y-3 bg-gradient-to-b from-card to-secondary/5">
          <p className="text-sm text-muted-foreground leading-relaxed">
            {video.tipo === "simulacion"
              ? "Simulación interactiva PhET de la Universidad de Colorado. Funciona 100% offline. Explora, experimenta y aprende."
              : video.tipo === "modulo"
              ? "Juego educativo interactivo de EduConect Rural. Disponible sin conexión a internet."
              : "Este recurso está disponible en el almacenamiento local del dispositivo. Puedes usarlo sin conexión a internet."}
          </p>

          <div className="flex gap-2">
            {hasUrl ? (
              <a
                href={video.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-2.5 px-4 bg-primary text-primary-foreground rounded-lg font-medium text-sm hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
              >
                Abrir {tipoLabel.toLowerCase()}
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            ) : (
              <button
                onClick={handleClose}
                className="flex-1 py-2.5 px-4 bg-muted text-muted-foreground rounded-lg font-medium text-sm"
              >
                No disponible offline
              </button>
            )}
            <button
              onClick={handleClose}
              className="py-2.5 px-4 border border-border rounded-lg font-medium text-sm hover:bg-muted transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
