// Cliente de la WhatsApp Cloud API de Meta.
// Traduce los mensajes neutros del flujo (texto, botones, lista) al formato de WhatsApp.

import crypto from 'node:crypto';

export function crearClienteWhatsApp({ token, phoneNumberId, version = 'v25.0', modoPrueba = false, logger = console }) {
  const url = `https://graph.facebook.com/${version}/${phoneNumberId}/messages`;

  async function llamarAPI(cuerpo) {
    if (modoPrueba) {
      logger.log('[modo prueba] →', JSON.stringify(cuerpo));
      return { modoPrueba: true };
    }
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(cuerpo),
    });
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      const detalle = json?.error?.message ?? resp.statusText;
      throw new Error(`WhatsApp API ${resp.status}: ${detalle}`);
    }
    return json;
  }

  return {
    enviar(destino, mensaje) {
      return llamarAPI({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: destino,
        ...aFormatoWhatsApp(mensaje),
      });
    },
    marcarLeido(messageId) {
      return llamarAPI({ messaging_product: 'whatsapp', status: 'read', message_id: messageId });
    },
  };
}

// Límites de WhatsApp: botón máx. 20 caracteres, máx. 3 botones;
// fila de lista máx. 24 caracteres de título y 72 de descripción.
export function aFormatoWhatsApp(mensaje) {
  switch (mensaje.tipo) {
    case 'texto':
      return { type: 'text', text: { body: mensaje.texto, preview_url: false } };

    case 'botones':
      return {
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text: mensaje.texto },
          action: {
            buttons: mensaje.opciones.slice(0, 3).map((o) => ({
              type: 'reply',
              reply: { id: o.id, title: o.titulo.slice(0, 20) },
            })),
          },
        },
      };

    case 'lista':
      return {
        type: 'interactive',
        interactive: {
          type: 'list',
          body: { text: mensaje.texto },
          action: {
            button: mensaje.boton.slice(0, 20),
            sections: [{
              title: 'Opciones',
              rows: mensaje.opciones.slice(0, 10).map((o) => ({
                id: o.id,
                title: o.titulo.slice(0, 24),
                description: o.descripcion?.slice(0, 72),
              })),
            }],
          },
        },
      };

    default:
      throw new Error(`Tipo de mensaje no soportado: ${mensaje.tipo}`);
  }
}

// Extrae los mensajes entrantes del payload del webhook.
export function extraerMensajes(payload) {
  const mensajes = [];
  for (const entry of payload?.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value ?? {};
      for (const m of value.messages ?? []) {
        const nombre = value.contacts?.find((c) => c.wa_id === m.from)?.profile?.name;
        mensajes.push({ id: m.id, de: m.from, nombre, entrada: aEntrada(m) });
      }
    }
  }
  return mensajes;
}

function aEntrada(m) {
  if (m.type === 'text') return { tipo: 'texto', valor: m.text?.body ?? '' };
  if (m.type === 'interactive') {
    const r = m.interactive?.button_reply ?? m.interactive?.list_reply;
    return { tipo: 'boton', valor: r?.id ?? '' };
  }
  if (m.type === 'button') return { tipo: 'texto', valor: m.button?.text ?? '' }; // botón de plantilla
  return { tipo: 'otro', valor: m.type };
}

// Verifica que el webhook venga de Meta (encabezado X-Hub-Signature-256).
export function firmaValida(cuerpoCrudo, firma, appSecret) {
  if (!appSecret) return true; // sin secreto configurado (solo desarrollo)
  if (!firma?.startsWith('sha256=')) return false;
  const esperada = crypto.createHmac('sha256', appSecret).update(cuerpoCrudo).digest('hex');
  const recibida = firma.slice('sha256='.length);
  return recibida.length === esperada.length
    && crypto.timingSafeEqual(Buffer.from(recibida, 'hex'), Buffer.from(esperada, 'hex'));
}
