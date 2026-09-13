import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { obtenerServicio, listarValvulasDeServicio, type ServicioLocal, type ValvulaLocal } from '../../src/db/repository';

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

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const [s, vs] = await Promise.all([
          obtenerServicio(db, servicioId),
          listarValvulasDeServicio(db, servicioId),
        ]);
        setServicio(s);
        setValvulas(vs);
      })();
    }, [db, servicioId])
  );

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
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  folio: { fontSize: 12, color: '#2563eb', fontWeight: '700' },
  nombre: { fontSize: 18, fontWeight: '700', color: '#0f172a', marginTop: 2 },
  lista: { padding: 16, gap: 12, flexGrow: 1 },
  vacio: { textAlign: 'center', color: '#64748b', marginTop: 40 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  codigo: { fontSize: 16, fontWeight: '600', color: '#0f172a' },
  filaInfo: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  estatus: { fontSize: 13, color: '#64748b' },
  fotos: { fontSize: 13, color: '#2563eb', fontWeight: '600' },
});
