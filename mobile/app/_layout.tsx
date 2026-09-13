import { Stack } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { Suspense } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { AuthProvider } from '../src/auth/AuthContext';
import { migrateDbIfNeeded } from '../src/db/schema';

function CargandoBaseLocal() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator size="large" />
    </View>
  );
}

export default function RootLayout() {
  return (
    <Suspense fallback={<CargandoBaseLocal />}>
      <SQLiteProvider databaseName="fredceapp.db" onInit={migrateDbIfNeeded} useSuspense>
        <AuthProvider>
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: '#0f172a' },
              headerTintColor: '#fff',
              headerTitleStyle: { fontWeight: '600' },
            }}
          >
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="login" options={{ headerShown: false }} />
            <Stack.Screen name="servicios/index" options={{ title: 'Mis servicios' }} />
            <Stack.Screen name="servicios/[id]" options={{ title: 'Servicio' }} />
            <Stack.Screen name="valvulas/[id]" options={{ title: 'Válvula' }} />
            <Stack.Screen
              name="valvulas/[id]/camara"
              options={{ presentation: 'fullScreenModal', headerShown: false }}
            />
          </Stack>
        </AuthProvider>
      </SQLiteProvider>
    </Suspense>
  );
}
