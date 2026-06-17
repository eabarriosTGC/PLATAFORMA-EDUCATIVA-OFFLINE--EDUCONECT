import { Curso, Progreso } from "@/lib/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export async function getCursos(): Promise<Curso[]> {
  const res = await fetch(`${API_BASE}/api/cursos`);
  if (!res.ok) throw new Error(`Error al cargar cursos: ${res.status}`);
  return res.json();
}

export async function getCurso(id: number): Promise<Curso> {
  const res = await fetch(`${API_BASE}/api/cursos/${id}`);
  if (!res.ok) throw new Error(`Error al cargar curso ${id}: ${res.status}`);
  return res.json();
}

export async function saveProgreso(usuario: string, curso_id: number, porcentaje: number): Promise<void> {
  const res = await fetch(`${API_BASE}/api/progreso`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ usuario, curso_id, porcentaje }),
  });
  if (!res.ok) throw new Error(`Error al guardar progreso: ${res.status}`);
}

export async function getProgreso(usuario: string): Promise<Progreso[]> {
  const res = await fetch(`${API_BASE}/api/progreso/${encodeURIComponent(usuario)}`);
  if (!res.ok) throw new Error(`Error al cargar progreso: ${res.status}`);
  return res.json();
}

/** Resultado de búsqueda */
export interface SearchResult {
  tipo: string;
  id: number;
  titulo: string;
  descripcion: string;
  categoria: string;
}

/** GET /api/buscar?q=... — búsqueda full-text */
export async function buscar(query: string): Promise<SearchResult[]> {
  if (!query.trim()) return [];
  const res = await fetch(`${API_BASE}/api/buscar?q=${encodeURIComponent(query)}&limite=8`);
  if (!res.ok) throw new Error(`Error en búsqueda: ${res.status}`);
  return res.json();
}
