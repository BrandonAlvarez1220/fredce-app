import { File } from 'expo-file-system';
import { API_BASE_URL, REQUEST_TIMEOUT_MS, UPLOAD_TIMEOUT_MS } from '../config';
import type {
  ApiError,
  Etapa,
  LoginResponse,
  Servicio,
  SubirFotoResponse,
  ValvulaDetalle,
  VacacionesCalculo,
  VacacionesResumen,
} from './types';

export class ApiClientError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = 'ApiClientError';
  }
}

// MySQL DATETIME no acepta el ISO 8601 de `Date.toISOString()` (T, ms, Z).
function aFechaMysql(iso: string): string {
  return iso.slice(0, 19).replace('T', ' ');
}

async function request<T>(
  path: string,
  options: {
    method?: string;
    token?: string;
    json?: unknown;
    form?: FormData;
    timeoutMs?: number;
  } = {}
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? REQUEST_TIMEOUT_MS);

  const headers: Record<string, string> = {};
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  if (options.json !== undefined) headers['Content-Type'] = 'application/json';

  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.json !== undefined ? JSON.stringify(options.json) : options.form,
      signal: controller.signal,
    });

    const body = (await res.json().catch(() => ({}))) as T & Partial<ApiError>;

    if (!res.ok) {
      throw new ApiClientError(body.error ?? `Error HTTP ${res.status}`, res.status);
    }
    return body as T;
  } catch (err) {
    if (err instanceof ApiClientError) throw err;
    if (err instanceof Error && err.name === 'AbortError') {
      throw new ApiClientError('Sin respuesta del servidor (tiempo agotado)', 0);
    }
    throw new ApiClientError('No hay conexión con el servidor', 0);
  } finally {
    clearTimeout(timeout);
  }
}

export function login(
  usuario: string,
  password: string,
  deviceIdentifier: string,
  deviceName?: string
): Promise<LoginResponse> {
  return request<LoginResponse>('/auth/login', {
    method: 'POST',
    json: { usuario, password, device_identifier: deviceIdentifier, device_name: deviceName },
  });
}

export function getEtapas(token: string): Promise<{ etapas: Etapa[] }> {
  return request('/etapas', { token });
}

export function getServicios(token: string): Promise<{ servicios: Servicio[] }> {
  return request('/servicios', { token });
}

export function getValvula(id: number, token: string): Promise<ValvulaDetalle> {
  return request(`/valvulas/${id}`, { token });
}

/**
 * NOTA: este endpoint todavía no existe del lado de generador-facturas —
 * propuesto a FredceSistema (2026-09-13) para poder marcar una válvula como
 * "en_proceso"/"completo" desde la app. Mientras no lo implementen, esta
 * llamada falla (404) y `sincronizarEstatusValvulas` simplemente la
 * reintenta en el siguiente sync — el cambio queda guardado local mientras
 * tanto (ver `actualizarEstatusValvulaLocal`), no se pierde.
 */
export function actualizarEstatusValvula(
  id: number,
  estatus: 'pendiente' | 'en_proceso' | 'completo',
  token: string
): Promise<{ id: number; estatus: string }> {
  return request(`/valvulas/${id}/estatus`, { method: 'PUT', token, json: { estatus } });
}

/**
 * NOTA: igual que actualizarEstatusValvula, este endpoint todavía no existe
 * del lado de generador-facturas — propuesto 2026-09-13 para poder borrar
 * una foto ya subida (mala, repetida, etc). Mientras no exista, la foto
 * queda oculta en la app (ver `sync_status='eliminar_pendiente'`) pero
 * técnicamente sigue en el servidor/Drive hasta que se implemente.
 */
export function eliminarFoto(serverId: number, token: string): Promise<Record<string, unknown>> {
  return request(`/fotos/${serverId}`, { method: 'DELETE', token });
}

/**
 * Sube una foto ya capturada y guardada localmente. Idempotente por
 * clientUuid: reintentar la misma subida (p.ej. tras perder señal a medio
 * camino) es seguro, el servidor regresa el registro existente.
 */
export async function subirFoto(
  token: string,
  params: {
    clientUuid: string;
    valvulaId: number;
    etapaId: number;
    fechaCaptura: string;
    fileUri: string;
    etiquetaLibre?: string | null;
    orden?: number | null;
  }
): Promise<SubirFotoResponse> {
  const form = new FormData();
  form.append('client_uuid', params.clientUuid);
  form.append('valvula_id', String(params.valvulaId));
  form.append('etapa_id', String(params.etapaId));
  form.append('fecha_captura', aFechaMysql(params.fechaCaptura));
  if (params.etiquetaLibre) form.append('etiqueta_libre', params.etiquetaLibre);
  if (params.orden !== undefined && params.orden !== null) form.append('orden', String(params.orden));
  form.append('file', new File(params.fileUri));

  // Timeout más largo que el resto de llamadas (JSON, livianas): incluso
  // comprimida (ver camara.tsx), una foto sigue siendo el request más
  // pesado de la app, justo en el escenario de señal débil que le importa
  // a este flujo — 15s era optimista para eso.
  return request('/fotos', { method: 'POST', token, form, timeoutMs: UPLOAD_TIMEOUT_MS });
}

// Vacaciones. 403 = la cuenta no tiene vacaciones (externo, fuera del padrón,
// etc.); el mensaje del servidor viene listo para mostrar. La app nunca manda
// id de persona: el servidor la deduce del token.

export async function getVacaciones(token: string): Promise<VacacionesResumen> {
  return (await request<{ data: VacacionesResumen }>('/vacaciones', { token })).data;
}

export function marcarVacacionesVistas(token: string): Promise<unknown> {
  return request('/vacaciones/vistas', { method: 'POST', token });
}

export async function calcularVacaciones(token: string, inicio: string, fin: string): Promise<VacacionesCalculo> {
  return (await request<{ data: VacacionesCalculo }>(`/vacaciones/calcular?inicio=${inicio}&fin=${fin}`, { token })).data;
}

export function solicitarVacaciones(
  token: string,
  params: { inicio: string; fin: string; comentario?: string }
): Promise<unknown> {
  return request('/vacaciones', { method: 'POST', token, json: params });
}

export function cancelarVacaciones(token: string, id: number): Promise<unknown> {
  return request(`/vacaciones/${id}/cancelar`, { method: 'PUT', token });
}
