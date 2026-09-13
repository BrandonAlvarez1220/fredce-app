/**
 * Paleta de marca de FREDCE.
 *
 * `navy` sale del logo (color del wordmark "FREDCE"). `naranja` se tomó
 * directamente del sitio real fredce.com (rgb(232,92,26) medido con
 * getComputedStyle del botón principal) — es más naranja que el "Gold
 * #F5A820" que se mencionó como paleta ya establecida; se usa este por ser
 * la fuente más autoritativa (el sitio público en vivo) y porque Brandon
 * autorizó tomarlo de ahí. Se mantiene el nombre `gold` en el código para
 * no tener que tocar cada uso, aunque el valor real es naranja.
 * `fondoOscuro` también sale del sitio (rgb(10,10,11), body background).
 */
export const colors = {
  navy: '#1B2A4A',
  navyClaro: '#28406e',
  gold: '#E85C1A', // naranja real de fredce.com, no dorado — ver nota arriba
  fondoOscuro: '#0A0A0B', // background real del sitio
  fondo: '#f8fafc',
  tarjeta: '#ffffff',
  borde: '#e2e8f0',
  texto: '#0f172a',
  textoSecundario: '#64748b',
  placeholder: '#94a3b8',
  error: '#ef4444',
  advertencia: '#f59e0b',
};
