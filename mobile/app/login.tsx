import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
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
      <Image source={require('../assets/logo.png')} style={styles.logo} resizeMode="contain" />
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
        <TextInput
          style={styles.input}
          placeholder="Contraseña"
          placeholderTextColor={colors.placeholder}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable style={styles.boton} onPress={onSubmit} disabled={cargando}>
          {cargando ? (
            <ActivityIndicator color={colors.navy} />
          ) : (
            <Text style={styles.botonTexto}>Entrar</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: colors.navy },
  logo: { width: '80%', height: 90, alignSelf: 'center' },
  subtitulo: { fontSize: 14, color: '#cbd5e1', textAlign: 'center', marginTop: 8, marginBottom: 32 },
  form: { gap: 12 },
  input: {
    backgroundColor: '#ffffff',
    color: colors.texto,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
  },
  boton: {
    backgroundColor: colors.gold,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  botonTexto: { color: colors.navy, fontSize: 16, fontWeight: '700' },
  error: { color: '#fca5a5', textAlign: 'center' },
});
