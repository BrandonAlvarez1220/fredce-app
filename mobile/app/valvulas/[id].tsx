import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Etapa } from '../../src/api/types';
import { getValvula } from '../../src/api/client';
import { useAuth } from '../../src/auth/AuthContext';
import {
  guardarFotosDeServidor,
  listarEtapas,
  listarFotosDeValvula,
  obtenerValvula,
  type FotoLocal,
  type ValvulaLocal,
} from '../../src/db/repository';

export default function ValvulaDetalleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const valvulaId = Number(id);
  const db = useSQLiteContext();
  const router = useRouter();
  const { token } = useAuth();

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

  const fotosDeEtapa = fotos.filter((f) => f.etapa_id === etapaSeleccionada);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.codigo}>{valvula?.codigo}</Text>
      </View>

      <FlatList
        horizontal
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
        data={fotosDeEtapa}
        keyExtractor={(f) => f.client_uuid}
        numColumns={3}
        contentContainerStyle={styles.grid}
        ListEmptyComponent={
          <Text style={styles.vacio}>Sin fotos en esta etapa todavía. Usa el botón de cámara para tomar la primera.</Text>
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

      <Pressable
        style={styles.botonCamara}
        disabled={etapaSeleccionada === null}
        onPress={() => router.push(`/valvulas/${valvulaId}/camara?etapaId=${etapaSeleccionada}`)}
      >
        <Text style={styles.botonCamaraTexto}>📷 Tomar foto</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  codigo: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  chips: { padding: 12, gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#e2e8f0',
    marginRight: 8,
  },
  chipActivo: { backgroundColor: '#2563eb' },
  chipTexto: { color: '#334155', fontSize: 13, fontWeight: '600' },
  chipTextoActivo: { color: '#fff' },
  grid: { padding: 8, flexGrow: 1 },
  vacio: { textAlign: 'center', color: '#64748b', marginTop: 40, paddingHorizontal: 24 },
  celda: { flex: 1 / 3, aspectRatio: 1, padding: 4 },
  miniatura: { flex: 1, borderRadius: 8, backgroundColor: '#e2e8f0' },
  miniaturaRemota: { alignItems: 'center', justifyContent: 'center' },
  miniaturaRemotaTexto: { fontSize: 24, color: '#94a3b8' },
  badgePendiente: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
    backgroundColor: '#f59e0b',
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
    backgroundColor: '#ef4444',
    color: '#fff',
    fontSize: 10,
    textAlign: 'center',
    borderRadius: 4,
  },
  botonCamara: {
    margin: 16,
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  botonCamaraTexto: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
