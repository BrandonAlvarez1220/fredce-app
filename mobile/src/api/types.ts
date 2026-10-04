// Tipos que reflejan los contratos ya validados end-to-end contra
// generador-facturas (ver memoria del proyecto / docs/spec.md).

export interface LoginResponse {
  token: string;
  expires_in: number;
  tecnico: { id: number; nombre: string };
}

export interface Etapa {
  id: number;
  nombre: string;
  orden: number;
}

export interface ValvulaResumen {
  id: number;
  codigo: string;
  estatus: 'pendiente' | 'en_proceso' | 'completo';
  total_fotos: number;
}

export interface Servicio {
  id: number;
  folio: string;
  nombre: string;
  fecha: string;
  estatus: 'pendiente' | 'en_proceso' | 'completo' | 'cancelado';
  valvulas: ValvulaResumen[];
}

export interface FotoServidor {
  id: number;
  client_uuid: string;
  etapa_id: number;
  onedrive_file_id: string | null;
  orden: number | null;
  etiqueta_libre: string | null;
  fecha_captura: string;
}

export interface ValvulaDetalle {
  valvula: {
    id: number;
    codigo: string;
    estatus: ValvulaResumen['estatus'];
    servicio_id: number;
  };
  fotos: FotoServidor[];
}

export interface SubirFotoResponse {
  id: number;
  onedrive_file_id: string | null;
  ya_existia: boolean;
}

export interface ApiError {
  error: string;
}

// Vacaciones (contrato cerrado con FredceControl, /api/tecnico/vacaciones*).
// El saldo y los días los calcula SIEMPRE el servidor; la app solo los muestra.

export interface VacacionesSaldo {
  anios_servicio: number;
  derecho: number;
  ajustes: number;
  tomado: number;
  pendientes: number;
  disponible: number;
  solicitable: number;
  proximo_aniversario: string | null;
  dias_proximo_aniversario: number | null;
}

export type VacacionEstatus = 'solicitada' | 'aprobada' | 'rechazada' | 'cancelada';

export interface VacacionSolicitud {
  id: number;
  dias: number;
  nuevo: boolean;
  inicio: string;
  fin: string;
  estatus: VacacionEstatus;
  comentario: string | null;
  respuesta: string | null;
  resuelta_en: string | null;
  created_at: string;
}

export interface Festivo {
  fecha: string;
  nombre: string;
}

export interface VacacionesResumen {
  saldo: VacacionesSaldo;
  solicitudes: VacacionSolicitud[];
  sin_ver: number;
  festivos: Festivo[];
}

export interface VacacionesCalculo {
  dias: number;
  festivos: Festivo[];
  solicitable: number;
  alcanza: boolean;
}
