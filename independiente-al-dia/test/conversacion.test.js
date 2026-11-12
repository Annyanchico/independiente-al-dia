import { test } from 'node:test';
import assert from 'node:assert/strict';
import { procesarMensaje, PASOS } from '../src/conversacion.js';
import { interpretarMonto } from '../src/utils/formato.js';

const t = (valor) => ({ tipo: 'texto', valor });
const b = (valor) => ({ tipo: 'boton', valor });

test('interpreta montos como los escribe la gente', () => {
  assert.equal(interpretarMonto('3500000'), 3_500_000);
  assert.equal(interpretarMonto('3.500.000'), 3_500_000);
  assert.equal(interpretarMonto('$ 3.500.000'), 3_500_000);
  assert.equal(interpretarMonto('3,500,000'), 3_500_000);
  assert.equal(interpretarMonto('3,5 millones'), 3_500_000);
  assert.equal(interpretarMonto('3.5M'), 3_500_000);
  assert.equal(interpretarMonto('800 mil'), 800_000);
  assert.equal(interpretarMonto('2 millones 300 mil'), 2_300_000);
  assert.equal(interpretarMonto('0'), 0);
  assert.equal(interpretarMonto('mucho'), null);
});

test('flujo completo de contratista', () => {
  let r = procesarMensaje(null, t('hola'));
  assert.equal(r.respuestas[0].tipo, 'botones');

  r = procesarMensaje(r.sesion, b('calcular'));
  assert.equal(r.sesion.paso, PASOS.TIPO);

  r = procesarMensaje(r.sesion, b('tipo_contrato'));
  assert.equal(r.sesion.paso, PASOS.INGRESOS);

  r = procesarMensaje(r.sesion, t('8 millones'));
  assert.equal(r.sesion.paso, PASOS.RIESGO);
  assert.equal(r.respuestas[0].tipo, 'lista');

  r = procesarMensaje(r.sesion, b('riesgo_I'));
  assert.equal(r.sesion.paso, PASOS.RESULTADO);
  assert.equal(r.sesion.resultado.totalAPagar, 928_800);
  assert.match(r.respuestas[0].texto, /Total a pagar/);
  assert.equal(r.evento.tipo, 'calculo_realizado');
});

test('flujo de cuenta propia con costos', () => {
  let r = procesarMensaje(null, b('calcular'));
  r = procesarMensaje(r.sesion, b('tipo_cuenta_propia'));
  r = procesarMensaje(r.sesion, t('5.000.000'));
  assert.equal(r.sesion.paso, PASOS.COSTOS);
  r = procesarMensaje(r.sesion, t('1.000.000'));
  assert.equal(r.sesion.resultado.ibc, 1_750_905); // 40% de 4M = 1,6M → mínimo
  assert.equal(r.sesion.resultado.obligado, true);
});

test('valor que no entiende: repite la pregunta sin avanzar', () => {
  let r = procesarMensaje(null, b('calcular'));
  r = procesarMensaje(r.sesion, b('tipo_contrato'));
  r = procesarMensaje(r.sesion, t('no sé'));
  assert.equal(r.sesion.paso, PASOS.INGRESOS);
  assert.match(r.respuestas[0].texto, /No entendí/);
});

test('ingreso bajo: avisa que no está obligado', () => {
  let r = procesarMensaje(null, b('calcular'));
  r = procesarMensaje(r.sesion, b('tipo_cuenta_propia'));
  r = procesarMensaje(r.sesion, t('1.200.000'));
  r = procesarMensaje(r.sesion, t('0'));
  assert.match(r.respuestas[0].texto, /no estás obligado/);
});

test('audio: pide escribir', () => {
  const r = procesarMensaje(null, { tipo: 'otro', valor: 'audio' });
  assert.match(r.respuestas[0].texto, /escritos/);
});

test('interesado en el plan genera evento', () => {
  const r = procesarMensaje({ paso: PASOS.RESULTADO, datos: { tipo: 'contrato' } }, b('quiero_plan'));
  assert.equal(r.evento.tipo, 'interesado_plan');
});
