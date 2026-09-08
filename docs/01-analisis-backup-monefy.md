# Análisis del backup de Monefy

Archivo: `data/monefy-backup-2026-09-07.xlsx`
Todo lo de aquí está **verificado** leyendo el archivo, no supuesto.

## Forma general

- Una sola hoja: `in`
- 12.889 filas, desde junio de 2021
- 8 columnas: `date`, `account`, `category`, `amount`, `currency`,
  `converted amount`, `currency.1`, `description`
- 21 cuentas, 86 categorías (incluyendo pseudo-categorías, ver abajo)

### Cuentas por volumen

| Cuenta | Movimientos |
|---|---|
| Tarjeta crédito rappi | 5.426 |
| Bancolombia | 2.066 |
| Rappi cuenta | 1.802 |
| Fiducuenta | 950 |
| Multinversion | 819 |
| Ualá | 747 |
| Efectivo | 332 |
| Nequi | 230 |
| ARQ | 194 |
| Cuenta leidy bancolombia prestamos | 155 |
| eToro | 38 |
| Global66 | 27 |
| Lulo | 23 |
| XTB | 20 |
| Bold | 20 |
| Nu, Dale | 9 c/u |
| Pibank, Plenti | 7 c/u |
| Cineco | 5 |
| Pibank para renta | 3 |

Cuentas en USD (confirmadas por Jose): **ARQ (DolarApp), eToro, XTB, Plenti,
Global66**. La fecha de inicio de cada una se deduce de su primer movimiento
en el backup.

---

## Problemas a resolver en el importador

### 1. La moneda se perdió por completo

Las columnas `currency` y `converted amount` traen **COP en el 100% de las
filas**, incluidas eToro, Global66 y XTB. Monefy aplanó todo a pesos y no
exportó ni la moneda original ni la tasa aplicada.

Esa información **no se puede recuperar del archivo**. Hay que reconstruirla.

### 2. Fechas en tres formatos mezclados

- Texto `dd/mm/yyyy` (7.683 filas)
- Seriales de Excel (`44203`)
- Fechas con día y mes invertidos (`2021-09-07` es en realidad 7 de septiembre)

Para días ≤ 12 es ambiguo. **Regla acordada: las filas vienen en orden
cronológico**, así que se desambigua por posición de fila.

### 3. Las transferencias no existen como entidad

Son dos filas espejo con categorías falsas: `To 'X'` y `From 'Y'`.
No hay id que las relacione.

- 2.698 filas `To '...'`
- 2.632 filas `From '...'`
- ≈66 quedan sin pareja → revisión manual

En el modelo nuevo la transferencia debe ser **una entidad con dos patas**,
no dos movimientos sueltos.

### 4. `Initial balance 'X'` es una pseudo-categoría

Hay que convertirla en un saldo inicial real de la cuenta, no en un movimiento.

### 5. Rendimientos mezclados dentro de la cuenta

Hoy se registran como categoría `Ahorros` con descripción "Subió inversión"
(1.491 filas). Exactamente lo que el diseño nuevo quiere separar.

### 6. Cashback inconsistente

Unas veces como `Ahorros`, otras como ajuste de `Facturas`
("Ajuste rappi card 4x1000 y cashback"). Necesita categoría propia y
vínculo a la transacción que lo originó.

### 7. Tarjeta de crédito mal modelada

`Tarjeta crédito rappi` arranca con `Initial balance` **positivo de 800.000**,
que en realidad es el cupo. Al importar se rebasa: deuda = cupo − saldo actual.

---

## Reconstrucción de los montos en USD

### Lo que hay

162 filas mencionan un monto en dólares dentro de la descripción:

| Cuenta | Filas totales | Con monto USD explícito |
|---|---|---|
| ARQ | 194 | 72 |
| eToro | 38 | 17 |
| XTB | 20 | 14 |
| Plenti | 7 | 7 |
| Global66 | 27 | 2 |

Hay ruido: una compra en Bancolombia dice "completar 100 usd con descuento"
y **no** es un movimiento en dólares. El parser debe dejar cada caso en cola
de revisión, no importar a ciegas.

### Advertencia crítica de Jose

Los montos en COP de esos movimientos **fueron estimados a ojo**. Monefy no
le permitía manejar USD, así que anotaba una cifra aproximada. En varios casos
lo que realmente pasó fue mover USD directamente entre dos cuentas en USD, sin
conversión real.

**Por lo tanto el COP de esas filas no es fuente confiable.** Dividirlo por la
TRM daría un USD igual de inventado.

### Jerarquía acordada

1. Si la descripción trae el monto en USD → ese manda, el COP se recalcula.
2. Si no → estimar con la TRM del día y marcar como **baja confianza**.
3. Reconciliar contra el saldo real actual en USD que dé Jose, repartiendo la
   diferencia **solo** entre los movimientos de baja confianza. Así el saldo
   final queda exacto aunque el histórico intermedio sea aproximado.

### Tasas reales derivables del archivo

De los pares donde hay COP y USD se saca la tasa que realmente aplicó DolarApp:

| COP | USD | Tasa implícita |
|---|---|---|
| 2.107.000 | 500 | 4.214,00 |
| 309.875 | 71,71 | 4.321,70 |
| 4.300 | 1 | 4.300,00 |
| 820.378 | 187,5 | 4.375,35 |

Con varios de estos puntos se calcula el spread típico del proveedor contra la
TRM oficial de ese día, y ese spread se aplica a las filas sin dato explícito.
