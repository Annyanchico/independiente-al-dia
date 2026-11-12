import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { crearApp } from '../src/app.js';
import { crearAlmacenSesiones } from '../src/sesiones.js';
import { aFormatoWhatsApp } from '../src/whatsapp.js';

const SECRETO = 'secreto-de-prueba';

function montar() {
  const enviados = [];
  const eventos = [];
  const whatsapp = {
    enviar: async (destino, mensaje) => {
      aFormatoWhatsApp(mensaje); // valida que se pueda traducir
      enviados.push({ destino, mensaje });
    },
    marcarLeido: async () => {},
  };
  const app = crearApp({
    config: { verifyToken: 'token-verificacion', appSecret: SECRETO },
    whatsapp,
    sesiones: crearAlmacenSesiones(),
    registrarEvento: (e) => eventos.push(e),
    logger: { log() {}, warn() {}, error() {} },
  });
  const servidor = app.listen(0);
  const base = `http://127.0.0.1:${servidor.address().port}`;
  return { base, servidor, enviados, eventos };
}

let contador = 0;
function payload(entrada) {
  const msg = { from: '573001234567', id: `wamid.${++contador}`, timestamp: '1', ...entrada };
  return {
    object: 'whatsapp_business_account',
    entry: [{ changes: [{ field: 'messages', value: {
      messaging_product: 'whatsapp',
      contacts: [{ wa_id: '573001234567', profile: { name: 'Prueba' } }],
      messages: [msg],
    } }] }],
  };
}

async function enviar(base, cuerpo, { firmar = true } = {}) {
  const json = JSON.stringify(cuerpo);
  const firma = 'sha256=' + crypto.createHmac('sha256', SECRETO).update(json).digest('hex');
  const res = await fetch(`${base}/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(firmar ? { 'X-Hub-Signature-256': firma } : {}) },
    body: json,
  });
  await new Promise((r) => setTimeout(r, 30)); // dejar que termine el procesamiento
  return res.status;
}

test('verificación del webhook', async () => {
  const { base, servidor } = montar();
  const ok = await fetch(`${base}/webhook?hub.mode=subscribe&hub.verify_token=token-verificacion&hub.challenge=12345`);
  assert.equal(ok.status, 200);
  assert.equal(await ok.text(), '12345');
  const mal = await fetch(`${base}/webhook?hub.mode=subscribe&hub.verify_token=otro&hub.challenge=1`);
  assert.equal(mal.status, 403);
  servidor.close();
});

test('rechaza peticiones sin firma válida', async () => {
  const { base, servidor, enviados } = montar();
  const status = await enviar(base, payload({ type: 'text', text: { body: 'hola' } }), { firmar: false });
  assert.equal(status, 401);
  assert.equal(enviados.length, 0);
  servidor.close();
});

test('conversación completa por el webhook', async () => {
  const { base, servidor, enviados, eventos } = montar();
  const boton = (id) => payload({ type: 'interactive', interactive: { type: 'button_reply', button_reply: { id, title: id } } });
  const lista = (id) => payload({ type: 'interactive', interactive: { type: 'list_reply', list_reply: { id, title: id } } });

  assert.equal(await enviar(base, payload({ type: 'text', text: { body: 'Hola' } })), 200);
  await enviar(base, boton('calcular'));
  await enviar(base, boton('tipo_contrato'));
  await enviar(base, payload({ type: 'text', text: { body: '8.000.000' } }));
  await enviar(base, lista('riesgo_I'));

  const resultado = enviados.find((e) => e.mensaje.texto?.includes('Total a pagar'));
  assert.ok(resultado, 'debe enviar el resultado');
  assert.match(resultado.mensaje.texto, /928\.800/);
  assert.equal(eventos[0].tipo, 'calculo_realizado');
  assert.equal(eventos[0].nombre, 'Prueba');
  servidor.close();
});

test('no procesa dos veces el mismo mensaje', async () => {
  const { base, servidor, enviados } = montar();
  const p = payload({ type: 'text', text: { body: 'hola' } });
  await enviar(base, p);
  await enviar(base, p);
  assert.equal(enviados.length, 1);
  servidor.close();
});
