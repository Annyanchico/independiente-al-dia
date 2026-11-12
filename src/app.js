import express from 'express';
import { procesarMensaje } from './conversacion.js';
import { extraerMensajes, firmaValida } from './whatsapp.js';
import { crearDeduplicador } from './sesiones.js';

/**
 * Crea la aplicación Express del webhook.
 * Recibe sus dependencias para poder probarla sin WhatsApp real.
 */
export function crearApp({ config, whatsapp, sesiones, registrarEvento = () => {}, logger = console }) {
  const app = express();
  const yaProcesado = crearDeduplicador();

  // Guardamos el cuerpo crudo para verificar la firma de Meta
  app.use(express.json({ verify: (req, _res, buf) => { req.cuerpoCrudo = buf; } }));

  app.get('/salud', (_req, res) => res.json({ ok: true }));

  // Verificación del webhook (Meta llama esto al configurar la URL)
  app.get('/webhook', (req, res) => {
    const modo = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const reto = req.query['hub.challenge'];
    if (modo === 'subscribe' && token === config.verifyToken) {
      logger.log('Webhook verificado por Meta');
      return res.status(200).send(reto);
    }
    return res.sendStatus(403);
  });

  // Mensajes entrantes
  app.post('/webhook', async (req, res) => {
    if (!firmaValida(req.cuerpoCrudo ?? Buffer.from(''), req.get('x-hub-signature-256'), config.appSecret)) {
      logger.warn('Firma inválida: petición rechazada');
      return res.sendStatus(401);
    }

    // Respondemos 200 de inmediato; Meta reintenta si tardamos
    res.sendStatus(200);

    for (const msg of extraerMensajes(req.body)) {
      if (yaProcesado(msg.id)) continue;
      try {
        await atender(msg);
      } catch (err) {
        logger.error(`Error atendiendo a ${msg.de}:`, err.message);
      }
    }
  });

  async function atender({ id, de, nombre, entrada }) {
    whatsapp.marcarLeido(id).catch(() => {});
    const sesion = await sesiones.obtener(de);
    const { sesion: nueva, respuestas, evento } = procesarMensaje(sesion, entrada);
    await sesiones.guardar(de, nueva);
    for (const r of respuestas) {
      await whatsapp.enviar(de, r);
    }
    if (evento) registrarEvento({ ...evento, usuario: de, nombre, fecha: new Date().toISOString() });
  }

  return app;
}
