// src/types/index.ts
export type DificultadPreferida = 'fácil' | 'media' | 'difícil' | 'combinado'

export type Objetivo =
  | 'sin_restriccion'
  | 'bajar_peso'
  | 'mas_proteina'
  | 'vegetariano'
  | 'vegano'
  | 'sin_gluten'

export type Unidad = 'g' | 'kg' | 'ml' | 'l' | 'ud' | 'cucharada' | 'pizca'
export type Dificultad = 'fácil' | 'media' | 'difícil'
export type Franja = 'comida' | 'cena'
export type Dia =
  | 'lunes'
  | 'martes'
  | 'miercoles'
  | 'jueves'
  | 'viernes'
  | 'sabado'
  | 'domingo'

export interface Ingrediente {
  nombre: string
  cantidad: number
  unidad: Unidad
}

export interface Receta {
  nombre: string
  tiempo_prep: number
  dificultad: Dificultad
  descripcion_corta: string
  calorias_aprox: number
  ingredientes: Ingrediente[]
  pasos?: string[]
  tags: string[]
}

export interface OpcionesSlot {
  dia: Dia
  franja: Franja
  opciones: Receta[]
  error?: boolean
}

export interface Perfil {
  id?: string
  usuario_id?: string
  personas: number
  presupuesto: number
  codigo_postal: string
  supermercado: string
  objetivo: Objetivo
  dificultad_recetas: DificultadPreferida
  ingredientes_si: string[]
  ingredientes_no: string[]
  nevera: string[]
  zona_id?: string   // zona logística Mercadona resuelta del CP
}

export type ClaveMenu = `${Dia}_${Franja}`

export type MenuSemanal = Partial<Record<ClaveMenu, Receta>>

export interface ResultadoPrecio {
  ingrediente: string
  cantidad_necesaria: number
  unidad: string
  producto_mercadona?: string
  precio_envase?: number
  tamaño_envase?: number
  unidad_envase?: string
  envases_a_comprar?: number
  coste_real?: number
  sobrante?: number
  sin_precio: boolean
}

export const DIAS: Dia[] = [
  'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo',
]
export const DIAS_LABEL: Record<Dia, string> = {
  lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles',
  jueves: 'Jueves', viernes: 'Viernes', sabado: 'Sábado', domingo: 'Domingo',
}
export const FRANJAS: Franja[] = ['comida', 'cena']
