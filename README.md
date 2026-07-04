<h1 align="center">📦 this-xys/bails</h1>

<div align="center">

**Bails** es una librería en TypeScript basada en WebSockets para interactuar con la API de WhatsApp Web.

![Node](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen)
![License](https://img.shields.io/badge/license-MIT-blue)
![TypeScript](https://img.shields.io/badge/-TypeScript-3178C6?logo=typescript&logoColor=white)

</div>

<br/>

> [!NOTE]
> Bails no requiere Selenium, Puppeteer ni ningún navegador para funcionar. Se conecta directamente a WhatsApp Web mediante un **WebSocket**, lo que la hace mucho más liviana en consumo de RAM y CPU en comparación con soluciones basadas en navegador.

## Índice

- [¿Qué es Bails?](#qué-es-bails)
- [Características](#características)
- [Instalación](#instalación)
- [Inicio rápido](#inicio-rápido)
  - [Vinculación de la cuenta](#vinculación-de-la-cuenta)
  - [Guardado de credenciales](#guardado-de-credenciales)
- [Métodos de mensajería](#métodos-de-mensajería)
  - [`sendMessage`](#sendmessage-el-método-principal)
  - [Mensajes de texto](#mensajes-de-texto)
  - [Mensajes multimedia](#mensajes-multimedia)
  - [Ubicación y contactos](#ubicación-y-contactos)
  - [Encuestas, reacciones y botones](#encuestas-reacciones-y-botones)
  - [Editar, eliminar, reenviar y fijar](#editar-eliminar-reenviar-y-fijar)
  - [Mensajes enriquecidos](#mensajes-enriquecidos)
  - [Marcar un mensaje como generado por IA](#marcar-un-mensaje-como-generado-por-ia)
  - [Estados (historias)](#estados-historias)
  - [Recibos, lectura y presencia](#recibos-lectura-y-presencia)
- [Grupos, comunidades y canales](#grupos-comunidades-y-canales)
- [Perfil, privacidad y negocios](#perfil-privacidad-y-negocios)
- [Store (caché en memoria)](#store-caché-en-memoria)
- [Aviso legal](#aviso-legal)
- [Créditos](#créditos)

## ¿Qué es Bails?

**Bails** es una librería para conectarse a WhatsApp Web de forma directa, sin depender de un navegador ni de librerías de automatización como Selenium o Puppeteer. Toda la comunicación con WhatsApp ocurre a través de un **WebSocket**, tal como lo hace la propia versión web de WhatsApp, lo que se traduce en una librería rápida y liviana en recursos.

Es un fork de **Baileys**, y conserva casi toda su base: el protocolo, el cifrado, la arquitectura del socket y el manejo de credenciales. Además, incorpora algunos métodos para enviar mensajes con contenido enriquecido (tablas, listas, código y LaTeX) — más detalle en la sección [Mensajes enriquecidos](#mensajes-enriquecidos).

Este README está enfocado principalmente en explicar **cómo enviar cada tipo de mensaje**, ya que es lo que más se necesita a la hora de integrar la librería en un proyecto real.

## Características

- 🔌 Conexión directa por WebSocket, sin navegador de por medio.
- 💬 Envío de todo tipo de mensajes: texto, imágenes, video, audio, notas de voz, documentos, stickers, ubicación, contactos, encuestas y más.
- 🧩 Métodos para enviar mensajes enriquecidos: tablas, listas, código y LaTeX.
- 🤖 Marca de "generado por IA" en mensajes de chats individuales.
- 📸 Publicación de estados (historias) con notificación por menciones.
- 👥 Administración completa de grupos, comunidades y canales de difusión.
- 🔐 2 métodos de vinculación: código QR o código de emparejamiento.
- 🗂️ 3 formas de guardar credenciales: por archivos múltiples, un solo archivo o SQLite.

## Instalación

Instalación directa desde GitHub:

```bash
npm install github:this-xys/bails
```

> **Requisito:** Node.js **20** o superior.

Una vez instalada, importala en tu proyecto:

```ts
import makeWASocket from 'baileys'
```

## Inicio rápido

Para conectar una cuenta de WhatsApp a bails hacen falta dos cosas: **cómo se guardan las credenciales de la sesión** y **cómo se vincula el dispositivo** (que puede ser con código QR o con código de emparejamiento).

### Vinculación de la cuenta

Bails soporta los **2 métodos de vinculación** que ofrece WhatsApp:

#### 1. Con código QR

```ts
import makeWASocket, { useMultiFileAuthState } from 'baileys'

async function iniciar() {
  const { state, saveCreds } = await useMultiFileAuthState('sesion')

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true
  })

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', (update) => {
    console.log(update)
  })
}

iniciar()
```

Al iniciar, se imprime un código QR en la terminal que hay que escanear desde WhatsApp (Dispositivos vinculados → Vincular un dispositivo).

#### 2. Con código de emparejamiento

```ts
const sock = makeWASocket({
  auth: state,
  printQRInTerminal: false
})

if (!sock.authState?.creds?.registered) {
  const codigo = await sock.requestPairingCode('5215512345678') // número con código de país, sin +
  console.log('Tu código de emparejamiento es:', codigo)
}
```

En este caso, en vez de escanear un QR, WhatsApp te muestra en el celular un código de 8 caracteres que hay que ingresar desde la opción "Vincular con número de teléfono".

### Guardado de credenciales

Una vez vinculada la cuenta, bails necesita persistir las credenciales para no tener que volver a escanear el QR o pedir el código cada vez. Hay **3 formas** de hacerlo, todas exportadas por la librería:

| Método | Cómo guarda los datos | Cuándo conviene |
|---|---|---|
| `useMultiFileAuthState('carpeta')` | Un archivo por cada clave, dentro de una carpeta | Uso por defecto, ideal para desarrollo y bots simples |
| `useSingleFileAuthState('archivo.json')` | Todo en un único archivo JSON | Cuando querés portar la sesión fácilmente como un solo archivo |
| `useSqliteAuthState({ dbPath: 'sesion.db' })` | En una base de datos SQLite (requiere `better-sqlite3`) | Bots con mucho volumen de claves o que necesitan acceso concurrente |

Ejemplo con SQLite:

```ts
import makeWASocket, { useSqliteAuthState } from 'baileys'

const { state, saveCreds } = await useSqliteAuthState({ dbPath: 'sesion.db' })

const sock = makeWASocket({ auth: state })
sock.ev.on('creds.update', saveCreds)
```

## Métodos de mensajería

Todos los métodos de envío viven dentro del objeto `sock` que devuelve `makeWASocket()`. La firma general es siempre parecida: reciben el **JID** (identificador del chat) y el contenido del mensaje.

Formatos de JID más comunes:

| Tipo de chat | Formato de JID |
|---|---|
| Contacto individual | `5215512345678@s.whatsapp.net` |
| Grupo | `1234567890@g.us` |
| Canal de difusión (newsletter) | `1234567890@newsletter` |
| Estado (historia) | `status@broadcast` |
| Identificador LID | `123456789@lid` |

> **¿Qué es un LID?** Es un identificador que WhatsApp usa como capa de privacidad: en ciertos contextos (por ejemplo, dentro de comunidades) un contacto no se identifica con su número de teléfono (`@s.whatsapp.net`) sino con un `@lid`, un ID que no revela el número real. Bails mantiene internamente una tabla de equivalencias entre el LID y el número de teléfono real (`LIDMappingStore`) para poder cifrar y enviar los mensajes correctamente sin que tengas que hacer nada manualmente. Si necesitás revisarlo, `isLidUser(jid)` te dice si un JID es de tipo LID.

### `sendMessage` — el método principal

```ts
await sock.sendMessage(jid, contenido, opciones)
```

- **`jid`** *(string)*: destinatario del mensaje (contacto, grupo, canal o `status@broadcast` para estados).
- **`contenido`** *(`AnyMessageContent`)*: define qué tipo de mensaje se envía (texto, imagen, video, encuesta, etc. — ver detalle abajo).
- **`opciones`** *(`MiscMessageGenerationOptions`, opcional)*: permite, entre otras cosas:
  - `quoted`: el mensaje al que se responde (citar).
  - `messageId`: forzar un ID de mensaje propio.
  - `ephemeralExpiration`: duración de los mensajes efímeros.
  - `mediaUploadTimeoutMs`: tiempo máximo para subir archivos.

Todos los métodos de envío devuelven una promesa que se resuelve con el mensaje ya construido y enviado (`WAMessage`), el cual podés guardar para citarlo, editarlo o eliminarlo más adelante.

El resto de los métodos de esta sección (`sendTable`, `sendList`, `sendCodeBlock`, etc.) son en realidad **atajos**: por debajo construyen el `contenido` correcto y llaman a `relayMessage` por vos, para que no tengas que armar la estructura del mensaje a mano.

### Mensajes de texto

```ts
await sock.sendMessage(jid, { text: 'Hola, esto es Bails 👋' })
```

Con vista previa de enlace desactivada:

```ts
await sock.sendMessage(jid, { text: 'Mirá esto: https://ejemplo.com', linkPreview: null })
```

Citando un mensaje:

```ts
await sock.sendMessage(jid, { text: 'Respondiendo a tu mensaje' }, { quoted: mensajeOriginal })
```

### Mensajes multimedia

| Tipo | Campo | Ejemplo |
|---|---|---|
| Imagen | `image` | `{ image: { url: './foto.jpg' }, caption: 'Mirá esto' }` |
| Video | `video` | `{ video: { url: './video.mp4' }, caption: 'Un video', gifPlayback: false }` |
| Nota de voz | `audio` + `ptt: true` | `{ audio: { url: './audio.mp3' }, ptt: true }` |
| Audio normal | `audio` | `{ audio: { url: './cancion.mp3' }, mimetype: 'audio/mp4' }` |
| Video nota (círculo) | `video` + `ptv: true` | `{ video: { url: './nota.mp4' }, ptv: true }` |
| Sticker | `sticker` | `{ sticker: { url: './sticker.webp' } }` |
| Documento | `document` | `{ document: { url: './archivo.pdf' }, mimetype: 'application/pdf', fileName: 'informe.pdf' }` |
| Paquete de stickers | `stickerPack` | `{ stickerPack: { name: 'Mi pack', cover: {...}, stickers: [...] } }` |
| Álbum (varias fotos/videos) | `album` | `{ album: { images: [...], videos: [...] } }` |

Ejemplo completo:

```ts
await sock.sendMessage(jid, {
  image: { url: './foto.jpg' },
  caption: 'Foto enviada desde Bails'
})
```

> `WAMediaUpload` acepta una URL (`{ url: '...' }`), un `Buffer` o un `Stream`, tanto para archivos locales como remotos.

### Ubicación y contactos

```ts
// Ubicación
await sock.sendMessage(jid, {
  location: { degreesLatitude: 19.4326, degreesLongitude: -99.1332, name: 'CDMX' }
})

// Contacto (vCard)
await sock.sendMessage(jid, {
  contacts: {
    displayName: 'Soporte',
    contacts: [{ vcard: 'BEGIN:VCARD\nVERSION:3.0\nFN:Soporte\nTEL:+521234567890\nEND:VCARD' }]
  }
})
```

### Encuestas, reacciones y botones

```ts
// Encuesta
await sock.sendMessage(jid, {
  poll: { name: '¿Cuál prefieres?', values: ['Opción A', 'Opción B'], selectableCount: 1 }
})

// Reacción a un mensaje
await sock.sendMessage(jid, { react: { text: '🔥', key: mensaje.key } })

// Respuesta a un botón / lista (uso interno al procesar interacciones)
await sock.sendMessage(jid, { buttonReply: { displayText: 'Sí', id: 'btn_si', index: 0 }, type: 'plain' })
```

### Editar, eliminar, reenviar y fijar

```ts
// Editar un mensaje ya enviado
await sock.sendMessage(jid, { text: 'Texto corregido', edit: mensajeAnterior.key })

// Eliminar (para todos)
await sock.sendMessage(jid, { delete: mensaje.key })

// Reenviar un mensaje
await sock.sendMessage(jid, { forward: mensajeOriginal })

// Fijar un mensaje en el chat (24h, 7 días o 30 días)
await sock.sendMessage(jid, { pin: mensaje.key, type: 1, time: 86400 })
```

### Mensajes enriquecidos

Estos métodos permiten enviar contenido "enriquecido" reutilizando el mismo formato interno que WhatsApp usa para las respuestas de Meta AI (tablas, código con resaltado de sintaxis, LaTeX, etc.), sin tener que armar el protobuf a mano.

**`sendTable`** — envía una tabla con encabezados y filas:

```ts
await sock.sendTable(
  jid,
  'Precios',
  ['Producto', 'Precio'],
  [['Café', '$50'], ['Té', '$40']],
  undefined,
  { footer: 'Precios sujetos a cambio' }
)
```

**`sendList`** — envía una lista simple de elementos:

```ts
await sock.sendList(jid, 'Tareas pendientes', ['Comprar pan', 'Enviar reporte', 'Llamar al cliente'])
```

**`sendCodeBlock`** — envía código con resaltado de sintaxis (soporta `javascript`, `typescript`, `python`, entre otros):

```ts
await sock.sendCodeBlock(jid, 'console.log("Hola mundo")', undefined, { language: 'javascript', title: 'Ejemplo' })
```

**`sendLatex`** — envía una o más expresiones matemáticas en formato LaTeX:

```ts
await sock.sendLatex(jid, undefined, {
  text: 'La fórmula cuadrática es:',
  expressions: [{ latexExpression: 'x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}' }]
})
```

**`sendRichMessage`** — envía una combinación libre de sub-mensajes (texto, tabla, código, LaTeX, imágenes) en un solo mensaje:

```ts
await sock.sendRichMessage(jid, [
  { messageType: RichSubMessageType.TEXT, messageText: 'Resultado del análisis:' },
  { messageType: RichSubMessageType.TABLE, tableMetadata: { title: 'Datos', rows: [...] } }
])
```

**`captureUnifiedResponse`** / **`sendUnifiedResponse`** — permiten capturar la respuesta enriquecida de un mensaje recibido y reenviarla o reutilizarla tal cual:

```ts
const capturado = sock.captureUnifiedResponse(mensajeRecibido.message)
if (capturado) {
  await sock.sendUnifiedResponse(otroJid, undefined, capturado)
}
```

**`updateMediaMessage`** — re-sube un archivo multimedia cuyo enlace venció, para poder reenviarlo:

```ts
await sock.updateMediaMessage(mensajeConMediaVencido)
```

### Marcar un mensaje como generado por IA

Cualquier mensaje regular (texto, imagen, video, etc.) puede llevar la etiqueta/icono de "generado por IA" que WhatsApp muestra junto al mensaje, agregando la propiedad `ai: true` al contenido:

```ts
await sock.sendMessage(jid, { text: 'Esta respuesta la generó un modelo de IA', ai: true })
```

> ⚠️ Esta marca **solo funciona en chats individuales** (no en grupos). Si se intenta usar `ai: true` en un grupo, bails lanza un error indicando que el icono de IA solo está permitido en chats privados.

### Estados (historias)

`sendStatusWhatsApp` publica un estado (historia) en tu cuenta. A diferencia de `sendMessage`, este método está pensado para trabajar junto con **menciones**: el segundo parámetro es un arreglo de JIDs (contactos o grupos) a los que se les notifica que fueron mencionados en el estado.

```ts
await sock.sendStatusWhatsApp(
  { text: 'Nuevo estado 🚀', backgroundColor: '#25D366' },
  [contactoJid, grupoJid] // se les notifica el estado como mención
)
```

- Si se pasa un JID de grupo, se les notifica automáticamente a todos sus participantes.
- Si no se pasa ningún JID, el estado se publica igual, pero sin generar ninguna notificación de mención a otros contactos.
- Para contenido multimedia (imagen, video, audio) en el estado, se pueden combinar los mismos campos que en `sendMessage` (`image`, `video`, `audio`), y bails ajusta automáticamente el color de fondo y la fuente cuando corresponde.

### Recibos, lectura y presencia


```ts
// Marcar mensajes como leídos (doble check azul)
await sock.readMessages([mensaje.key])

// Enviar un recibo manualmente
await sock.sendReceipt(jid, participante, [id], 'read')

// Actualizar presencia (escribiendo, grabando audio, en línea)
await sock.sendPresenceUpdate('composing', jid) // 'available' | 'unavailable' | 'composing' | 'recording' | 'paused'

// Suscribirse a la presencia de un contacto
await sock.presenceSubscribe(jid)
```

## Grupos, comunidades y canales

Bails conserva toda la funcionalidad estándar de Baileys para administrar grupos, comunidades (grupos con subgrupos) y canales de difusión (newsletters):

```ts
await sock.groupCreate('Mi grupo', [jid1, jid2])
await sock.groupParticipantsUpdate(jid, [participante], 'add') // 'add' | 'remove' | 'promote' | 'demote'
await sock.groupInviteCode(jid)

await sock.communityCreate('Mi comunidad', 'Descripción')

await sock.newsletterCreate('Mi canal', 'Descripción del canal')
```

## Perfil, privacidad y negocios

```ts
await sock.updateProfileName('Mi Bot')
await sock.updateProfileStatus('Disponible 24/7')
await sock.updateProfilePicture(jid, { url: './avatar.jpg' })

await sock.updateBlockStatus(jid, 'block') // o 'unblock'

// API de negocios (catálogo, pedidos)
await sock.getCatalog({ jid })
await sock.productCreate({ ... })
```

## Store (caché en memoria)

El **Store** es un caché en memoria de chats, contactos, mensajes y metadata de grupos, que se va llenando solo a medida que van llegando eventos (`sock.ev`). El Baileys oficial más reciente **eliminó este módulo** de la librería; en bails se mantiene disponible porque resuelve un problema muy común al hacer un bot: no depender de volver a pedirle todo a WhatsApp (mensaje anterior, foto de perfil, metadata de un grupo) cada vez que se necesita.

### ¿Cuándo conviene usarlo?

- Si tu bot necesita **buscar mensajes anteriores** (por ejemplo, para citar o reenviar algo que no tenés a mano).
- Si querés **listar los chats o contactos** sin tener que reconstruirlos manualmente desde los eventos.
- Si hacés muchas consultas de `groupMetadata` o `profilePictureUrl` y no querés golpear la API de WhatsApp cada vez.

Si tu bot es simple y solo responde a mensajes entrantes sin necesitar historial, podés omitirlo sin problema; el store consume RAM porque guarda todo en memoria.

### Uso

```ts
import makeWASocket, { makeInMemoryStore, useMultiFileAuthState } from 'baileys'

const store = makeInMemoryStore({})
store.readFromFile('./store.json') // opcional: cargar datos guardados de una corrida anterior

const { state, saveCreds } = await useMultiFileAuthState('sesion')
const sock = makeWASocket({ auth: state })

store.bind(sock.ev) // conecta el store a todos los eventos del socket

sock.ev.on('creds.update', saveCreds)

// Guardar el store a disco cada cierto tiempo
setInterval(() => {
  store.writeToFile('./store.json')
}, 10_000)

// Ejemplos de consulta
const chats = store.chats.all()
const contacto = store.contacts['5215512345678@s.whatsapp.net']
const mensaje = await store.loadMessage(jid, mensajeId)
```

## Aviso legal

Este proyecto no está afiliado, asociado, autorizado ni respaldado de ninguna forma por WhatsApp Inc. ni por Meta. "WhatsApp" y las marcas relacionadas son propiedad de sus respectivos dueños.

El uso de esta librería es responsabilidad exclusiva de quien la implementa. Se recomienda no usarla para spam, mensajería masiva no solicitada ni cualquier práctica que viole los Términos de Servicio de WhatsApp.

## Créditos

**Bails** es un fork de **[Baileys](https://github.com/WhiskeySockets/Baileys)**, la librería original mantenida por la comunidad de **WhiskeySockets**. Gran parte de la base de este proyecto —el manejo del protocolo de WhatsApp Web, el cifrado, la arquitectura del socket y la mayoría del código— proviene de ese trabajo original.

- Repositorio oficial: https://github.com/WhiskeySockets/Baileys
- Licencia: MIT

Si esta librería te resulta útil, considerá también dar reconocimiento y apoyo al proyecto original. 🙌

---

<div align="center">Hecho con 💙 por <b>this-xys</b></div>
