import { requireOptionalNativeModule } from 'expo';

type QuitarFondoNativo = {
  estaDisponible(): boolean;
  quitarFondoAsync(uri: string): Promise<string | null>;
};

// "Optional" a propósito: en Expo Go o en un build anterior a este módulo
// el código nativo no existe, y la app debe seguir funcionando igual (solo
// sin el interruptor) en vez de tronar al abrir la cámara.
const nativo = requireOptionalNativeModule<QuitarFondoNativo>('QuitarFondo');

/** true si este build y este sistema operativo pueden quitar fondos. */
export function quitarFondoDisponible(): boolean {
  return nativo?.estaDisponible() ?? false;
}

/**
 * Devuelve el uri de una copia de la foto con el fondo en blanco (JPEG), o
 * null si el modelo no encontró un sujeto claro. Lanza si el modelo no está
 * disponible (p. ej. aún no se descarga en Android).
 */
export async function quitarFondo(uri: string): Promise<string | null> {
  if (!nativo) return null;
  return nativo.quitarFondoAsync(uri);
}
