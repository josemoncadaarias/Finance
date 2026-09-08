# Contexto del proyecto

App móvil Android de finanzas personales, offline-first, con todos los datos
guardados localmente en el teléfono. Reemplaza y mejora Monefy.

Este archivo lo lee Claude Code automáticamente al abrir el proyecto.
Manténlo actualizado cuando tomemos decisiones nuevas.

---

## Sobre el usuario

- Jose, desarrollador full-stack. Fuerte en .NET, Angular, TypeScript, SQL, Azure.
- Nuevo en: Ionic, Capacitor, SQLite móvil, Git/GitHub para proyectos propios.
- Vive en Colombia. Ingresos en COP. Maneja cuentas en USD.
- Explicaciones: simples y claras, incluso en análisis técnico profundo.
- Antes de recomendar algo, verificarlo contra el código o los datos reales.
  Marcar explícitamente qué es supuesto y qué está verificado.
- Antes de aplicar un cambio, evaluar el riesgo de romper lo que ya funciona.

## Objetivo real de la app

No es solo registrar gastos. El objetivo de fondo es **previsibilidad
tributaria**: saber durante todo el año cuánto va a deber de impuesto de
renta, y por lo tanto cuánto hay que ahorrar cada mes para pagarlo con
plata ya apartada, sin sorpresas.

Todo lo demás (categorías, cuentas, gráficos) existe para alimentar eso.

---

## Decisiones ya tomadas

### Stack

| Pieza | Elección |
|---|---|
| Framework UI | Angular + Ionic |
| Empaquetado nativo | Capacitor |
| Base de datos | SQLite local (`@capacitor-community/sqlite`) |
| Lenguaje | TypeScript |
| IDE | VS Code |
| Android | Android Studio (solo por SDK, emulador y firma del APK) |

Se descartó .NET MAUI Blazor Hybrid pese a encajar mejor con la experiencia
de Jose: a la fecha tiene issues abiertos en Android (safe areas que dejan la
UI inutilizable en .NET 10, crashes al arrancar en emulador). No vale la pena
pelear con el framework en un proyecto de largo aliento.

### Reglas de negocio innegociables

1. **Offline-first.** La app nunca se rompe sin internet. Si falta un dato de
   red (TRM, tasa), se usa el último valor cacheado y se marca como tal.

2. **Dinero como enteros.** JavaScript no tiene decimal, todo es float64. Los
   montos se guardan como enteros en unidades mínimas (centavos para USD,
   pesos enteros para COP) y solo se formatean al mostrar. **Nunca sumar
   floats.** El backup de Monefy ya trae la basura típica: `9421.2800000000007`.

3. **Multimoneda con tasa por movimiento.** Cada movimiento en divisa guarda
   la tasa que aplicó ese banco en esa transacción, como dato editable. No se
   recalcula el histórico cuando cambia la TRM. La TRM oficial (Superfinanciera,
   API pública de datos.gov.co) es el ancla; la tasa del banco se deriva o se
   digita.

4. **Tarjetas de crédito como pasivo.** El saldo representa la deuda
   (negativo o cero). El cupo total es un atributo aparte. El cupo disponible
   se calcula: cupo total − deuda. No cuentan para el patrimonio como activo,
   pero sí restan como pasivo. En Monefy estaban mal modeladas (saldo inicial
   positivo de 800.000 = cupo, mezclando dos conceptos).

5. **Cuentas marcables como "no cuenta para patrimonio"**, igual que Monefy.

6. **Rendimientos y cashback viven aparte.** No se mezclan con el saldo de la
   cuenta que los generó. Módulo propio, porque tienen tratamiento tributario
   distinto.

7. **Todo editable.** Cualquier valor que la app calcule o traiga de internet
   debe poder sobreescribirse a mano. Además la app guarda ambos: el calculado
   y el ingresado manualmente, para poder compararlos.

8. **Formularios DIAN configurables.** El módulo tributario no debe quemar el
   formulario 210. Cada formulario es un conjunto de reglas y renglones
   configurables, para poder agregar otros después.

### Límites reales que no se deben prometer

- **La tasa que aplicó cada banco un día dado no es consultable en internet.**
  No existe fuente pública ni histórica. Solo existe la TRM oficial diaria.
- **Las tasas de rendimiento por banco tampoco son consultables de forma
  confiable.** Están en términos y condiciones que cambian sin aviso. La
  solución es un historial de tasas por cuenta (tasa E.A. con vigencia
  desde/hasta) que el usuario mantiene, y la app devenga día a día.
- **No usar un LLM para traer cifras exactas** (TRM, tasas). Inventa números.
  Para datos numéricos, APIs deterministas con caché local. Un LLM sí encaja
  para clasificar categorías automáticamente o leer un extracto bancario.

---

## Estado actual

Fase 0. Todavía no hay código. Lo siguiente es el modelo de datos y el
esquema SQLite (ver `docs/03-roadmap.md`).

## Pendientes de Jose

- Node 26.1.0 instalado (compartido con proyectos Angular del cliente).
  Está fuera del rango declarado por Angular (^20.19 || ^22.12 || ^24),
  pero funciona con advertencia. NO reemplazar: rompería el entorno de
  trabajo. Si el toolchain falla por versión, instalar fnm y aislar por
  proyecto con .node-version.

- [ ] Saldo real actual en USD de: ARQ (DolarApp), eToro, XTB, Plenti, Global66.
      Necesario para reconciliar el histórico importado (ver
      `docs/01-analisis-backup-monefy.md`).
- [ ] Confirmar si presenta hoy el formulario 210 y si aplica persona jurídica.

## Documentos

- `docs/01-analisis-backup-monefy.md` — qué trae el backup y sus problemas
- `docs/02-decisiones-tecnicas.md` — el porqué de cada decisión
- `docs/03-roadmap.md` — orden de trabajo por fases
- `docs/04-guia-stack.md` — introducción al stack para alguien que viene de .NET/Angular
- `data/monefy-backup-2026-09-07.xlsx` — backup real, 12.889 movimientos
