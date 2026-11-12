import { PARAMETROS_2026 } from './config/parametros-2026.js';

export const TIPOS = {
  CONTRATO: 'contrato',          // prestación de servicios personales
  CUENTA_PROPIA: 'cuenta_propia', // comerciantes, oficios, rentistas
};

// En PILA los aportes se aproximan al múltiplo de 100 superior
const redondearAporte = (valor) => Math.ceil(valor / 100) * 100;
// El IBC se aproxima al peso superior
const redondearIBC = (valor) => Math.ceil(valor);

function tarifaFondoSolidaridad(ibc, p) {
  const enSMMLV = ibc / p.smmlv;
  const tramo = p.fondoSolidaridad.find(
    (t) => enSMMLV >= t.desdeSMMLV && enSMMLV < t.hastaSMMLV,
  );
  return tramo ? tramo.tarifa : 0;
}

/**
 * Calcula los aportes mensuales de un trabajador independiente.
 *
 * @param {object} datos
 * @param {'contrato'|'cuenta_propia'} datos.tipo
 * @param {number} datos.ingresos  Ingresos brutos del mes, sin IVA (suma de todos los contratos)
 * @param {number} [datos.costos=0] Costos deducibles (solo cuenta propia)
 * @param {'I'|'II'|'III'|'IV'|'V'} [datos.claseRiesgo] Obligatoria en contrato; voluntaria en cuenta propia
 * @param {'completa'|'parcial'} [datos.caja] Caja de compensación voluntaria
 * @param {object} [parametros] Parámetros normativos del año
 */
export function calcularAportes(datos, parametros = PARAMETROS_2026) {
  const p = parametros;
  const { tipo, ingresos, costos = 0, caja } = datos;

  if (!Object.values(TIPOS).includes(tipo)) {
    throw new Error(`Tipo de independiente no válido: ${tipo}`);
  }
  if (!Number.isFinite(ingresos) || ingresos < 0) {
    throw new Error('Los ingresos deben ser un número positivo');
  }
  if (!Number.isFinite(costos) || costos < 0) {
    throw new Error('Los costos deben ser un número positivo');
  }

  const claseRiesgo = datos.claseRiesgo ?? (tipo === TIPOS.CONTRATO ? 'I' : null);
  if (claseRiesgo && !(claseRiesgo in p.arl)) {
    throw new Error(`Clase de riesgo no válida: ${claseRiesgo}`);
  }

  // En contratos de prestación de servicios no se restan costos
  const ingresoNeto = tipo === TIPOS.CONTRATO ? ingresos : Math.max(ingresos - costos, 0);
  const obligado = ingresoNeto >= p.smmlv;

  const ibcMinimo = p.smmlv * p.ibcMinimoSMMLV;
  const ibcMaximo = p.smmlv * p.ibcMaximoSMMLV;
  const ibcCalculado = ingresoNeto * p.porcentajeIBC;
  const ibc = redondearIBC(Math.min(Math.max(ibcCalculado, ibcMinimo), ibcMaximo));

  const salud = redondearAporte(ibc * p.tarifas.salud);
  const pension = redondearAporte(ibc * p.tarifas.pension);

  const tarifaFSP = tarifaFondoSolidaridad(ibc, p);
  const fondoSolidaridad = tarifaFSP > 0 ? redondearAporte(ibc * tarifaFSP) : 0;

  let arl = 0;
  let arlLaPagaContratante = false;
  if (claseRiesgo) {
    arlLaPagaContratante = p.arlPagadaPorContratante.includes(claseRiesgo);
    arl = redondearAporte(ibc * p.arl[claseRiesgo]);
  }

  const cajaCompensacion = caja ? redondearAporte(ibc * p.caja[caja]) : 0;

  const totalAPagar =
    salud + pension + fondoSolidaridad + (arlLaPagaContratante ? 0 : arl) + cajaCompensacion;

  return {
    anio: p.anio,
    tipo,
    obligado,
    ingresoNeto,
    ibc,
    ibcAjustadoAlMinimo: ibcCalculado < ibcMinimo,
    ibcAjustadoAlMaximo: ibcCalculado > ibcMaximo,
    aportes: {
      salud,
      pension,
      fondoSolidaridad,
      arl,
      cajaCompensacion,
    },
    claseRiesgo,
    arlLaPagaContratante,
    totalAPagar,
  };
}
