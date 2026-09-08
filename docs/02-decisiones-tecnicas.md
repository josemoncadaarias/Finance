# Decisiones técnicas y por qué

## Stack: Angular + Ionic + Capacitor

**Por qué.** Jose ya domina Angular, TypeScript, HTML y CSS. Ionic le da los
componentes móviles y Capacitor empaqueta eso como app Android nativa con
acceso a SQLite y al sistema de archivos.

El punto decisivo: se puede desarrollar y depurar **en el navegador** con
`ionic serve` y solo compilar a Android cuando se quiera probar en el celular.
Para un proyecto que se construye de a poco en ratos libres, eso importa más
que cualquier otra ventaja teórica.

**Alternativa descartada: .NET MAUI Blazor Hybrid.** Encajaba mejor con la
experiencia de Jose (C#, Visual Studio, EF Core, tipo `decimal` nativo). Se
descartó porque a la fecha tiene issues abiertos y confirmados en Android: en
.NET 10 las apps generadas quedan inutilizables porque no se respetan las
áreas seguras (la barra superior queda tapada por la barra de estado, no se
puede abrir el menú, en emulador y en hardware real), y hay reportes de crashes
al arrancar tras actualizar a .NET 10.

**Reevaluar si:** esos issues se cierran, o si Ionic resulta insuficiente para
algo concreto.

---

## Dinero como enteros

JavaScript no tiene tipo decimal. Todo número es float64, y sumar floats
acumula error. El backup de Monefy ya lo muestra: `9421.2800000000007`.

**Regla:** todos los montos se guardan como **enteros en unidades mínimas**.

- COP → pesos enteros (Colombia no usa centavos en la práctica)
- USD → centavos (`$12.34` se guarda como `1234`)

Cada cuenta conoce su moneda y por lo tanto sus decimales. El formateo pasa
solo en la capa de presentación. Nunca se hace aritmética sobre el valor
formateado.

Las tasas de cambio son la excepción: se guardan con precisión alta (por
ejemplo entero escalado ×10.000) porque 4.321,70 necesita decimales reales.

---

## Tarjetas de crédito como pasivo

El saldo de una tarjeta representa **lo que se debe**, no el cupo disponible.

- `balance` ≤ 0, es deuda
- `credit_limit` es atributo aparte
- cupo disponible = `credit_limit − |balance|`

**Por qué.** En Monefy el saldo mezclaba cupo y deuda en un solo número. Y
para el impuesto de renta las deudas restan del patrimonio líquido, así que
el pasivo tiene que ser explícito.

**Cómo se ve para el usuario:** "debo $X, tengo $Y disponible", que es como
la gente piensa una tarjeta.

**Migración:** deuda = cupo − saldo que traía Monefy.

---

## Multimoneda

Cada movimiento en una cuenta en divisa guarda:

- `amount` en la moneda de la cuenta (entero, unidad mínima)
- `rate` la tasa que aplicó ese banco en esa transacción
- `amount_base` el equivalente en COP a esa tasa, congelado
- `rate_source` de dónde salió: manual, derivada, TRM oficial, cacheada
- `confidence` alta / baja, para la cola de revisión

**El histórico no se recalcula nunca** cuando cambia la TRM. Eso es lo que
rompe Monefy y es justamente lo que se necesita para renta.

Fuente de la TRM oficial: API pública de datos.gov.co (Superfinanciera).
Se cachea localmente por fecha. Sin internet, se usa el último valor conocido
y se marca.

---

## Rendimientos y cashback aparte

Ninguno de los dos se mezcla con el saldo de la cuenta que los generó, porque
tributariamente son otra cosa (los rendimientos financieros tienen componente
inflacionario no gravado; el cashback es un ingreso distinto).

**Rendimientos:** cada cuenta tiene un historial de tasas (tasa E.A. con
vigencia desde/hasta) que el usuario mantiene. La app devenga día a día contra
ese historial y guarda el **calculado**. Cuando el banco abona el real, se
registra también y se pueden comparar.

**Cashback:** ingreso vinculado a la transacción que lo originó, acumulándose
en su propio módulo.

---

## Todo editable, y doble registro

Cualquier valor que la app calcule o traiga de internet debe poder
sobreescribirse a mano, y la app guarda **ambos**: el calculado y el manual.
La diferencia entre los dos es información útil, especialmente para renta.

Esto aplica también al componente inflacionario: se estima (con inflación
acumulada, o con el dato del año anterior si es muy temprano) y siempre se
puede editar.

---

## Módulo tributario configurable

No quemar el formulario 210. Cada formulario DIAN se modela como un conjunto
de reglas y renglones configurables, para poder agregar otros después.

Formularios conocidos, **pendientes de verificar contra fuente oficial**:
210 (persona natural residente), 110 (jurídicas y quienes llevan
contabilidad), 350 (retención en la fuente), 300 (IVA), 490 (recibo de pago).

Antes de codificar este módulo hay que mapear bien el Estatuto Tributario:
cédulas, límite del 40%, UVT, rentas exentas, tratamiento del componente
inflacionario en rendimientos financieros, y cómo se declara el patrimonio en
moneda extranjera.

**Nota:** las reglas tributarias que se implementen deben validarse con un
contador antes de confiar en el número final.
