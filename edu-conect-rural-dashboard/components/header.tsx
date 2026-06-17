"use client"

import { WifiOff, CheckCircle } from "lucide-react"
import { BuscaGlobal } from "@/components/busca-global"

interface HeaderProps {
  studentName?: string
  isOnline?: boolean
}

export function Header({ studentName = "Estudiante", isOnline = false }: HeaderProps) {

  return (
    <header className="bg-card border-b border-border px-4 sm:px-6 py-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        {/* Título y nombre */}
        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-semibold text-foreground">
            <span className="text-balance">¡Hola, {studentName}!</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Bienvenido a tu Escuela Local
          </p>
        </div>

        {/* Buscador global */}
        <BuscaGlobal />

        {/* Estado de conexión */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
            isOnline ? "bg-accent text-accent-foreground" : "bg-primary/10 text-primary"
          }`}>
            {isOnline ? (
              <><CheckCircle className="w-4 h-4" /><span>Conectado</span></>
            ) : (
              <><WifiOff className="w-4 h-4" /><span>Modo Offline</span></>
            )}
          </div>
          <span className="text-xs text-muted-foreground hidden sm:inline">
            {isOnline ? "(Sin Internet)" : "(Sin conexión)"}
          </span>
        </div>
      </div>
    </header>
  )
}
