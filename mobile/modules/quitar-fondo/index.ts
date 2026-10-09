import { requireOptionalNativeModule } from 'expo';
import { Asset } from 'expo-asset';

type QuitarFondoNativo = {
  estaDisponible(): boolean;
  quitarFondoAsync(uri: string): Promise<string | null>;
  agregarMarcaAsync(uri: string, logoUri: string): Promise<string>;
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

// El logo viaja empaquetado con el JS; expo-asset lo copia a un archivo
// local (file://) que el código nativo sí puede abrir. Se resuelve una
// sola vez y se reutiliza en todas las fotos.
let logoUriPromesa: Promise<string> | null = null;
function logoUri(): Promise<string> {
  logoUriPromesa ??= Asset.fromModule(require('../../assets/marca-agua.png'))
    .downloadAsync()
    .then((a) => {
      if (!a.localUri) throw new Error('No se pudo cargar el logo');
      return a.localUri;
    })
    .catch((err) => {
      logoUriPromesa = null; // permitir reintento en la siguiente foto
      throw err;
    });
  return logoUriPromesa;
}

/** Devuelve el uri de una copia de la foto con el logo en la esquina inferior derecha. */
export async function agregarMarca(uri: string): Promise<string> {
  if (!nativo) return uri;
  return nativo.agregarMarcaAsync(uri, await logoUri());
}
