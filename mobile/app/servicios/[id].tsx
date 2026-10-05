import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { obtenerServicio, listarValvulasDeServicio, type ServicioLocal, type ValvulaLocal } from '../../src/db/repository';
import { useSync } from '../../src/sync/SyncContext';
import { colors } from '../../src/theme';

const ESTATUS_LABEL: Record<string, string> = {
  pendiente: 'Pendiente',
  en_proceso: 'En proceso',
  completo: 'Completa',
};

export default function ServicioDetalleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const servicioId = Number(id);
  const db = useSQLiteContext();
  const router = useRouter();

  const [servicio, setServicio] = useState<ServicioLocal | null>(null);
  const [valvulas, setValvulas] = useState<ValvulaLocal[]>([]);

  const { lastSyncAt } = useSync();

  const cargar = useCallback(async () => {
    const [s, vs] = await Promise.all([
      obtenerServicio(db, servicioId),
      listarValvulasDeServicio(db, servicioId),
    ]);
    setServicio(s);
    setValvulas(vs);
  }, [db, servicioId]);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar])
  );

  // Releer cuando termina un sync (puede traer válvulas o estatus nuevos).
  useEffect(() => {
    if (lastSyncAt) cargar();
  }, [lastSyncAt, cargar]);

  return (
    <View style={styles.container}>
      {servicio && (
        <View style={styles.header}>
          <Text style={styles.folio}>{servicio.folio}</Text>
          <Text style={styles.nombre}>{servicio.nombre}</Text>
        </View>
      )}

      <FlatList
        data={valvulas}
        keyExtractor={(v) => String(v.id)}
        contentContainerStyle={styles.lista}
        ListEmptyComponent={<Text style={styles.vacio}>Este servicio no tiene válvulas registradas.</Text>}
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={() => router.push(`/valvulas/${item.id}`)}>
            <Text style={styles.codigo}>{item.codigo}</Text>
            <View style={styles.filaInfo}>
              <Text style={styles.estatus}>{ESTATUS_LABEL[item.estatus] ?? item.estatus}</Text>
              <Text style={styles.fotos}>{item.total_fotos} foto{item.total_fotos === 1 ? '' : 's'}</Text>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.fondo },
  header: { padding: 16, backgroundColor: colors.tarjeta, borderBottomWidth: 1, borderBottomColor: colors.borde },
  folio: { fontSize: 11, color: colors.naranja, fontWeight: '700' },
  nombre: { fontSize: 16, fontWeight: '700', color: colors.texto, marginTop: 2 },
  lista: { padding: 12, gap: 8, flexGrow: 1 },
  vacio: { textAlign: 'center', color: colors.textoSecundario, marginTop: 40 },
  card: {
    backgroundColor: colors.tarjeta,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.borde,
  },
  codigo: { fontSize: 14, fontWeight: '600', color: colors.texto },
  filaInfo: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  estatus: { fontSize: 12, color: colors.textoSecundario },
  fotos: { fontSize: 12, color: colors.naranja, fontWeight: '600' },
});
