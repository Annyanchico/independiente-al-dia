import { appendFile } from 'node:fs/promises';
import { crearApp } from './app.js';
import { crearClienteWhatsApp } from './whatsapp.js';
import { crearAlmacenSesiones } from './sesiones.js';

const config = {
  puerto: Number(process.env.PORT ?? 3000),
  verifyToken: process.env.WHATSAPP_VERIFY_TOKEN,
  appSecret: process.env.WHATSAPP_APP_SECRET,
  token: process.env.WHATSAPP_TOKEN,
  phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
  version: process.env.GRAPH_API_VERSION ?? 'v25.0',
};

const modoPrueba = !config.token || !config.phoneNumberId;
if (!config.verifyToken) {
  console.error('Falta WHATSAPP_VERIFY_TOKEN en el archivo .env');
  process.exit(1);
}
if (modoPrueba) {
  console.warn('Sin WHATSAPP_TOKEN o WHATSAPP_PHONE_NUMBER_ID: modo prueba (los mensajes se imprimen, no se envían).');
}
if (!config.appSecret) {
  console.warn('Sin WHATSAPP_APP_SECRET: no se verifica la firma de Meta. Configúralo antes de producción.');
}

const whatsapp = crearClienteWhatsApp({ ...config, modoPrueba });
const sesiones = crearAlmacenSesiones({ minutosExpiracion: 30 });

// Por ahora los eventos (cálculos e interesados) se guardan en un archivo JSONL.
// Más adelante: base de datos / CRM.
const registrarEvento = (evento) =>
  appendFile('eventos.jsonl', `${JSON.stringify(evento)}\n`).catch((e) => console.error(e.message));

crearApp({ config, whatsapp, sesiones, registrarEvento }).listen(config.puerto, () => {
  console.log(`Independiente al Día escuchando en el puerto ${config.puerto}`);
});
