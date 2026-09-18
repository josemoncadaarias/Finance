/**
 * Formulario 210, as a screen: every section, every box, in the order of the
 * spreadsheet it replaces.
 *
 * This is the Spanish of the tax module, and the source every other language
 * is laid over: `tax-form.en.ts` holds the English, matched row by row, and
 * `tax-words.ts` picks one. Spanish is what the DIAN's form speaks, so nothing
 * here is ever reworded to suit a translation.
 *
 * In English the DIAN's own terms are not translated away. A row that lands in
 * a box of the form keeps its Spanish label - the words printed beside that
 * casilla - with an English `gloss` beside it: an English "non-constitutive
 * income" on its own would be a phrase nobody could find on the form.
 * Everything this app wrote in its own voice is simply English.
 *
 * The screen renders this and nothing else, so a line added to the form next
 * year is a line added here - and, the tests insist, in `tax-form.en.ts`.
 * Each row says whether the person types it or the simulation works it out,
 * and which box of the form it lands in.
 */

import type { EmploymentKind, TaxInputs, TaxResult } from './types';

export type FieldFormat = 'money' | 'percent' | 'uvt' | 'count';

type NumericKeys<T> = {
  [K in keyof T]-?: T[K] extends number | undefined ? K : never;
}[keyof T];

export type InputKey = Exclude<NumericKeys<TaxInputs>, 'year' | 'formRevision'>;
export type ResultKey = NumericKeys<TaxResult>;

export type SpecialRow =
  | 'references'
  | 'inflationReference'
  | 'inflationaryMode'
  | 'employment'
  | 'salaryPrefill'
  | 'yieldsPrefill'
  | 'rateTable'
  | 'monthlyWithholding'
  | 'extraWithholding'
  | 'sources';

/**
 * When a row belongs on the form at all.
 *
 * Casilla 59 is asked two ways - worked out from the yields, or typed as the
 * certificate states it - and the rows of the way not chosen are not "greyed
 * out", they are simply not part of the form that person is filling in. The
 * spreadsheet leaves them out for the same reason.
 */
export type RowWhen = 'inflationary.worked' | 'inflationary.typed';

/**
 * `gloss` is only ever set by a translation: what the Spanish label of a box
 * means, shown beside it in the reader's language. Spanish rows have none.
 */
export type FormRow =
  | {
      kind: 'input'; key: InputKey; label: string; gloss?: string; box?: string; hint?: string;
      format: FieldFormat; when?: RowWhen;
    }
  | {
      kind: 'computed'; key: ResultKey; label: string; gloss?: string; box?: string; hint?: string;
      format: Exclude<FieldFormat, 'count'>; total?: boolean; when?: RowWhen;
    }
  | { kind: 'note'; text: string; when?: RowWhen }
  | { kind: 'special'; which: SpecialRow; when?: RowWhen };

/** Whether a row belongs on the form these inputs describe. */
export function rowApplies(when: RowWhen | undefined, typed: boolean): boolean {
  if (!when) return true;
  return when === 'inflationary.typed' ? typed : !typed;
}

export interface FormSection {
  id: string;
  title: string;
  /** What a section named after the DIAN's form means, set only by a translation. */
  titleGloss?: string;
  subtitle?: string;
  /** Folded when the screen opens. Only for what is rarely touched. */
  collapsed?: boolean;
  rows: FormRow[];
}

export const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

/** What each kind of work means, said the way a person would ask it. */
export type EmploymentWords = Record<EmploymentKind, { title: string; detail: string }>;

export const EMPLOYMENT_TEXT: EmploymentWords = {
  ordinary: {
    title: 'Salario ordinario',
    detail: 'Cotizas sobre todo tu salario. Tú pagas 4% de salud y 4% de pensión; tu empleador paga el resto.',
  },
  integral: {
    title: 'Salario integral',
    detail: 'Desde 13 salarios mínimos. Cotizas sobre el 70% del salario (Ley 344 de 1996, art. 18). Tú pagas 4% y 4%.',
  },
  independent: {
    title: 'Independiente',
    detail: 'Por contrato o prestación de servicios. Cotizas sobre el 40% de lo que facturas (Ley 1955 de 2019, art. 244) y pagas todo: 12,5% de salud y 16% de pensión.',
  },
};

/**
 * What the tax rules on this screen were looked up in.
 *
 * Shown in "Notas y supuestos" so it is plain that no figure or box here is a
 * guess: each came from a place anyone can open and check.
 */
export const TAX_SOURCES: readonly TaxSource[] = [
  { label: 'DIAN - Formulario 210, año gravable 2025', url: 'https://www.dian.gov.co/atencionciudadano/formulariosinstructivos/Formularios/2025/Formulario_210_2025.pdf' },
  { label: 'Siempre al Día - Ingresos en el formulario 210: casillas y cédulas', url: 'https://siemprealdia.co/colombia/impuestos/ingresos-en-el-formulario-210/' },
  { label: 'Actualícese - Quiénes usan las casillas 43 a 57 del formulario 210', url: 'https://actualicese.com/que-personas-naturales-deberan-utilizar-las-casillas-43-a-57-del-formulario-210/' },
  { label: 'CONCP - Rentas no laborales en el formulario 210', url: 'https://concp.co/rentas-no-laborales-en-el-formulario-210/' },
  { label: 'Siempre al Día - Componente inflacionario en la declaración de renta', url: 'https://siemprealdia.co/colombia/impuestos/componente-inflacionario-en-la-declaracion-de-renta/' },
  { label: 'INCP - IPC anual de 6,24% en agosto de 2026 (DANE)', url: 'https://incp.org.co/publicaciones/infoincp-publicaciones/informacion-para-empresas/2026/09/dane-reporto-variacion-anual-del-ipc-de-624-en-agosto-de-2026/' },
  { label: 'La República - DTF', url: 'https://www.larepublica.co/indicadores-economicos/bancos/dtf' },
  { label: 'Holland & Knight - Salario mínimo y auxilio de transporte 2026', url: 'https://www.hklaw.com/en/insights/publications/2025/12/colombia-decreta-aumento-del-salario-minimo-y-auxilio-de-transporte' },
  { label: 'Alegra - Salario mínimo en Colombia 2026', url: 'https://blog.alegra.com/colombia/salario-minimo-en-colombia-2026/' },
  { label: 'Ámbito Jurídico - Auxilio de transporte 2026', url: 'https://www.ambitojuridico.com/noticias/laboral/249095-valor-del-auxilio-de-transporte-para-el-2026-aumenta-245-respecto-al-2025' },
];

export const TAX_TEXT = {
  title: 'Simulador de renta',
  legendTyped: 'Casilla que escribes',
  legendComputed: 'Casilla que se calcula sola',
  box: 'Csl.',

  toPay: 'Saldo a pagar',
  inFavour: 'Saldo a favor',
  settled: 'Ni pagas ni te devuelven',
  savePerMonth: 'Aparta {amount} cada mes para no tener sorpresas',
  taxLine: 'Impuesto {tax} · retenciones {withheld}',

  saving: 'Guardando…',
  saved: 'Guardado',
  previousYear: 'Año anterior',
  nextYear: 'Año siguiente',
  yearLabel: 'Año gravable {year}',

  uvtMissing: 'Falta la UVT de {year}. Sin ella ningún tope se puede calcular: escríbela en Parámetros del año.',

  referencesIntro: 'De dónde salen los parámetros de este año. Si alguno aún no es oficial, se usa la mejor referencia disponible en vez de dejarlo en cero.',
  standingOfficial: 'Oficial',
  standingReference: 'Referencia {year}',
  standingEstimate: 'Estimado',
  standingLater: 'De {year}, posterior',
  laterWarning: 'De este año falta {what}, y se está usando la de un año posterior, que no le corresponde. Escríbela a mano abajo si la conoces.',
  refUvt: 'UVT',
  refMinimumWage: 'Salario mínimo, sin auxilio de transporte',
  refInflationary: 'Componente inflacionario',
  inflationaryModeTitle: 'Cómo sale la casilla 59',
  inflationaryModeWorked: 'Calcularlo',
  inflationaryModeTyped: 'Escribirlo',
  inflationaryModeWorkedHint: 'La app lo calcula: la parte de la casilla 58 que son rendimientos financieros, por el porcentaje del año.',
  inflationaryModeTypedHint: 'Escribes la cifra que ya conoces, por ejemplo la del certificado del banco.',
  sheetInflationaryMode: 'Casilla 59',

  salaryButton: 'Traer lo registrado como salario en {year}',
  salaryHint: 'Tú registras lo que te llega a la cuenta, que es el neto. Aquí va el bruto: úsalo solo como punto de partida y corrígelo.',
  salarySheetTitle: '¿En qué categoría registras tu salario?',
  salaryEmpty: 'No hay ingresos registrados en {year}.',
  salaryUsed: 'Se tomaron {total} de "{category}" repartidos en {months} meses. Es el NETO: cámbialo por el salario bruto de tu contrato.',

  yieldsButton: 'Traer rendimientos y cashback de {year}',
  yieldsHint: 'Los rendimientos y el cashback van aquí, en rentas de capital, no en ganancias ocasionales. Lo que trae la app es aproximado: usa el certificado de cada banco.',
  yieldsNone: 'No hay rendimientos ni cashback registrados en {year}.',
  yieldsUsed: 'Se tomaron {gross} de rendimientos brutos ({days} días calculados), {cashback} de cashback y {withheld} de retención. Aproximado: compáralo con los certificados de los bancos.',

  sourcesTitle: 'Fuentes consultadas',

  excelButton: 'Descargar en Excel',
  excelHint: 'Un archivo como tu simulador de Excel: lo amarillo lo escribes tú y lo demás se recalcula solo.',
  excelWriting: 'Armando la hoja de cálculo',
  excelSaved: 'Se descargó {file}. Lo amarillo se puede cambiar y todo lo demás se recalcula.',
  excelFile: 'simulador-renta-{year}.xlsx',

  sheetName: 'Renta {year}',
  sheetTitle: 'SIMULADOR DECLARACIÓN DE RENTA — PERSONA NATURAL (Formulario 210)',
  sheetSubtitle: 'Año gravable {year} · exportado desde Finance el {date}',
  sheetBoxColumn: 'Columna C = casilla equivalente en el Formulario 210 de la DIAN.',
  sheetLegendTyped: 'Dato manual: escríbelo o cámbialo según tu situación. Todo lo que depende de él se recalcula solo.',
  sheetLegendComputed: 'Cálculo automático: no lo edites, está bloqueado. Si de verdad lo necesitas: Revisar › Desproteger hoja.',
  sheetSummary: 'Resumen',
  sheetSavePerMonth: 'Ahorro mensual para el saldo a pagar',
  sheetEmployment: 'Tipo de contrato',
  sheetBaseShare: '% del salario sobre el que cotizas (IBC)',
  sheetBaseShareHint: '100% con salario ordinario, 70% con salario integral y 40% como independiente. Si cambias de contrato, ajusta este % y los de salud y pensión.',
  sheetRateRange: 'Rango (UVT)',
  sheetRateMarginal: 'Tarifa marginal',
  sheetRateFormula: 'Fórmula',
  sheetRateRow: '(Base − {from}) × {rate}% + {plus} UVT',
  sheetMonth: 'Retención en la fuente — {month}',
  sheetExtra: 'Retención adicional {n}',
  sheetBox: 'Csl. {box}',
  yieldsWithholdingLabel: 'Retención por rendimientos (aprox.)',

  extraConcept: 'Concepto',
  rateTableTitle: 'Tabla de tarifas (art. 241 E.T.)',
  rateBand: 'Desde {from} UVT',
  rateApplies: 'Tu renta cae aquí',

  close: 'Cerrar',
  toTop: 'Ir arriba del todo',
  toBottom: 'Ir abajo del todo',
  collapseAll: 'Plegar todas las secciones',
  expandAll: 'Desplegar todas las secciones',

  disclaimer: 'Es una herramienta de apoyo personal. No reemplaza a un contador ni la declaración oficial ante la DIAN.',

  /** Joins the last two names of a list: "la UVT y el salario mínimo". */
  and: 'y',
} as const;

/** The module's own words in any language: the same keys as `TAX_TEXT`. */
export type TaxText = Record<keyof typeof TAX_TEXT, string>;

/** An external page a rule was looked up in. */
export interface TaxSource { label: string; url: string }

export const TAX_FORM: readonly FormSection[] = [
  {
    id: 'situation',
    title: 'Tu situación',
    rows: [
      { kind: 'special', which: 'employment' },
      {
        kind: 'input', key: 'dependents', format: 'count',
        label: 'Dependientes económicos',
        hint: 'Hasta 4 cuentan (art. 336 E.T.).',
      },
    ],
  },

  {
    id: 'parameters',
    title: 'Parámetros del año',
    subtitle: 'Cambian por ley cada año. Casi nunca se tocan.',
    collapsed: true,
    rows: [
      { kind: 'special', which: 'references' },
      {
        kind: 'input', key: 'uvtMinor', format: 'money',
        label: 'Valor de la UVT',
        hint: 'La DIAN la fija por resolución cada diciembre, para el año siguiente.',
      },
      {
        kind: 'input', key: 'minimumWageMinor', format: 'money',
        label: 'Salario mínimo mensual',
        hint: 'Sin el auxilio de transporte, que no es salario. Pone el IBC entre 1 y 25 salarios mínimos y calcula por escalones el fondo de solidaridad.',
      },
      { kind: 'input', key: 'labourExemptScaled', format: 'percent', label: '% renta exenta de trabajo', hint: 'Art. 206 num. 10 E.T.' },
      { kind: 'input', key: 'labourExemptCapUvt', format: 'uvt', label: 'Tope renta exenta (UVT al año)', hint: 'Ley 2277 de 2022.' },
      { kind: 'input', key: 'dependentMonthlyCapUvt', format: 'uvt', label: 'Tope deducción por dependiente (UVT al mes)', hint: 'Art. 387 E.T.' },
      { kind: 'input', key: 'healthPolicyCapUvt', format: 'uvt', label: 'Tope deducción por salud (UVT al mes)', hint: 'Art. 387 E.T.' },
      { kind: 'input', key: 'globalCapScaled', format: 'percent', label: '% límite global de exentas y deducciones', hint: 'Art. 336 num. 3 E.T.' },
      { kind: 'input', key: 'globalCapUvt', format: 'uvt', label: 'Tope límite global (UVT al año)', hint: 'Art. 336 num. 3 E.T.' },
      { kind: 'input', key: 'dependentUvt', format: 'uvt', label: 'UVT por dependiente al año', hint: 'Art. 336 E.T.' },
      { kind: 'input', key: 'eInvoiceCapUvt', format: 'uvt', label: 'Tope deducción factura electrónica (UVT)', hint: 'Art. 336 num. 5 E.T.' },
      { kind: 'input', key: 'voluntaryCapUvt', format: 'uvt', label: 'Tope aporte voluntario (UVT al año)', hint: 'Art. 126-1 E.T.' },
      { kind: 'input', key: 'voluntaryIncomeShareScaled', format: 'percent', label: 'Tope aporte voluntario (% de ingresos)', hint: 'Art. 126-1 E.T.' },
    ],
  },

  {
    id: 'labour',
    title: '1. Rentas de trabajo',
    subtitle: 'Casillas 32 a 42',
    rows: [
      {
        kind: 'input', key: 'monthlySalaryMinor', format: 'money',
        label: 'Salario mensual bruto',
        hint: 'El de tu contrato, antes de descuentos. Si cambia mes a mes, el promedio.',
      },
      { kind: 'special', which: 'salaryPrefill' },
      { kind: 'input', key: 'monthsWorked', format: 'count', label: 'Meses trabajados en el año' },
      {
        kind: 'input', key: 'otherLabourIncomeMinor', format: 'money',
        label: 'Otros ingresos laborales del año',
        hint: 'Bonos, comisiones, primas extralegales.',
      },
      { kind: 'computed', key: 'grossLabourMinor', format: 'money', label: 'Total ingresos brutos de trabajo', box: '32', total: true },

      { kind: 'note', text: 'Aportes obligatorios a seguridad social. Se restan como ingresos no constitutivos de renta.' },
      {
        kind: 'computed', key: 'monthlyBaseMinor', format: 'money',
        label: 'Base de cotización mensual (IBC)',
        hint: 'Todo el salario si es ordinario, 70% si es integral, 40% si eres independiente.',
      },
      { kind: 'input', key: 'healthScaled', format: 'percent', label: '% aporte a salud', hint: '4% como empleado, 12,5% como independiente.' },
      { kind: 'input', key: 'pensionScaled', format: 'percent', label: '% aporte a pensión', hint: '4% como empleado, 16% como independiente.' },
      {
        kind: 'input', key: 'solidarityScaled', format: 'percent',
        label: '% fondo de solidaridad pensional',
        hint: 'Se usa este mientras no haya salario mínimo en Parámetros. Con él, se calcula solo: 1% desde 4 salarios mínimos y sube hasta 2% (Ley 797 de 2003).',
      },
      { kind: 'computed', key: 'solidarityRateScaled', format: 'percent', label: '% de solidaridad aplicado' },
      { kind: 'computed', key: 'healthMinor', format: 'money', label: 'Aporte a salud en el año' },
      { kind: 'computed', key: 'pensionMinor', format: 'money', label: 'Aporte a pensión en el año' },
      { kind: 'computed', key: 'solidarityMinor', format: 'money', label: 'Aporte a fondo de solidaridad en el año' },
      { kind: 'computed', key: 'contributionsMinor', format: 'money', label: 'Total aportes obligatorios', box: '33', total: true },
      { kind: 'computed', key: 'labourNetMinor', format: 'money', label: 'Renta líquida de trabajo', box: '34', total: true },
    ],
  },

  {
    id: 'fees',
    title: '2. Rentas de trabajo sin relación laboral',
    subtitle: 'Casillas 43 a 46',
    rows: [
      {
        kind: 'note',
        text: 'Trabajo tuyo por el que no te pagan como empleado: honorarios, comisiones, '
            + 'servicios personales, emolumentos. El artículo 103 del E.T. dice que todo eso es '
            + 'renta de trabajo, seas empleado o no. Tiene columna aparte porque aquí SÍ puedes '
            + 'restar lo que te costó ganártelo: un empleado no tiene costos, alguien que factura '
            + 'sus servicios sí. Si eres asalariado y nada más, esta sección va en ceros.',
      },
      {
        kind: 'input', key: 'feeIncomeMinor', format: 'money', box: '43',
        label: 'Ingresos brutos',
        hint: 'Todo lo que facturaste en el año por honorarios, comisiones o servicios, antes de '
            + 'restar nada. Si te practicaron retención, va el valor bruto, no el que te consignaron.',
      },
      {
        kind: 'input', key: 'feeNonTaxableMinor', format: 'money', box: '44',
        label: 'Ingresos no constitutivos de renta',
        hint: 'La parte que la ley dice que no es renta. Lo más común: los aportes obligatorios a '
            + 'salud y pensión que pagaste sobre estos ingresos (arts. 55 y 56 E.T.). Si no tienes '
            + 'nada de esto, déjalo en cero.',
      },
      {
        kind: 'input', key: 'feeCostsMinor', format: 'money', box: '45',
        label: 'Costos y deducciones procedentes',
        hint: 'Lo que gastaste para producir esos ingresos y puedes probar con soporte: insumos, '
            + 'transporte del servicio, arriendo del local. Ojo: quien resta costos aquí NO puede '
            + 'tomar además el 25% de renta exenta del art. 206 num. 10 sobre estos mismos '
            + 'ingresos. Por confirmar con tu contador antes de usarlo en una declaración.',
      },
      {
        kind: 'computed', key: 'feeNetMinor', format: 'money', box: '46', total: true,
        label: 'Renta líquida',
        hint: 'Casilla 43 menos 44 menos 45. Nunca queda negativa.',
      },
    ],
  },

  {
    id: 'capital',
    title: '3. Rentas de capital',
    subtitle: 'Casillas 58 a 62',
    rows: [
      {
        kind: 'input', key: 'capitalIncomeMinor', format: 'money', box: '58',
        label: 'Ingresos brutos por rentas de capital',
        hint: 'Intereses y rendimientos financieros de todas tus cuentas, cashback, arriendos y regalías.',
      },
      { kind: 'special', which: 'yieldsPrefill' },
      { kind: 'special', which: 'inflationaryMode' },
      {
        kind: 'input', key: 'financialYieldMinor', format: 'money', when: 'inflationary.worked',
        label: 'De ellos, rendimientos financieros',
        hint: 'Intereses de cuentas, CDT y fondos. Solo a estos se les aplica el componente inflacionario: el cashback y los arriendos no lo tienen.',
      },
      {
        kind: 'input', key: 'inflationaryScaled', format: 'percent', when: 'inflationary.worked',
        label: '% componente inflacionario del año',
        hint: 'Inflación del DANE dividida por la tasa de captación de la Superfinanciera (art. 40-1 E.T.). Sale al año siguiente.',
      },
      { kind: 'special', which: 'inflationReference', when: 'inflationary.worked' },
      {
        kind: 'input', key: 'capitalNonTaxableTypedMinor', format: 'money', when: 'inflationary.typed',
        label: 'Componente inflacionario certificado',
        hint: 'La cifra del certificado del banco. Se usa tal cual; solo se recorta si supera la casilla 58.',
      },
      {
        kind: 'computed', key: 'capitalNonTaxableMinor', format: 'money', box: '59',
        label: 'Ingresos no constitutivos de renta',
        hint: 'El componente inflacionario de los rendimientos financieros (arts. 38 a 41 E.T.).',
      },
      { kind: 'input', key: 'capitalCostsMinor', format: 'money', box: '60', label: 'Costos y deducciones procedentes' },
      {
        kind: 'computed', key: 'capitalNetMinor', format: 'money', box: '61', total: true,
        label: 'Renta líquida de capital',
        hint: 'Casilla 58 menos 59 menos 60. Nunca queda negativa.',
      },
      {
        kind: 'input', key: 'passiveCapitalMinor', format: 'money', box: '62',
        label: 'Rentas líquidas pasivas - ECE',
        hint: 'Solo si controlas una sociedad en el exterior (una ECE: entidad controlada del '
            + 'exterior, arts. 882 a 893 E.T.). Sus rentas pasivas - intereses, dividendos, '
            + 'regalías, arriendos - se declaran en el año en que la sociedad las gana, aunque no '
            + 'te las haya girado. Va aquí porque esas rentas son de capital por naturaleza. '
            + 'Tener una cuenta o acciones en el exterior NO es esto: esto es controlar la '
            + 'sociedad. Si no es tu caso, déjalo en cero.',
      },
    ],
  },

  {
    id: 'other',
    title: '4. Rentas no laborales',
    subtitle: 'Casillas 74 a 78',
    rows: [
      {
        kind: 'input', key: 'otherIncomeMinor', format: 'money', box: '74',
        label: 'Ingresos brutos por rentas no laborales',
        hint: 'Ventas, operaciones con criptoactivos, venta de activos fijos que tuviste menos de dos años. Los rendimientos y el cashback no van aquí.',
      },
      { kind: 'input', key: 'otherCostsMinor', format: 'money', box: '77', label: 'Costos y deducciones procedentes' },
      { kind: 'computed', key: 'otherNetMinor', format: 'money', label: 'Renta líquida no laboral', box: '78', total: true },
    ],
  },

  {
    id: 'general',
    title: 'Cédula general',
    rows: [
      {
        kind: 'computed', key: 'generalNetMinor', format: 'money', box: '91', total: true,
        label: 'Renta líquida cédula general',
        hint: 'Trabajo más capital más no laboral.',
      },
    ],
  },

  {
    id: 'capped',
    title: '5. Rentas exentas y deducciones',
    subtitle: 'Con límite del 40% o 1.340 UVT · Casillas 35 a 41',
    rows: [
      { kind: 'input', key: 'voluntaryPayrollMinor', format: 'money', label: 'Aportes voluntarios AFC, FVP o AVC por nómina', hint: 'Lo que tu empleador traslada directamente al fondo.' },
      { kind: 'input', key: 'voluntaryOwnMinor', format: 'money', label: 'Aportes voluntarios propios', hint: 'Lo que tú aportas por fuera de la nómina.' },
      { kind: 'computed', key: 'voluntaryMinor', format: 'money', label: 'Total aportes voluntarios', box: '35' },
      { kind: 'input', key: 'housingInterestMinor', format: 'money', box: '38', label: 'Intereses de vivienda o ICETEX' },
      { kind: 'computed', key: 'labourExemptMinor', format: 'money', box: '36', label: 'Renta exenta de trabajo', hint: '25% de la renta de trabajo, con tope de 790 UVT.' },
      { kind: 'computed', key: 'dependentDeductionMinor', format: 'money', box: '39', label: 'Deducción por dependiente', hint: '10% de los ingresos de trabajo, con tope de 32 UVT al mes.' },
      { kind: 'input', key: 'healthPolicyMinor', format: 'money', label: 'Pagos de medicina prepagada o pólizas de salud', hint: 'Solo lo que pagaste en el año, tuyo, de tu cónyuge o de tus hijos.' },
      { kind: 'computed', key: 'healthPolicyMinor', format: 'money', box: '39', label: 'Deducción por salud', hint: 'Con tope de 16 UVT al mes.' },
      { kind: 'input', key: 'otherDeductionsMinor', format: 'money', box: '39', label: 'Otras deducciones' },
      { kind: 'computed', key: 'beforeCapMinor', format: 'money', label: 'Subtotal sin aplicar el límite' },
      { kind: 'computed', key: 'capMinor', format: 'money', label: 'Límite aplicable', hint: 'El menor entre el 40% de la cédula general y 1.340 UVT.' },
      { kind: 'computed', key: 'cappedMinor', format: 'money', box: '41', label: 'Rentas exentas y deducciones limitadas', total: true },
    ],
  },

  {
    id: 'uncapped',
    title: '6. Deducciones sin límite',
    subtitle: 'No compiten por el 40% ni por los 1.340 UVT',
    rows: [
      { kind: 'computed', key: 'dependentsMinor', format: 'money', box: '139', label: 'Deducción por dependientes económicos', hint: '72 UVT por cada uno, hasta 4.' },
      { kind: 'input', key: 'eInvoicePurchasesMinor', format: 'money', label: 'Compras con factura electrónica', hint: 'Pagadas por medio electrónico y que no estén ya en otra casilla.' },
      { kind: 'computed', key: 'eInvoiceMinor', format: 'money', box: '28', label: 'Deducción del 1% por factura electrónica', hint: 'Con tope de 240 UVT.' },
      { kind: 'computed', key: 'deductionsMinor', format: 'money', box: '92', label: 'Total rentas exentas y deducciones', total: true },
    ],
  },

  {
    id: 'tax',
    title: 'Impuesto',
    rows: [
      { kind: 'computed', key: 'taxableMinor', format: 'money', box: '93', label: 'Renta líquida ordinaria', total: true },
      { kind: 'computed', key: 'taxableUvt', format: 'uvt', label: 'Renta líquida gravable en UVT' },
      { kind: 'special', which: 'rateTable' },
      {
        kind: 'input', key: 'occasionalTaxMinor', format: 'money', box: '127',
        label: 'Impuesto de ganancias ocasionales',
        hint: 'Venta de activos que tuviste 2 años o más, premios, herencias. Los rendimientos no van aquí: son rentas de capital.',
      },
      { kind: 'computed', key: 'taxMinor', format: 'money', box: '126', label: 'Impuesto neto de renta', total: true },
    ],
  },

  {
    id: 'withholding',
    title: 'Retenciones y anticipos',
    subtitle: 'Casillas 130 a 132',
    rows: [
      { kind: 'note', text: 'Retención practicada en la nómina, mes a mes.' },
      { kind: 'special', which: 'monthlyWithholding' },
      { kind: 'computed', key: 'monthlyWithheldMinor', format: 'money', label: 'Subtotal retención de nómina' },
      { kind: 'note', text: 'Retenciones por otros conceptos: rendimientos financieros, honorarios, venta de activos.' },
      { kind: 'special', which: 'extraWithholding' },
      { kind: 'computed', key: 'extraWithheldMinor', format: 'money', label: 'Subtotal retenciones adicionales' },
      { kind: 'computed', key: 'withheldMinor', format: 'money', box: '132', label: 'Total retenciones del año', total: true },
      { kind: 'input', key: 'creditFromLastYearMinor', format: 'money', box: '131', label: 'Saldo a favor del año anterior', hint: 'Sin solicitud de devolución o compensación.' },
      { kind: 'input', key: 'advancePaidMinor', format: 'money', box: '130', label: 'Anticipo de renta del año anterior' },
    ],
  },

  {
    id: 'settle',
    title: 'Liquidación final',
    rows: [
      { kind: 'computed', key: 'taxMinor', format: 'money', box: '129', label: 'Total impuesto a cargo' },
      { kind: 'computed', key: 'creditedMinor', format: 'money', label: 'Retenciones, anticipos y saldo a favor' },
      { kind: 'computed', key: 'toPayMinor', format: 'money', box: '134', label: 'Saldo a pagar', total: true },
      { kind: 'computed', key: 'inFavourMinor', format: 'money', box: '137', label: 'Saldo a favor', total: true },
    ],
  },

  {
    id: 'planning',
    title: 'Para planear tu año',
    rows: [
      { kind: 'computed', key: 'grossPerMonthMinor', format: 'money', label: 'Ingreso bruto mensual promedio' },
      { kind: 'computed', key: 'contributionsPerMonthMinor', format: 'money', label: 'Aportes obligatorios al mes' },
      { kind: 'computed', key: 'voluntaryPerMonthMinor', format: 'money', label: 'Aporte voluntario al mes' },
      { kind: 'computed', key: 'withheldPerMonthMinor', format: 'money', label: 'Retención en la fuente al mes' },
      { kind: 'computed', key: 'netPerMonthMinor', format: 'money', label: 'Salario neto mensual promedio', total: true },
      { kind: 'computed', key: 'savePerMonthMinor', format: 'money', label: 'Ahorro mensual para el saldo a pagar', hint: 'Apártalo cada mes y el pago llega con la plata ya guardada.', total: true },
    ],
  },

  {
    id: 'voluntary',
    title: 'Aporte voluntario óptimo',
    subtitle: 'AFC, FVP o AVC',
    rows: [
      { kind: 'computed', key: 'roomMinor', format: 'money', label: 'Espacio libre dentro del límite', hint: 'Lo que el límite del 40% o 1.340 UVT aún deja sin usar.' },
      { kind: 'computed', key: 'voluntaryCeilingMinor', format: 'money', label: 'Tope del aporte voluntario', hint: 'El menor entre 3.800 UVT y el 30% de tus ingresos.' },
      { kind: 'computed', key: 'voluntaryOptimalMinor', format: 'money', label: 'Aporte voluntario recomendado', total: true },
      { kind: 'computed', key: 'voluntaryMissingMinor', format: 'money', label: 'Lo que falta por trasladar' },
      { kind: 'computed', key: 'voluntaryMissingPerMonthMinor', format: 'money', label: 'Lo que falta, repartido al mes' },
    ],
  },

  {
    id: 'notes',
    title: 'Notas y supuestos',
    collapsed: true,
    rows: [
      { kind: 'note', text: 'El IBC depende del tipo de contrato: todo el salario si es ordinario, 70% si es integral y 40% si eres independiente.' },
      { kind: 'note', text: 'La deducción por dependientes y la del 1% por factura electrónica no compiten por el límite del 40% o 1.340 UVT (art. 336 num. 3 y 5 E.T.).' },
      { kind: 'note', text: 'El límite del 40% o 1.340 UVT se calcula sobre la renta líquida de la cédula general (casilla 91).' },
      { kind: 'note', text: 'Cubre la cédula general. No incluye las cédulas de pensiones ni de dividendos.' },
      { kind: 'note', text: 'Revisa cada año la UVT y los topes: la ley puede cambiarlos.' },
      { kind: 'note', text: 'Los rendimientos financieros van en rentas de capital (casilla 58). Su componente inflacionario es ingreso no constitutivo de renta (casilla 59) y la renta líquida de capital queda en la casilla 61.' },
      { kind: 'note', text: 'El cashback se suma a rentas de capital sin componente inflacionario. No encontramos un concepto de la DIAN sobre el cashback: es un supuesto que hay que confirmar con un contador.' },
      { kind: 'note', text: 'Las casillas 43 a 57 son para honorarios de independientes que restan costos y gastos en lugar de la renta exenta del 25%. Este simulador cubre las casillas 43 a 46 en la sección 2; el resto de esa columna (casillas 47 a 57) aún no. Si no restas costos, tus honorarios van en rentas de trabajo (casilla 32), como independiente.' },
      { kind: 'note', text: 'Nada de esto está confirmado con un contador todavía.' },
      { kind: 'special', which: 'sources' },
    ],
  },
];
