/**
 * Paleta de marca de FREDCE — CONFIRMADA por Brandon 2026-09-13: Negro +
 * Naranja, la del sitio público real (fredce.com), sin azul. Ambos valores
 * se tomaron con `getComputedStyle` directo del sitio (no a ojo):
 * fondo `rgb(10,10,11)`, botón principal `rgb(232,92,26)`.
 *
 * `navy` existió en una versión anterior (se pensó que era la paleta
 * "oficial" por el color del wordmark del logo) — ya NO se usa como color
 * de interfaz (headers, chips, acentos). Se deja aquí solo por si algo del
 * logo original (assets/logo.png, pensado para fondo claro) lo necesita;
 * el resto de la app usa `oscuro` (chrome/estructura) y `naranja` (único
 * acento) — dos colores, no tres.
 */
export const colors = {
  oscuro: '#0A0A0B', // headers, fondo de pantallas oscuras (antes: navy)
  naranja: '#E85C1A', // único acento: botones, selección activa, texto destacado
  navy: '#1B2A4A', // legacy — no usar en UI nueva, ver nota arriba
  gold: '#E85C1A', // alias legacy de `naranja`, mismo valor — evita romper imports viejos
  fondoOscuro: '#0A0A0B', // alias legacy de `oscuro`
  fondo: '#f8fafc',
  tarjeta: '#ffffff',
  borde: '#e2e8f0',
  texto: '#0f172a',
  textoSecundario: '#64748b',
  placeholder: '#94a3b8',
  error: '#ef4444',
  advertencia: '#f59e0b',
};
