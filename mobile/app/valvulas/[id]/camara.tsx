import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Crypto from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { encolarFoto } from '../../../src/db/repository';

const CARPETA_FOTOS = 'fredceapp_fotos';

async function guardarFotoPermanente(uriTemporal: string): Promise<string> {
  const archivo = new File(uriTemporal);
  const carpeta = new Directory(Paths.document, CARPETA_FOTOS);
  if (!carpeta.exists) {
    await carpeta.create({ intermediates: true });
  }
  await archivo.move(carpeta);
  return archivo.uri;
}

export default function CamaraScreen() {
  const { id, etapaId } = useLocalSearchParams<{ id: string; etapaId: string }>();
  const valvulaId = Number(id);
  const etapaIdNum = Number(etapaId);
  const db = useSQLiteContext();
  const router = useRouter();

  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [capturando, setCapturando] = useState(false);
  const [tomadasEnRafaga, setTomadasEnRafaga] = useState(0);

  if (!permission) {
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <View style={[styles.container, styles.centrado]}>
        <Text style={styles.mensaje}>Se necesita permiso de cámara para tomar fotos de la válvula.</Text>
        <Pressable style={styles.botonPrincipal} onPress={requestPermission}>
          <Text style={styles.botonPrincipalTexto}>Dar permiso</Text>
        </Pressable>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.cancelar}>Cancelar</Text>
        </Pressable>
      </View>
    );
  }

  async function tomarFoto() {
    if (!cameraRef.current || capturando) return;
    setCapturando(true);
    try {
      const foto = await cameraRef.current.takePictureAsync({ quality: 0.7 });
      if (!foto) return;
      const uriFinal = await guardarFotoPermanente(foto.uri);
      await encolarFoto(db, {
        clientUuid: Crypto.randomUUID(),
        valvulaId,
        etapaId: etapaIdNum,
        fileUri: uriFinal,
        fechaCaptura: new Date().toISOString(),
      });
      setTomadasEnRafaga((n) => n + 1);
    } finally {
      setCapturando(false);
    }
  }

  return (
    <View style={styles.container}>
      <CameraView ref={cameraRef} style={styles.camara} facing="back" />

      <View style={styles.overlaySuperior}>
        <Text style={styles.contador}>{tomadasEnRafaga > 0 ? `${tomadasEnRafaga} tomada(s)` : ''}</Text>
      </View>

      <View style={styles.overlayInferior}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.listo}>Listo</Text>
        </Pressable>

        <Pressable style={styles.disparador} onPress={tomarFoto} disabled={capturando} />

        <View style={{ width: 60 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  centrado: { alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
  camara: { flex: 1 },
  mensaje: { color: '#fff', textAlign: 'center', fontSize: 16 },
  botonPrincipal: { backgroundColor: '#2563eb', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 10 },
  botonPrincipalTexto: { color: '#fff', fontWeight: '600' },
  cancelar: { color: '#94a3b8' },
  overlaySuperior: { position: 'absolute', top: 50, alignSelf: 'center' },
  contador: { color: '#fff', fontSize: 14, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  overlayInferior: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 32,
  },
  listo: { color: '#fff', fontSize: 16, fontWeight: '600', width: 60 },
  disparador: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#fff',
    borderWidth: 4,
    borderColor: '#94a3b8',
  },
});
