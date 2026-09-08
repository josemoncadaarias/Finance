# Puesta en marcha, paso a paso

Escrito para alguien que nunca ha montado un proyecto propio en GitHub.
Sigue el orden. No te saltes pasos.

---

## Paso 1 — Instalar lo necesario

Instala en este orden:

1. **Git** — https://git-scm.com/download/win
   En el instalador, deja todo por defecto. Solo asegúrate de que quede
   marcada la opción de agregar Git al PATH.

2. **Node.js LTS** — https://nodejs.org
   Elige la versión LTS (la de la izquierda), no la "Current".

3. **Android Studio** — https://developer.android.com/studio
   Es pesado (varios GB) y se demora. Déjalo instalando mientras haces otra
   cosa. Al abrirlo la primera vez, acepta el asistente que descarga el SDK.

4. **JDK 17** — Android Studio normalmente ya lo trae. Verifica después.

VS Code ya lo tienes.

**Verifica que todo quedó bien.** Abre una terminal nueva (PowerShell) y corre:

```bash
git --version
node --version
npm --version
```

Si alguno falla con "no se reconoce el comando", cierra y abre la terminal de
nuevo. Si sigue fallando, es que no quedó en el PATH.

Luego instala el CLI de Ionic:

```bash
npm install -g @ionic/cli
ionic --version
```

---

## Paso 2 — Configurar Git por primera vez

Solo se hace una vez en la vida por computador:

```bash
git config --global user.name "Tu Nombre"
git config --global user.email "tu@correo.com"
git config --global init.defaultBranch main
```

El correo debe ser el mismo con el que vas a crear la cuenta de GitHub.

---

## Paso 3 — Crear la carpeta del proyecto

Elige dónde va a vivir. Por ejemplo `C:\proyectos\finanzas-app`.

Descomprime ahí los archivos que te entregué. Te debe quedar así:

```
finanzas-app/
  CLAUDE.md
  README.md
  SETUP.md
  .gitignore
  docs/
    01-analisis-backup-monefy.md
    02-decisiones-tecnicas.md
    03-roadmap.md
    04-guia-stack.md
  data/
    monefy-backup-2026-09-07.xlsx
```

---

## Paso 4 — Convertirla en repositorio Git

Abre una terminal **dentro de esa carpeta** y corre:

```bash
git init
git add .
git commit -m "Contexto inicial del proyecto"
```

Qué acabas de hacer, en cristiano:

- `git init` → le dice a Git "vigila esta carpeta"
- `git add .` → "prepara todos estos archivos para guardar"
- `git commit` → "guarda una foto del estado actual con este mensaje"

Un commit es un punto al que siempre puedes volver. Haz commits seguido.

---

## Paso 5 — Subirlo a GitHub

1. Crea una cuenta en https://github.com si no tienes.
2. Botón **+** arriba a la derecha → **New repository**.
3. Nombre: `finanzas-app`. Marca **Private**.
4. **No** marques ninguna de las casillas de inicializar con README,
   .gitignore ni licencia. Ya los tienes localmente y chocarían.
5. Crear.

GitHub te va a mostrar unos comandos. Usa los de "push an existing
repository":

```bash
git remote add origin https://github.com/TU-USUARIO/finanzas-app.git
git branch -M main
git push -u origin main
```

Te va a pedir autenticarte. Se abre el navegador, autorizas, listo.

Refresca la página de GitHub: ahí deben estar tus archivos.

### El ciclo de aquí en adelante

Cada vez que trabajes:

```bash
git add .
git commit -m "descripción de lo que hiciste"
git push
```

Con eso basta por ahora. Ramas, merges y pull requests los vemos cuando
hagan falta; para un proyecto de una sola persona no los necesitas todavía.

---

## Paso 6 — Instalar Claude Code

```bash
npm install -g @anthropic-ai/claude-code
```

Luego, **parado en la carpeta del proyecto**:

```bash
cd C:\proyectos\finanzas-app
claude
```

La primera vez te pide autenticarte con tu cuenta de Anthropic.

Claude Code lee `CLAUDE.md` automáticamente al arrancar, así que ya llega con
todo el contexto de lo que decidimos. No tienes que explicar nada de nuevo.

También puedes usarlo desde VS Code instalando la extensión de Claude Code,
si prefieres tenerlo al lado del editor en vez de en una terminal aparte.

---

## Paso 7 — Primer mensaje en Claude Code

Cuando arranques, algo así:

```
Lee CLAUDE.md y docs/. Vamos por la Fase 1 del roadmap:
el modelo de datos y el esquema SQLite.
Antes de escribir código, muéstrame el diseño de tablas
propuesto para que lo revisemos.
```

De ahí en adelante la conversación sigue allá, con acceso al código real.

---

## Notas

- El proyecto Angular/Ionic **todavía no está creado**. Se crea en la Fase 1,
  desde Claude Code, para que veas cada paso.
- Si algo del setup falla, el error exacto es la mejor pista. Pégalo tal cual
  en Claude Code y se resuelve más rápido que buscándolo a ciegas.
