/**
 * COPIA de FredceControl/frontend/src/unidades.ts (repo web, rama main).
 * Hay que mantener ambos archivos IGUALES: si cambias algo aquí, cámbialo
 * también allá (y viceversa). TypeScript puro, sin dependencias de DOM/RN.
 */

/**
 * Convertidor de unidades para el rubro de válvulas.
 *
 * Cada magnitud se convierte pasando por una unidad base del SI (Pa, N, N·m, m…):
 * valor → base → destino. Así con N unidades solo hay N factores, no N² pares,
 * y todas las conversiones son consistentes entre sí.
 *
 * Los factores son las definiciones exactas (NIST SP 811 / BIPM), no redondeos:
 *   1 lb  = 0.45359237 kg   (exacto)      1 in = 0.0254 m (exacto)
 *   g0    = 9.80665 m/s²    (exacto)      → 1 lbf = 4.4482216152605 N
 *   1 psi = 1 lbf/in² = 6894.757293168… Pa
 */

export type Unidad = {
  key: string
  label: string
  /** Pasa de esta unidad a la base de la magnitud. */
  aBase: (v: number) => number
  /** Pasa de la base a esta unidad. */
  deBase: (v: number) => number
}

export type Magnitud = {
  key: string
  label: string
  unidades: Unidad[]
  /** Unidad seleccionada al abrir. */
  default: string
  /** Aclaración que se muestra debajo (condiciones de referencia, etc.). */
  nota?: string
  /** Si la magnitud no admite negativos (p. ej. temperatura absoluta), la base mínima. */
  minBase?: number
}

/** Unidad lineal: `factor` unidades base por cada unidad. */
const lin = (key: string, label: string, factor: number): Unidad =>
  ({ key, label, aBase: v => v * factor, deBase: v => v / factor })

const LB = 0.45359237
const G0 = 9.80665
const IN = 0.0254
const FT = 0.3048
const LBF = LB * G0                       // 4.4482216152605 N
const PSI = LBF / (IN * IN)               // 6894.757293168361 Pa
const GAL_US = 3.785411784e-3             // m³ (231 in³, exacto)

// Columnas de líquido: presión = ρ·g·h con la densidad convencional.
const MM_HG = 133.322387415               // Pa, mercurio a 0 °C (ρ = 13595.1 kg/m³)
const MM_H2O = 1000 * G0 / 1000           // Pa, agua a 4 °C (ρ = 1000 kg/m³) = 9.80665 Pa

export const MAGNITUDES: Magnitud[] = [
  {
    key: 'presion', label: 'Presión', default: 'psi',
    nota: 'Columnas de agua a 4 °C y de mercurio a 0 °C (valores convencionales).',
    unidades: [
      lin('psi', 'psi', PSI),
      lin('bar', 'bar', 1e5),
      lin('kgcm2', 'kg/cm²', G0 * 1e4),
      lin('kpa', 'kPa', 1e3),
      lin('mpa', 'MPa', 1e6),
      lin('pa', 'Pa', 1),
      lin('atm', 'atm', 101325),
      lin('inh2o', 'inH₂O', MM_H2O * 25.4),
      lin('mmh2o', 'mmH₂O', MM_H2O),
      lin('mmhg', 'mmHg', MM_HG),
      lin('inhg', 'inHg', MM_HG * 25.4),
    ],
  },
  {
    key: 'temperatura', label: 'Temperatura', default: 'c', minBase: 0,
    unidades: [
      { key: 'c', label: '°C', aBase: v => v + 273.15, deBase: k => k - 273.15 },
      { key: 'f', label: '°F', aBase: v => (v - 32) * 5 / 9 + 273.15, deBase: k => (k - 273.15) * 9 / 5 + 32 },
      { key: 'k', label: 'K', aBase: v => v, deBase: k => k },
      { key: 'r', label: '°R', aBase: v => v * 5 / 9, deBase: k => k * 9 / 5 },
    ],
  },
  {
    key: 'longitud', label: 'Longitud', default: 'in',
    unidades: [
      lin('in', 'in', IN),
      lin('mm', 'mm', 1e-3),
      lin('cm', 'cm', 1e-2),
      lin('m', 'm', 1),
      lin('ft', 'ft', FT),
    ],
  },
  {
    key: 'fuerza', label: 'Fuerza', default: 'lbf',
    unidades: [
      lin('lbf', 'lbf', LBF),
      lin('n', 'N', 1),
      lin('kn', 'kN', 1e3),
      lin('kgf', 'kgf', G0),
    ],
  },
  {
    key: 'torque', label: 'Torque', default: 'lbfft',
    unidades: [
      lin('lbfft', 'lbf·ft', LBF * FT),
      lin('lbfin', 'lbf·in', LBF * IN),
      lin('nm', 'N·m', 1),
      lin('kgfm', 'kgf·m', G0),
      lin('kgfcm', 'kgf·cm', G0 / 100),
    ],
  },
  {
    key: 'caudal', label: 'Caudal (líquido)', default: 'gpm',
    nota: 'Caudal volumétrico a condiciones reales. GPM = galón US.',
    unidades: [
      lin('gpm', 'GPM', GAL_US / 60),
      lin('lmin', 'L/min', 1e-3 / 60),
      lin('ls', 'L/s', 1e-3),
      lin('m3h', 'm³/h', 1 / 3600),
      lin('acfm', 'ft³/min', FT ** 3 / 60),
    ],
  },
  {
    // Un "metro cúbico normal" no es un volumen fijo: es una CANTIDAD de gas
    // (moles) medida a condiciones de referencia. Para pasar de una referencia
    // a otra se corrige por gas ideal: V2 = V1 · (T2/T1) · (P1/P2).
    // Base: Nm³/h (0 °C, 101.325 kPa — DIN 1343).
    key: 'caudal_gas', label: 'Caudal (gas estándar)', default: 'scfm',
    nota: 'SCFM/SCFH a 60 °F y 14.696 psia (referencia de API 520 para PSV). Nm³/h a 0 °C y 101.325 kPa. '
        + 'No mezclar con caudal real (ACFM): ese depende de la presión y temperatura de operación.',
    unidades: (() => {
      const scf = FT ** 3 * (273.15 / (273.15 + (60 - 32) * 5 / 9)) * (14.696 * PSI / 101325) // Nm³ por scf
      return [
        lin('scfm', 'SCFM', scf * 60),
        lin('scfh', 'SCFH', scf),
        lin('nm3h', 'Nm³/h', 1),
        lin('nm3min', 'Nm³/min', 60),
      ]
    })(),
  },
]

export function magnitud(key: string): Magnitud {
  const m = MAGNITUDES.find(x => x.key === key)
  if (!m) throw new Error(`Magnitud desconocida: ${key}`)
  return m
}

/** Convierte `v` de la unidad `de` a la unidad `a` dentro de la magnitud `mag`. */
export function convertirUnidad(mag: string, v: number, de: string, a: string): number {
  const m = magnitud(mag)
  const u1 = m.unidades.find(u => u.key === de)
  const u2 = m.unidades.find(u => u.key === a)
  if (!u1 || !u2) throw new Error(`Unidad desconocida en ${mag}: ${!u1 ? de : a}`)
  return de === a ? v : u2.deBase(u1.aBase(v))
}

/**
 * Lee un número escrito a mano. Acepta coma decimal ("16,5") solo si no hay
 * punto, porque "1,000.5" y "1.000,5" son ambiguos: ahí se rechaza en vez de adivinar.
 */
export function leerNumero(txt: string): number | null {
  let s = txt.trim().replace(/\s/g, '')
  if (s === '' || s === '-' || s === '.') return null
  if (s.includes(',')) {
    if (s.includes('.') || (s.match(/,/g) ?? []).length > 1) return NaN
    s = s.replace(',', '.')
  }
  if (!/^-?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(s)) return NaN
  return Number(s)
}

/** Número legible: 6 cifras significativas, sin ceros de relleno, sin notación científica en rangos normales. */
export function formatear(v: number, cifras = 6): string {
  if (!Number.isFinite(v)) return '—'
  if (v === 0) return '0'
  const abs = Math.abs(v)
  if (abs >= 1e-4 && abs < 1e12) {
    const decimales = Math.max(0, cifras - 1 - Math.floor(Math.log10(abs)))
    return Number(v.toFixed(Math.min(decimales, 12))).toLocaleString('en-US', { maximumFractionDigits: 12 })
  }
  return v.toExponential(cifras - 1)
}

// ─── Presión manométrica ↔ absoluta ───────────────────────────────────────

/**
 * Presión atmosférica a una altitud (atmósfera estándar ISA, troposfera):
 *   P = 101325 · (1 − 2.25577e-5 · h)^5.25588   [Pa, h en m]
 * Es un promedio: el barómetro real varía ±2 % con el clima. Para calibrar
 * con precisión se usa la lectura de un barómetro, no la altitud.
 */
export function presionAtmosferica(altitudM: number): number {
  return 101325 * Math.pow(1 - 2.25577e-5 * altitudM, 5.25588)
}

// ─── Tamaño nominal: NPS ↔ DN ─────────────────────────────────────────────

/**
 * NPS (pulgadas) y DN (mm) son NOMBRES de tamaño, no medidas: un tubo NPS 2
 * no mide 2" de nada (su diámetro exterior es 2.375"). Por eso no se convierte
 * con 25.4 sino con la tabla de equivalencias de ASME B36.10M / ISO 6708.
 * OD = diámetro exterior del tubo (ASME B36.10M); desde NPS 14 el OD = NPS.
 */
export const NPS_DN: { nps: string; dn: number; od: number }[] = [
  { nps: '1/8', dn: 6, od: 0.405 },
  { nps: '1/4', dn: 8, od: 0.540 },
  { nps: '3/8', dn: 10, od: 0.675 },
  { nps: '1/2', dn: 15, od: 0.840 },
  { nps: '3/4', dn: 20, od: 1.050 },
  { nps: '1', dn: 25, od: 1.315 },
  { nps: '1-1/4', dn: 32, od: 1.660 },
  { nps: '1-1/2', dn: 40, od: 1.900 },
  { nps: '2', dn: 50, od: 2.375 },
  { nps: '2-1/2', dn: 65, od: 2.875 },
  { nps: '3', dn: 80, od: 3.500 },
  { nps: '3-1/2', dn: 90, od: 4.000 },
  { nps: '4', dn: 100, od: 4.500 },
  { nps: '5', dn: 125, od: 5.563 },
  { nps: '6', dn: 150, od: 6.625 },
  { nps: '8', dn: 200, od: 8.625 },
  { nps: '10', dn: 250, od: 10.750 },
  { nps: '12', dn: 300, od: 12.750 },
  { nps: '14', dn: 350, od: 14 },
  { nps: '16', dn: 400, od: 16 },
  { nps: '18', dn: 450, od: 18 },
  { nps: '20', dn: 500, od: 20 },
  { nps: '24', dn: 600, od: 24 },
  { nps: '30', dn: 750, od: 30 },
  { nps: '36', dn: 900, od: 36 },
  { nps: '42', dn: 1050, od: 42 },
  { nps: '48', dn: 1200, od: 48 },
]

// ─── Clase de presión: ASME ↔ PN ──────────────────────────────────────────

/**
 * Designación PN equivalente a cada Class de ASME B16.5 según ISO 7005-1 /
 * EN 1759-1 (bridas de "serie americana" en PN). Es una equivalencia de
 * NOMBRE: la presión que aguanta una brida depende del material y de la
 * temperatura (tablas presión-temperatura de ASME B16.5 / B16.34).
 * Ojo: una brida EN 1092 PN 16 / PN 40 NO es intercambiable con ninguna Class
 * — los barrenos y diámetros son distintos.
 */
export const CLASE_PN: { clase: number; pn: number }[] = [
  { clase: 150, pn: 20 },
  { clase: 300, pn: 50 },
  { clase: 400, pn: 68 },
  { clase: 600, pn: 110 },
  { clase: 900, pn: 150 },
  { clase: 1500, pn: 260 },
  { clase: 2500, pn: 420 },
]

// ─── Fracción de pulgada ──────────────────────────────────────────────────

/** Pulgadas decimales → fracción más cercana en 64avos, simplificada: 0.8125 → 13/16. */
export function fraccionPulgada(pulg: number): { texto: string; error: number } {
  const signo = pulg < 0 ? '-' : ''
  const abs = Math.abs(pulg)
  const entero = Math.floor(abs)
  let num = Math.round((abs - entero) * 64)
  let den = 64
  let ent = entero
  if (num === 64) { ent += 1; num = 0 }
  while (num > 0 && num % 2 === 0) { num /= 2; den /= 2 }
  const texto = num === 0 ? `${signo}${ent}"` : `${signo}${ent > 0 ? ent + ' ' : ''}${num}/${den}"`
  const valor = ent + (num === 0 ? 0 : num / den)
  return { texto, error: abs - valor }
}
