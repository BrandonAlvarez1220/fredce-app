import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

/**
 * Selector de rango de fechas (sin dependencias). Marca los festivos (no se
 * descuentan) y deshabilita lo anterior a `minFecha`. Toque 1 = inicio,
 * toque 2 = fin (mismo día = un solo día); un tercer toque reinicia.
 * Fechas siempre AAAA-MM-DD.
 */

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const DIAS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

const dos = (n: number) => String(n).padStart(2, '0');
export const aIso = (d: Date) => `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;

interface Props {
  inicio: string | null;
  fin: string | null;
  festivos: Set<string>;
  minFecha: string;
  onChange: (inicio: string | null, fin: string | null) => void;
}

export default function Calendario({ inicio, fin, festivos, minFecha, onChange }: Props) {
  const [y0, m0] = minFecha.split('-').map(Number);
  const [mes, setMes] = useState({ y: y0, m: m0 - 1 });

  const offset = (new Date(mes.y, mes.m, 1).getDay() + 6) % 7; // lunes = 0
  const diasMes = new Date(mes.y, mes.m + 1, 0).getDate();
  const celdas: (string | null)[] = [
    ...Array<null>(offset).fill(null),
    ...Array.from({ length: diasMes }, (_, i) => `${mes.y}-${dos(mes.m + 1)}-${dos(i + 1)}`),
  ];

  const puedeRetroceder = mes.y > y0 || (mes.y === y0 && mes.m > m0 - 1);
  const mover = (delta: number) => {
    const d = new Date(mes.y, mes.m + delta, 1);
    setMes({ y: d.getFullYear(), m: d.getMonth() });
  };

  function tocar(f: string) {
    if (!inicio || fin) onChange(f, null);
    else if (f < inicio) onChange(f, null);
    else onChange(inicio, f);
  }

  return (
    <View style={styles.cont}>
      <View style={styles.nav}>
        <Pressable onPress={() => mover(-1)} disabled={!puedeRetroceder} hitSlop={12}>
          <Text style={[styles.flecha, !puedeRetroceder && styles.flechaOff]}>‹</Text>
        </Pressable>
        <Text style={styles.mes}>{MESES[mes.m]} {mes.y}</Text>
        <Pressable onPress={() => mover(1)} hitSlop={12}>
          <Text style={styles.flecha}>›</Text>
        </Pressable>
      </View>
      <View style={styles.fila}>
        {DIAS.map((d, i) => (
          <Text key={i} style={styles.diaSemana}>{d}</Text>
        ))}
      </View>
      <View style={styles.grid}>
        {celdas.map((f, i) => {
          if (!f) return <View key={`v${i}`} style={styles.celda} />;
          const deshab = f < minFecha;
          const extremo = f === inicio || f === fin;
          const enRango = !!inicio && !!fin && f > inicio && f < fin;
          return (
            <Pressable key={f} style={styles.celda} disabled={deshab} onPress={() => tocar(f)}>
              <View style={[styles.dia, enRango && styles.diaRango, extremo && styles.diaExtremo]}>
                <Text style={[styles.diaTexto, deshab && styles.diaOff, extremo && styles.diaTextoExtremo]}>
                  {Number(f.slice(8))}
                </Text>
                {festivos.has(f) && <View style={[styles.punto, extremo && { backgroundColor: '#fff' }]} />}
              </View>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.leyenda}>● Festivo (no se descuenta)</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  cont: { backgroundColor: colors.tarjeta, borderWidth: 1, borderColor: colors.borde, borderRadius: 12, padding: 12 },
  nav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  flecha: { fontSize: 28, color: colors.naranja, paddingHorizontal: 8 },
  flechaOff: { color: colors.borde },
  mes: { fontSize: 16, fontWeight: '700', color: colors.texto },
  fila: { flexDirection: 'row' },
  diaSemana: { flex: 1, textAlign: 'center', fontSize: 12, color: colors.textoSecundario, paddingBottom: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  celda: { width: '14.2857%', aspectRatio: 1, padding: 2 },
  dia: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  diaRango: { backgroundColor: '#fde7da' },
  diaExtremo: { backgroundColor: colors.naranja },
  diaTexto: { fontSize: 15, color: colors.texto },
  diaOff: { color: colors.placeholder },
  diaTextoExtremo: { color: '#fff', fontWeight: '700' },
  punto: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.naranja, marginTop: 1 },
  leyenda: { fontSize: 11, color: colors.textoSecundario, marginTop: 8 },
});
