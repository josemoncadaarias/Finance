# Roadmap

Orden pensado para minimizar retrabajo: primero los cimientos (datos), luego
lo visible, y el módulo tributario al final, cuando ya haya datos limpios que
alimentarlo.

---

## Fase 1 — Modelo de datos y esquema SQLite

**Entregable:** esquema creado y migrable, con seeds mínimos.

Entidades base:

- `currencies` — código, decimales, símbolo
- `accounts` — nombre, icono, moneda, tipo (débito / crédito / efectivo /
  inversión), `credit_limit`, `include_in_net_worth`, saldo inicial, fecha de
  apertura
- `categories` — nombre, icono, color, tipo (ingreso / gasto), padre opcional
- `transactions` — cuenta, categoría, fecha, `amount`, `rate`, `amount_base`,
  `rate_source`, `confidence`, descripción
- `transfers` — entidad propia con pata origen y pata destino, cada una con su
  monto y su tasa (permite transferencias entre monedas distintas)
- `exchange_rates` — fecha, par, tasa, fuente (caché de TRM)
- `account_rates` — cuenta, tasa E.A., vigencia desde/hasta
- `yields` — rendimientos calculados y reales, por cuenta y periodo
- `cashbacks` — monto, transacción origen, cuenta

Sin UI todavía. Solo esquema, tipos TypeScript y una capa de repositorio.

## Fase 2 — Importador del backup de Monefy

**Entregable:** script que lee el `.xlsx` y puebla la base, más una cola de
revisión.

- Desambiguar fechas asumiendo orden cronológico
- Emparejar `To '...'` / `From '...'` en transferencias reales
- Convertir `Initial balance` en saldo inicial de cuenta
- Rebasar tarjetas de crédito a modelo de pasivo
- Extraer montos USD de las descripciones (162 candidatos)
- Marcar de baja confianza lo estimado
- Reconciliar contra los saldos reales en USD que dé Jose

Ver `01-analisis-backup-monefy.md` para el detalle de cada problema.

## Fase 3 — UI base

**Entregable:** app usable para el día a día.

- Registro rápido de movimiento (la fortaleza de Monefy: pocos toques)
- CRUD de cuentas y categorías con catálogo amplio de iconos
- Listado y edición de movimientos
- Navegación por periodo: mes, año, viaje a periodos anteriores
- Exportación

En este punto la app ya reemplaza a Monefy.

## Fase 4 — Multimoneda y TRM

- Consulta de TRM oficial con caché local
- Comportamiento offline con último valor conocido
- Edición manual de la tasa por movimiento
- Vista de patrimonio consolidado en COP

## Fase 5 — Rendimientos, cashback y patrimonio

- Historial de tasas por cuenta
- Devengo diario calculado vs. rendimiento real abonado
- Acumulado de cashback
- Patrimonio: activos, pasivos, exclusiones

## Fase 6 — Módulo de renta

- Formularios configurables (arrancar por el 210)
- Componente inflacionario editable con estimación
- Proyección anual a partir de lo registrado
- Cuánto ahorrar al mes para cubrir el impuesto estimado

Requiere mapear antes el Estatuto Tributario. Validar con contador.

## Después

Sincronización en la nube (opcional, nunca obligatoria — la app debe seguir
funcionando 100% local).
