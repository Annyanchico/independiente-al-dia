# Independiente al Día — Asistente de WhatsApp

Asistente por WhatsApp que calcula los aportes a seguridad social de trabajadores independientes en Colombia (IBC, salud, pensión, Fondo de Solidaridad y ARL) con la normativa 2026.

Esta es la **fase 1 (validación)**: calculadora gratuita y captura de interesados en el plan pago.

## Qué hace

1. Saluda y ofrece calcular aportes o explicar qué es el IBC.
2. Pregunta si la persona tiene contrato de prestación de servicios o trabaja por cuenta propia.
3. Pide los ingresos del mes (entiende "3.500.000", "3,5 millones", "800 mil"…) y, si es cuenta propia, los costos.
4. Si es contrato, pide la clase de riesgo de la ARL.
5. Muestra el detalle y el total a pagar, y pregunta si le interesa el plan mensual.
6. Guarda cada cálculo y cada interesado en `eventos.jsonl`.

## Estructura

```
src/
  config/parametros-2026.js  ← valores normativos (SMMLV, tarifas, FSP, ARL). Se actualiza cada año.
  calculadora.js             ← cálculo de aportes (función pura)
  conversacion.js            ← flujo de preguntas y respuestas (función pura)
  whatsapp.js                ← cliente de la Cloud API de Meta, lectura del webhook y firma
  sesiones.js                ← estado de cada conversación (en memoria, 30 min)
  app.js                     ← servidor Express: /webhook y /salud
  server.js                  ← arranque y configuración
test/                        ← 19 pruebas (calculadora, conversación, webhook)
```

## Correr en tu computador

Necesitas Node.js 20 o superior.

```bash
npm install
cp .env.example .env      # y llena los valores
npm test                  # corre las pruebas
npm run dev               # arranca el servidor en http://localhost:3000
```

Sin `WHATSAPP_TOKEN` el servidor arranca en **modo prueba**: imprime en consola lo que enviaría, sin mandarlo.

Para que Meta llegue a tu computador necesitas una URL pública con HTTPS. Para pruebas sirve un túnel:

```bash
npx cloudflared tunnel --url http://localhost:3000
# o: ngrok http 3000
```

## Configurar WhatsApp en Meta (paso a paso)

### 1. Portafolio comercial
- Entra a [business.facebook.com](https://business.facebook.com) y crea o usa el portafolio de **TITANTECH S.A.S.**
- Inicia la **verificación de la empresa** (NIT, certificado de Cámara de Comercio, dominio o teléfono). Sin verificación hay límites de envío.

### 2. Crear la app
- Entra a [developers.facebook.com](https://developers.facebook.com) → **Mis apps** → **Crear app**.
- Caso de uso: **Conectar con clientes a través de WhatsApp**. Asóciala al portafolio de TITANTECH.

### 3. Probar con el número de prueba
- En **WhatsApp → Configuración de la API** (API Setup) encuentras:
  - El **token de acceso temporal** (dura 24 horas) → `WHATSAPP_TOKEN`
  - El **identificador del número de teléfono** (Phone number ID) → `WHATSAPP_PHONE_NUMBER_ID`
- Agrega tu celular como destinatario de prueba (hasta 5 números).
- En **Configuración de la app → Básica** copia la **clave secreta** → `WHATSAPP_APP_SECRET`

### 4. Conectar el webhook
- Arranca el servidor y el túnel.
- En **WhatsApp → Configuración** (Configuration) → **Webhook** → **Editar**:
  - URL de devolución de llamada: `https://TU-URL/webhook`
  - Token de verificación: el mismo texto que pusiste en `WHATSAPP_VERIFY_TOKEN`
- Pulsa **Verificar y guardar** y luego suscríbete al campo **messages**.
- Escríbele "hola" al número de prueba desde tu celular. Debe responder el menú.

### 5. Pasar a producción
- **Número propio**: agrega un número que NO esté en uso en la app normal de WhatsApp (o elimínalo de ella primero). Se verifica por SMS o llamada.
- **Nombre para mostrar**: "Independiente al Día" (Meta lo revisa).
- **Método de pago** en la cuenta de WhatsApp Business (se cobra por mensaje de plantilla y, desde octubre de 2026, por mensajes de servicio después de los primeros 1.000 al mes).
- **Token permanente**: en el portafolio → **Configuración del negocio → Usuarios del sistema** → crea un usuario administrador → asígnale la app y la cuenta de WhatsApp → genera un token con los permisos `whatsapp_business_messaging` y `whatsapp_business_management`. Ese reemplaza el temporal en `WHATSAPP_TOKEN`.
- **Política de privacidad**: Meta exige una URL pública. Debe cumplir la Ley 1581 de 2012 (habeas data).
- Cambia la app a modo **En vivo** (Live).

### 6. Publicar el servidor
Cualquier hosting de Node.js con HTTPS sirve (Railway, Render, Fly.io o un VPS). Configura las mismas variables de `.env` en el hosting y actualiza la URL del webhook en Meta.

## Antes de producción (pendientes)

- [ ] Revisar con el equipo contable las tarifas del Fondo de Solidaridad frente a la reforma pensional (Ley 2381 de 2024) y la presunción de costos del Decreto 379 de 2026.
- [ ] Cambiar `sesiones.js` y `eventos.jsonl` por una base de datos (por ejemplo PostgreSQL o Redis).
- [ ] Crear plantillas de **utilidad** en Meta para los recordatorios de fecha límite.
- [ ] Agregar fechas límite de pago según los dos últimos dígitos del documento.
- [ ] Entender audios con IA (transcripción) y preguntas libres.
- [ ] Integración con un operador PILA para generar la planilla y el link de pago.
