import { Stack } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { Suspense } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '../src/auth/AuthContext';
import { migrateDbIfNeeded } from '../src/db/schema';
import { SyncProvider } from '../src/sync/SyncContext';
import { colors } from '../src/theme';

function CargandoBaseLocal() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator size="large" />
    </View>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <Suspense fallback={<CargandoBaseLocal />}>
        <SQLiteProvider databaseName="fredceapp.db" onInit={migrateDbIfNeeded} useSuspense>
          <AuthProvider>
            <SyncProvider>
              <Stack
                screenOptions={{
                  headerStyle: { backgroundColor: colors.oscuro },
                  headerTintColor: '#fff',
                  headerTitleStyle: { fontWeight: '600' },
                }}
              >
                <Stack.Screen name="index" options={{ headerShown: false }} />
                <Stack.Screen name="login" options={{ headerShown: false }} />
                <Stack.Screen name="servicios/index" options={{ title: 'Mis servicios' }} />
                <Stack.Screen name="servicios/[id]" options={{ title: 'Servicio' }} />
                <Stack.Screen name="valvulas/[id]" options={{ title: 'Válvula' }} />
                {/* Pantalla normal (no modal): en Android, los modales a
                    veces no propagan bien los safe-area insets, que es
                    justo lo que necesitamos aquí para no tapar el botón
                    de disparo con la barra de navegación del sistema. */}
                <Stack.Screen
                  name="valvulas/[id]/camara"
                  options={{ headerShown: false, animation: 'slide_from_bottom' }}
                />
              </Stack>
            </SyncProvider>
          </AuthProvider>
        </SQLiteProvider>
      </Suspense>
    </SafeAreaProvider>
  );
}
