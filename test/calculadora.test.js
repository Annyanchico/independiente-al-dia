import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcularAportes, TIPOS } from '../src/calculadora.js';

test('40% menor al mínimo: IBC sube a 1 SMMLV (ejemplo UGPP)', () => {
  // UGPP ABC Omiso 2026: ingreso neto $3.210.000 → 40% = $1.284.000 → IBC = 1 SMMLV
  const r = calcularAportes({ tipo: TIPOS.CUENTA_PROPIA, ingresos: 3_210_000 });
  assert.equal(r.ibc, 1_750_905);
  assert.equal(r.ibcAjustadoAlMinimo, true);
  assert.equal(r.obligado, true);
  assert.equal(r.aportes.salud, 218_900);   // 218.863 → múltiplo de 100 superior
  assert.equal(r.aportes.pension, 280_200); // 280.145 → 280.200
  assert.equal(r.aportes.arl, 0);           // ARL voluntaria en cuenta propia
  assert.equal(r.totalAPagar, 499_100);
});

test('ingreso neto menor a 1 SMMLV: no obligado', () => {
  const r = calcularAportes({ tipo: TIPOS.CUENTA_PROPIA, ingresos: 2_000_000, costos: 600_000 });
  assert.equal(r.obligado, false);
});

test('contrato de prestación de servicios: 40% del valor y ARL clase I', () => {
  const r = calcularAportes({ tipo: TIPOS.CONTRATO, ingresos: 8_000_000 });
  assert.equal(r.ibc, 3_200_000);
  assert.equal(r.aportes.salud, 400_000);
  assert.equal(r.aportes.pension, 512_000);
  assert.equal(r.aportes.arl, 16_800);      // 16.704 → 16.800
  assert.equal(r.aportes.fondoSolidaridad, 0);
  assert.equal(r.totalAPagar, 928_800);
});

test('contrato no resta costos', () => {
  const r = calcularAportes({ tipo: TIPOS.CONTRATO, ingresos: 8_000_000, costos: 5_000_000 });
  assert.equal(r.ibc, 3_200_000);
});

test('IBC desde 4 SMMLV paga Fondo de Solidaridad Pensional', () => {
  const r = calcularAportes({ tipo: TIPOS.CONTRATO, ingresos: 20_000_000 });
  assert.equal(r.ibc, 8_000_000);
  assert.equal(r.aportes.fondoSolidaridad, 80_000);
});

test('IBC tope de 25 SMMLV', () => {
  const r = calcularAportes({ tipo: TIPOS.CONTRATO, ingresos: 200_000_000 });
  assert.equal(r.ibc, 1_750_905 * 25);
  assert.equal(r.ibcAjustadoAlMaximo, true);
});

test('riesgo IV y V: la ARL la paga el contratante', () => {
  const r = calcularAportes({ tipo: TIPOS.CONTRATO, ingresos: 5_000_000, claseRiesgo: 'IV' });
  assert.equal(r.arlLaPagaContratante, true);
  assert.equal(r.totalAPagar, r.aportes.salud + r.aportes.pension);
});

test('datos inválidos lanzan error', () => {
  assert.throws(() => calcularAportes({ tipo: 'otro', ingresos: 1 }));
  assert.throws(() => calcularAportes({ tipo: TIPOS.CONTRATO, ingresos: -5 }));
  assert.throws(() => calcularAportes({ tipo: TIPOS.CONTRATO, ingresos: 5e6, claseRiesgo: 'X' }));
});
