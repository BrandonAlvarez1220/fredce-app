import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
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
      <Text style={styles.titulo}>FredceApp</Text>
      <Text style={styles.subtitulo}>Captura de servicio de válvulas</Text>

      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Usuario"
          autoCapitalize="none"
          autoCorrect={false}
          value={usuario}
          onChangeText={setUsuario}
        />
        <TextInput
          style={styles.input}
          placeholder="Contraseña"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable style={styles.boton} onPress={onSubmit} disabled={cargando}>
          {cargando ? <ActivityIndicator color="#fff" /> : <Text style={styles.botonTexto}>Entrar</Text>}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#0f172a' },
  titulo: { fontSize: 32, fontWeight: '700', color: '#fff', textAlign: 'center' },
  subtitulo: { fontSize: 14, color: '#94a3b8', textAlign: 'center', marginTop: 4, marginBottom: 32 },
  form: { gap: 12 },
  input: {
    backgroundColor: '#1e293b',
    color: '#fff',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
  },
  boton: {
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  botonTexto: { color: '#fff', fontSize: 16, fontWeight: '600' },
  error: { color: '#f87171', textAlign: 'center' },
});
