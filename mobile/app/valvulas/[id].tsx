import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert, FlatList, Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Etapa } from '../../src/api/types';
import { descargarImagenFoto, getValvula } from '../../src/api/client';
import { useAuth } from '../../src/auth/AuthContext';
import {
  actualizarEstatusValvulaLocal,
  eliminarFotoDeLocal,
  guardarArchivoFotoRemota,
  guardarFotosDeServidor,
  listarEtapas,
  listarFotosDeValvula,
  marcarFotoParaEliminar,
  obtenerValvula,
  type EstatusValvula,
  type FotoLocal,
  type ValvulaLocal,
} from '../../src/db/repository';
import { useSync } from '../../src/sync/SyncContext';
import { colors } from '../../src/theme';

const ESTATUS_OPCIONES: {
  valor: EstatusValvula;
  etiqueta: string;
  icono: keyof typeof Ionicons.glyphMap;
}[] = [
  { valor: 'pendiente', etiqueta: 'Pendiente', icono: 'time-outline' },
  { valor: 'en_proceso', etiqueta: 'En proceso', icono: 'construct-outline' },
  { valor: 'completo', etiqueta: 'Completa', icono: 'checkmark-circle' },
];

export default function ValvulaDetalleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const valvulaId = Number(id);
  const db = useSQLiteContext();
  const router = useRouter();
  const { token } = useAuth();
  const { syncNow } = useSync();

  const [valvula, setValvula] = useState<ValvulaLocal | null>(null);
  const [etapas, setEtapas] = useState<Etapa[]>([]);
  const [etapaSeleccionada, setEtapaSeleccionada] = useState<number | null>(null);
  const [fotos, setFotos] = useState<FotoLocal[]>([]);
  // Solo mientras se mantiene presionada una miniatura, para "espiar" el
  // detalle — no es una vista que haya que cerrar aparte, al soltar
  // desaparece sola (mismo patrón que WhatsApp/galería nativa).
  const [fotoAmpliada, setFotoAmpliada] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    const [v, es, fs] = await Promise.all([
      obtenerValvula(db, valvulaId),
      listarEtapas(db),
      listarFotosDeValvula(db, valvulaId),
    ]);
    setValvula(v);
    setEtapas(es);
    setFotos(fs);
    setEtapaSeleccionada((actual) => actual ?? es[0]?.id ?? null);

    // Best-effort: si hay señal, trae fotos que otros técnicos hayan subido
    // para esta válvula. Si falla (sin señal), no interrumpe nada — se
    // sigue mostrando lo que ya hay en local.
    if (token) {
      try {
        const detalle = await getValvula(valvulaId, token);
        await guardarFotosDeServidor(db, valvulaId, detalle.fotos);
        const locales = await listarFotosDeValvula(db, valvulaId);
        setFotos(locales);

        // Fotos de otros técnicos: sin archivo local, se bajan una por una
        // (y quedan en disco, así la próxima vez ya no se piden).
        const sinArchivo = new Set(locales.filter((f) => !f.file_uri && f.server_id).map((f) => f.server_id));
        let descargo = false;
        for (const f of detalle.fotos) {
          if (!f.tiene_imagen || !sinArchivo.has(f.id)) continue;
          try {
            await guardarArchivoFotoRemota(db, f.id, await descargarImagenFoto(f.id, token));
            descargo = true;
          } catch {
            // 404 (servidor viejo / aún sin subir) o sin señal: sigue el placeholder
          }
        }
        if (descargo) setFotos(await listarFotosDeValvula(db, valvulaId));
      } catch {
        // sin señal o error del servidor: se ignora, offline-first
      }
    }
  }, [db, valvulaId, token]);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar])
  );

  async function cambiarEstatus(nuevo: EstatusValvula) {
    if (!valvula || valvula.estatus === nuevo) return;
    setValvula({ ...valvula, estatus: nuevo, estatus_sync_pendiente: 1 }); // optimista
    await actualizarEstatusValvulaLocal(db, valvulaId, nuevo);
    syncNow(); // intenta confirmarlo ya mismo si hay señal; si no, queda pendiente
  }

  // Marcar como completa es la acción con más peso (cierra el trabajo en
  // esa válvula) — pedir confirmación evita que se marque por accidente con
  // un toque de más, a diferencia de pendiente/en_proceso que son estados
  // de trabajo normales y se cambian libremente.
  function onPressEstatus(opcion: (typeof ESTATUS_OPCIONES)[number]) {
    if (!valvula || valvula.estatus === opcion.valor) return;
    if (opcion.valor === 'completo') {
      Alert.alert(
        'Marcar como completa',
        `¿${valvula.codigo} ya está lista? Podrás seguir agregando fotos después si hace falta.`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Confirmar', onPress: () => cambiarEstatus('completo') },
        ]
      );
    } else {
      cambiarEstatus(opcion.valor);
    }
  }

  // 'eliminar_pendiente' se oculta de inmediato al confirmar el borrado —
  // no espera a que el servidor lo confirme para desaparecer de la vista.
  const fotosDeEtapa = fotos.filter(
    (f) => f.etapa_id === etapaSeleccionada && f.sync_status !== 'eliminar_pendiente'
  );

  function onEliminarFoto(foto: FotoLocal) {
    Alert.alert('Eliminar foto', '¿Seguro que quieres borrar esta foto? No se puede deshacer.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          if (foto.sync_status === 'subida') {
            // ya está en el servidor: se oculta ya, se confirma con la API en el siguiente sync
            await marcarFotoParaEliminar(db, foto.id);
          } else {
            // nunca llegó a subir (pendiente/error): se puede borrar de una vez, sin servidor de por medio
            await eliminarFotoDeLocal(db, foto.id);
          }
          setFotos(await listarFotosDeValvula(db, valvulaId));
          syncNow();
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.header}>
        <Text style={styles.codigo}>{valvula?.codigo}</Text>
      </View>

      {/* Cómo se marca que ya se terminó con la válvula (antes no había
          forma de cambiar esto desde la app, solo se veía "Pendiente"). */}
      <View style={styles.estatusCard}>
        <View style={styles.estatusEncabezado}>
          <Text style={styles.estatusLabel}>ESTATUS DE LA VÁLVULA</Text>
          {valvula?.estatus_sync_pendiente === 1 && (
            <Text style={styles.estatusGuardando}>Guardando…</Text>
          )}
        </View>
        <View style={styles.segmentado}>
          {ESTATUS_OPCIONES.map((op) => {
            const activo = valvula?.estatus === op.valor;
            return (
              <Pressable
                key={op.valor}
                style={[styles.segmento, activo && styles.segmentoActivo]}
                onPress={() => onPressEstatus(op)}
              >
                <Ionicons name={op.icono} size={15} color={activo ? '#fff' : colors.textoSecundario} />
                <Text style={[styles.segmentoTexto, activo && styles.segmentoTextoActivo]}>{op.etiqueta}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <FlatList
        horizontal
        style={styles.chipsContenedor}
        data={etapas}
        keyExtractor={(e) => String(e.id)}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
        renderItem={({ item }) => {
          const activo = item.id === etapaSeleccionada;
          // Mismo filtro que fotosDeEtapa (abajo): una foto marcada
          // 'eliminar_pendiente' ya desapareció de la cuadrícula al
          // instante, pero seguía contando aquí hasta que el borrado se
          // confirmaba con el servidor — el chip quedaba con un número
          // viejo mientras tanto (bug reportado por Brandon 2026-09-13).
          const totalEnEtapa = fotos.filter(
            (f) => f.etapa_id === item.id && f.sync_status !== 'eliminar_pendiente'
          ).length;
          return (
            <Pressable
              style={[styles.chip, activo && styles.chipActivo]}
              onPress={() => setEtapaSeleccionada(item.id)}
            >
              <Text style={[styles.chipTexto, activo && styles.chipTextoActivo]}>
                {item.nombre}
                {totalEnEtapa > 0 ? ` (${totalEnEtapa})` : ''}
              </Text>
            </Pressable>
          );
        }}
      />

      <FlatList
        style={styles.gridContenedor}
        data={fotosDeEtapa}
        keyExtractor={(f) => f.client_uuid}
        numColumns={3}
        contentContainerStyle={styles.grid}
        ListEmptyComponent={
          <Text style={styles.vacio}>Sin fotos en esta etapa todavía. Usa el botón + para tomar la primera.</Text>
        }
        renderItem={({ item }) => (
          <View style={styles.celda}>
            {item.file_uri ? (
              <Pressable
                style={styles.miniatura}
                onLongPress={() => setFotoAmpliada(item.file_uri)}
                onPressOut={() => setFotoAmpliada(null)}
                delayLongPress={300}
              >
                <Image source={{ uri: item.file_uri }} style={styles.miniatura} />
              </Pressable>
            ) : (
              <View style={[styles.miniatura, styles.miniaturaRemota]}>
                <Text style={styles.miniaturaRemotaTexto}>☁︎</Text>
              </View>
            )}
            <Pressable style={styles.botonBorrar} onPress={() => onEliminarFoto(item)} hitSlop={8}>
              <Ionicons name="close" size={14} color="#fff" />
            </Pressable>
            {item.sync_status === 'pendiente' && <Text style={styles.badgePendiente}>Pendiente</Text>}
            {item.sync_status === 'error' && (
              <Pressable
                onPress={() =>
                  Alert.alert('No se pudo subir', item.sync_error ?? 'Error desconocido. Se reintenta solo.')
                }
              >
                <Text style={styles.badgeError}>Error (toca para ver)</Text>
              </Pressable>
            )}
          </View>
        )}
      />

      {/* Vista ampliada al mantener presionada una miniatura — se cierra
          sola al soltar, no requiere ningún gesto ni botón para cerrarla. */}
      <Modal visible={fotoAmpliada !== null} transparent animationType="fade">
        <View style={styles.modalFondo} pointerEvents="none">
          {fotoAmpliada && (
            <Image source={{ uri: fotoAmpliada }} style={styles.modalImagen} resizeMode="contain" />
          )}
        </View>
      </Modal>

      {/* FAB en vez de la barra completa de antes: al no ir pegado al borde
          (margen de 24 + la propia SafeAreaView), no depende de calcular
          bien el inset exacto de cada teléfono para no quedar tapado. */}
      <Pressable
        style={styles.fab}
        disabled={etapaSeleccionada === null}
        onPress={() => router.push(`/valvulas/${valvulaId}/camara?etapaId=${etapaSeleccionada}`)}
      >
        <Ionicons name="add" size={32} color="#fff" />
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.fondo },
  header: { padding: 16, backgroundColor: colors.tarjeta, borderBottomWidth: 1, borderBottomColor: colors.borde },
  codigo: { fontSize: 16, fontWeight: '700', color: colors.texto },
  estatusCard: {
    margin: 12,
    marginBottom: 4,
    padding: 12,
    borderRadius: 14,
    backgroundColor: colors.tarjeta,
    borderWidth: 1,
    borderColor: colors.borde,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
  },
  estatusEncabezado: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  estatusLabel: { fontSize: 11, fontWeight: '700', color: colors.textoSecundario, letterSpacing: 0.5 },
  estatusGuardando: { fontSize: 11, color: colors.naranja, fontWeight: '600' },
  segmentado: {
    flexDirection: 'row',
    backgroundColor: colors.fondo,
    borderRadius: 10,
    padding: 3,
    gap: 3,
  },
  segmento: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 9,
    borderRadius: 8,
  },
  segmentoActivo: {
    backgroundColor: colors.naranja,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
  },
  segmentoTexto: { fontSize: 12, fontWeight: '600', color: colors.textoSecundario },
  segmentoTextoActivo: { color: '#fff' },
  // FlatList sin `style` (solo contentContainerStyle) hereda flexGrow y se
  // estira a ocupar todo el espacio disponible del padre — por eso los chips
  // se veían gigantes. flexGrow:0 + altura fija lo evita.
  chipsContenedor: { flexGrow: 0, height: 48 },
  chips: { paddingHorizontal: 12, alignItems: 'center', gap: 6 },
  gridContenedor: { flex: 1 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: colors.borde,
    marginRight: 6,
  },
  chipActivo: { backgroundColor: colors.naranja },
  chipTexto: { color: '#334155', fontSize: 12, fontWeight: '600' },
  chipTextoActivo: { color: '#fff' },
  grid: { padding: 8, paddingBottom: 112, flexGrow: 1 }, // espacio para que el FAB no tape la última fila
  vacio: { textAlign: 'center', color: colors.textoSecundario, marginTop: 40, paddingHorizontal: 24 },
  celda: { flex: 1 / 3, aspectRatio: 1, padding: 4 },
  miniatura: { flex: 1, borderRadius: 8, backgroundColor: colors.borde },
  modalFondo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' },
  modalImagen: { width: '100%', height: '80%' },
  miniaturaRemota: { alignItems: 'center', justifyContent: 'center' },
  miniaturaRemotaTexto: { fontSize: 24, color: colors.placeholder },
  botonBorrar: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgePendiente: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
    backgroundColor: colors.advertencia,
    color: '#fff',
    fontSize: 10,
    textAlign: 'center',
    borderRadius: 4,
  },
  badgeError: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
    backgroundColor: colors.error,
    color: '#fff',
    fontSize: 10,
    textAlign: 'center',
    borderRadius: 4,
  },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 40,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.naranja,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
});
