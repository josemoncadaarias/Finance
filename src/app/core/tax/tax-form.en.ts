/**
 * Formulario 210 in English, laid over the Spanish of `tax-form.ts`.
 *
 * The rule, decided by Jose on 2026-09-18: the explanations, the hints and
 * everything the app says in its own voice are English; the DIAN's own terms
 * stay Spanish, so they still match the form a person is filling in.
 *
 * - A row that lands in a box keeps its Spanish `label` - exactly the one in
 *   `tax-form.ts`, the tests check it - and adds a short English `gloss`.
 * - A section named after a part of the form keeps its Spanish title too, with
 *   a `titleGloss`.
 * - Everything else is plain English, with a Spanish term in brackets only
 *   where it is the word the person will meet on the form or a certificate.
 *
 * Never translated: casilla, UVT, IBC, E.T., AFC/FVP/AVC, article numbers and
 * the names of norms. Figures keep Colombian formatting (12,5%, 1.340 UVT), as
 * everywhere else in the app: the same figure must not look different after a
 * change of language.
 *
 * Rows are found by `rowWordsId` in `tax-words.ts`: `input.<key>`,
 * `computed.<key>`, and `note.<n>` for the n-th note of the section. A row
 * without an entry would show its Spanish, and the tests fail on it.
 */

import type { EmploymentWords, TaxText } from './tax-form';

export interface RowWords {
  label?: string;
  gloss?: string;
  hint?: string;
  /** A note's text. */
  text?: string;
}

export interface SectionWords {
  title: string;
  titleGloss?: string;
  subtitle?: string;
  rows: Readonly<Record<string, RowWords>>;
}

export const MONTH_NAMES_EN: readonly string[] = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export const EMPLOYMENT_TEXT_EN: EmploymentWords = {
  ordinary: {
    title: 'Ordinary salary',
    detail: 'You contribute on your whole salary. You pay 4% for health and 4% for pension; your employer pays the rest.',
  },
  integral: {
    title: 'Integral salary',
    detail: 'Salario integral, from 13 minimum wages. You contribute on 70% of the salary (Ley 344 de 1996, art. 18). You pay 4% and 4%.',
  },
  independent: {
    title: 'Self-employed',
    detail: 'Under a contract for services (prestación de servicios). You contribute on 40% of what you bill (Ley 1955 de 2019, art. 244) and pay all of it: 12,5% for health and 16% for pension.',
  },
};

/** Each source's title in English, by its address. The pages themselves are in Spanish. */
export const TAX_SOURCE_LABELS_EN: Readonly<Record<string, string>> = {
  'https://www.dian.gov.co/atencionciudadano/formulariosinstructivos/Formularios/2025/Formulario_210_2025.pdf':
    'DIAN - Formulario 210, tax year 2025',
  'https://siemprealdia.co/colombia/impuestos/ingresos-en-el-formulario-210/':
    'Siempre al Día - Income on Formulario 210: casillas and cédulas',
  'https://actualicese.com/que-personas-naturales-deberan-utilizar-las-casillas-43-a-57-del-formulario-210/':
    'Actualícese - Who uses casillas 43 to 57 of Formulario 210',
  'https://concp.co/rentas-no-laborales-en-el-formulario-210/':
    'CONCP - Rentas no laborales (non-employment income) on Formulario 210',
  'https://siemprealdia.co/colombia/impuestos/componente-inflacionario-en-la-declaracion-de-renta/':
    'Siempre al Día - The componente inflacionario on the income tax return',
  'https://incp.org.co/publicaciones/infoincp-publicaciones/informacion-para-empresas/2026/09/dane-reporto-variacion-anual-del-ipc-de-624-en-agosto-de-2026/':
    'INCP - Annual CPI of 6,24% in August 2026 (DANE)',
  'https://www.larepublica.co/indicadores-economicos/bancos/dtf':
    'La República - DTF',
  'https://www.hklaw.com/en/insights/publications/2025/12/colombia-decreta-aumento-del-salario-minimo-y-auxilio-de-transporte':
    'Holland & Knight - Minimum wage and transport allowance 2026',
  'https://blog.alegra.com/colombia/salario-minimo-en-colombia-2026/':
    'Alegra - Minimum wage in Colombia 2026',
  'https://www.ambitojuridico.com/noticias/laboral/249095-valor-del-auxilio-de-transporte-para-el-2026-aumenta-245-respecto-al-2025':
    'Ámbito Jurídico - Transport allowance 2026',
};

export const TAX_TEXT_EN: TaxText = {
  title: 'Income tax simulator',
  legendTyped: 'Box you type in',
  legendComputed: 'Box that works itself out',
  box: 'Csl.',

  toPay: 'Balance to pay',
  inFavour: 'Balance in your favour',
  settled: 'Nothing to pay, nothing back',
  savePerMonth: 'Set aside {amount} every month to avoid surprises',
  taxLine: 'Tax {tax} · withholding {withheld}',

  saving: 'Saving…',
  saved: 'Saved',
  previousYear: 'Previous year',
  nextYear: 'Next year',
  yearLabel: 'Tax year {year}',

  uvtMissing: 'The {year} UVT is missing. Without it no cap can be worked out: type it in under This year\'s parameters.',

  referencesIntro: 'Where this year\'s parameters come from. If one is not official yet, the best reference available is used instead of leaving it at zero.',
  standingOfficial: 'Official',
  standingReference: 'Reference {year}',
  standingEstimate: 'Estimate',
  standingLater: 'From {year}, later',
  laterWarning: 'This year\'s {what} is missing, and a later year\'s is being used, which does not belong to it. Type it in by hand below if you know it.',
  refUvt: 'UVT',
  refMinimumWage: 'Minimum wage, without the transport allowance',
  refInflationary: 'Inflationary component',
  inflationaryModeTitle: 'How casilla 59 is reached',
  inflationaryModeWorked: 'Work it out',
  inflationaryModeTyped: 'Type it in',
  inflationaryModeWorkedHint: 'The app works it out: the part of casilla 58 that is financial yields, times the year\'s percentage.',
  inflationaryModeTypedHint: 'You type the figure you already know, for example the one on the bank\'s certificate.',
  sheetInflationaryMode: 'Casilla 59',

  salaryButton: 'Bring in the salary recorded in {year}',
  salaryHint: 'You record what reaches your account, which is the net. This box wants the gross: use it only as a starting point and correct it.',
  salarySheetTitle: 'Which category do you record your salary under?',
  salaryEmpty: 'No income recorded in {year}.',
  salaryUsed: 'Took {total} from "{category}", spread over {months} months. That is the NET: replace it with the gross salary in your contract.',

  yieldsButton: 'Bring in the yields and cashback of {year}',
  yieldsHint: 'Yields and cashback go here, in rentas de capital, not in ganancias ocasionales. What the app brings in is approximate: use each bank\'s certificate.',
  yieldsNone: 'No yields or cashback recorded in {year}.',
  yieldsUsed: 'Took {gross} of gross yields ({days} days worked out), {cashback} of cashback and {withheld} of withholding. Approximate: compare it with the banks\' certificates.',

  sourcesTitle: 'Sources consulted (in Spanish)',

  excelButton: 'Download as Excel',
  excelHint: 'A file like your Excel simulator: you type the yellow boxes and the rest recalculates itself.',
  excelWriting: 'Building the spreadsheet',
  excelSaved: 'Downloaded {file}. The yellow boxes can be changed and everything else recalculates.',
  excelFile: 'income-tax-simulator-{year}.xlsx',

  sheetName: 'Income tax {year}',
  sheetTitle: 'INCOME TAX RETURN SIMULATOR — INDIVIDUAL (Formulario 210)',
  sheetSubtitle: 'Tax year {year} · exported from Finance on {date}',
  sheetBoxColumn: 'Column C = the matching casilla (box) on the DIAN\'s Formulario 210.',
  sheetLegendTyped: 'Manual figure: type it or change it to fit your situation. Everything that depends on it recalculates itself.',
  sheetLegendComputed: 'Automatic calculation: do not edit it, it is locked. If you really need to: Review › Unprotect Sheet.',
  sheetSummary: 'Summary',
  sheetSavePerMonth: 'Monthly saving for the balance to pay',
  sheetEmployment: 'Kind of contract',
  sheetBaseShare: '% of the salary you contribute on (IBC)',
  sheetBaseShareHint: '100% with an ordinary salary, 70% with an integral salary and 40% as self-employed. If your contract changes, adjust this % and the health and pension ones.',
  sheetRateRange: 'Range (UVT)',
  sheetRateMarginal: 'Marginal rate',
  sheetRateFormula: 'Formula',
  sheetRateRow: '(Base − {from}) × {rate}% + {plus} UVT',
  sheetMonth: 'Retención en la fuente (withholding tax) — {month}',
  sheetExtra: 'Additional withholding {n}',
  sheetBox: 'Csl. {box}',
  yieldsWithholdingLabel: 'Withholding on yields (approx.)',

  extraConcept: 'Description',
  rateTableTitle: 'Rate table (art. 241 E.T.)',
  rateBand: 'From {from} UVT',
  rateApplies: 'Your income falls here',

  close: 'Close',
  toTop: 'Go to the top',
  toBottom: 'Go to the bottom',
  collapseAll: 'Fold every section',
  expandAll: 'Unfold every section',

  disclaimer: 'A personal support tool. It does not replace an accountant or the official return filed with the DIAN.',

  and: 'and',
};

/** The words of every section and row, by section id. */
export const TAX_FORM_EN: Readonly<Record<string, SectionWords>> = {
  situation: {
    title: 'Your situation',
    rows: {
      'input.dependents': { label: 'Financial dependants', hint: 'Up to 4 count (art. 336 E.T.).' },
    },
  },

  parameters: {
    title: 'This year\'s parameters',
    subtitle: 'Set by law every year. Rarely touched.',
    rows: {
      'input.uvtMinor': {
        label: 'UVT value',
        hint: 'The DIAN sets it by resolution every December, for the following year.',
      },
      'input.minimumWageMinor': {
        label: 'Monthly minimum wage',
        hint: 'Without the transport allowance, which is not salary. It keeps the IBC (contribution base) between 1 and 25 minimum wages and sets the steps of the solidarity fund.',
      },
      'input.labourExemptScaled': { label: 'Exempt employment income %', hint: 'Art. 206 num. 10 E.T.' },
      'input.labourExemptCapUvt': { label: 'Exempt employment income cap (UVT a year)', hint: 'Ley 2277 de 2022.' },
      'input.dependentMonthlyCapUvt': { label: 'Dependant deduction cap (UVT a month)', hint: 'Art. 387 E.T.' },
      'input.healthPolicyCapUvt': { label: 'Health deduction cap (UVT a month)', hint: 'Art. 387 E.T.' },
      'input.globalCapScaled': { label: 'Overall limit on exemptions and deductions %', hint: 'Art. 336 num. 3 E.T.' },
      'input.globalCapUvt': { label: 'Overall limit cap (UVT a year)', hint: 'Art. 336 num. 3 E.T.' },
      'input.dependentUvt': { label: 'UVT per dependant a year', hint: 'Art. 336 E.T.' },
      'input.eInvoiceCapUvt': { label: 'Electronic invoice deduction cap (UVT)', hint: 'Art. 336 num. 5 E.T.' },
      'input.voluntaryCapUvt': { label: 'Voluntary contribution cap (UVT a year)', hint: 'Art. 126-1 E.T.' },
      'input.voluntaryIncomeShareScaled': { label: 'Voluntary contribution cap (% of income)', hint: 'Art. 126-1 E.T.' },
    },
  },

  labour: {
    title: '1. Rentas de trabajo',
    titleGloss: 'employment income',
    subtitle: 'Casillas 32 to 42',
    rows: {
      'input.monthlySalaryMinor': {
        label: 'Gross monthly salary',
        hint: 'The one in your contract, before deductions. If it changes from month to month, the average.',
      },
      'input.monthsWorked': { label: 'Months worked in the year' },
      'input.otherLabourIncomeMinor': {
        label: 'Other employment income in the year',
        hint: 'Bonuses, commissions, non-statutory bonuses (primas extralegales).',
      },
      'computed.grossLabourMinor': { label: 'Total ingresos brutos de trabajo', gloss: 'total gross employment income' },

      'note.0': { text: 'Mandatory social security contributions. They are subtracted as ingresos no constitutivos de renta (income that is not taxable).' },
      'computed.monthlyBaseMinor': {
        label: 'Monthly contribution base (IBC)',
        hint: 'The whole salary if ordinary, 70% if integral, 40% if you are self-employed.',
      },
      'input.healthScaled': { label: 'Health contribution %', hint: '4% as an employee, 12,5% as self-employed.' },
      'input.pensionScaled': { label: 'Pension contribution %', hint: '4% as an employee, 16% as self-employed.' },
      'input.solidarityScaled': {
        label: 'Pension solidarity fund %',
        hint: 'Used while there is no minimum wage under This year\'s parameters. With one, it works itself out: 1% from 4 minimum wages, rising to 2% (Ley 797 de 2003).',
      },
      'computed.solidarityRateScaled': { label: 'Solidarity % applied' },
      'computed.healthMinor': { label: 'Health contribution for the year' },
      'computed.pensionMinor': { label: 'Pension contribution for the year' },
      'computed.solidarityMinor': { label: 'Solidarity fund contribution for the year' },
      'computed.contributionsMinor': { label: 'Total aportes obligatorios', gloss: 'total mandatory contributions' },
      'computed.labourNetMinor': { label: 'Renta líquida de trabajo', gloss: 'net employment income' },
    },
  },

  fees: {
    title: '2. Rentas de trabajo sin relación laboral',
    titleGloss: 'work income without an employment contract',
    subtitle: 'Casillas 43 to 46',
    rows: {
      'note.0': {
        text: 'Work of yours you are not paid for as an employee: fees (honorarios), commissions, '
            + 'personal services, emoluments. Article 103 of the E.T. says all of it is '
            + 'renta de trabajo (employment income), whether you are an employee or not. It has a '
            + 'column of its own because here you CAN subtract what it cost you to earn it: an '
            + 'employee has no costs, someone who bills for their services does. If you are only '
            + 'salaried, leave this section at zero.',
      },
      'input.feeIncomeMinor': {
        label: 'Ingresos brutos',
        gloss: 'gross income',
        hint: 'Everything you billed in the year for fees, commissions or services, before '
            + 'subtracting anything. If tax was withheld, enter the gross amount, not what reached your account.',
      },
      'input.feeNonTaxableMinor': {
        label: 'Ingresos no constitutivos de renta',
        gloss: 'income that is not taxable',
        hint: 'The part the law says is not income. The most common: the mandatory health and '
            + 'pension contributions you paid on this income (arts. 55 and 56 E.T.). If you have '
            + 'none, leave it at zero.',
      },
      'input.feeCostsMinor': {
        label: 'Costos y deducciones procedentes',
        gloss: 'allowable costs and deductions',
        hint: 'What you spent to produce that income and can back with receipts: supplies, '
            + 'transport for the service, rent of the premises. Careful: whoever subtracts costs '
            + 'here CANNOT also take the 25% exempt income (renta exenta) of art. 206 num. 10 on '
            + 'this same income. To be confirmed with your accountant before using it on a return.',
      },
      'computed.feeNetMinor': {
        label: 'Renta líquida',
        gloss: 'net income',
        hint: 'Casilla 43 minus 44 minus 45. It is never negative.',
      },
    },
  },

  capital: {
    title: '3. Rentas de capital',
    titleGloss: 'capital income: interest, yields…',
    subtitle: 'Casillas 58 to 62',
    rows: {
      'input.capitalIncomeMinor': {
        label: 'Ingresos brutos por rentas de capital',
        gloss: 'gross capital income',
        hint: 'Interest and financial yields from all your accounts, cashback, rent and royalties.',
      },
      'input.financialYieldMinor': {
        label: 'Of which, financial yields',
        hint: 'Interest from accounts, CDTs and funds. Only these carry the inflationary component: cashback and rent do not.',
      },
      'input.inflationaryScaled': {
        label: 'Inflationary component of the year %',
        hint: 'DANE inflation divided by the Superfinanciera deposit rate (art. 40-1 E.T.). It is published the following year.',
      },
      'input.capitalNonTaxableTypedMinor': {
        label: 'Certified inflationary component',
        hint: 'The figure on the bank\'s certificate. It is used as it is; it is only cut back if it exceeds casilla 58.',
      },
      'computed.capitalNonTaxableMinor': {
        label: 'Ingresos no constitutivos de renta',
        gloss: 'income that is not taxable',
        hint: 'The inflationary part of financial yields - componente inflacionario (arts. 38 to 41 E.T.).',
      },
      'input.capitalCostsMinor': { label: 'Costos y deducciones procedentes', gloss: 'allowable costs and deductions' },
      'computed.capitalNetMinor': {
        label: 'Renta líquida de capital',
        gloss: 'net capital income',
        hint: 'Casilla 58 minus 59 minus 60. It is never negative.',
      },
      'input.passiveCapitalMinor': {
        label: 'Rentas líquidas pasivas - ECE',
        gloss: 'passive income of a controlled foreign company',
        hint: 'Only if you control a company abroad (an ECE: entidad controlada del exterior, '
            + 'arts. 882 to 893 E.T.). Its passive income - interest, dividends, royalties, rent - '
            + 'is declared in the year the company earns it, even if it has not paid it out to '
            + 'you. It goes here because that income is capital income by nature. Holding an '
            + 'account or shares abroad is NOT this: this is controlling the company. If that is '
            + 'not your case, leave it at zero.',
      },
    },
  },

  other: {
    title: '4. Rentas no laborales',
    titleGloss: 'non-employment income',
    subtitle: 'Casillas 74 to 78',
    rows: {
      'input.otherIncomeMinor': {
        label: 'Ingresos brutos por rentas no laborales',
        gloss: 'gross non-employment income',
        hint: 'Sales, crypto-asset operations, sale of fixed assets you held for less than two years. Yields and cashback do not go here.',
      },
      'input.otherCostsMinor': { label: 'Costos y deducciones procedentes', gloss: 'allowable costs and deductions' },
      'computed.otherNetMinor': { label: 'Renta líquida no laboral', gloss: 'net non-employment income' },
    },
  },

  general: {
    title: 'Cédula general',
    titleGloss: 'general schedule',
    rows: {
      'computed.generalNetMinor': {
        label: 'Renta líquida cédula general',
        gloss: 'net income of the general schedule',
        hint: 'Employment plus capital plus non-employment.',
      },
    },
  },

  capped: {
    title: '5. Rentas exentas y deducciones',
    titleGloss: 'exempt income and deductions',
    subtitle: 'Limited to 40% or 1.340 UVT · Casillas 35 to 41',
    rows: {
      'input.voluntaryPayrollMinor': {
        label: 'Voluntary AFC, FVP or AVC contributions through payroll',
        hint: 'What your employer transfers straight to the fund.',
      },
      'input.voluntaryOwnMinor': { label: 'Your own voluntary contributions', hint: 'What you contribute outside payroll.' },
      'computed.voluntaryMinor': { label: 'Total aportes voluntarios', gloss: 'total voluntary contributions' },
      'input.housingInterestMinor': { label: 'Intereses de vivienda o ICETEX', gloss: 'mortgage or student loan interest' },
      'computed.labourExemptMinor': {
        label: 'Renta exenta de trabajo',
        gloss: 'exempt employment income',
        hint: '25% of employment income, capped at 790 UVT.',
      },
      'computed.dependentDeductionMinor': {
        label: 'Deducción por dependiente',
        gloss: 'dependant deduction',
        hint: '10% of employment income, capped at 32 UVT a month.',
      },
      'input.healthPolicyMinor': {
        label: 'Prepaid medicine or health insurance payments',
        hint: 'Only what you paid in the year, for yourself, your spouse or your children.',
      },
      'computed.healthPolicyMinor': { label: 'Deducción por salud', gloss: 'health deduction', hint: 'Capped at 16 UVT a month.' },
      'input.otherDeductionsMinor': { label: 'Otras deducciones', gloss: 'other deductions' },
      'computed.beforeCapMinor': { label: 'Subtotal before the limit' },
      'computed.capMinor': { label: 'Applicable limit', hint: 'The lower of 40% of the cédula general and 1.340 UVT.' },
      'computed.cappedMinor': {
        label: 'Rentas exentas y deducciones limitadas',
        gloss: 'exempt income and deductions after the limit',
      },
    },
  },

  uncapped: {
    title: '6. Deductions with no limit',
    subtitle: 'They do not compete for the 40% or the 1.340 UVT',
    rows: {
      'computed.dependentsMinor': {
        label: 'Deducción por dependientes económicos',
        gloss: 'deduction for dependants',
        hint: '72 UVT for each one, up to 4.',
      },
      'input.eInvoicePurchasesMinor': {
        label: 'Purchases with an electronic invoice',
        hint: 'Paid electronically and not already in another casilla.',
      },
      'computed.eInvoiceMinor': {
        label: 'Deducción del 1% por factura electrónica',
        gloss: '1% electronic invoice deduction',
        hint: 'Capped at 240 UVT.',
      },
      'computed.deductionsMinor': { label: 'Total rentas exentas y deducciones', gloss: 'total exempt income and deductions' },
    },
  },

  tax: {
    title: 'Tax',
    rows: {
      'computed.taxableMinor': { label: 'Renta líquida ordinaria', gloss: 'ordinary net income' },
      'computed.taxableUvt': { label: 'Taxable net income in UVT' },
      'input.occasionalTaxMinor': {
        label: 'Impuesto de ganancias ocasionales',
        gloss: 'occasional gains tax',
        hint: 'Sale of assets you held for 2 years or more, prizes, inheritances. Yields do not go here: they are rentas de capital.',
      },
      'computed.taxMinor': { label: 'Impuesto neto de renta', gloss: 'net income tax' },
    },
  },

  withholding: {
    title: 'Retenciones y anticipos',
    titleGloss: 'withholding and advance payments',
    subtitle: 'Casillas 130 to 132',
    rows: {
      'note.0': { text: 'Tax withheld from your payroll, month by month.' },
      'computed.monthlyWithheldMinor': { label: 'Payroll withholding subtotal' },
      'note.1': { text: 'Withholding for other items: financial yields, fees, sale of assets.' },
      'computed.extraWithheldMinor': { label: 'Additional withholding subtotal' },
      'computed.withheldMinor': { label: 'Total retenciones del año', gloss: 'total withholding for the year' },
      'input.creditFromLastYearMinor': {
        label: 'Saldo a favor del año anterior',
        gloss: 'last year\'s credit balance',
        hint: 'Without a refund or offset request.',
      },
      'input.advancePaidMinor': { label: 'Anticipo de renta del año anterior', gloss: 'advance paid last year' },
    },
  },

  settle: {
    title: 'Final settlement',
    rows: {
      'computed.taxMinor': { label: 'Total impuesto a cargo', gloss: 'total tax due' },
      'computed.creditedMinor': { label: 'Withholding, advances and credit balance' },
      'computed.toPayMinor': { label: 'Saldo a pagar', gloss: 'balance to pay' },
      'computed.inFavourMinor': { label: 'Saldo a favor', gloss: 'balance in your favour' },
    },
  },

  planning: {
    title: 'Planning your year',
    rows: {
      'computed.grossPerMonthMinor': { label: 'Average gross monthly income' },
      'computed.contributionsPerMonthMinor': { label: 'Mandatory contributions a month' },
      'computed.voluntaryPerMonthMinor': { label: 'Voluntary contribution a month' },
      'computed.withheldPerMonthMinor': { label: 'Withholding tax a month' },
      'computed.netPerMonthMinor': { label: 'Average net monthly salary' },
      'computed.savePerMonthMinor': {
        label: 'Monthly saving for the balance to pay',
        hint: 'Set it aside every month and the payment arrives with the money already saved.',
      },
    },
  },

  voluntary: {
    title: 'Best voluntary contribution',
    subtitle: 'AFC, FVP or AVC',
    rows: {
      'computed.roomMinor': { label: 'Room left within the limit', hint: 'What the 40% or 1.340 UVT limit still leaves unused.' },
      'computed.voluntaryCeilingMinor': {
        label: 'Voluntary contribution cap',
        hint: 'The lower of 3.800 UVT and 30% of your income.',
      },
      'computed.voluntaryOptimalMinor': { label: 'Recommended voluntary contribution' },
      'computed.voluntaryMissingMinor': { label: 'Still to transfer' },
      'computed.voluntaryMissingPerMonthMinor': { label: 'Still to transfer, spread by month' },
    },
  },

  notes: {
    title: 'Notes and assumptions',
    rows: {
      'note.0': { text: 'The IBC (contribution base) depends on the kind of contract: the whole salary if ordinary, 70% if integral and 40% if you are self-employed.' },
      'note.1': { text: 'The dependants deduction and the 1% electronic invoice deduction do not compete for the 40% or 1.340 UVT limit (art. 336 num. 3 and 5 E.T.).' },
      'note.2': { text: 'The 40% or 1.340 UVT limit is worked out on the net income of the cédula general (casilla 91).' },
      'note.3': { text: 'It covers the cédula general. It does not include the pensions or dividends cédulas.' },
      'note.4': { text: 'Check the UVT and the caps every year: the law can change them.' },
      'note.5': { text: 'Financial yields go in rentas de capital (casilla 58). Their inflationary component is ingreso no constitutivo de renta, income that is not taxable (casilla 59), and the net capital income lands in casilla 61.' },
      'note.6': { text: 'Cashback is added to rentas de capital with no inflationary component. We found no DIAN ruling on cashback: it is an assumption to confirm with an accountant.' },
      'note.7': { text: 'Casillas 43 to 57 are for fees of self-employed people who subtract costs and expenses instead of the 25% exempt income. This simulator does not have that section yet: here a self-employed person goes in rentas de trabajo (casilla 32).' },
      'note.8': { text: 'None of this has been confirmed with an accountant yet.' },
    },
  },
};
