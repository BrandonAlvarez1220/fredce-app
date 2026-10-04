import { Stack, useRouter, useSegments } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { Suspense, useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../src/auth/AuthContext';
import { migrateDbIfNeeded } from '../src/db/schema';
import { SyncProvider } from '../src/sync/SyncContext';
import { BotonMenu, MenuProvider } from '../src/menu/MenuLateral';
import { colors } from '../src/theme';
import { VacacionesProvider } from '../src/vacaciones/VacacionesContext';

function CargandoBaseLocal() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator size="large" />
    </View>
  );
}

/**
 * Antes, "Salir" limpiaba el token pero no navegaba a ningún lado — si ya
 * estabas dentro de /servicios te quedabas ahí viendo la misma pantalla,
 * como si el botón no hiciera nada. Este guard corre en cada cambio de
 * sesión/ruta y fuerza la navegación a /login apenas el token desaparece
 * (logout, o en el futuro una expiración de sesión), sin importar en qué
 * pantalla del stack estés parado.
 */
function AuthGate() {
  const { token, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    const enLogin = segments[0] === 'login';
    if (!token && !enLogin) {
      router.replace('/login');
    }
  }, [token, isLoading, segments, router]);

  return null;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <Suspense fallback={<CargandoBaseLocal />}>
        <SQLiteProvider databaseName="fredceapp.db" onInit={migrateDbIfNeeded} useSuspense>
          <AuthProvider>
            <SyncProvider>
              <VacacionesProvider>
              <MenuProvider>
              <AuthGate />
              <Stack
                screenOptions={{
                  headerStyle: { backgroundColor: colors.oscuro },
                  headerTintColor: '#fff',
                  headerTitleStyle: { fontWeight: '600' },
                }}
              >
                <Stack.Screen name="index" options={{ headerShown: false }} />
                <Stack.Screen name="login" options={{ headerShown: false }} />
                <Stack.Screen name="servicios/index" options={{ title: 'Mis servicios', headerLeft: () => <BotonMenu /> }} />
                <Stack.Screen name="servicios/[id]" options={{ title: 'Servicio' }} />
                <Stack.Screen name="valvulas/[id]" options={{ title: 'Válvula' }} />
                <Stack.Screen name="convertidor" options={{ title: 'Convertidor', headerLeft: () => <BotonMenu /> }} />
                <Stack.Screen name="vacaciones/index" options={{ title: 'Vacaciones', headerLeft: () => <BotonMenu /> }} />
                <Stack.Screen name="vacaciones/solicitar" options={{ title: 'Solicitar vacaciones' }} />
                {/* Pantalla normal (no modal): en Android, los modales a
                    veces no propagan bien los safe-area insets, que es
                    justo lo que necesitamos aquí para no tapar el botón
                    de disparo con la barra de navegación del sistema. */}
                <Stack.Screen
                  name="valvulas/[id]/camara"
                  options={{ headerShown: false, animation: 'slide_from_bottom' }}
                />
              </Stack>
              </MenuProvider>
              </VacacionesProvider>
            </SyncProvider>
          </AuthProvider>
        </SQLiteProvider>
      </Suspense>
    </SafeAreaProvider>
  );
}
