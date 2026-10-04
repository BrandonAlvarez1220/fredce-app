import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ApiClientError, calcularVacaciones, solicitarVacaciones } from '../../src/api/client';
import type { VacacionesCalculo } from '../../src/api/types';
import { useAuth } from '../../src/auth/AuthContext';
import { colors } from '../../src/theme';
import Calendario, { aIso } from '../../src/vacaciones/Calendario';
import { useVacaciones } from '../../src/vacaciones/VacacionesContext';

export default function SolicitarVacacionesScreen() {
  const { token } = useAuth();
  const { data, refresh } = useVacaciones();
  const router = useRouter();

  const [inicio, setInicio] = useState<string | null>(null);
  const [fin, setFin] = useState<string | null>(null);
  const [comentario, setComentario] = useState('');
  const [calculo, setCalculo] = useState<VacacionesCalculo | null>(null);
  const [errorCalculo, setErrorCalculo] = useState<string | null>(null);
  const [calculando, setCalculando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null);

  const hoy = useMemo(() => aIso(new Date()), []);
  const festivos = useMemo(() => new Set((data?.festivos ?? []).map((f) => f.fecha)), [data]);
  const saldo = data?.saldo;

  // Vista previa: los días siempre los calcula el servidor.
  useEffect(() => {
    setCalculo(null);
    setErrorCalculo(null);
    setErrorEnvio(null);
    if (!token || !inicio || !fin) return;
    let vigente = true;
    setCalculando(true);
    calcularVacaciones(token, inicio, fin)
      .then((r) => vigente && setCalculo(r))
      .catch((e) => vigente && setErrorCalculo(e instanceof ApiClientError ? e.message : 'No se pudo calcular'))
      .finally(() => vigente && setCalculando(false));
    return () => {
      vigente = false;
    };
  }, [token, inicio, fin]);

  const puedeEnviar = !!calculo && calculo.alcanza && calculo.dias >= 1 && !enviando;

  async function enviar() {
    if (!token || !inicio || !fin) return;
    setEnviando(true);
    setErrorEnvio(null);
    try {
      await solicitarVacaciones(token, { inicio, fin, ...(comentario.trim() ? { comentario: comentario.trim() } : {}) });
      await refresh();
      router.back();
    } catch (e) {
      setErrorEnvio(e instanceof ApiClientError ? e.message : 'No se pudo enviar la solicitud');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.contenido} keyboardShouldPersistTaps="handled">
        {saldo && (
          <Text style={styles.nota}>
            Puedes solicitar hasta {saldo.solicitable} días hábiles. Sábados, domingos y festivos no se descuentan.
          </Text>
        )}
        {saldo && saldo.derecho === 0 && saldo.proximo_aniversario && (
          <Text style={styles.nota}>Aún no tienes días: tu próximo aniversario es el {saldo.proximo_aniversario}.</Text>
        )}

        <Calendario
          inicio={inicio}
          fin={fin}
          festivos={festivos}
          minFecha={hoy}
          onChange={(i, f) => {
            setInicio(i);
            setFin(f);
          }}
        />

        <View style={styles.resumen}>
          {!inicio ? (
            <Text style={styles.nota}>Toca el primer día de tus vacaciones.</Text>
          ) : !fin ? (
            <Text style={styles.nota}>Toca el último día (el mismo día si es solo uno).</Text>
          ) : calculando ? (
            <ActivityIndicator />
          ) : errorCalculo ? (
            <Text style={styles.error}>{errorCalculo}</Text>
          ) : calculo ? (
            <>
              <Text style={styles.dias}>
                Serían {calculo.dias} día{calculo.dias === 1 ? '' : 's'} hábil{calculo.dias === 1 ? '' : 'es'}
              </Text>
              {calculo.festivos.length > 0 && (
                <Text style={styles.nota}>
                  Festivos que no cuentan: {calculo.festivos.map((f) => f.nombre).join(', ')}
                </Text>
              )}
              {!calculo.alcanza && (
                <Text style={styles.error}>
                  {calculo.motivo ?? `Solo puedes solicitar ${calculo.solicitable} días hábiles.`}
                </Text>
              )}
            </>
          ) : null}
        </View>

        <Text style={styles.label}>Comentario (opcional)</Text>
        <TextInput
          style={styles.input}
          value={comentario}
          onChangeText={setComentario}
          maxLength={500}
          multiline
          placeholder="Ej. viaje familiar"
          placeholderTextColor={colors.placeholder}
        />

        {errorEnvio && <Text style={styles.error}>{errorEnvio}</Text>}

        <Pressable style={[styles.boton, !puedeEnviar && styles.botonOff]} disabled={!puedeEnviar} onPress={enviar}>
          {enviando ? <ActivityIndicator color="#fff" /> : <Text style={styles.botonTexto}>Enviar solicitud</Text>}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  contenido: { padding: 16, gap: 12, backgroundColor: colors.fondo, flexGrow: 1 },
  nota: { fontSize: 12, color: colors.textoSecundario },
  error: { fontSize: 13, color: colors.error },
  resumen: { gap: 4, minHeight: 40, justifyContent: 'center' },
  dias: { fontSize: 18, fontWeight: '700', color: colors.texto },
  label: { fontSize: 12, fontWeight: '600', color: colors.textoSecundario },
  input: {
    backgroundColor: colors.tarjeta,
    borderWidth: 1,
    borderColor: colors.borde,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: colors.texto,
    minHeight: 70,
    textAlignVertical: 'top',
  },
  boton: { backgroundColor: colors.naranja, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  botonOff: { opacity: 0.4 },
  botonTexto: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
