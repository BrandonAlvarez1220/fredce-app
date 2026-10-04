import { usePathname, useRouter } from 'expo-router';
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { Animated, Dimensions, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthContext';
import { colors } from '../theme';
import { useVacaciones } from '../vacaciones/VacacionesContext';

/**
 * Menú lateral deslizable, sin dependencias nativas (Animated + PanResponder
 * de React Native; @react-navigation/drawer exigiría reanimated/gesture-handler
 * en package.json). Se abre con el botón ☰ del header o deslizando desde el
 * borde izquierdo, y solo en las pantallas de primer nivel (RUTAS): en las de
 * detalle (servicio, válvula, cámara) el header conserva su flecha de volver.
 */

const NOMBRE_APP = 'Fredce Campo';
const BORDE_PX = 16; // franja de la que se arrastra para abrir
const ALTO_HEADER = 56;

const RUTAS = ['/servicios', '/vacaciones', '/convertidor'] as const;

interface MenuContextValue {
  abrir: () => void;
}
const MenuContext = createContext<MenuContextValue | undefined>(undefined);

export function useMenu(): MenuContextValue {
  const ctx = useContext(MenuContext);
  if (!ctx) throw new Error('useMenu debe usarse dentro de <MenuProvider>');
  return ctx;
}

/** Botón ☰ para `headerLeft` de las pantallas de primer nivel. */
export function BotonMenu() {
  const { abrir } = useMenu();
  return (
    <Pressable onPress={abrir} hitSlop={12} accessibilityLabel="Abrir menú" style={styles.hamburguesa}>
      <Text style={styles.hamburguesaTexto}>☰</Text>
    </Pressable>
  );
}

export function MenuProvider({ children }: { children: ReactNode }) {
  const { token, tecnico, logout } = useAuth();
  const { disponible: hayVacaciones, sinVer } = useVacaciones();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  const ancho = Math.min(300, Dimensions.get('window').width * 0.8);
  const progreso = useRef(new Animated.Value(0)).current; // 0 cerrado … 1 abierto
  const progresoActual = useRef(0);
  const [montado, setMontado] = useState(false);

  const animar = useCallback(
    (a: 0 | 1) => {
      if (a === 1) setMontado(true);
      Animated.timing(progreso, { toValue: a, duration: 200, useNativeDriver: true }).start(() => {
        if (a === 0) setMontado(false);
      });
      progresoActual.current = a;
    },
    [progreso]
  );
  const abrir = useCallback(() => animar(1), [animar]);
  const cerrar = useCallback(() => animar(0), [animar]);

  // Un solo PanResponder por gesto: desde la franja izquierda abre, desde el
  // panel abierto cierra. `base` es dónde estaba el progreso al empezar.
  const crearPan = (base: 0 | 1) => {
    let inicio = base;
    return PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderGrant: () => {
        inicio = base;
        setMontado(true);
      },
      onPanResponderMove: (_, g) => progreso.setValue(Math.max(0, Math.min(1, inicio + g.dx / ancho))),
      onPanResponderRelease: (_, g) => {
        const abierto = inicio + g.dx / ancho > 0.5 || (g.vx > 0.5 && inicio === 0);
        animar(abierto && !(g.vx < -0.5) ? 1 : 0);
      },
      onPanResponderTerminate: () => animar(progresoActual.current ? 1 : 0),
    });
  };
  const panBorde = useMemo(() => crearPan(0), [ancho]); // eslint-disable-line react-hooks/exhaustive-deps
  const panPanel = useMemo(() => crearPan(1), [ancho]); // eslint-disable-line react-hooks/exhaustive-deps

  const enRutaDeMenu = RUTAS.some((r) => pathname === r);

  function ir(ruta: (typeof RUTAS)[number]) {
    cerrar();
    if (pathname !== ruta) router.replace(ruta);
  }

  async function salir() {
    cerrar();
    await logout();
  }

  const value = useMemo(() => ({ abrir }), [abrir]);
  const items: { ruta: (typeof RUTAS)[number]; texto: string; badge?: number; visible: boolean }[] = [
    { ruta: '/servicios', texto: 'Servicios', visible: true },
    { ruta: '/vacaciones', texto: 'Vacaciones', badge: sinVer, visible: hayVacaciones },
    { ruta: '/convertidor', texto: 'Convertidor de unidades', visible: true },
  ];

  return (
    <MenuContext.Provider value={value}>
      {children}

      {token && enRutaDeMenu && !montado && (
        <View
          {...panBorde.panHandlers}
          style={[styles.borde, { top: insets.top + ALTO_HEADER }]}
        />
      )}

      {token && montado && (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          <Animated.View style={[styles.scrim, { opacity: progreso.interpolate({ inputRange: [0, 1], outputRange: [0, 0.5] }) }]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={cerrar} />
          </Animated.View>
          <Animated.View
            {...panPanel.panHandlers}
            style={[
              styles.panel,
              { width: ancho, paddingTop: insets.top, paddingBottom: insets.bottom + 8 },
              { transform: [{ translateX: progreso.interpolate({ inputRange: [0, 1], outputRange: [-ancho, 0] }) }] },
            ]}
          >
            <View style={styles.cabecera}>
              <Text style={styles.nombreApp}>{NOMBRE_APP}</Text>
              {tecnico?.nombre ? <Text style={styles.usuario}>{tecnico.nombre}</Text> : null}
            </View>

            <View style={{ flex: 1, paddingTop: 8 }}>
              {items
                .filter((i) => i.visible)
                .map((i) => {
                  const activo = pathname === i.ruta;
                  return (
                    <Pressable key={i.ruta} onPress={() => ir(i.ruta)} style={[styles.item, activo && styles.itemActivo]}>
                      <Text style={[styles.itemTexto, activo && styles.itemTextoActivo]}>{i.texto}</Text>
                      {!!i.badge && i.badge > 0 && (
                        <View style={styles.badge}>
                          <Text style={styles.badgeTexto}>{i.badge}</Text>
                        </View>
                      )}
                    </Pressable>
                  );
                })}
            </View>

            <Pressable onPress={salir} style={styles.item}>
              <Text style={[styles.itemTexto, { color: colors.error }]}>Cerrar sesión</Text>
            </Pressable>
          </Animated.View>
        </View>
      )}
    </MenuContext.Provider>
  );
}

const styles = StyleSheet.create({
  hamburguesa: { paddingHorizontal: 8, paddingVertical: 4 },
  hamburguesaTexto: { color: '#fff', fontSize: 24 },
  borde: { position: 'absolute', left: 0, bottom: 0, width: BORDE_PX },
  scrim: { ...StyleSheet.flatten(StyleSheet.absoluteFill), backgroundColor: '#000' },
  panel: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: colors.tarjeta },
  cabecera: { backgroundColor: colors.oscuro, padding: 16, gap: 2 },
  nombreApp: { color: colors.naranja, fontSize: 20, fontWeight: '800' },
  usuario: { color: '#fff', fontSize: 14 },
  item: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  itemActivo: { backgroundColor: '#fde7da', borderLeftWidth: 4, borderLeftColor: colors.naranja },
  itemTexto: { fontSize: 15, fontWeight: '600', color: colors.texto },
  itemTextoActivo: { color: colors.naranja },
  badge: { minWidth: 22, height: 22, borderRadius: 11, backgroundColor: colors.naranja, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  badgeTexto: { color: '#fff', fontSize: 12, fontWeight: '700' },
});
