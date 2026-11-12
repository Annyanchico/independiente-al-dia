// Flujo de conversación del asistente. Es una función pura:
// recibe la sesión y lo que escribió la persona, y devuelve la sesión nueva
// y los mensajes a enviar (en formato neutro, independiente de WhatsApp).

import { calcularAportes, TIPOS } from './calculadora.js';
import { formatoCOP, interpretarMonto } from './utils/formato.js';
import { PARAMETROS_2026 } from './config/parametros-2026.js';

export const PASOS = {
  INICIO: 'inicio',
  TIPO: 'tipo',
  INGRESOS: 'ingresos',
  COSTOS: 'costos',
  RIESGO: 'riesgo',
  RESULTADO: 'resultado',
};

const BOTON = {
  CALCULAR: 'calcular',
  QUE_ES_IBC: 'que_es_ibc',
  CONTRATO: 'tipo_contrato',
  CUENTA_PROPIA: 'tipo_cuenta_propia',
  NUEVO: 'nuevo_calculo',
  QUIERO_PLAN: 'quiero_plan',
};

const PALABRAS_REINICIO = ['hola', 'menu', 'menú', 'inicio', 'reiniciar', 'empezar', 'buenas'];

export const sesionNueva = () => ({ paso: PASOS.INICIO, datos: {} });

const texto = (cuerpo) => ({ tipo: 'texto', texto: cuerpo });
const botones = (cuerpo, opciones) => ({ tipo: 'botones', texto: cuerpo, opciones });

function menuPrincipal() {
  return botones(
    '¡Hola! Soy el asistente de *Independiente al Día* 👋\n\n'
    + 'Te ayudo a calcular cuánto debes pagar de seguridad social este mes, '
    + 'sin enredos.',
    [
      { id: BOTON.CALCULAR, titulo: 'Calcular aportes' },
      { id: BOTON.QUE_ES_IBC, titulo: '¿Qué es el IBC?' },
    ],
  );
}

function preguntarTipo() {
  return botones(
    '¿Cómo recibes tus ingresos?\n\n'
    + '• *Contrato*: prestación de servicios con una empresa o entidad.\n'
    + '• *Cuenta propia*: tienes tu negocio, vendes o haces oficios.',
    [
      { id: BOTON.CONTRATO, titulo: 'Contrato' },
      { id: BOTON.CUENTA_PROPIA, titulo: 'Cuenta propia' },
    ],
  );
}

function preguntarRiesgo() {
  return {
    tipo: 'lista',
    texto: '¿Cuál es la clase de riesgo de tu contrato? Aparece en el contrato o en tu afiliación a la ARL.',
    boton: 'Elegir riesgo',
    opciones: [
      { id: 'riesgo_I', titulo: 'Riesgo I', descripcion: 'Oficina, asesoría, trabajo administrativo' },
      { id: 'riesgo_II', titulo: 'Riesgo II', descripcion: 'Algunos procesos manufactureros' },
      { id: 'riesgo_III', titulo: 'Riesgo III', descripcion: 'Procesos con riesgo medio' },
      { id: 'riesgo_IV', titulo: 'Riesgo IV', descripcion: 'Riesgo alto: lo paga el contratante' },
      { id: 'riesgo_V', titulo: 'Riesgo V', descripcion: 'Riesgo máximo: lo paga el contratante' },
    ],
  };
}

function explicarIBC() {
  return texto(
    'El *IBC* (Ingreso Base de Cotización) es el valor sobre el que se calculan tus aportes.\n\n'
    + 'Para independientes es el *40%* de lo que ganas en el mes, pero nunca menos de '
    + `un salario mínimo (${formatoCOP(PARAMETROS_2026.smmlv)} en ${PARAMETROS_2026.anio}).\n\n`
    + 'Sobre ese valor pagas 12,5% de salud y 16% de pensión, más ARL si tienes contrato.',
  );
}

function mensajeResultado(r) {
  const lineas = [];

  if (!r.obligado) {
    lineas.push(
      'Con ese ingreso *no estás obligado* a cotizar, porque tu ingreso neto es menor a un salario mínimo.',
      '',
      'Si quieres cotizar de forma voluntaria, este sería el valor sobre el mínimo:',
      '',
    );
  } else {
    lineas.push('Este es tu cálculo del mes 👇', '');
  }

  lineas.push(`*IBC:* ${formatoCOP(r.ibc)}`);
  if (r.ibcAjustadoAlMinimo) lineas.push('_(se ajustó al salario mínimo)_');
  if (r.ibcAjustadoAlMaximo) lineas.push('_(se ajustó al tope de 25 salarios mínimos)_');
  lineas.push('');
  lineas.push(`Salud (12,5%): ${formatoCOP(r.aportes.salud)}`);
  lineas.push(`Pensión (16%): ${formatoCOP(r.aportes.pension)}`);
  if (r.aportes.fondoSolidaridad > 0) {
    lineas.push(`Fondo de Solidaridad: ${formatoCOP(r.aportes.fondoSolidaridad)}`);
  }
  if (r.claseRiesgo) {
    const nota = r.arlLaPagaContratante ? ' _(la paga tu contratante)_' : '';
    lineas.push(`ARL riesgo ${r.claseRiesgo}: ${formatoCOP(r.aportes.arl)}${nota}`);
  }
  lineas.push('');
  lineas.push(`*Total a pagar: ${formatoCOP(r.totalAPagar)}*`);
  lineas.push('');
  lineas.push('_Cálculo informativo con la normativa vigente. Se paga en la PILA, planilla tipo I._');

  return lineas.join('\n');
}

function pedirIngresos(tipo) {
  return texto(
    tipo === TIPOS.CONTRATO
      ? '¿Cuánto suman tus honorarios de este mes, *sin IVA*? Si tienes varios contratos, súmalos todos.\n\nEjemplo: 3.500.000'
      : '¿Cuánto vendiste o te ingresó en total este mes?\n\nEjemplo: 3.500.000',
  );
}

/**
 * @param {object} sesion  Estado actual ({ paso, datos })
 * @param {object} entrada { tipo: 'texto'|'boton'|'otro', valor: string }
 * @returns {{ sesion: object, respuestas: object[], evento?: object }}
 */
export function procesarMensaje(sesion, entrada) {
  const actual = sesion ?? sesionNueva();
  const valor = (entrada.valor ?? '').trim();
  const normalizado = valor.toLowerCase();

  // Audios, imágenes y otros: por ahora pedimos texto
  if (entrada.tipo === 'otro') {
    return {
      sesion: actual,
      respuestas: [texto('Por ahora solo entiendo mensajes escritos ✍️ Escríbeme y seguimos.')],
    };
  }

  // Palabras que reinician la conversación
  if (entrada.tipo === 'texto' && PALABRAS_REINICIO.includes(normalizado)) {
    return { sesion: sesionNueva(), respuestas: [menuPrincipal()] };
  }

  // Botones disponibles en cualquier momento
  if (entrada.tipo === 'boton') {
    switch (valor) {
      case BOTON.CALCULAR:
      case BOTON.NUEVO:
        return { sesion: { paso: PASOS.TIPO, datos: {} }, respuestas: [preguntarTipo()] };
      case BOTON.QUE_ES_IBC:
        return {
          sesion: actual,
          respuestas: [explicarIBC(), botones('¿Calculamos tus aportes?', [
            { id: BOTON.CALCULAR, titulo: 'Calcular aportes' },
          ])],
        };
      case BOTON.QUIERO_PLAN:
        return {
          sesion: actual,
          respuestas: [texto(
            '¡Genial! 🙌 Un asesor te escribirá pronto para contarte cómo te dejamos la '
            + 'planilla lista cada mes, con certificado y cuenta de cobro incluidos.',
          )],
          evento: { tipo: 'interesado_plan', datos: actual.datos },
        };
      default:
        break;
    }
  }

  switch (actual.paso) {
    case PASOS.TIPO: {
      const tipo = valor === BOTON.CONTRATO || normalizado.startsWith('contrato') ? TIPOS.CONTRATO
        : valor === BOTON.CUENTA_PROPIA || normalizado.includes('propia') ? TIPOS.CUENTA_PROPIA
        : null;
      if (!tipo) return { sesion: actual, respuestas: [preguntarTipo()] };
      return {
        sesion: { paso: PASOS.INGRESOS, datos: { tipo } },
        respuestas: [pedirIngresos(tipo)],
      };
    }

    case PASOS.INGRESOS: {
      const ingresos = interpretarMonto(valor);
      if (ingresos === null || ingresos <= 0) {
        return {
          sesion: actual,
          respuestas: [texto('No entendí el valor 🤔 Escríbelo solo con números, por ejemplo: 3.500.000')],
        };
      }
      const datos = { ...actual.datos, ingresos };
      if (datos.tipo === TIPOS.CUENTA_PROPIA) {
        return {
          sesion: { paso: PASOS.COSTOS, datos },
          respuestas: [texto(
            '¿Cuánto gastaste este mes en tu actividad? (mercancía, materiales, arriendo del local, etc.)\n\n'
            + 'Si no tuviste gastos, escribe *0*.',
          )],
        };
      }
      return { sesion: { paso: PASOS.RIESGO, datos }, respuestas: [preguntarRiesgo()] };
    }

    case PASOS.COSTOS: {
      const costos = interpretarMonto(valor);
      if (costos === null || costos < 0) {
        return {
          sesion: actual,
          respuestas: [texto('No entendí el valor 🤔 Escríbelo con números, o *0* si no tuviste gastos.')],
        };
      }
      return finalizar({ ...actual.datos, costos });
    }

    case PASOS.RIESGO: {
      const match = valor.match(/^riesgo_(I|II|III|IV|V)$/) ?? valor.toUpperCase().match(/^(?:RIESGO\s*)?(I|II|III|IV|V|[1-5])$/);
      if (!match) return { sesion: actual, respuestas: [preguntarRiesgo()] };
      const romanos = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V' };
      const claseRiesgo = romanos[match[1]] ?? match[1];
      return finalizar({ ...actual.datos, claseRiesgo });
    }

    default:
      return { sesion: sesionNueva(), respuestas: [menuPrincipal()] };
  }
}

function finalizar(datos) {
  const resultado = calcularAportes(datos);
  return {
    sesion: { paso: PASOS.RESULTADO, datos, resultado },
    respuestas: [
      texto(mensajeResultado(resultado)),
      botones('¿Quieres que te dejemos la planilla lista cada mes, con recordatorio y certificado?', [
        { id: BOTON.QUIERO_PLAN, titulo: 'Sí, me interesa' },
        { id: BOTON.NUEVO, titulo: 'Nuevo cálculo' },
      ]),
    ],
    evento: { tipo: 'calculo_realizado', datos, resultado },
  };
}
