import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { ApiClientError } from '../../src/api/client';
import { useAuth } from '../../src/auth/AuthContext';
import { leerMeta, listarServicios, type ServicioLocal } from '../../src/db/repository';
import { META_LAST_SYNC, sincronizarCatalogos, sincronizarFotosPendientes } from '../../src/sync/sync';

const ESTATUS_LABEL: Record<string, string> = {
  pendiente: 'Pendiente',
  en_proceso: 'En proceso',
  completo: 'Completo',
  cancelado: 'Cancelado',
};

export default function ServiciosScreen() {
  const db = useSQLiteContext();
  const { token, tecnico, logout } = useAuth();
  const router = useRouter();

  const [servicios, setServicios] = useState<ServicioLocal[]>([]);
  const [ultimaSync, setUltimaSync] = useState<string | null>(null);
  const [sincronizando, setSincronizando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const cargarDesdeLocal = useCallback(async () => {
    const [lista, meta] = await Promise.all([listarServicios(db), leerMeta(db, META_LAST_SYNC)]);
    setServicios(lista);
    setUltimaSync(meta);
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      cargarDesdeLocal();
    }, [cargarDesdeLocal])
  );

  async function sincronizar() {
    if (!token) return;
    setSincronizando(true);
    setAviso(null);
    try {
      const resultadoFotos = await sincronizarFotosPendientes(db, token);
      await sincronizarCatalogos(db, token);
      await cargarDesdeLocal();
      if (resultadoFotos.subidas > 0 || resultadoFotos.fallidas > 0) {
        setAviso(
          `Fotos subidas: ${resultadoFotos.subidas}${resultadoFotos.fallidas ? ` · pendientes: ${resultadoFotos.fallidas}` : ''}`
        );
      }
    } catch (err) {
      setAviso(err instanceof ApiClientError ? err.message : 'No se pudo sincronizar. Se reintentará después.');
    } finally {
      setSincronizando(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.saludo}>Hola, {tecnico?.nombre}</Text>
          <Text style={styles.sync}>
            {ultimaSync ? `Última sync: ${new Date(ultimaSync).toLocaleString()}` : 'Sin sincronizar todavía'}
          </Text>
        </View>
        <Pressable onPress={logout}>
          <Text style={styles.salir}>Salir</Text>
        </Pressable>
      </View>

      {aviso && <Text style={styles.aviso}>{aviso}</Text>}

      <FlatList
        data={servicios}
        keyExtractor={(s) => String(s.id)}
        contentContainerStyle={styles.lista}
        refreshControl={<RefreshControl refreshing={sincronizando} onRefresh={sincronizar} />}
        ListEmptyComponent={
          <Text style={styles.vacio}>
            {sincronizando ? 'Sincronizando…' : 'Sin servicios asignados. Desliza hacia abajo para sincronizar.'}
          </Text>
        }
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={() => router.push(`/servicios/${item.id}`)}>
            <Text style={styles.folio}>{item.folio}</Text>
            <Text style={styles.nombre}>{item.nombre}</Text>
            <Text style={styles.estatus}>{ESTATUS_LABEL[item.estatus] ?? item.estatus}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  saludo: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  sync: { fontSize: 12, color: '#64748b', marginTop: 2 },
  salir: { color: '#ef4444', fontWeight: '600' },
  aviso: { backgroundColor: '#fef9c3', color: '#854d0e', padding: 10, textAlign: 'center' },
  lista: { padding: 16, gap: 12, flexGrow: 1 },
  vacio: { textAlign: 'center', color: '#64748b', marginTop: 40 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  folio: { fontSize: 12, color: '#2563eb', fontWeight: '700' },
  nombre: { fontSize: 16, fontWeight: '600', color: '#0f172a', marginTop: 4 },
  estatus: { fontSize: 13, color: '#64748b', marginTop: 4 },
});
