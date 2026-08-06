// utils/colores.js
const COLOR_MAP = {
  'blanco':   '#ffffff',
  'negro':    '#1a1a1a',
  'gris':     '#9ca3af',
  'plata':    '#c0c0c0',
  'rojo':     '#ef4444',
  'rojo metalico': '#ef4444',
  'azul':     '#3b82f6',
  'verde':    '#22c55e',
  'amarillo': '#eab308',
  'naranja':  '#f97316',
  'celeste':  '#38bdf8',
  'beige':    '#e8dcc8',
  'marron':   '#78350f',
  'dorado':   '#d4af37',
};

function colorAHex(nombreColor) {
  if (!nombreColor) return '#aaaaaa';
  const clave = nombreColor
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // quita tildes: "Marrón" → "marron"
  return COLOR_MAP[clave] || '#aaaaaa';
}

module.exports = { colorAHex };