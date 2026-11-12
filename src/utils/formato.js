const cop = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

export const formatoCOP = (valor) => cop.format(valor).replace(/\s/g, ' ');

/**
 * Convierte lo que escribe una persona en un número de pesos.
 * Acepta: "3500000", "3.500.000", "$3.500.000", "3,5 millones", "3.5M", "800 mil", "2 millones 300 mil".
 * Devuelve null si no entiende el valor.
 */
export function interpretarMonto(texto) {
  if (typeof texto !== 'string') return null;
  let t = texto.toLowerCase().trim()
    .replace(/\$|cop|pesos?/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!t) return null;

  // "2 millones 300 mil"
  const compuesto = t.match(/^(\d+(?:[.,]\d+)?)\s*(?:millones?|mill?|m)\s+(\d+(?:[.,]\d+)?)\s*(?:mil|k)$/);
  if (compuesto) {
    return Math.round(aNumero(compuesto[1]) * 1_000_000 + aNumero(compuesto[2]) * 1_000);
  }

  const conUnidad = t.match(/^(\d+(?:[.,]\d+)?)\s*(millones?|mill?|m|mil|k)$/);
  if (conUnidad) {
    const factor = conUnidad[2].startsWith('mil') && !conUnidad[2].startsWith('mill') ? 1_000
      : conUnidad[2] === 'k' ? 1_000
      : 1_000_000;
    return Math.round(aNumero(conUnidad[1]) * factor);
  }

  // Número solo: "3.500.000", "3,500,000", "3500000", "0"
  if (/^\d{1,3}([.,]\d{3})+$/.test(t)) return Number(t.replace(/[.,]/g, ''));
  if (/^\d+$/.test(t)) return Number(t);
  return null;
}

// "3,5" o "3.5" → 3.5 (para cantidades con unidad)
function aNumero(s) {
  return Number(s.replace(',', '.'));
}
