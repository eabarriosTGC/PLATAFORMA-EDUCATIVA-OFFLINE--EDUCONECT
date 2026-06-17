export interface Curso {
  id: number;
  titulo: string;
  descripcion: string;
  categoria: string;
  archivo_path: string;
}

export interface Progreso {
  id: number;
  usuario: string;
  curso_id: number;
  porcentaje: number;
  ultima_vez: string;
}
