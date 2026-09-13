import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ApiClientError } from '../src/api/client';
import { useAuth } from '../src/auth/AuthContext';
import { colors } from '../src/theme';

export default function LoginScreen() {
  const { login } = useAuth();
  const router = useRouter();
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [verPassword, setVerPassword] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit() {
    if (!usuario.trim() || !password) {
      setError('Escribe tu usuario y contraseña.');
      return;
    }
    setError(null);
    setCargando(true);
    try {
      await login(usuario.trim(), password);
      router.replace('/servicios');
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'No se pudo iniciar sesión.');
    } finally {
      setCargando(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* El wordmark del logo es Navy sobre transparente — necesita una
            base clara detrás para no perderse contra el fondo oscuro de
            marca, sea cual sea ese fondo. */}
        <View style={styles.logoCard}>
          <Image source={require('../assets/logo.png')} style={styles.logo} resizeMode="contain" />
        </View>
        <Text style={styles.subtitulo}>Captura de servicio de válvulas</Text>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Usuario"
            placeholderTextColor={colors.placeholder}
            autoCapitalize="none"
            autoCorrect={false}
            value={usuario}
            onChangeText={setUsuario}
          />

          <View style={styles.inputConIcono}>
            <TextInput
              style={styles.inputTexto}
              placeholder="Contraseña"
              placeholderTextColor={colors.placeholder}
              secureTextEntry={!verPassword}
              value={password}
              onChangeText={setPassword}
            />
            <Pressable
              style={styles.iconoOjo}
              onPress={() => setVerPassword((v) => !v)}
              hitSlop={10}
            >
              <Ionicons
                name={verPassword ? 'eye-off' : 'eye'}
                size={22}
                color={colors.textoSecundario}
              />
            </Pressable>
          </View>

          {error && <Text style={styles.error}>{error}</Text>}

          <Pressable style={styles.boton} onPress={onSubmit} disabled={cargando}>
            {cargando ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.botonTexto}>Entrar</Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.fondoOscuro },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  logoCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignSelf: 'center',
    width: '100%',
  },
  logo: { width: '100%', height: 70 },
  subtitulo: { fontSize: 14, color: '#cbd5e1', textAlign: 'center', marginTop: 16, marginBottom: 32 },
  form: { gap: 12 },
  input: {
    backgroundColor: '#ffffff',
    color: colors.texto,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
  },
  inputConIcono: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 10,
  },
  inputTexto: {
    flex: 1,
    color: colors.texto,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
  },
  iconoOjo: { paddingHorizontal: 14 },
  boton: {
    backgroundColor: colors.gold,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  botonTexto: { color: '#fff', fontSize: 16, fontWeight: '700' },
  error: { color: '#fca5a5', textAlign: 'center' },
});
