# Play Console: todo lo que falta, paso a paso

Guía para Jose (2026-10-09). Cada bloque gris tiene un botón para copiar
(arriba a la derecha) cuando se abre en GitHub. Donde dice **Marca**, es la
opción a escoger; donde hay un bloque, se pega tal cual.

Ya hecho: Sign in details ("No"), SMS and Call log permissions, Foreground
service permissions.

Todo se encuentra en **Monitor and improve → Policy and programs → App
content** (las declaraciones) o en **Grow users → Store presence** (la ficha).
Al terminar cada uno: **Save**. No envíes nada a revisión hasta el paso 13.

---

## 1. Privacy policy (App content)

```
https://jadexlabs-finance.netlify.app/privacy.html
```

## 2. Ads (App content)

**Marca:** No, my app does not contain ads.

## 3. Content rating (App content)

1. **Start questionnaire.** Email:
   ```
   jadex.apps@gmail.com
   ```
2. Category: **All Other App Types**.
3. A todas las preguntas (violencia, sexo, lenguaje, drogas, apuestas,
   miedo...): **No**.
4. Si pregunta por interacción entre usuarios, compartir ubicación o compras
   digitales: **No** (la app no tiene chat, no usa ubicación y aún no vende
   nada).
5. Si pregunta si la app es un navegador o da acceso libre a internet: **No**.
6. **Save → Next → Submit**. Debe salir para todo público.

## 4. Target audience and content (App content)

- Target age: **18 and over** (solo esa).
- Appeal to children: **No**.

## 5. News apps (App content)

**Marca:** No.

## 6. Government apps (App content)

**Marca:** No.

## 7. Financial features (App content)

La app no es banco, no presta, no mueve plata ni vende inversiones: solo
registra y calcula.

- **Marca** la opción de manejo de finanzas personales / presupuesto
  (en inglés suele decir *Personal finance*, *Budgeting* o *Financial
  management / tracking*), y nada más.
- Si no aparece una así: **My app doesn't provide any financial features**.
- Si pide una licencia o documento: no aplica para este tipo; si insiste,
  mándame la captura antes de seguir.

## 8. Health apps (App content)

**Marca:** My app does not have any health features.

## 9. Data safety (App content)

Lo honesto, sin exagerar: todo vive en el celular, pero la **copia en
Google Drive** (opcional, en el Drive de la persona) sí saca datos del
celular, y Google cuenta eso como "recolección".

**Pantalla Data collection and security**
- Does your app collect or share any of the required user data types?
  **Yes**
- Is all of the user data collected by your app encrypted in transit?
  **Yes**
- Which of the following methods of account creation does your app support?
  **My app does not allow users to create an account**
  (el inicio con Google es opcional y solo sirve para la copia en Drive.)
- Si pregunta por un enlace para borrar datos: no aplica (no hay cuentas).

**Pantalla Data types** — marca solo estos tres:
- Financial info → **Purchase history**
- Financial info → **Other financial info**
- Messages → **SMS or MMS**

**Para cada uno de los tres**, las mismas respuestas:
- Collected: **Yes** · Shared: **No**
- Is this data processed ephemerally? **No**
- Is this data required or can users choose? **Users can choose whether
  this data is collected** (la copia en Drive es opcional)
- Why is this user data collected? **App functionality** (solo esa)

**Al final:** revisa el resumen y **Save**.

## 10. App category and contact details (Grow users → Store presence → Store settings)

- App or game: **App**
- Category: **Finance**
- Tags: si pide, elige las que digan *Personal finance* / *Budget* /
  *Expense tracker* (máximo 5).
- Email:
  ```
  jadex.apps@gmail.com
  ```
- Website:
  ```
  https://jadexlabs-finance.netlify.app
  ```
- Phone: déjalo vacío (es opcional).

## 11. Main store listing (Grow users → Store presence → Main store listing)

Idioma por defecto: **Spanish (Latin America) – es-419**. Los textos están
en `store/play-listing.es.md` (nombre, descripción corta y larga): copia
cada uno en su campo.

Imágenes (en `store/` y en tu Drive, carpeta *Finance App/Play Store*):
- App icon: `icon-512.png`
- Feature graphic: `feature-graphic-1024x500.png`
- Phone screenshots: los 8 de `screenshots/`

Las capturas son del diseño anterior. Sirven para las pruebas; antes de
publicar a todo el mundo las cambiamos por unas del diseño nuevo.

## 12. Revisión final

En **Dashboard → Finish setting up your app** todo debe quedar en verde.
Si algo queda pendiente, mándame la captura.

## 13. Prueba cerrada: lo que pone a correr el reloj

Google exige, para cuentas personales, una **prueba cerrada con al menos 12
personas durante 14 días seguidos** antes de publicar. Conviene tener 15 o 16
por si alguien se sale. Tú puedes estar en la lista, pero no cuentes contigo
para llegar a 12 (no está claro que Google cuente la cuenta del dueño).

Qué les pides a las personas: un correo de Gmail y un celular Android; que
acepten la invitación, instalen la app desde Play Store y no la desinstalen
en 14 días. No hace falta que la usen mucho.

**Entrar:** https://play.google.com/console → *Finance: gastos y
rendimientos* → menú izquierdo **Test and release → Testing → Closed
testing**.

1. En la pista que ya viene (**Alpha** o *Closed testing*): **Manage track**.
2. Pestaña **Testers** → **Create email list** → nombre: `Probadores` →
   pega los correos separados por coma → **Save**. Deja esa lista marcada →
   **Save**.
3. Pestaña **Countries / regions** → **Add countries / regions** →
   **Colombia** (y el país de quien viva afuera) → **Save**.
4. Arriba: **Create new release** → **Add from library** → la versión más
   alta (1078 o mayor) → **Add to release** → **Next**.
5. En *Release notes* pega:
   ```
   <es-419>
   Primera versión de prueba.
   </es-419>
   ```
   → **Next** → **Save**.
6. Menú izquierdo: **Publishing overview** → **Send changes for review** →
   confirmar. Google revisa (de horas a unos días) y avisa por correo.
7. Cuando esté aprobada: **Closed testing → Manage track → Testers** →
   abajo, **Copy link** (el enlace para unirse). Mándalo a las personas con
   este mensaje:
   ```
   Hola, te pido un favor: ayúdame a probar mi app. Abre este enlace con tu
   Gmail desde el celular, toca "Become a tester" / "Ser tester", y luego
   "Download it on Google Play" para instalarla. Déjala instalada al menos
   14 días, no tienes que usarla. ¡Gracias!
   ENLACE
   ```
8. Desde que 12 o más estén dentro, cuentan los 14 días. El Dashboard
   muestra cuántos van ("testers currently opted-in").

Si Google rechaza algo en la revisión, llega un correo con el motivo:
mándamelo y lo corregimos.
