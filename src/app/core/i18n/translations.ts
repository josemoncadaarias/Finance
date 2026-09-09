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
  'entry.erase': 'Borrar',
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
  'entry.erase': 'Erase',
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
