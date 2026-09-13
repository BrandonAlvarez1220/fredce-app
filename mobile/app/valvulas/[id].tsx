import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
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

const ESTATUS_OPCIONES: { valor: EstatusValvula; etiqueta: string }[] = [
  { valor: 'pendiente', etiqueta: 'Pendiente' },
  { valor: 'en_proceso', etiqueta: 'En proceso' },
  { valor: 'completo', etiqueta: 'Completa' },
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

  const fotosDeEtapa = fotos.filter((f) => f.etapa_id === etapaSeleccionada);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.header}>
        <Text style={styles.codigo}>{valvula?.codigo}</Text>
      </View>

      {/* Cómo se marca que ya se terminó con la válvula (antes no había
          forma de cambiar esto desde la app, solo se veía "Pendiente"). */}
      <View style={styles.estatusFila}>
        {ESTATUS_OPCIONES.map((op) => {
          const activo = valvula?.estatus === op.valor;
          return (
            <Pressable
              key={op.valor}
              style={[styles.estatusBoton, activo && styles.estatusBotonActivo]}
              onPress={() => cambiarEstatus(op.valor)}
            >
              <Text style={[styles.estatusTexto, activo && styles.estatusTextoActivo]}>{op.etiqueta}</Text>
            </Pressable>
          );
        })}
        {valvula?.estatus_sync_pendiente === 1 && <Text style={styles.estatusPendienteIcono}>⏳</Text>}
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
  estatusFila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.tarjeta,
    borderBottomWidth: 1,
    borderBottomColor: colors.borde,
  },
  estatusBoton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.borde,
    alignItems: 'center',
  },
  estatusBotonActivo: { backgroundColor: colors.naranja },
  estatusTexto: { fontSize: 12, fontWeight: '600', color: '#334155' },
  estatusTextoActivo: { color: '#fff' },
  estatusPendienteIcono: { fontSize: 14 },
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
  grid: { padding: 8, paddingBottom: 96, flexGrow: 1 }, // espacio para que el FAB no tape la última fila
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
    bottom: 24,
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
