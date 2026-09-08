# The stack explained, coming from .NET and Angular

## The pieces, one sentence each

**Angular** — you already know it. It is exactly the same Angular you use at
work. Components, services, RxJS, dependency injection. Nothing new.

**Ionic** — a library of visual components that look and behave like a native
mobile app. That is *all* it is: instead of `<button>` you use `<ion-button>`,
instead of hand-rolling a list you use `<ion-list>`. It is still Angular
underneath. Comparable to using Angular Material, but designed for phones.

**Capacitor** — the bridge. It takes your web app (which is what Angular
produces: HTML, CSS and JS) and puts it inside a real Android container. That
container gives it access to phone features the browser does not have: SQLite,
files, camera, notifications. Built by the same team as Ionic.

**SQLite** — a database that lives in a single file on the phone. Plain old
SQL: `CREATE TABLE`, `SELECT`, `JOIN`. If you know SQL Server, this will feel
like a reduced, serverless version. Nothing to install or configure, no network
connection, no users.

**Android Studio** — you will not write code there. It is installed because it
brings the Android SDK, the emulator for testing without a phone, and the
tooling to sign the APK. You will barely open it.

## What the work cycle feels like

```
ionic serve          → opens in the browser, reloads on save
                       (this is where you'll spend 90% of your time)

ionic cap sync       → copies your web app into the Android project
ionic cap run android → installs it on the emulator or your phone
```

You develop in the browser like any Angular app. You only build for Android
when you want to test something native or see how it really feels.

**Important trick:** SQLite does not exist in the browser. The
`@capacitor-community/sqlite` plugin ships a web mode that emulates the
database using browser storage, so you can develop without building for Android
all the time. It has to be configured from the start.

## Mental mappings from .NET

| In .NET | Here |
|---|---|
| Solution / `.csproj` project | folder with a `package.json` |
| NuGet | npm |
| `dotnet restore` | `npm install` |
| `dotnet run` | `ionic serve` |
| EF Core + migrations | hand-written SQL, or Drizzle if we want a light ORM |
| `decimal` | **does not exist** → integers in minor units |
| appsettings.json | Angular's `environment.ts` |

The difference that will jar you most is `decimal`. In C# you add money without
thinking. Here you have to be disciplined: all amounts as integers, formatting
only for display. It is explained in `02-technical-decisions.md`.

## What is genuinely new and takes a while

1. **The Android build cycle.** The first time you run `ionic cap run android`
   it will download Gradle and compile, and it will take a while. That is
   normal. Subsequent runs are fast.
2. **Capacitor plugins.** Every native capability is an npm package that also
   has to be synced into the Android project (`ionic cap sync`). If you install
   a plugin and do not sync, it does not work and the error is not obvious.
3. **Asynchronous SQLite.** Every operation returns a Promise. No synchronous
   queries.

## The structure we are going to use

```
src/
  app/
    core/          cross-cutting services (db, rates, money formatting)
    data/          repositories and models
    features/
      accounts/
      transactions/
      transfers/
      reports/
      taxes/
    shared/        reusable components
  assets/
```

This is the standard Angular feature-based structure. Nothing exotic.
