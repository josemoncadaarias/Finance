/**
 * The words a statement uses that say what something was.
 *
 * The merchant dictionary answers nearly everything on a phone that has been
 * used, because it has seen the same supermarket forty times. On the first
 * import of a brand-new install it knows nothing, and fifty lines are asked
 * about one at a time - which is exactly the tiredness that makes a person
 * accept the whole lot without reading it. Jose asked for this on 2026-09-23.
 *
 * Deliberately words and not brands. A list of Colombian shops would be wrong
 * in every other country, which is the same reason rule 22 refuses a built-in
 * list of banks. "Supermercado", "farmacia", "peaje" and "nomina" are the
 * ordinary nouns of the two languages this app speaks, and a bank that writes
 * one of them is telling us what the movement was.
 *
 * Three things keep a guess from doing damage:
 *   - it only runs where the person's own dictionary said nothing;
 *   - a guess can only land on a category that came with the app, so a list
 *     somebody has made their own is never overruled by a word;
 *   - and the sign decides the half: an income word can never land on an
 *     expense, or a refund would be filed as a salary.
 *
 * It is marked 'guessed' and the screen says so. Calling it "aprendida" would
 * be the app claiming a history it does not have.
 */

/** A starter category, named the way `starter-categories.ts` names it. */
export interface WordMatch {
  kind: 'income' | 'expense';
  es: string;
  en: string;
}

/**
 * Word to category, folded exactly as `merchantKeyOf` folds a description:
 * upper case, no accents. Only whole words match.
 */
const WORDS: Readonly<Record<string, WordMatch>> = Object.fromEntries([
  ...entries(['SUPERMERCADO', 'SUPERMERCADOS', 'MERCADO', 'SUPERMARKET', 'GROCERY',
    'GROCERIES', 'MINIMARKET', 'FRUVER', 'CARNICERIA', 'PANADERIA', 'MERCADOS'],
    'expense', 'Mercado', 'Groceries'),

  ...entries(['RESTAURANTE', 'RESTAURANT', 'CAFETERIA', 'PIZZERIA', 'PIZZA',
    'HAMBURGUESA', 'HAMBURGUESAS', 'BURGER', 'SUSHI', 'ASADERO', 'COMIDAS',
    'DELIVERY', 'DOMICILIOS'],
    'expense', 'Restaurante', 'Eating out'),

  ...entries(['TAXI', 'TAXIS', 'UBER', 'DIDI', 'CABIFY', 'BUS', 'BUSES', 'METRO',
    'TRANSPORTE', 'TRANSPORT', 'PASAJE', 'PASAJES'],
    'expense', 'Transporte', 'Transport'),

  ...entries(['GASOLINA', 'COMBUSTIBLE', 'FUEL', 'PEAJE', 'PEAJES', 'TOLL',
    'PARQUEADERO', 'PARKING', 'TALLER', 'LLANTAS', 'MECANICA'],
    'expense', 'Automóvil', 'Car'),

  ...entries(['ARRIENDO', 'ARRENDAMIENTO', 'RENT', 'ADMINISTRACION', 'FERRETERIA',
    'MUEBLES'],
    'expense', 'Casa', 'Home'),

  ...entries(['ACUEDUCTO', 'ALCANTARILLADO', 'ENERGIA', 'ELECTRICIDAD',
    'ELECTRICITY', 'SERVICIOS', 'FACTURA', 'FACTURAS', 'INTERNET', 'TELEFONIA',
    'SEGURO', 'SEGUROS', 'INSURANCE', 'UTILITIES'],
    'expense', 'Facturas', 'Bills'),

  ...entries(['FARMACIA', 'FARMACIAS', 'DROGUERIA', 'PHARMACY', 'CLINICA',
    'CLINIC', 'HOSPITAL', 'ODONTOLOGIA', 'LABORATORIO', 'OPTICA', 'MEDICINA',
    'DENTAL', 'EPS'],
    'expense', 'Salud', 'Health'),

  ...entries(['CINE', 'CINEMA', 'TEATRO', 'THEATER', 'CONCIERTO', 'NETFLIX',
    'SPOTIFY', 'DISNEY', 'STEAM', 'PLAYSTATION', 'XBOX', 'NINTENDO'],
    'expense', 'Entretenimiento', 'Entertainment'),

  ...entries(['ROPA', 'CALZADO', 'ZAPATOS', 'BOUTIQUE', 'CLOTHING', 'SHOES'],
    'expense', 'Ropa', 'Clothes'),

  ...entries(['PELUQUERIA', 'BARBERIA', 'BARBER', 'SPA', 'ESTETICA',
    'COSMETICOS'],
    'expense', 'Cuidado personal', 'Personal care'),

  ...entries(['TECNOLOGIA', 'COMPUTADOR', 'COMPUTER', 'SOFTWARE', 'GOOGLE',
    'MICROSOFT', 'ADOBE', 'HOSTING'],
    'expense', 'Tecnología', 'Technology'),

  ...entries(['UNIVERSIDAD', 'UNIVERSITY', 'COLEGIO', 'SCHOOL', 'CURSO',
    'COURSE', 'ACADEMIA', 'MATRICULA', 'EDUCACION'],
    'expense', 'Educación', 'Education'),

  ...entries(['HOTEL', 'HOSTAL', 'AIRBNB', 'BOOKING', 'AEROLINEA', 'VUELO',
    'FLIGHT', 'AGENCIA'],
    'expense', 'Viajes', 'Travel'),

  ...entries(['VETERINARIA', 'VETERINARIO', 'MASCOTAS', 'PETSHOP'],
    'expense', 'Mascotas', 'Pets'),

  ...entries(['REGALO', 'REGALOS', 'FLORISTERIA', 'GIFT'],
    'expense', 'Regalos', 'Gifts'),

  // The other half. A word here can only ever land on money coming in.
  ...entries(['NOMINA', 'PAYROLL', 'SALARIO', 'SUELDO', 'QUINCENA', 'SALARY'],
    'income', 'Salario', 'Salary'),

  ...entries(['INTERES', 'INTERESES', 'RENDIMIENTO', 'RENDIMIENTOS', 'INTEREST'],
    'income', 'Rendimientos', 'Interest'),

  // Cashback comes with the schema itself (migration 037), under that name in
  // both languages.
  ...entries(['CASHBACK'], 'income', 'Cashback', 'Cashback'),
]);

function entries(
  words: readonly string[], kind: 'income' | 'expense', es: string, en: string,
): [string, WordMatch][] {
  return words.map(word => [word, { kind, es, en }]);
}

/**
 * What the words of a description suggest, or null.
 *
 * The first word that says anything wins, reading left to right: a bank puts
 * the thing it is describing before the reference numbers.
 *
 * `signed` is the movement in minor units. Its sign picks the half of the
 * list that may answer - an income word on a line of money leaving is a
 * misreading, not a category.
 */
export function wordCategoryOf(
  description: string | null | undefined, signed: number | null,
): WordMatch | null {
  if (!description || signed === null || signed === 0) return null;
  const wanted = signed > 0 ? 'income' : 'expense';

  const folded = description
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9Ñ]+/g, ' ')
    .trim();

  for (const word of folded.split(' ')) {
    const found = WORDS[word];
    if (found && found.kind === wanted) return found;
  }
  return null;
}

/** Every word it knows, for the test that checks they are all spelt foldable. */
export const COMMON_WORDS = WORDS;
