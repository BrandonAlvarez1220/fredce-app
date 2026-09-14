import Constants from 'expo-constants';

/**
 * URL base de la API de técnico. Vive en app.json → expo.extra.apiBaseUrl
 * para poder cambiarla en un solo lugar (LAN hoy, HostGator después) sin
 * tocar código. Ver docs/spec.md del repo raíz para el estado de la
 * integración con generador-facturas.
 */
export const API_BASE_URL: string =
  (Constants.expoConfig?.extra?.apiBaseUrl as string | undefined) ??
  'http://192.168.0.13:8000/api/tecnico';

/** Cuánto tiempo (ms) esperar una respuesta antes de considerar "sin señal". */
export const REQUEST_TIMEOUT_MS = 15000;

/**
 * Timeout específico para subir fotos — más generoso que el de las llamadas
 * JSON livianas, porque incluso comprimida (~200-500KB, ver camara.tsx)
 * sigue siendo el request más pesado, justo en el escenario de señal débil
 * en campo que le importa a esta app.
 */
export const UPLOAD_TIMEOUT_MS = 45000;
