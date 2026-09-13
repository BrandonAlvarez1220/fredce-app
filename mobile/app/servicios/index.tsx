import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../../src/auth/AuthContext';
import { listarServicios, type ServicioLocal } from '../../src/db/repository';
import { useSync } from '../../src/sync/SyncContext';
import { colors } from '../../src/theme';

const ESTATUS_LABEL: Record<string, string> = {
  pendiente: 'Pendiente',
  en_proceso: 'En proceso',
  completo: 'Completo',
  cancelado: 'Cancelado',
};

export default function ServiciosScreen() {
  const db = useSQLiteContext();
  const { tecnico, logout } = useAuth();
  const { isSyncing, pendingCount, lastSyncAt, lastResult, lastError, syncNow } = useSync();
  const router = useRouter();

  const [servicios, setServicios] = useState<ServicioLocal[]>([]);

  const cargarDesdeLocal = useCallback(async () => {
    setServicios(await listarServicios(db));
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      cargarDesdeLocal();
    }, [cargarDesdeLocal])
  );

  async function onRefresh() {
    await syncNow();
    await cargarDesdeLocal();
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.saludo}>Hola, {tecnico?.nombre}</Text>
          <Text style={styles.sync}>
            {lastSyncAt ? `Última sync: ${new Date(lastSyncAt).toLocaleString()}` : 'Sin sincronizar todavía'}
          </Text>
        </View>
        <Pressable onPress={logout}>
          <Text style={styles.salir}>Salir</Text>
        </Pressable>
      </View>

      <View style={styles.barraSync}>
        <View style={{ flex: 1 }}>
          {pendingCount > 0 ? (
            <Text style={styles.pendientesTexto}>
              📤 {pendingCount} foto{pendingCount === 1 ? '' : 's'} por subir
            </Text>
          ) : (
            <Text style={styles.pendientesTextoOk}>✓ Todo subido</Text>
          )}
          {lastError && !isSyncing && <Text style={styles.avisoError}>{lastError}. Se reintenta solo.</Text>}
          {lastResult && lastResult.subidas > 0 && !isSyncing && (
            <Text style={styles.avisoOk}>Últimas subidas: {lastResult.subidas}</Text>
          )}
        </View>
        <Pressable style={styles.botonSync} onPress={() => syncNow()} disabled={isSyncing}>
          {isSyncing ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.botonSyncTexto}>Sincronizar ahora</Text>
          )}
        </Pressable>
      </View>

      <FlatList
        data={servicios}
        keyExtractor={(s) => String(s.id)}
        contentContainerStyle={styles.lista}
        refreshControl={<RefreshControl refreshing={isSyncing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <Text style={styles.vacio}>
            {isSyncing ? 'Sincronizando…' : 'Sin servicios asignados. Desliza hacia abajo para sincronizar.'}
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
  container: { flex: 1, backgroundColor: colors.fondo },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: colors.tarjeta,
    borderBottomWidth: 1,
    borderBottomColor: colors.borde,
  },
  saludo: { fontSize: 18, fontWeight: '700', color: colors.texto },
  sync: { fontSize: 12, color: colors.textoSecundario, marginTop: 2 },
  salir: { color: colors.error, fontWeight: '600' },
  barraSync: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    backgroundColor: colors.tarjeta,
    borderBottomWidth: 1,
    borderBottomColor: colors.borde,
  },
  pendientesTexto: { color: colors.advertencia, fontWeight: '700', fontSize: 13 },
  pendientesTextoOk: { color: '#16a34a', fontWeight: '600', fontSize: 13 },
  avisoError: { color: colors.textoSecundario, fontSize: 11, marginTop: 2 },
  avisoOk: { color: colors.textoSecundario, fontSize: 11, marginTop: 2 },
  botonSync: {
    backgroundColor: colors.gold,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 130,
    alignItems: 'center',
  },
  botonSyncTexto: { color: '#fff', fontWeight: '700', fontSize: 12 },
  lista: { padding: 16, gap: 12, flexGrow: 1 },
  vacio: { textAlign: 'center', color: colors.textoSecundario, marginTop: 40 },
  card: {
    backgroundColor: colors.tarjeta,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.borde,
  },
  folio: { fontSize: 12, color: colors.naranja, fontWeight: '700' },
  nombre: { fontSize: 16, fontWeight: '600', color: colors.texto, marginTop: 4 },
  estatus: { fontSize: 13, color: colors.textoSecundario, marginTop: 4 },
});
