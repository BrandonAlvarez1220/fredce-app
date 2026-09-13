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
  drive_file_id: string | null;
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
  drive_file_id: string | null;
  ya_existia: boolean;
}

export interface ApiError {
  error: string;
}
