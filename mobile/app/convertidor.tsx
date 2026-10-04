import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from '../src/theme';
import {
  CLASE_PN, MAGNITUDES, NPS_DN, formatear, fraccionPulgada, leerNumero, magnitud, presionAtmosferica,
} from '../src/unidades';

/**
 * Convertidor de unidades — 100% offline (sin API ni base local). La lógica
 * vive en src/unidades.ts (copia de FredceControl); aquí solo la UI.
 * Referencia de qué mostrar: FredceControl/frontend/src/components/Convertidor.tsx.
 */

const ESPECIALES = [
  { key: 'gauge', label: 'Manométrica ↔ absoluta' },
  { key: 'nps', label: 'NPS ↔ DN' },
  { key: 'clase', label: 'Class ↔ PN' },
];

export default function ConvertidorScreen() {
  const [tab, setTab] = useState('presion');
  const tabs = [...MAGNITUDES.map((m) => ({ key: m.key, label: m.label })), ...ESPECIALES];

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.tabsWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
          {tabs.map((t) => (
            <Chip key={t.key} label={t.label} activo={tab === t.key} onPress={() => setTab(t.key)} />
          ))}
        </ScrollView>
      </View>
      <ScrollView contentContainerStyle={styles.contenido} keyboardShouldPersistTaps="handled">
        {tab === 'gauge' ? (
          <ManometricaAbsoluta />
        ) : tab === 'nps' ? (
          <TablaNps />
        ) : tab === 'clase' ? (
          <TablaClase />
        ) : (
          <ConvertirMagnitud key={tab} mag={tab} />
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Chip({ label, activo, onPress }: { label: string; activo: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, activo && styles.chipActivo]}>
      <Text style={[styles.chipTexto, activo && styles.chipTextoActivo]}>{label}</Text>
    </Pressable>
  );
}

function ConvertirMagnitud({ mag }: { mag: string }) {
  const m = magnitud(mag);
  const [txt, setTxt] = useState('1');
  const [de, setDe] = useState(m.default);
  const v = leerNumero(txt);
  const valido = v !== null && Number.isFinite(v);
  const base = valido ? m.unidades.find((u) => u.key === de)!.aBase(v) : NaN;
  const bajoCero = valido && m.minBase !== undefined && base < m.minBase - 1e-9;

  return (
    <View style={styles.bloque}>
      <Text style={styles.label}>Valor</Text>
      <TextInput style={styles.input} keyboardType="numbers-and-punctuation" value={txt} onChangeText={setTxt} />
      <Text style={styles.label}>De</Text>
      <View style={styles.chipsFila}>
        {m.unidades.map((u) => (
          <Chip key={u.key} label={u.label} activo={u.key === de} onPress={() => setDe(u.key)} />
        ))}
      </View>
      {v !== null && !valido && (
        <Text style={styles.error}>Escribe un número válido (ej. 16.5). Para coma decimal usa "16,5" sin separador de miles.</Text>
      )}
      {bajoCero && <Text style={styles.error}>Está por debajo del cero absoluto (0 K): no es una temperatura posible.</Text>}

      <View style={styles.tabla}>
        {m.unidades.map((u, i) => {
          const r = valido && !bajoCero ? u.deBase(base) : NaN;
          const fraccion =
            mag === 'longitud' && u.key === 'in' && valido && !bajoCero && Math.abs(r) < 1e4 ? fraccionPulgada(r) : null;
          return (
            <View key={u.key} style={[styles.fila, i > 0 && styles.filaBorde, u.key === de && styles.filaActiva]}>
              <Text style={styles.filaUnidad}>{u.label}</Text>
              <View style={{ flex: 1, alignItems: 'flex-end' }}>
                <Text style={styles.filaValor} selectable>{formatear(r)}</Text>
                {fraccion && (
                  <Text style={styles.nota}>
                    ≈ {fraccion.texto}
                    {Math.abs(fraccion.error) > 1e-6 && ` (${fraccion.error > 0 ? '+' : ''}${formatear(fraccion.error, 2)}")`}
                  </Text>
                )}
              </View>
            </View>
          );
        })}
      </View>
      {m.nota && <Text style={styles.nota}>{m.nota}</Text>}
    </View>
  );
}

function ManometricaAbsoluta() {
  const pres = magnitud('presion');
  const [txt, setTxt] = useState('');
  const [unidad, setUnidad] = useState('psi');
  const [sentido, setSentido] = useState<'g2a' | 'a2g'>('g2a');
  const [ref, setRef] = useState<'mar' | 'altitud' | 'barometro'>('mar');
  const [altitud, setAltitud] = useState('2250');
  const [baro, setBaro] = useState('');

  const u = pres.unidades.find((x) => x.key === unidad)!;
  const v = leerNumero(txt);
  const alt = leerNumero(altitud);
  const b = leerNumero(baro);

  // Presión atmosférica en Pa según la referencia elegida.
  let patm: number | null = 101325;
  let errRef: string | null = null;
  if (ref === 'altitud') {
    if (alt === null || !Number.isFinite(alt) || alt < -500 || alt > 9000) {
      patm = null;
      errRef = 'Altitud entre -500 y 9000 m.';
    } else patm = presionAtmosferica(alt);
  } else if (ref === 'barometro') {
    const pb = b !== null && Number.isFinite(b) ? u.aBase(b) : NaN;
    if (!(pb > 0)) {
      patm = null;
      errRef = `Escribe la lectura del barómetro en ${u.label}.`;
    } else patm = pb;
  }

  const valido = v !== null && Number.isFinite(v);
  const resultadoPa = valido && patm !== null ? (sentido === 'g2a' ? u.aBase(v) + patm : u.aBase(v) - patm) : NaN;
  const absNegativa = valido && patm !== null && (sentido === 'g2a' ? resultadoPa : u.aBase(v)) < 0;
  const sufijo = (abs: boolean) =>
    unidad === 'psi' ? (abs ? 'psia' : 'psig') : unidad === 'bar' ? (abs ? 'bara' : 'barg') : `${u.label} ${abs ? '(abs)' : '(man)'}`;

  return (
    <View style={styles.bloque}>
      <Text style={styles.label}>Tengo presión</Text>
      <View style={styles.chipsFila}>
        <Chip label="Manométrica → absoluta" activo={sentido === 'g2a'} onPress={() => setSentido('g2a')} />
        <Chip label="Absoluta → manométrica" activo={sentido === 'a2g'} onPress={() => setSentido('a2g')} />
      </View>
      <Text style={styles.label}>Valor</Text>
      <TextInput style={styles.input} keyboardType="numbers-and-punctuation" value={txt} onChangeText={setTxt} />
      <Text style={styles.label}>Unidad</Text>
      <View style={styles.chipsFila}>
        {pres.unidades.map((x) => (
          <Chip key={x.key} label={x.label} activo={x.key === unidad} onPress={() => setUnidad(x.key)} />
        ))}
      </View>

      <View style={styles.caja}>
        <Text style={styles.label}>Presión atmosférica de referencia</Text>
        <View style={styles.chipsFila}>
          <Chip label="Nivel del mar" activo={ref === 'mar'} onPress={() => setRef('mar')} />
          <Chip label="Altitud" activo={ref === 'altitud'} onPress={() => setRef('altitud')} />
          <Chip label="Barómetro" activo={ref === 'barometro'} onPress={() => setRef('barometro')} />
        </View>
        {ref === 'altitud' && (
          <View style={styles.inline}>
            <TextInput style={[styles.input, styles.inputChico]} keyboardType="numbers-and-punctuation" value={altitud} onChangeText={setAltitud} />
            <Text style={styles.nota}>m</Text>
          </View>
        )}
        {ref === 'barometro' && (
          <View style={styles.inline}>
            <TextInput style={[styles.input, styles.inputChico]} keyboardType="numbers-and-punctuation" value={baro} onChangeText={setBaro} />
            <Text style={styles.nota}>{u.label}</Text>
          </View>
        )}
        {errRef ? (
          <Text style={styles.error}>{errRef}</Text>
        ) : (
          <Text style={styles.nota}>
            Atmosférica usada: {formatear(u.deBase(patm!))} {u.label}
            {ref === 'altitud' && ' (atmósfera estándar; el clima la mueve ±2 %, para calibrar usa barómetro)'}
          </Text>
        )}
      </View>

      {v !== null && !valido && <Text style={styles.error}>Escribe un número válido.</Text>}
      {absNegativa && <Text style={styles.error}>La presión absoluta no puede ser negativa: el vacío perfecto es 0 absoluto.</Text>}
      {valido && patm !== null && !absNegativa && (
        <View style={styles.resultado}>
          <Text style={styles.nota}>
            {formatear(v)} {sufijo(sentido === 'a2g')} =
          </Text>
          <Text style={styles.resultadoValor} selectable>
            {formatear(u.deBase(resultadoPa))} {sufijo(sentido === 'g2a')}
          </Text>
        </View>
      )}
      <Text style={styles.nota}>
        Manométrica (g) se mide contra la atmósfera; absoluta (a) contra el vacío. Absoluta = manométrica + atmosférica.
        Los manómetros de campo marcan manométrica; los cálculos de gas (API 520) usan absoluta.
      </Text>
    </View>
  );
}

function TablaNps() {
  const [q, setQ] = useState('');
  const buscar = q.trim().replace(/["”]/g, '').replace(/^dn\s*/i, '');
  const coincide = useMemo(
    () => new Set(buscar === '' ? [] : NPS_DN.filter((r) => r.nps === buscar || String(r.dn) === buscar).map((r) => r.nps)),
    [buscar],
  );

  return (
    <View style={styles.bloque}>
      <TextInput
        style={styles.input}
        placeholder="Busca: 2, 1-1/2, 50, DN 80…"
        placeholderTextColor={colors.placeholder}
        autoCapitalize="none"
        value={q}
        onChangeText={setQ}
      />
      <View style={styles.tabla}>
        <View style={[styles.fila, styles.filaEncabezado]}>
          <Text style={[styles.celda, styles.encabezado]}>NPS (in)</Text>
          <Text style={[styles.celda, styles.encabezado]}>DN (mm)</Text>
          <Text style={[styles.celda, styles.encabezado, styles.derecha]}>OD (in)</Text>
          <Text style={[styles.celda, styles.encabezado, styles.derecha]}>OD (mm)</Text>
        </View>
        {NPS_DN.map((r) => (
          <View key={r.nps} style={[styles.fila, styles.filaBorde, coincide.has(r.nps) && styles.filaResaltada]}>
            <Text style={[styles.celda, coincide.has(r.nps) && styles.negrita]}>{r.nps}"</Text>
            <Text style={[styles.celda, coincide.has(r.nps) && styles.negrita]}>DN {r.dn}</Text>
            <Text style={[styles.celda, styles.derecha]}>{r.od.toFixed(3)}</Text>
            <Text style={[styles.celda, styles.derecha]}>{(r.od * 25.4).toFixed(1)}</Text>
          </View>
        ))}
      </View>
      {buscar !== '' && coincide.size === 0 && <Text style={styles.nota}>No hay un tamaño nominal "{q}".</Text>}
      <Text style={styles.nota}>
        NPS y DN son nombres de tamaño, no medidas: un NPS 2 tiene 2.375" de diámetro exterior. Por eso se usa esta tabla
        (ASME B36.10M / ISO 6708) y no una multiplicación por 25.4.
      </Text>
    </View>
  );
}

function TablaClase() {
  return (
    <View style={styles.bloque}>
      <View style={styles.tabla}>
        <View style={[styles.fila, styles.filaEncabezado]}>
          <Text style={[styles.celda, styles.encabezado]}>ASME Class</Text>
          <Text style={[styles.celda, styles.encabezado]}>PN equivalente</Text>
        </View>
        {CLASE_PN.map((r) => (
          <View key={r.clase} style={[styles.fila, styles.filaBorde]}>
            <Text style={[styles.celda, styles.negrita]}>Class {r.clase}</Text>
            <Text style={styles.celda}>PN {r.pn}</Text>
          </View>
        ))}
      </View>
      <View style={styles.aviso}>
        <Text style={styles.avisoTexto}>
          Es equivalencia de nombre (ISO 7005-1 / EN 1759-1), no de presión. Lo que aguanta una brida depende del material y
          la temperatura: consulta la tabla presión-temperatura de ASME B16.5 / B16.34.
        </Text>
        <Text style={styles.avisoTexto}>
          Una brida EN 1092 PN 16 o PN 40 no es intercambiable con ninguna Class: cambian barrenos y diámetros.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.fondo },
  tabsWrap: { backgroundColor: colors.tarjeta, borderBottomWidth: 1, borderBottomColor: colors.borde },
  tabs: { padding: 12, gap: 8 },
  contenido: { padding: 16, paddingBottom: 40 },
  bloque: { gap: 10 },
  chipsFila: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.borde,
    backgroundColor: colors.tarjeta,
  },
  chipActivo: { backgroundColor: colors.oscuro, borderColor: colors.oscuro },
  chipTexto: { fontSize: 13, fontWeight: '600', color: colors.texto },
  chipTextoActivo: { color: '#fff' },
  label: { fontSize: 12, fontWeight: '600', color: colors.textoSecundario },
  input: {
    backgroundColor: colors.tarjeta,
    borderWidth: 1,
    borderColor: colors.borde,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 18,
    fontWeight: '600',
    color: colors.texto,
  },
  inputChico: { width: 110, fontSize: 15, paddingVertical: 6 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  error: { fontSize: 13, color: colors.error },
  nota: { fontSize: 12, color: colors.textoSecundario },
  caja: { borderWidth: 1, borderColor: colors.borde, borderRadius: 8, padding: 12, gap: 8, backgroundColor: colors.tarjeta },
  tabla: { borderWidth: 1, borderColor: colors.borde, borderRadius: 8, backgroundColor: colors.tarjeta, overflow: 'hidden' },
  fila: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10 },
  filaBorde: { borderTopWidth: 1, borderTopColor: colors.borde },
  filaActiva: { backgroundColor: '#f1f5f9' },
  filaResaltada: { backgroundColor: '#fde7da' },
  filaEncabezado: { backgroundColor: colors.fondo },
  filaUnidad: { width: 80, fontSize: 14, color: colors.textoSecundario },
  filaValor: { fontSize: 17, fontWeight: '700', color: colors.texto, fontVariant: ['tabular-nums'] },
  celda: { flex: 1, fontSize: 14, color: colors.texto },
  encabezado: { fontSize: 12, fontWeight: '600', color: colors.textoSecundario },
  derecha: { textAlign: 'right' },
  negrita: { fontWeight: '700' },
  resultado: { alignItems: 'center', backgroundColor: colors.tarjeta, borderRadius: 8, padding: 16, gap: 4, borderWidth: 1, borderColor: colors.borde },
  resultadoValor: { fontSize: 24, fontWeight: '700', color: colors.texto },
  aviso: { borderWidth: 1, borderColor: colors.advertencia, backgroundColor: '#fef3c7', borderRadius: 8, padding: 12, gap: 6 },
  avisoTexto: { fontSize: 12, color: '#92400e' },
});
