import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

const KEY = 'fredceapp_device_identifier';

/**
 * Id estable del dispositivo, generado una sola vez y persistido. No usamos
 * un identificador de hardware real (evita permisos extra); un UUID propio
 * alcanza para lo que el backend necesita: distinguir dispositivos del mismo
 * técnico (spec: un técnico puede tener "dispositivo(s)").
 */
export async function getDeviceIdentifier(): Promise<string> {
  const existing = await SecureStore.getItemAsync(KEY);
  if (existing) return existing;

  const generated = Crypto.randomUUID();
  await SecureStore.setItemAsync(KEY, generated);
  return generated;
}
