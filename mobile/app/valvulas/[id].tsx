import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert, FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Etapa } from '../../src/api/types';
import { getValvula } from '../../src/api/client';
import { useAuth } from '../../src/auth/AuthContext';
import {
  actualizarEstatusValvulaLocal,
  guardarFotosDeServidor,
  listarEtapas,
  listarFotosDeValvula,
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
        setFotos(await listarFotosDeValvula(db, valvulaId));
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

  const fotosDeEtapa = fotos.filter((f) => f.etapa_id === etapaSeleccionada);

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
          const totalEnEtapa = fotos.filter((f) => f.etapa_id === item.id).length;
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
              <Image source={{ uri: item.file_uri }} style={styles.miniatura} />
            ) : (
              <View style={[styles.miniatura, styles.miniaturaRemota]}>
                <Text style={styles.miniaturaRemotaTexto}>☁︎</Text>
              </View>
            )}
            {item.sync_status === 'pendiente' && <Text style={styles.badgePendiente}>Pendiente</Text>}
            {item.sync_status === 'error' && <Text style={styles.badgeError}>Error</Text>}
          </View>
        )}
      />

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
  miniaturaRemota: { alignItems: 'center', justifyContent: 'center' },
  miniaturaRemotaTexto: { fontSize: 24, color: colors.placeholder },
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
