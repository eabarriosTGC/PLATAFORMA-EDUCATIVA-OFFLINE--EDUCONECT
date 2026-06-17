"use client"

import { useEffect } from "react"
import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import { QuickAccessGrid } from "@/components/quick-access-grid"
import { ContinuarEstudiando } from "@/components/continuar-estudiando"
import { VideoGrid } from "@/components/video-grid"
import { LibraryPreview } from "@/components/library-preview"
import { CursosView } from "@/components/cursos-view"
import { BibliotecaView } from "@/components/biblioteca-view"
import { ProgresoView } from "@/components/progreso-view"
import { YouTubeRuralView } from "@/components/youtube-rural-view"
import { ProfesoresView } from "@/components/profesores-view"
import { VideoModal } from "@/components/video-modal"
import { AppProvider, useAppState } from "@/lib/app-state"
import { getCursos, getProgreso } from "@/lib/api"

function DashboardContent() {
  const {
    activeView, selectedVideo, setSelectedVideo,
    setCursos, setProgreso, setLoadingCursos, setErrorCursos,
    usuario,
  } = useAppState()

  // Fetch cursos al montar
  useEffect(() => {
    getCursos()
      .then((data) => {
        setCursos(data)
        setLoadingCursos(false)
      })
      .catch((err) => {
        setErrorCursos(err.message)
        setLoadingCursos(false)
      })

    // Fetch progreso del estudiante por defecto
    getProgreso(usuario)
      .then((data) => setProgreso(data))
      .catch(() => {}) // silencioso
  }, [usuario, setCursos, setProgreso, setLoadingCursos, setErrorCursos])

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main className="lg:pl-72">
        <Header studentName="Estudiante" isOnline={true} />

        <div className="p-4 sm:p-6 space-y-8 max-w-7xl">
          {activeView === "cursos" && <CursosView />}
          {activeView === "biblioteca" && <BibliotecaView />}
          {activeView === "progreso" && <ProgresoView />}
          {activeView === "videos" && <VideoGrid showAll />}
          {activeView === "youtube" && <YouTubeRuralView />}
          {activeView === "profesores" && <ProfesoresView />}

          {(activeView === "dashboard" || activeView === "videos") && (
            <>
              <ContinuarEstudiando />
              <QuickAccessGrid />
              {activeView === "dashboard" && <VideoGrid />}
              <LibraryPreview />
            </>
          )}
        </div>

        <footer className="mt-12 p-4 sm:p-6 border-t border-border">
          <div className="max-w-7xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-sm text-muted-foreground">
            <p>
              © 2026 EduConect Rural - Plataforma Educativa Offline
            </p>
            <p className="text-xs">
              Diseñado para escuelas rurales colombianas 🇨🇴
            </p>
          </div>
        </footer>
      </main>

      {selectedVideo && (
        <VideoModal video={selectedVideo} onClose={() => setSelectedVideo(null)} />
      )}
    </div>
  )
}

export default function DashboardPage() {
  return (
    <AppProvider>
      <DashboardContent />
    </AppProvider>
  )
}
