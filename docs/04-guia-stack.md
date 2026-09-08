# El stack explicado, viniendo de .NET y Angular

## Las piezas, en una frase cada una

**Angular** — ya lo conoces. Es exactamente el mismo Angular que usas en el
trabajo. Componentes, servicios, RxJS, inyección de dependencias. Nada nuevo.

**Ionic** — una librería de componentes visuales que se ven y se comportan
como app móvil nativa. Es *solo eso*: en vez de `<button>` usas
`<ion-button>`, en vez de armar un listado a mano usas `<ion-list>`. Sigue
siendo Angular por debajo. Comparable a usar Angular Material, pero pensado
para celular.

**Capacitor** — el puente. Toma tu app web (que es lo que Angular produce:
HTML, CSS y JS) y la mete dentro de un contenedor Android real. Ese
contenedor le da acceso a cosas del teléfono que el navegador no tiene:
SQLite, archivos, cámara, notificaciones. Lo instala el mismo equipo de Ionic.

**SQLite** — una base de datos que vive en un solo archivo dentro del
teléfono. SQL de toda la vida: `CREATE TABLE`, `SELECT`, `JOIN`. Si manejas
SQL Server, esto te va a parecer una versión reducida y sin servidor. No hay
que instalar ni configurar nada, no hay conexión de red, no hay usuarios.

**Android Studio** — no vas a programar ahí. Se instala porque trae el SDK de
Android, el emulador para probar sin celular, y las herramientas para firmar
el APK. Lo abres poco.

## Cómo se siente el ciclo de trabajo

```
ionic serve          → abre en el navegador, recarga al guardar
                       (aquí vas a pasar el 90% del tiempo)

ionic cap sync       → copia tu app web al proyecto Android
ionic cap run android → la instala en el emulador o en tu celular
```

Desarrollas en el navegador como cualquier app Angular. Solo compilas a
Android cuando quieras probar algo nativo o ver cómo se siente de verdad.

**Truco importante:** SQLite no existe en el navegador. El plugin
`@capacitor-community/sqlite` trae un modo web que emula la base usando
almacenamiento del navegador, para que puedas desarrollar sin compilar a
Android todo el tiempo. Hay que configurarlo desde el inicio.

## Equivalencias mentales desde .NET

| En .NET | Aquí |
|---|---|
| Solución / proyecto `.csproj` | carpeta con `package.json` |
| NuGet | npm |
| `dotnet restore` | `npm install` |
| `dotnet run` | `ionic serve` |
| EF Core + migraciones | SQL a mano, o Drizzle si queremos un ORM ligero |
| `decimal` | **no existe** → enteros en unidades mínimas |
| appsettings.json | `environment.ts` de Angular |

La diferencia que más te va a chocar es la del `decimal`. En C# sumas dinero
sin pensarlo. Aquí hay que ser disciplinado: todos los montos como enteros,
formateo solo al mostrar. Está explicado en `02-decisiones-tecnicas.md`.

## Lo que sí es nuevo y toma un rato

1. **El ciclo de build a Android.** La primera vez que corras
   `ionic cap run android` va a descargar Gradle y compilar, y se demora.
   Es normal. Las siguientes son rápidas.
2. **Los plugins de Capacitor.** Cada capacidad nativa es un paquete npm que
   además hay que sincronizar al proyecto Android (`ionic cap sync`). Si
   instalas un plugin y no sincronizas, no funciona y el error no es obvio.
3. **SQLite asíncrono.** Todas las operaciones devuelven Promise. Nada de
   consultas síncronas.

## Estructura que vamos a usar

```
src/
  app/
    core/          servicios transversales (db, tasas, formateo de dinero)
    data/          repositorios y modelos
    features/
      accounts/
      transactions/
      transfers/
      reports/
      taxes/
    shared/        componentes reutilizables
  assets/
```

Es la estructura estándar de Angular por features. Nada exótico.
