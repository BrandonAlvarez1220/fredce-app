import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ApiClientError, cancelarVacaciones, marcarVacacionesVistas } from '../../src/api/client';
import type { VacacionEstatus } from '../../src/api/types';
import { useAuth } from '../../src/auth/AuthContext';
import { colors } from '../../src/theme';
import { useVacaciones } from '../../src/vacaciones/VacacionesContext';

const ESTATUS: Record<VacacionEstatus, { texto: string; color: string }> = {
  solicitada: { texto: 'Solicitada', color: colors.advertencia },
  aprobada: { texto: 'Aprobada', color: '#16a34a' },
  rechazada: { texto: 'Rechazada', color: colors.error },
  cancelada: { texto: 'Cancelada', color: colors.textoSecundario },
};

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const DIA_MS = 24 * 60 * 60 * 1000;
/** Días de hoy (local) a una fecha AAAA-MM-DD; solo para decidir si mostrar el aviso. */
function diasHasta(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  const hoy = new Date();
  return Math.round((new Date(y, m - 1, d).getTime() - new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).getTime()) / DIA_MS);
}

function fechaCorta(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MESES[m - 1]} ${y}`;
}

export default function VacacionesScreen() {
  const { token } = useAuth();
  const { disponible, mensajeNoDisponible, data, error, refresh } = useVacaciones();
  const router = useRouter();
  // Ids resaltados como "nuevo": se congelan al abrir la pantalla, porque
  // marcar como vistas apaga el aviso en el servidor pero el técnico todavía
  // tiene que poder ver cuáles eran.
  const [nuevos, setNuevos] = useState<Set<number>>(new Set());

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const res = await refresh();
        if (res && res.sin_ver > 0 && token) {
          setNuevos(new Set(res.solicitudes.filter((s) => s.nuevo).map((s) => s.id)));
          try {
            await marcarVacacionesVistas(token);
            await refresh();
          } catch {
            // sin señal: se reintenta la próxima vez que abra la pantalla
          }
        }
      })();
    }, [refresh, token])
  );

  function confirmarCancelar(id: number) {
    Alert.alert('Cancelar solicitud', '¿Seguro que quieres cancelar esta solicitud?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Sí, cancelar',
        style: 'destructive',
        onPress: async () => {
          if (!token) return;
          try {
            await cancelarVacaciones(token, id);
          } catch (err) {
            Alert.alert('No se pudo cancelar', err instanceof ApiClientError ? err.message : 'Error desconocido');
          }
          await refresh();
        },
      },
    ]);
  }

  if (!disponible || !data) {
    return (
      <View style={styles.centro}>
        <Text style={styles.vacio}>
          {error ?? mensajeNoDisponible ?? (disponible ? 'Cargando…' : 'Vacaciones no está disponible para tu cuenta.')}
        </Text>
      </View>
    );
  }

  const { saldo, solicitudes } = data;

  return (
    <ScrollView contentContainerStyle={styles.contenido}>
      <View style={styles.card}>
        <Text style={styles.label}>Puedes solicitar</Text>
        <Text style={styles.grande}>
          {saldo.solicitable} <Text style={styles.unidad}>días hábiles</Text>
        </Text>
        <Text style={styles.detalle}>
          Derecho {saldo.derecho} · Tomados {saldo.tomado}
          {saldo.ajustes !== 0 ? ` · Ajustes ${saldo.ajustes}` : ''} · Pendientes {saldo.pendientes} · Disponibles{' '}
          {saldo.disponible}
        </Text>
        <Text style={styles.detalle}>
          {saldo.anios_servicio} año{saldo.anios_servicio === 1 ? '' : 's'} de servicio
          {saldo.proximo_aniversario
            ? ` · próximo aniversario ${fechaCorta(saldo.proximo_aniversario)}` +
              (saldo.dias_proximo_aniversario !== null ? ` (en ${saldo.dias_proximo_aniversario} días)` : '')
            : ''}
        </Text>
      </View>

      {saldo.por_vencer && diasHasta(saldo.por_vencer.fecha) <= 120 && (
        <View style={styles.aviso}>
          <Text style={styles.avisoTexto}>
            {saldo.por_vencer.dias} día{saldo.por_vencer.dias === 1 ? '' : 's'} sin usar vence{saldo.por_vencer.dias === 1 ? '' : 'n'} el{' '}
            {fechaCorta(saldo.por_vencer.fecha)}.
          </Text>
        </View>
      )}

      {saldo.bloques && saldo.bloques.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.label}>Tus bloques vigentes</Text>
          {saldo.bloques.map((b) => (
            <Text key={b.anio} style={styles.detalle}>
              Año {b.anio} · quedan {b.restan} de {b.dias} · vencen el {fechaCorta(b.vence)}
            </Text>
          ))}
        </View>
      )}

      <Pressable style={styles.boton} onPress={() => router.push('/vacaciones/solicitar')}>
        <Text style={styles.botonTexto}>Solicitar vacaciones</Text>
      </Pressable>

      {error && <Text style={styles.errorTexto}>{error}. Mostrando lo último guardado.</Text>}

      <Text style={styles.seccion}>Mis solicitudes</Text>
      {solicitudes.length === 0 && <Text style={styles.vacio}>Todavía no has hecho solicitudes.</Text>}
      {solicitudes.map((s) => {
        const est = ESTATUS[s.estatus];
        const resaltada = nuevos.has(s.id);
        return (
          <View key={s.id} style={[styles.solicitud, resaltada && styles.solicitudNueva]}>
            <View style={styles.solicitudTop}>
              <Text style={[styles.estatus, { color: est.color }]}>{est.texto}</Text>
              {resaltada && <Text style={styles.nuevo}>NUEVO</Text>}
            </View>
            <Text style={styles.rango}>
              {fechaCorta(s.inicio)}
              {s.fin !== s.inicio ? ` – ${fechaCorta(s.fin)}` : ''}
            </Text>
            <Text style={styles.detalle}>
              {s.dias} día{s.dias === 1 ? '' : 's'} hábil{s.dias === 1 ? '' : 'es'}
            </Text>
            {s.comentario ? <Text style={styles.detalle}>Tu comentario: {s.comentario}</Text> : null}
            {s.respuesta ? <Text style={styles.respuesta}>Respuesta: {s.respuesta}</Text> : null}
            {s.estatus === 'solicitada' && (
              <Pressable onPress={() => confirmarCancelar(s.id)}>
                <Text style={styles.cancelar}>Cancelar solicitud</Text>
              </Pressable>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: colors.fondo },
  contenido: { padding: 16, gap: 12, backgroundColor: colors.fondo, flexGrow: 1 },
  card: { backgroundColor: colors.tarjeta, borderRadius: 12, borderWidth: 1, borderColor: colors.borde, padding: 16, gap: 4 },
  label: { fontSize: 12, fontWeight: '600', color: colors.textoSecundario },
  grande: { fontSize: 32, fontWeight: '700', color: colors.texto },
  unidad: { fontSize: 14, fontWeight: '500', color: colors.textoSecundario },
  detalle: { fontSize: 12, color: colors.textoSecundario },
  aviso: { backgroundColor: '#fef3c7', borderWidth: 1, borderColor: colors.advertencia, borderRadius: 10, padding: 12 },
  avisoTexto: { fontSize: 13, color: '#92400e', fontWeight: '600' },
  boton: { backgroundColor: colors.naranja, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  botonTexto: { color: '#fff', fontWeight: '700', fontSize: 15 },
  errorTexto: { fontSize: 12, color: colors.error },
  seccion: { fontSize: 14, fontWeight: '700', color: colors.texto, marginTop: 8 },
  vacio: { textAlign: 'center', color: colors.textoSecundario },
  solicitud: { backgroundColor: colors.tarjeta, borderRadius: 12, borderWidth: 1, borderColor: colors.borde, padding: 14, gap: 3 },
  solicitudNueva: { borderColor: colors.naranja, borderWidth: 2 },
  solicitudTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  estatus: { fontSize: 13, fontWeight: '700' },
  nuevo: { fontSize: 10, fontWeight: '800', color: '#fff', backgroundColor: colors.naranja, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  rango: { fontSize: 16, fontWeight: '600', color: colors.texto },
  respuesta: { fontSize: 13, color: colors.texto, marginTop: 2 },
  cancelar: { color: colors.error, fontWeight: '600', fontSize: 13, marginTop: 6 },
});
