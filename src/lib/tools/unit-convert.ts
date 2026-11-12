/** Unit conversion. Every unit has a factor to the category base unit (temperature is handled separately). */

export interface UnitDef {
  label: string;
  factor: number;
}
export interface Category {
  label: string;
  units: Record<string, UnitDef>;
}

export const CATEGORIES: Record<string, Category> = {
  length: {
    label: "Length",
    units: {
      mm: { label: "Millimetre", factor: 0.001 },
      cm: { label: "Centimetre", factor: 0.01 },
      m: { label: "Metre", factor: 1 },
      km: { label: "Kilometre", factor: 1000 },
      in: { label: "Inch", factor: 0.0254 },
      ft: { label: "Foot", factor: 0.3048 },
      yd: { label: "Yard", factor: 0.9144 },
      mi: { label: "Mile", factor: 1609.344 },
    },
  },
  mass: {
    label: "Weight",
    units: {
      mg: { label: "Milligram", factor: 0.000001 },
      g: { label: "Gram", factor: 0.001 },
      kg: { label: "Kilogram", factor: 1 },
      t: { label: "Tonne", factor: 1000 },
      oz: { label: "Ounce", factor: 0.028349523125 },
      lb: { label: "Pound", factor: 0.45359237 },
    },
  },
  volume: {
    label: "Volume",
    units: {
      ml: { label: "Millilitre", factor: 0.001 },
      l: { label: "Litre", factor: 1 },
      tsp: { label: "Teaspoon (US)", factor: 0.00492892159375 },
      tbsp: { label: "Tablespoon (US)", factor: 0.01478676478125 },
      cup: { label: "Cup (US)", factor: 0.2365882365 },
      pt: { label: "Pint (US)", factor: 0.473176473 },
      gal: { label: "Gallon (US)", factor: 3.785411784 },
    },
  },
  area: {
    label: "Area",
    units: {
      cm2: { label: "Square centimetre", factor: 0.0001 },
      m2: { label: "Square metre", factor: 1 },
      ha: { label: "Hectare", factor: 10000 },
      km2: { label: "Square kilometre", factor: 1_000_000 },
      ft2: { label: "Square foot", factor: 0.09290304 },
      ac: { label: "Acre", factor: 4046.8564224 },
    },
  },
  speed: {
    label: "Speed",
    units: {
      ms: { label: "Metre per second", factor: 1 },
      kmh: { label: "Kilometre per hour", factor: 1 / 3.6 },
      mph: { label: "Mile per hour", factor: 0.44704 },
      kn: { label: "Knot", factor: 0.514444444444 },
    },
  },
  time: {
    label: "Time",
    units: {
      s: { label: "Second", factor: 1 },
      min: { label: "Minute", factor: 60 },
      h: { label: "Hour", factor: 3600 },
      d: { label: "Day", factor: 86400 },
      wk: { label: "Week", factor: 604800 },
    },
  },
  data: {
    label: "Data",
    units: {
      b: { label: "Byte", factor: 1 },
      kb: { label: "Kilobyte (1000)", factor: 1000 },
      mb: { label: "Megabyte (1000²)", factor: 1e6 },
      gb: { label: "Gigabyte (1000³)", factor: 1e9 },
      kib: { label: "Kibibyte (1024)", factor: 1024 },
      mib: { label: "Mebibyte (1024²)", factor: 1024 ** 2 },
      gib: { label: "Gibibyte (1024³)", factor: 1024 ** 3 },
    },
  },
  temperature: {
    label: "Temperature",
    units: { c: { label: "Celsius", factor: 1 }, f: { label: "Fahrenheit", factor: 1 }, k: { label: "Kelvin", factor: 1 } },
  },
};

function toCelsius(v: number, unit: string): number {
  return unit === "f" ? ((v - 32) * 5) / 9 : unit === "k" ? v - 273.15 : v;
}
function fromCelsius(c: number, unit: string): number {
  return unit === "f" ? (c * 9) / 5 + 32 : unit === "k" ? c + 273.15 : c;
}

/** Convert a value. Returns null if the category or a unit is unknown. */
export function convertUnit(category: string, value: number, from: string, to: string): number | null {
  const cat = CATEGORIES[category];
  if (!cat || !cat.units[from] || !cat.units[to] || !Number.isFinite(value)) return null;
  if (category === "temperature") return fromCelsius(toCelsius(value, from), to);
  return (value * cat.units[from]!.factor) / cat.units[to]!.factor;
}

/** Tidy a result for display: up to 10 significant digits, no trailing zeros. */
export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return "";
  if (n === 0) return "0";
  const abs = Math.abs(n);
  if (abs >= 1e15 || abs < 1e-6) return n.toExponential(6).replace(/\.?0+e/, "e");
  return String(Number(n.toPrecision(10)));
}
