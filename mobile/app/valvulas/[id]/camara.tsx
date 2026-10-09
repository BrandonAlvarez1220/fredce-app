import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Crypto from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { agregarMarca, quitarFondo, quitarFondoDisponible } from '../../../modules/quitar-fondo';
import { encolarFoto } from '../../../src/db/repository';
import { useSync } from '../../../src/sync/SyncContext';
import { colors } from '../../../src/theme';

const CARPETA_FOTOS = 'fredceapp_fotos';

// 1600px de lado mayor + 75% de calidad JPEG deja una foto perfectamente
// legible para el reporte (no es fotografía de producto, es documentación
// de servicio) mientras mantiene el archivo predeciblemente ligero — el
// punto es justo subirla desde plantas con señal débil. Antes de esto, el
// tamaño dependía por completo de los megapixeles del teléfono (un celular
// reciente fácil saca 3-8MB por foto); un fix del lado del servidor
// (subir upload_max_filesize) resolvió el síntoma inmediato, pero esto
// ataca la causa: subir menos datos siempre, sin importar la cámara.
const LADO_MAYOR_PX = 1600;
const CALIDAD_JPEG = 0.75;

async function comprimirFoto(uriOriginal: string): Promise<string> {
  const contexto = ImageManipulator.manipulate(uriOriginal);
  contexto.resize({ width: LADO_MAYOR_PX, height: null });
  const renderizada = await contexto.renderAsync();
  const resultado = await renderizada.saveAsync({ format: SaveFormat.JPEG, compress: CALIDAD_JPEG });
  return resultado.uri;
}

async function guardarFotoPermanente(uriTemporal: string): Promise<string> {
  const archivo = new File(uriTemporal);
  const carpeta = new Directory(Paths.document, CARPETA_FOTOS);
  if (!carpeta.exists) {
    await carpeta.create({ intermediates: true });
  }
  await archivo.move(carpeta);
  return archivo.uri;
}

// Se recuerda mientras la app esté abierta: esta pantalla se vuelve a
// montar en cada cambio de etapa y sería molesto re-activarlo cada vez.
let quitarFondoRecordado = false;

export default function CamaraScreen() {
  const { id, etapaId } = useLocalSearchParams<{ id: string; etapaId: string }>();
  const valvulaId = Number(id);
  const etapaIdNum = Number(etapaId);
  const db = useSQLiteContext();
  const router = useRouter();
  const { syncNow, refreshPendingCount } = useSync();

  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [capturando, setCapturando] = useState(false);
  const [tomadasEnRafaga, setTomadasEnRafaga] = useState(0);
  // El hardware de la cámara tarda un poco en estar listo tras montar la
  // vista — disparar antes de eso es la causa típica del CodedError
  // "Failed to capture image" que reportó Brandon (intermitente, "mientras
  // probaba subir fotos en distintas categorías": cada cambio de etapa
  // vuelve a montar esta pantalla). onCameraReady lo evita de raíz.
  const [camaraLista, setCamaraLista] = useState(false);
  // Falso en Expo Go, en builds anteriores al módulo nativo y en iOS < 17:
  // ahí el interruptor ni se muestra.
  const [puedeQuitarFondo] = useState(quitarFondoDisponible);
  const [sinFondo, setSinFondo] = useState(() => puedeQuitarFondo && quitarFondoRecordado);
  const [aviso, setAviso] = useState<string | null>(null);
  const avisoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function mostrarAviso(texto: string) {
    if (avisoTimer.current) clearTimeout(avisoTimer.current);
    setAviso(texto);
    avisoTimer.current = setTimeout(() => setAviso(null), 3000);
  }

  function alternarSinFondo() {
    const nuevo = !sinFondo;
    quitarFondoRecordado = nuevo;
    setSinFondo(nuevo);
  }

  if (!permission) {
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={[styles.container, styles.centrado]}>
        <Text style={styles.mensaje}>Se necesita permiso de cámara para tomar fotos de la válvula.</Text>
        <Pressable style={styles.botonPrincipal} onPress={requestPermission}>
          <Text style={styles.botonPrincipalTexto}>Dar permiso</Text>
        </Pressable>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.cancelar}>Cancelar</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  async function tomarFoto() {
    if (!cameraRef.current || capturando || !camaraLista) return;
    setCapturando(true);
    try {
      // Calidad alta al capturar (queremos el detalle original); el tamaño
      // final que de verdad importa para la subida lo controla
      // comprimirFoto() justo abajo, de forma predecible sin importar los
      // megapixeles de la cámara del teléfono.
      const foto = await cameraRef.current.takePictureAsync({ quality: 0.9 });
      if (!foto) return;
      let uriComprimida = await comprimirFoto(foto.uri);
      if (sinFondo) {
        // Se procesa la versión ya comprimida (1600px): el modelo tarda
        // mucho menos que con la foto original de 12+ MP y el resultado
        // es igual de útil. Si falla, se guarda la foto normal — nunca se
        // pierde una foto por culpa del filtro.
        try {
          const uriSinFondo = await quitarFondo(uriComprimida);
          if (uriSinFondo) {
            new File(uriComprimida).delete();
            uriComprimida = uriSinFondo;
          } else {
            mostrarAviso('No se detectó la pieza: se guardó la foto normal');
          }
        } catch (err) {
          console.warn('[camara] error al quitar fondo', err);
          mostrarAviso('No se pudo quitar el fondo: se guardó la foto normal');
        }
      }
      // Marca de agua al final (después de quitar fondo, para que el
      // modelo no confunda el logo con parte del sujeto). Si falla, la foto
      // se guarda sin marca: preferible a perder la foto.
      try {
        const uriConMarca = await agregarMarca(uriComprimida);
        if (uriConMarca !== uriComprimida) {
          new File(uriComprimida).delete();
          uriComprimida = uriConMarca;
        }
      } catch (err) {
        console.warn('[camara] error al agregar marca de agua', err);
      }
      const uriFinal = await guardarFotoPermanente(uriComprimida);
      await encolarFoto(db, {
        clientUuid: Crypto.randomUUID(),
        valvulaId,
        etapaId: etapaIdNum,
        fileUri: uriFinal,
        fechaCaptura: new Date().toISOString(),
      });
      setTomadasEnRafaga((n) => n + 1);
      await refreshPendingCount();
      syncNow(); // intento silencioso en cuanto hay señal, sin bloquear la ráfaga
    } catch (err) {
      // Antes esto no se atrapaba: el CodedError de expo-camera ("Failed to
      // capture image", intermitente) subía como promesa sin manejar y
      // tronaba en silencio sin que el técnico supiera que esa foto no se
      // guardó (bug reportado por Brandon vía FredceSistema, 2026-09-13).
      console.warn('[camara] error al capturar', err);
      Alert.alert('No se pudo tomar la foto', 'Intenta de nuevo.');
    } finally {
      setCapturando(false);
    }
  }

  // A propósito NO se usa position:absolute + insets a mano para la barra
  // de controles: eso dependía de leer bien insets.bottom, y en la práctica
  // seguía quedando tapada por la barra de navegación de Android en algunos
  // dispositivos. En vez de eso, la barra vive en flujo normal (columna,
  // debajo de la cámara) dentro de un SafeAreaView — así es imposible que
  // el sistema la tape, sea cual sea el valor real del inset.
  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.zonaCamara}>
        <CameraView
          ref={cameraRef}
          style={styles.camara}
          facing="back"
          onCameraReady={() => setCamaraLista(true)}
        />
        {tomadasEnRafaga > 0 && (
          <View style={styles.overlaySuperior}>
            <Text style={styles.contador}>{tomadasEnRafaga} tomada(s)</Text>
          </View>
        )}
        {aviso && (
          <View style={styles.overlayInferior}>
            <Text style={styles.aviso}>{aviso}</Text>
          </View>
        )}
      </View>

      <View style={styles.barraControles}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.listo}>Listo</Text>
        </Pressable>

        <Pressable
          style={[styles.disparador, !camaraLista && styles.disparadorDeshabilitado]}
          onPress={tomarFoto}
          disabled={capturando || !camaraLista}
        />

        {puedeQuitarFondo ? (
          <Pressable
            style={[styles.interruptor, sinFondo && styles.interruptorActivo]}
            onPress={alternarSinFondo}
            disabled={capturando}
            hitSlop={8}
          >
            <Text style={[styles.interruptorTexto, sinFondo && styles.interruptorTextoActivo]}>
              Sin fondo
            </Text>
          </Pressable>
        ) : (
          <View style={{ width: 60 }} />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  centrado: { alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
  zonaCamara: { flex: 1 },
  camara: { flex: 1 },
  mensaje: { color: '#fff', textAlign: 'center', fontSize: 16 },
  botonPrincipal: { backgroundColor: colors.naranja, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 10 },
  botonPrincipalTexto: { color: '#fff', fontWeight: '700' },
  cancelar: { color: '#94a3b8' },
  overlaySuperior: { position: 'absolute', top: 12, alignSelf: 'center' },
  overlayInferior: { position: 'absolute', bottom: 12, left: 16, right: 16, alignItems: 'center' },
  aviso: { color: '#fff', fontSize: 13, backgroundColor: 'rgba(0,0,0,0.65)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, textAlign: 'center' },
  contador: { color: '#fff', fontSize: 14, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  // Barra de controles en flujo normal (no absoluta): siempre visible,
  // nunca puede quedar detrás de la barra de navegación del sistema.
  barraControles: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 32,
    paddingVertical: 20,
    backgroundColor: '#000',
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
  disparadorDeshabilitado: { opacity: 0.4 },
  interruptor: {
    width: 60,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#94a3b8',
    alignItems: 'center',
  },
  interruptorActivo: { backgroundColor: colors.naranja, borderColor: colors.naranja },
  interruptorTexto: { color: '#94a3b8', fontSize: 11, fontWeight: '600', textAlign: 'center' },
  interruptorTextoActivo: { color: '#fff' },
});
