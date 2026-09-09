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
  'entry.note': 'Nota (opcional)',
  'entry.deleteMovement': 'Borrar este movimiento',
  'entry.deleteTransfer': 'Borrar esta transferencia',
  'entry.deleteTransfer.hint': 'Se borra de las dos cuentas: {from} y {to}.',
  'entry.transferNotFound': 'No se encontró la transferencia',

  'entry.need.amount': 'Escribe el monto',
  'entry.need.account': 'Escoge la cuenta',
  'entry.need.destination': 'Escoge la cuenta de destino',
  'entry.need.differentAccounts': 'Las dos cuentas no pueden ser la misma',
  'entry.need.arrived': 'Escribe cuánto llegó en {currency}',
  'entry.need.category': 'Escoge una categoría',

  // --- accounts ---------------------------------------------------------
  'accounts.title': 'Cuentas',
  'accounts.netWorth': 'Patrimonio',
  'accounts.available': 'Disponible',
  'accounts.limit': 'Cupo',
  'accounts.setAside': 'Aparte del patrimonio',
  'accounts.archived': 'Archivada',

  // --- import -----------------------------------------------------------
  'import.title': 'Importar',
  'import.intro.title': 'Trae tu backup de Monefy',
  'import.intro.body':
    'Exporta el CSV desde Monefy y escógelo aquí. Puedes hacerlo cuantas veces ' +
    'quieras: lo que ya está guardado se reconoce y se salta, y lo que hayas ' +
    'corregido a mano no se toca.',

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
  'entry.note': 'Note (optional)',
  'entry.deleteMovement': 'Delete this movement',
  'entry.deleteTransfer': 'Delete this transfer',
  'entry.deleteTransfer.hint': 'It goes from both accounts: {from} and {to}.',
  'entry.transferNotFound': 'That transfer was not found',

  'entry.need.amount': 'Type the amount',
  'entry.need.account': 'Pick the account',
  'entry.need.destination': 'Pick where it goes',
  'entry.need.differentAccounts': 'The two accounts cannot be the same',
  'entry.need.arrived': 'Type how much arrived in {currency}',
  'entry.need.category': 'Pick a category',

  'accounts.title': 'Accounts',
  'accounts.netWorth': 'Net worth',
  'accounts.available': 'Available',
  'accounts.limit': 'Limit',
  'accounts.setAside': 'Set aside from net worth',
  'accounts.archived': 'Archived',

  'import.title': 'Import',
  'import.intro.title': 'Bring in your Monefy backup',
  'import.intro.body':
    'Export the CSV from Monefy and choose it here. Do it as often as you like: ' +
    'what is already stored is recognised and skipped, and anything you corrected ' +
    'by hand is left alone.',

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
