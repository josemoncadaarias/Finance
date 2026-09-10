/**
 * Everything the app says in its own voice, in each language it speaks.
 *
 * What belongs here is the app's own words: buttons, labels, prompts, the
 * things this project wrote. What does not belong here is the user's data —
 * account names, category names, the notes typed on a movement. Those stay in
 * whatever language they were entered in, because translating them would mean
 * inventing data that nobody wrote.
 *
 * The Colombian tax module (form 210, UVT, DIAN) will stay Spanish for the
 * same reason in reverse: its terms have no equivalent outside Colombia, so
 * translating them would produce words that name nothing.
 *
 * Keys are English, which is also what the rest of the repository is written
 * in. A missing key falls back to Spanish rather than showing the key itself:
 * a screen with a stray `movements.empty.title` on it is worse than one with a
 * Spanish word on it.
 */

export type Language = 'es' | 'en';

export const LANGUAGES: { code: Language; name: string; flag: string }[] = [
  // Spanish is named in Spanish and English in English: someone lost in the
  // wrong language has to recognise their own on sight.
  { code: 'es', name: 'Español', flag: 'co' },
  { code: 'en', name: 'English', flag: 'gb' },
];

export const SPANISH = {
  // --- navigation -------------------------------------------------------
  'nav.summary': 'Resumen',
  'nav.summary.hint': 'Gastos, ingresos y saldo',
  'nav.accounts': 'Cuentas',
  'nav.accounts.hint': 'Saldos y patrimonio',
  'nav.import': 'Importar',
  'nav.import.hint': 'Traer el backup de Monefy',
  'nav.language': 'Idioma',

  // --- the summary screen ----------------------------------------------
  'summary.allAccounts': 'Todas las cuentas',
  'summary.account': 'Cuenta',
  'summary.allAccounts.hint': 'Sin las archivadas ni las apartadas del patrimonio',
  'summary.accountsCounted': '{count} cuentas, todas incluidas',
  'summary.accountsWithHidden': '{count} cuentas · {hidden} apartadas del patrimonio',
  'summary.creditCard': 'tarjeta de crédito',
  'summary.setAside': 'aparte del patrimonio',
  'summary.archived': 'archivada',

  'summary.balanceToday': 'Saldo hoy',
  'summary.owedToday': 'Debes hoy',
  'summary.netWorthToday': 'Patrimonio hoy',
  'summary.available': 'Disponible {available} de {limit}',

  'summary.inPeriod': 'En {period}',
  'summary.in': 'Entró',
  'summary.out': 'Salió',
  'summary.moved': 'Movido',

  'summary.seeMovements': 'Ver movimientos',
  'summary.movements': 'Movimientos',
  'summary.seeChart': 'Ver la gráfica',

  'summary.view.date': 'Por día',
  'summary.view.category': 'Por categoría',
  'summary.view.largest': 'Los más grandes',
  'summary.within.date': 'Dentro de cada día, lo más reciente primero',
  'summary.within.category': 'Dentro de cada categoría, de mayor a menor',
  'summary.collapseAll': 'Colapsar todo',
  'summary.expandAll': 'Expandir todo',

  'summary.empty.title': 'Nada por aquí',
  'summary.empty.body': 'No hay movimientos en {period}.',
  'summary.empty.search': 'No hay movimientos en {period} que digan "{search}".',
  'summary.search': 'Buscar',
  'summary.search.placeholder': 'Buscar movimiento',
  'summary.close': 'Cerrar',
  'summary.newTransfer': 'Nueva transferencia',
  'summary.previousPeriod': 'Periodo anterior',
  'summary.nextPeriod': 'Periodo siguiente',
  'summary.expense': 'Gasto',
  'summary.income': 'Ingreso',
  'summary.recordExpense': 'Registrar un gasto',
  'summary.recordIncome': 'Registrar un ingreso',
  'summary.correctedByHand': 'Corregido a mano',
  'summary.allMovements': 'Todos los movimientos',

  'summary.editAccount': 'Editar esta cuenta',
  'summary.period': 'Periodo',
  'summary.from': 'Desde',
  'summary.to': 'Hasta',
  'summary.apply': 'Aplicar',
  'summary.includeSetAside': 'Incluir las cuentas apartadas',
  'summary.includeSetAside.hint': '{count} cuentas que no cuentan para el patrimonio',

  // --- periods ----------------------------------------------------------
  'period.day': 'Día',
  'period.week': 'Semana',
  'period.month': 'Mes',
  'period.quarter': 'Trimestre',
  'period.year': 'Año',
  'period.all': 'Todo',
  'period.range': 'Entre dos fechas',
  'period.today': 'Hoy',
  'period.yesterday': 'Ayer',
  'period.everything': 'Todo el histórico',
  'period.quarterOf': '{quarter}º trimestre {year}',

  // --- recording a movement --------------------------------------------
  'entry.newExpense': 'Nuevo gasto',
  'entry.newIncome': 'Nuevo ingreso',
  'entry.transfer': 'Transferencia',
  'entry.editMovement': 'Editar movimiento',
  'entry.editTransfer': 'Editar transferencia',
  'entry.save': 'Guardar',
  'entry.cancel': 'Cancelar',
  'entry.doneDate': 'Listo',
  'entry.leaves': 'Sale',
  'entry.arrives': 'Llega',
  'entry.from': 'Desde',
  'entry.to': 'Hasta',
  'entry.pick': 'Escoge',
  'entry.pickAccount': 'Escoge una cuenta',
  'entry.swap': 'Invertir',
  'entry.fromWhere': 'Desde dónde',
  'entry.toWhere': 'Hacia dónde',
  'entry.allCategories': 'Ver todas ({count})',
  'entry.pickCategory': 'Escoge una categoría',
  'entry.searchCategory': 'Buscar categoría',
  'entry.timesUsed': '{count} veces',
  'entry.noCategory': 'Ninguna categoría dice "{search}"',
  'entry.note': 'Nota (opcional)',
  'entry.deleteMovement': 'Borrar este movimiento',
  'entry.deleteTransfer': 'Borrar esta transferencia',
  'entry.deleteTransfer.hint': 'Se borra de las dos cuentas: {from} y {to}.',
  'entry.transferNotFound': 'No se encontró la transferencia',

  'entry.keyboardHint': 'Teclado y calculadora: + − × ÷ · Enter guarda · Esc cierra',
  'entry.erase': 'Borrar un dígito',
  'entry.clearAmount': 'Borrar el monto',
  'entry.clearNote': 'Borrar la nota',
  'entry.need.finishSum': 'Termina la operación con =',
  'entry.need.amount': 'Escribe el monto',
  'entry.need.account': 'Escoge la cuenta',
  'entry.need.destination': 'Escoge la cuenta de destino',
  'entry.need.differentAccounts': 'Las dos cuentas no pueden ser la misma',
  'entry.need.arrived': 'Escribe cuánto llegó en {currency}',
  'entry.need.category': 'Escoge una categoría',

  // --- accounts ---------------------------------------------------------
  'accounts.title': 'Cuentas',
  'accounts.netWorth': 'Patrimonio',
  'accounts.brokersCaveat': 'Los brókers muestran lo que metiste, no lo que valen hoy.',
  'accounts.currencies': '{count} monedas',
  'accounts.availableOf': '{available} disponible de {limit}',
  'accounts.archived': 'archivada',
  'accounts.whereFrom': '¿De dónde sale?',
  'accounts.breakdown.title': 'Cómo se arma el patrimonio',
  'accounts.breakdown.body': 'Cada cuenta que cuenta, con lo que aporta al total.',
  'accounts.breakdown.rates':
    'Lo que tienes en otra moneda vale la tasa de hoy, no la de cuando lo ' +
    'compraste. Cada movimiento sí conserva la tasa de su día — eso dice qué te ' +
    'costó — pero el patrimonio dice cuánto tienes hoy.',
  'accounts.breakdown.excluded':
    'No entran: las archivadas ni las que marcaste como apartadas del patrimonio.',
  'accounts.rates.title': 'Tasa de hoy',
  'accounts.rates.body':
    'Escribe cuánto vale una unidad en pesos. Se guarda con la fecha de hoy; ' +
    'mañana puedes poner otra sin cambiar la de hoy.',
  'accounts.noRate': 'sin tasa, no se puede valorar',
  'accounts.missingRate': 'Falta la tasa de {currencies}: esa plata no está sumando',
  'accounts.sort.amount': 'Por monto',
  'accounts.sort.name': 'Por nombre',
  'accounts.archivedTitle': 'Archivadas',
  'accounts.archivedHint': 'Historial nada más: esta plata ya no existe y no cuenta para el patrimonio.',
  'accounts.showArchived': 'Ver {count} cuentas archivadas',
  'accounts.hideArchived': 'Ocultar {count} cuentas archivadas',
  'accounts.empty.title': 'Todavía no hay cuentas',
  'accounts.empty.body':
    'Importa tu backup de Monefy desde el menú y aparecerán aquí con sus saldos.',

  // --- import -----------------------------------------------------------
  'import.title': 'Importar',
  'import.intro.title': 'Trae tu backup de Monefy',
  'import.intro.body':
    'Exporta el CSV desde Monefy y escógelo aquí. Puedes hacerlo cuantas veces ' +
    'quieras: lo que ya está guardado se reconoce y se salta, y lo que hayas ' +
    'corregido a mano no se toca.',
  'import.notReady': 'La base de datos todavía no está lista.',
  'import.choose': 'Escoger archivo CSV',
  'import.reading': 'Importando {file}…',
  'import.failed': 'No se importó nada',
  'import.failed.hint': 'La base quedó como estaba: la importación es todo o nada.',
  'import.done': 'Listo',
  'import.rowsRead': 'Filas leídas',
  'import.rowsInserted': 'Movimientos nuevos',
  'import.rowsSkipped': 'Ya estaban guardados',
  'import.accountsCreated': 'Cuentas creadas',
  'import.categoriesCreated': 'Categorías creadas',
  'import.transfers': 'Transferencias',
  'import.rebuiltLegs': '{count} con una pata reconstruida',
  'import.usdAmounts': 'Montos en dólares',
  'import.usdDetail': '{read} leídos de la descripción, {estimated} estimados',
  'import.reviews.title': 'Pendientes de que los mires',
  'import.reviews.body':
    'Nada de esto se escribió a la brava: son las cosas que el importador no ' +
    'pudo resolver solo.',

  // --- what the importer flags for review -------------------------------
  'review.reconstructed_transfer': 'Transferencias con una pata reconstruida',
  'review.foreign_new_movement': 'Movimientos nuevos en cuentas en otra moneda',
  'review.estimated_amount': 'Montos en dólares estimados',
  'review.assumed_account': 'Cuentas cuya moneda se dedujo',
  'review.deleted_account': 'Cuentas borradas de Monefy, recreadas',
  'review.multi_currency_split': 'Reparto de cuentas multimoneda',
  'review.ambiguous_category': 'Categorías usadas como ingreso y gasto',
  'review.credit_limit_change': 'Aumentos de cupo, fuera del saldo',
  'review.credit_limit_mismatch': 'El cupo no coincide con el archivo',
  'review.near_date_transfer': 'Transferencias emparejadas con días de diferencia',

  // --- editing an account -----------------------------------------------
  'accounts.new': 'Nueva cuenta',
  'accounts.edit': 'Editar cuenta',
  'accounts.namePlaceholder': 'Nombre de la cuenta',
  'accounts.type': 'Tipo',
  'accounts.type.debit': 'Cuenta bancaria',
  'accounts.type.credit': 'Tarjeta de crédito',
  'accounts.type.cash': 'Efectivo',
  'accounts.type.investment': 'Inversión',
  'accounts.currency': 'Moneda',
  'accounts.currency.add': 'Agregar una moneda',
  'accounts.currency.code': 'Código',
  'accounts.currency.codeHint': 'CAD, MXN, BRL…',
  'accounts.currency.name': 'Nombre',
  'accounts.currency.symbol': 'Símbolo',
  'accounts.currency.badCode': 'El código son tres letras, como USD o CAD',
  'accounts.currency.needName': 'Escribe el nombre de la moneda',
  'accounts.currency.locked': 'No se puede cambiar: todos los montos guardados están en esta moneda',
  'accounts.opening': 'Saldo inicial',
  'accounts.openedOn': 'Abierta el',
  'accounts.countsToNetWorth': 'Cuenta para el patrimonio',
  'accounts.countsToNetWorth.hint': 'Apágalo para brókers o plata apartada que no quieres sumar',
  'accounts.archive': 'Archivar',
  'accounts.archive.hint': 'Se esconde de las listas, pero su historial se conserva',
  'accounts.creditLimit': 'Cupo total',
  'accounts.limitFrom': 'Vigente desde',
  'accounts.creditLimit.hint':
    'Cambiar el cupo no mueve plata: tu deuda queda igual y solo cambia cuánto ' +
    'te queda disponible. Por eso se guarda con su fecha y nunca como un movimiento.',
  'accounts.limitHistory': 'Historial de cupos',
  'accounts.limit.initial': 'Cupo inicial',
  'accounts.limit.changed': 'Cambio de cupo',
  'accounts.fromBackup': 'del backup',
  'accounts.need.name': 'Escribe el nombre de la cuenta',
  'accounts.need.currency': 'Escoge la moneda',
  'accounts.addAccount': 'Nueva cuenta',
  'accounts.edit.action': 'Editar',

  // --- editing a category -----------------------------------------------
  'nav.categories': 'Categorías',
  'nav.categories.hint': 'Crear, renombrar y archivar',
  'categories.kind.locked':
    'No se puede cambiar: lo que ya está clasificado aquí se registró como gasto o como ingreso.',
  'categories.usedIn': 'Usada en',
  'categories.archivedHint':
    'Ya no se ofrecen al registrar, pero lo que quedó clasificado en ellas no cambió.',
  'categories.title': 'Categorías',
  'categories.new': 'Nueva categoría',
  'categories.edit': 'Editar categoría',
  'categories.namePlaceholder': 'Nombre de la categoría',
  'categories.kind': 'Para',
  'categories.kind.expense': 'Gastos',
  'categories.kind.income': 'Ingresos',
  'categories.archive': 'Archivar',
  'categories.archive.hint': 'Deja de ofrecerse al registrar, pero lo ya registrado no cambia',
  'categories.need.name': 'Escribe el nombre de la categoría',
  'categories.expenses': 'Gastos',
  'categories.incomes': 'Ingresos',
  'categories.showArchived': 'Ver {count} archivadas',
  'categories.hideArchived': 'Ocultar {count} archivadas',
  'categories.inUse': 'En {count} movimientos',
  'categories.empty': 'Todavía no hay categorías',

  // --- choosing an icon -------------------------------------------------
  'icons.change': 'Cambiar',
  'icons.yours': 'Tus imágenes',
  'icons.uploadHint': 'PNG, JPG, WEBP o SVG, hasta 100 kB. Sirve para el logo de tu banco.',
  'icons.tooBig': 'La imagen pesa {size} kB; el límite son 100 kB. Redúcela primero.',
  'icons.money': 'Dinero',
  'icons.investing': 'Inversión',
  'icons.other': 'Otros',
  'icons.everyday': 'Del día a día',
  'icons.home': 'Casa',
  'icons.moving': 'Transporte',
  'icons.living': 'Vida',

  // --- reviewing what the importer assumed -------------------------------
  'nav.review': 'Revisar',
  'nav.review.hint': 'Lo que el importador tuvo que suponer',
  'review.title': 'Por revisar',
  'review.intro.title': '{count} cosas por confirmar',
  'review.intro.body':
    'Cada vez que el importador no pudo estar seguro, lo anotó en vez de ' +
    'decidirlo en silencio. Confirma o corrige: lo que corrijas queda protegido ' +
    'y no se pisa al volver a importar.',
  'review.clear.title': 'Todo revisado',
  'review.clear.body': 'No queda ninguna suposición sin confirmar.',
  'review.fix': 'Corregir',
  'review.itIsRight': 'Está bien',
  'review.markAllRead': 'Marcar los {count} como vistos',
  'review.informational': 'Esto el importador lo resolvió bien; solo te está avisando.',
  'review.closedInBatch': 'Visto en grupo, sin revisar uno por uno',
  'review.noSubject': 'Sobre la importación',
  'review.gone': 'Eso ya no existe; márcalo como visto',

  // What each kind means, and what to do about it. The reason on each row is
  // the importer's own technical note; this is the plain-language version.
  'review.help.foreign_new_movement':
    'Monefy solo guardaba pesos, así que el monto en dólares o euros de un ' +
    'movimiento nuevo es una lectura o una estimación. Corrígelo aquí y queda ' +
    'protegido: al volver a importar no se toca. Lo que ya habías corregido antes ' +
    'tampoco se pisa.',
  'review.help.estimated_amount':
    'Monefy solo guardaba pesos. Cuando la descripción no decía el monto en ' +
    'dólares, el importador lo estimó con la tasa más cercana que sí conocía. ' +
    'Si sabes el valor real, corrígelo; si no, déjalo y ajusta el saldo de la cuenta.',
  'review.help.assumed_account':
    'El backup no dice en qué moneda está cada cuenta. El importador la dedujo ' +
    'por los movimientos. Confirma que sea la correcta.',
  'review.help.deleted_account':
    'Estas cuentas ya no existían en Monefy, pero tenían movimientos. Se ' +
    'recrearon para no perder el historial. Si ya no las usas, archívalas.',
  'review.help.reconstructed_transfer':
    'Monefy guardó solo un lado de estas transferencias. El importador armó el ' +
    'otro para que la plata no aparezca de la nada. Revisa que la otra cuenta sea la correcta.',
  'review.help.credit_limit_change':
    'Aumentos de cupo que Monefy registró como si fuera plata que entró. Se ' +
    'sacaron del saldo y hoy viven en el historial de cupos de la tarjeta.',
  'review.help.multi_currency_split':
    'Cuentas que manejan más de una moneda, separadas en una fila por moneda ' +
    'para que los saldos no se sumen entre sí.',
  'review.help.ambiguous_category':
    'Categorías usadas como gasto y como ingreso. Quedaron como gasto; si alguna ' +
    'debería ser de ingresos, cámbiala.',
  'review.help.credit_limit_mismatch':
    'El cupo configurado no coincide con lo que dice el archivo. Uno de los dos ' +
    'está desactualizado.',
  'review.help.near_date_transfer':
    'Transferencias emparejadas aunque las dos patas tienen fechas distintas. ' +
    'Revisa que de verdad sean el mismo movimiento.',

  'nav.export': 'Exportar',
  'nav.export.hint': 'Copia de seguridad y CSV',
  'csv.date': 'fecha',
  'csv.account': 'cuenta',
  'csv.currency': 'moneda',
  'csv.category': 'categoria',
  'csv.amount': 'monto',
  'csv.amountInPesos': 'monto_en_pesos',
  'csv.rate': 'tasa',
  'csv.note': 'nota',
  'csv.kind': 'tipo',
  'csv.counterpart': 'contraparte',
  'csv.correctedByHand': 'corregido_a_mano',
  'csv.source': 'origen',
  'csv.confidence': 'confianza',
  'csv.transfer': 'Transferencia',
  'csv.movement': 'movimiento',
  'csv.transferLeg': 'transferencia',
  'csv.yes': 'si',
  'csv.no': 'no',
  'export.title': 'Exportar',
  'export.movements': 'Movimientos',
  'export.saved': 'Se guardó {file}',
  'export.nothing': 'Todavía no hay nada que exportar.',

  'export.backup.title': 'Copia de seguridad',
  'export.backup.body':
    'Todo lo que hay en la app, en un archivo que se puede volver a cargar: ' +
    'cuentas, movimientos, transferencias completas, tus correcciones a mano, ' +
    'el historial de cupos y las imágenes de los iconos.',
  'export.backup.action': 'Guardar copia de seguridad',
  'export.backup.hint':
    'Esta base de datos vive solo en este dispositivo. Si lo pierdes y no tienes ' +
    'esta copia, se pierde todo. Guárdala fuera del teléfono.',

  'export.csv.title': 'CSV para leer',
  'export.csv.body':
    'Los movimientos en una tabla que abre Excel: fecha, cuenta, categoría, ' +
    'monto en su moneda y en pesos, tasa y nota.',
  'export.csv.action': 'Descargar CSV',
  'export.csv.hint':
    'Sirve para revisar o pasarle a alguien, pero NO sirve para restaurar: un CSV ' +
    'no puede guardar qué pata pertenece a cuál transferencia ni qué corregiste a mano.',

  // --- shared states ----------------------------------------------------
  'state.opening': 'Abriendo la base de datos…',
  'state.failed': 'No se pudo abrir la base de datos',

  // --- the donut --------------------------------------------------------
  'donut.empty': 'Nada en este periodo',
  'donut.byCategory': 'Gasto por categoría: {summary}',
  'donut.percentOf': '{label}, {percent} por ciento',

  // --- movements labels -------------------------------------------------
  'movement.toAccount': 'A {account}',
  'movement.fromAccount': 'De {account}',
  'movement.otherAccount': 'otra cuenta',
  'movement.noCategory': 'Sin categoría',
} as const;

export type TranslationKey = keyof typeof SPANISH;

export const ENGLISH: Record<TranslationKey, string> = {
  'nav.summary': 'Summary',
  'nav.summary.hint': 'Spending, income and balance',
  'nav.accounts': 'Accounts',
  'nav.accounts.hint': 'Balances and net worth',
  'nav.import': 'Import',
  'nav.import.hint': 'Bring in the Monefy backup',
  'nav.language': 'Language',

  'summary.allAccounts': 'All accounts',
  'summary.account': 'Account',
  'summary.allAccounts.hint': 'Without the archived or the ones set aside',
  'summary.accountsCounted': '{count} accounts, all counted',
  'summary.accountsWithHidden': '{count} accounts · {hidden} set aside from net worth',
  'summary.creditCard': 'credit card',
  'summary.setAside': 'set aside from net worth',
  'summary.archived': 'archived',

  'summary.balanceToday': 'Balance today',
  'summary.owedToday': 'You owe today',
  'summary.netWorthToday': 'Net worth today',
  'summary.available': '{available} available of {limit}',

  'summary.inPeriod': 'In {period}',
  'summary.in': 'In',
  'summary.out': 'Out',
  'summary.moved': 'Moved',

  'summary.seeMovements': 'See movements',
  'summary.movements': 'Movements',
  'summary.seeChart': 'See the chart',

  'summary.view.date': 'By day',
  'summary.view.category': 'By category',
  'summary.view.largest': 'The largest',
  'summary.within.date': 'Within each day, most recent first',
  'summary.within.category': 'Within each category, largest first',
  'summary.collapseAll': 'Collapse all',
  'summary.expandAll': 'Expand all',

  'summary.empty.title': 'Nothing here',
  'summary.empty.body': 'No movements in {period}.',
  'summary.empty.search': 'No movements in {period} saying "{search}".',
  'summary.search': 'Search',
  'summary.search.placeholder': 'Search a movement',
  'summary.close': 'Close',
  'summary.newTransfer': 'New transfer',
  'summary.previousPeriod': 'Previous period',
  'summary.nextPeriod': 'Next period',
  'summary.expense': 'Expense',
  'summary.income': 'Income',
  'summary.recordExpense': 'Record an expense',
  'summary.recordIncome': 'Record income',
  'summary.correctedByHand': 'Corrected by hand',
  'summary.allMovements': 'All movements',

  'summary.editAccount': 'Edit this account',
  'summary.period': 'Period',
  'summary.from': 'From',
  'summary.to': 'To',
  'summary.apply': 'Apply',
  'summary.includeSetAside': 'Include the accounts set aside',
  'summary.includeSetAside.hint': "{count} accounts that don't count towards net worth",

  'period.day': 'Day',
  'period.week': 'Week',
  'period.month': 'Month',
  'period.quarter': 'Quarter',
  'period.year': 'Year',
  'period.all': 'All',
  'period.range': 'Between two dates',
  'period.today': 'Today',
  'period.yesterday': 'Yesterday',
  'period.everything': 'The whole history',
  'period.quarterOf': 'Q{quarter} {year}',

  'entry.newExpense': 'New expense',
  'entry.newIncome': 'New income',
  'entry.transfer': 'Transfer',
  'entry.editMovement': 'Edit movement',
  'entry.editTransfer': 'Edit transfer',
  'entry.save': 'Save',
  'entry.cancel': 'Cancel',
  'entry.doneDate': 'Done',
  'entry.leaves': 'Leaves',
  'entry.arrives': 'Arrives',
  'entry.from': 'From',
  'entry.to': 'To',
  'entry.pick': 'Pick',
  'entry.pickAccount': 'Pick an account',
  'entry.swap': 'Swap',
  'entry.fromWhere': 'From where',
  'entry.toWhere': 'To where',
  'entry.allCategories': 'See all ({count})',
  'entry.pickCategory': 'Pick a category',
  'entry.searchCategory': 'Search a category',
  'entry.timesUsed': '{count} times',
  'entry.noCategory': 'No category says "{search}"',
  'entry.note': 'Note (optional)',
  'entry.deleteMovement': 'Delete this movement',
  'entry.deleteTransfer': 'Delete this transfer',
  'entry.deleteTransfer.hint': 'It goes from both accounts: {from} and {to}.',
  'entry.transferNotFound': 'That transfer was not found',

  'entry.keyboardHint': 'Keyboard and calculator: + − × ÷ · Enter saves · Esc closes',
  'entry.erase': 'Delete a digit',
  'entry.clearAmount': 'Clear the amount',
  'entry.clearNote': 'Clear the note',
  'entry.need.finishSum': 'Finish the sum with =',
  'entry.need.amount': 'Type the amount',
  'entry.need.account': 'Pick the account',
  'entry.need.destination': 'Pick where it goes',
  'entry.need.differentAccounts': 'The two accounts cannot be the same',
  'entry.need.arrived': 'Type how much arrived in {currency}',
  'entry.need.category': 'Pick a category',

  'accounts.title': 'Accounts',
  'accounts.netWorth': 'Net worth',
  'accounts.brokersCaveat': 'Brokers show what you put in, not what it is worth today.',
  'accounts.currencies': '{count} currencies',
  'accounts.availableOf': '{available} available of {limit}',
  'accounts.archived': 'archived',
  'accounts.whereFrom': 'Where from?',
  'accounts.breakdown.title': 'How net worth is built',
  'accounts.breakdown.body': 'Every account that counts, with what it adds to the total.',
  'accounts.breakdown.rates':
    "What you hold in another currency is worth today's rate, not the rate you " +
    'bought it at. Each movement does keep its own day rate — that says what it ' +
    'cost you — but net worth says what you have today.',
  'accounts.breakdown.excluded':
    'Left out: archived accounts, and the ones marked as set aside from net worth.',
  'accounts.rates.title': "Today's rate",
  'accounts.rates.body':
    'Type what one unit is worth in pesos. It is stored under today, so ' +
    "tomorrow's figure will not change today's.",
  'accounts.noRate': 'no rate, cannot be valued',
  'accounts.missingRate': 'No rate for {currencies}: that money is not being counted',
  'accounts.sort.amount': 'By amount',
  'accounts.sort.name': 'By name',
  'accounts.archivedTitle': 'Archived',
  'accounts.archivedHint': 'History only: this money is gone and does not count towards net worth.',
  'accounts.showArchived': 'Show {count} archived accounts',
  'accounts.hideArchived': 'Hide {count} archived accounts',
  'accounts.empty.title': 'No accounts yet',
  'accounts.empty.body':
    'Import your Monefy backup from the menu and they will show up here with their balances.',

  'import.title': 'Import',
  'import.intro.title': 'Bring in your Monefy backup',
  'import.intro.body':
    'Export the CSV from Monefy and choose it here. Do it as often as you like: ' +
    'what is already stored is recognised and skipped, and anything you corrected ' +
    'by hand is left alone.',
  'import.notReady': 'The database is not ready yet.',
  'import.choose': 'Choose a CSV file',
  'import.reading': 'Importing {file}…',
  'import.failed': 'Nothing was imported',
  'import.failed.hint': 'The database is as it was: an import is all or nothing.',
  'import.done': 'Done',
  'import.rowsRead': 'Rows read',
  'import.rowsInserted': 'New movements',
  'import.rowsSkipped': 'Already stored',
  'import.accountsCreated': 'Accounts created',
  'import.categoriesCreated': 'Categories created',
  'import.transfers': 'Transfers',
  'import.rebuiltLegs': '{count} with a rebuilt leg',
  'import.usdAmounts': 'Dollar amounts',
  'import.usdDetail': '{read} read from the description, {estimated} estimated',
  'import.reviews.title': 'Waiting for you to look',
  'import.reviews.body':
    'None of this was written blind: these are the things the importer could not ' +
    'settle on its own.',

  'review.reconstructed_transfer': 'Transfers with one leg rebuilt',
  'review.foreign_new_movement': 'New movements in foreign-currency accounts',
  'review.estimated_amount': 'Estimated dollar amounts',
  'review.assumed_account': 'Accounts whose currency was inferred',
  'review.deleted_account': 'Accounts deleted in Monefy, recreated',
  'review.multi_currency_split': 'Multi-currency accounts split',
  'review.ambiguous_category': 'Categories used as both income and expense',
  'review.credit_limit_change': 'Limit increases, kept out of the balance',
  'review.credit_limit_mismatch': 'The limit disagrees with the file',
  'review.near_date_transfer': 'Transfers paired across a few days',

  'accounts.new': 'New account',
  'accounts.edit': 'Edit account',
  'accounts.namePlaceholder': 'Account name',
  'accounts.type': 'Type',
  'accounts.type.debit': 'Bank account',
  'accounts.type.credit': 'Credit card',
  'accounts.type.cash': 'Cash',
  'accounts.type.investment': 'Investment',
  'accounts.currency': 'Currency',
  'accounts.currency.add': 'Add a currency',
  'accounts.currency.code': 'Code',
  'accounts.currency.codeHint': 'CAD, MXN, BRL…',
  'accounts.currency.name': 'Name',
  'accounts.currency.symbol': 'Symbol',
  'accounts.currency.badCode': 'A code is three letters, like USD or CAD',
  'accounts.currency.needName': 'Type the name of the currency',
  'accounts.currency.locked': 'Cannot change: every stored amount is in this currency',
  'accounts.opening': 'Opening balance',
  'accounts.openedOn': 'Opened on',
  'accounts.countsToNetWorth': 'Counts towards net worth',
  'accounts.countsToNetWorth.hint': 'Turn it off for brokers or money set aside you do not want added in',
  'accounts.archive': 'Archive',
  'accounts.archive.hint': 'Hidden from the lists, but its history is kept',
  'accounts.creditLimit': 'Credit limit',
  'accounts.limitFrom': 'In force from',
  'accounts.creditLimit.hint':
    'Changing the limit moves no money: the debt stays where it was and only the ' +
    'room left over changes. That is why it is stored with its date and never as a movement.',
  'accounts.limitHistory': 'Limit history',
  'accounts.limit.initial': 'Opening limit',
  'accounts.limit.changed': 'Limit change',
  'accounts.fromBackup': 'from the backup',
  'accounts.need.name': 'Type the account name',
  'accounts.need.currency': 'Pick the currency',
  'accounts.addAccount': 'New account',
  'accounts.edit.action': 'Edit',

  'nav.categories': 'Categories',
  'nav.categories.hint': 'Create, rename and archive',
  'categories.kind.locked':
    'Cannot change: what is already filed here was recorded as spending or as income.',
  'categories.usedIn': 'Used in',
  'categories.archivedHint':
    'No longer offered when recording, but what was filed under them is unchanged.',
  'categories.title': 'Categories',
  'categories.new': 'New category',
  'categories.edit': 'Edit category',
  'categories.namePlaceholder': 'Category name',
  'categories.kind': 'For',
  'categories.kind.expense': 'Spending',
  'categories.kind.income': 'Income',
  'categories.archive': 'Archive',
  'categories.archive.hint': 'No longer offered when recording, but what is recorded stays',
  'categories.need.name': 'Type the category name',
  'categories.expenses': 'Spending',
  'categories.incomes': 'Income',
  'categories.showArchived': 'Show {count} archived',
  'categories.hideArchived': 'Hide {count} archived',
  'categories.inUse': 'In {count} movements',
  'categories.empty': 'No categories yet',

  'icons.change': 'Change',
  'icons.yours': 'Your images',
  'icons.uploadHint': 'PNG, JPG, WEBP or SVG, up to 100 kB. This is for your bank\'s own logo.',
  'icons.tooBig': 'The image is {size} kB; the limit is 100 kB. Scale it down first.',
  'icons.money': 'Money',
  'icons.investing': 'Investing',
  'icons.other': 'Other',
  'icons.everyday': 'Everyday',
  'icons.home': 'Home',
  'icons.moving': 'Getting around',
  'icons.living': 'Living',

  'nav.review': 'Review',
  'nav.review.hint': 'What the importer had to assume',
  'review.title': 'To review',
  'review.intro.title': '{count} things to confirm',
  'review.intro.body':
    'Every time the importer could not be sure, it wrote it down instead of ' +
    'deciding quietly. Confirm or correct: what you correct is protected and ' +
    'a later import will not overwrite it.',
  'review.clear.title': 'All reviewed',
  'review.clear.body': 'No assumption is left unconfirmed.',
  'review.fix': 'Correct',
  'review.itIsRight': "It's right",
  'review.markAllRead': 'Mark all {count} as seen',
  'review.informational': 'The importer got these right; it is only telling you.',
  'review.closedInBatch': 'Seen as a batch, not one by one',
  'review.noSubject': 'About the import',
  'review.gone': 'That no longer exists; mark it as seen',

  'review.help.foreign_new_movement':
    'Monefy only stored pesos, so the dollar or euro amount of a new movement is ' +
    'a reading or an estimate. Correct it here and it is protected: a later ' +
    'import will not touch it, and neither will it touch what you corrected before.',
  'review.help.estimated_amount':
    'Monefy only stored pesos. Where the description did not say the dollar ' +
    'amount, the importer estimated it from the nearest rate it did know. If you ' +
    'know the real figure, correct it; if not, leave it and adjust the balance.',
  'review.help.assumed_account':
    'The backup does not say which currency an account is in. The importer ' +
    'inferred it from the movements. Confirm it is right.',
  'review.help.deleted_account':
    'These accounts no longer existed in Monefy but still had movements. They ' +
    'were recreated so the history is not lost. Archive them if you are done with them.',
  'review.help.reconstructed_transfer':
    'Monefy stored only one side of these transfers. The importer built the other ' +
    'so money does not appear from nowhere. Check the other account is right.',
  'review.help.credit_limit_change':
    'Limit increases Monefy recorded as money arriving. They were taken out of the ' +
    'balance and now live in the card\'s limit history.',
  'review.help.multi_currency_split':
    'Accounts holding more than one currency, split into a row per currency so ' +
    'balances are never added across them.',
  'review.help.ambiguous_category':
    'Categories used both as spending and as income. They were kept as spending; ' +
    'change any that should be income.',
  'review.help.credit_limit_mismatch':
    'The configured limit disagrees with the file. One of the two is out of date.',
  'review.help.near_date_transfer':
    'Transfers paired even though the two legs carry different dates. Check they ' +
    'really are the same movement.',

  'nav.export': 'Export',
  'nav.export.hint': 'Backup and CSV',
  'csv.date': 'date',
  'csv.account': 'account',
  'csv.currency': 'currency',
  'csv.category': 'category',
  'csv.amount': 'amount',
  'csv.amountInPesos': 'amount_in_pesos',
  'csv.rate': 'rate',
  'csv.note': 'note',
  'csv.kind': 'kind',
  'csv.counterpart': 'counterpart',
  'csv.correctedByHand': 'corrected_by_hand',
  'csv.source': 'source',
  'csv.confidence': 'confidence',
  'csv.transfer': 'Transfer',
  'csv.movement': 'movement',
  'csv.transferLeg': 'transfer',
  'csv.yes': 'yes',
  'csv.no': 'no',
  'export.title': 'Export',
  'export.movements': 'Movements',
  'export.saved': '{file} was saved',
  'export.nothing': 'There is nothing to export yet.',

  'export.backup.title': 'Backup',
  'export.backup.body':
    'Everything the app holds, in a file that can be read back: accounts, ' +
    'movements, whole transfers, your hand corrections, the credit-limit history ' +
    'and the images used as icons.',
  'export.backup.action': 'Save a backup',
  'export.backup.hint':
    'This database lives only on this device. Lose it without this file and ' +
    'everything is gone. Keep it somewhere other than the phone.',

  'export.csv.title': 'CSV to read',
  'export.csv.body':
    'The movements as a table Excel can open: date, account, category, amount in ' +
    'its own currency and in pesos, rate and note.',
  'export.csv.action': 'Download CSV',
  'export.csv.hint':
    'Good for checking or handing to someone, but NOT for restoring: a CSV cannot ' +
    'record which leg belongs to which transfer, or what you corrected by hand.',

  'state.opening': 'Opening the database…',
  'state.failed': 'The database could not be opened',

  'donut.empty': 'Nothing in this period',
  'donut.byCategory': 'Spending by category: {summary}',
  'donut.percentOf': '{label}, {percent} per cent',

  'movement.toAccount': 'To {account}',
  'movement.fromAccount': 'From {account}',
  'movement.otherAccount': 'another account',
  'movement.noCategory': 'No category',
};

export const DICTIONARIES: Record<Language, Record<TranslationKey, string>> = {
  es: SPANISH,
  en: ENGLISH,
};
