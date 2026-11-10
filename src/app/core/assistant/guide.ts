/**
 * "¿Cómo registro un préstamo?", "¿dónde creo una categoría?", "quiero
 * agregar una tarjeta": a question about how to use the app, not about one's
 * money (Jose, 2026-11-10, from a tester's comment: she could not find where
 * a loan is entered). The assistant answers with the steps and a button that
 * opens that form at once.
 *
 * Pure: a sentence (folded: lower case, no accents) in, the thing it asks
 * how to make out. Read by its structure - a verb of making or finding, then
 * the thing - never by one person's sentences.
 */

/** Everything the assistant can walk a person through. */
export type GuideTopic =
  | 'account' | 'card' | 'loan' | 'debt' | 'payCard' | 'payLoan'
  | 'category' | 'cap' | 'goal' | 'reminder' | 'product' | 'currency'
  | 'expense' | 'income' | 'transfer' | 'statement' | 'receipt' | 'notices' | 'backup';

/** Every topic, in the order the "¿Qué quieres hacer?" chips offer them. */
export const GUIDE_TOPICS: readonly GuideTopic[] = [
  'expense', 'income', 'transfer', 'account', 'card', 'loan', 'category', 'cap', 'goal',
  'reminder', 'product', 'payCard', 'payLoan', 'currency', 'statement', 'receipt', 'notices', 'backup',
];

/** A verb of making, entering or setting up something. */
const MAKE_VERB = '(creo|crear|crearla|crearlo|crea|creamos|agrego|agregar|agregarla|agregarlo|agrega|agregamos|anado|anadir|anade|registro|registrar|registrarla|registrarlo|registra|registramos|ingreso|ingresar|ingresarla|ingresarlo|ingresa|meto|meter|metemos|pongo|poner|ponemos|anoto|anotar|apunto|apuntar|hago|hacer|hacemos|configuro|configurar|guardo|guardar|cargo|cargar|subo|subir|importo|importar|activo|activar|conecto|conectar|vinculo|vincular|pago|pagar|abono|abonar|programo|programar|uso|usar|lleno|llenar|defino|definir|establezco|establecer|fijo|fijar|armo|armar|doy de alta|saco|sacar|paso|pasar|muevo|mover|transfiero|transferir|envio|enviar|lleva|llevo|llevar|se crea|se crean|se agrega|se agregan|se registra|se registran|se hace|se pone|se ingresa|se ingresan|se configura|se mete|se anota|se paga|se usa|create|add|record|register|enter|set up|make|import|pay|track|log)';
/** A verb of finding where something is. */
const FIND_VERB = '(esta|estan|queda|quedan|encuentro|encuentra|hallo|consigo|aparece|aparecen|is|are|find)';

/**
 * How or where to make something: "¿cómo creo...?", "¿dónde agrego...?",
 * "quiero crear...", "ayúdame a registrar...", "me puedes mostrar cómo
 * ingreso...", "crear categoría", "nueva meta", "how do I add...".
 */
const HOW_MAKE = new RegExp([
  `\\b(como|donde|en donde|en que parte|por donde|de que forma|de que manera|que hago para|que tengo que hacer para|que debo hacer para|how|where)\\b.{0,40}\\b${MAKE_VERB}\\b`,
  `\\b(quiero|quisiera|necesito|ayudame a|ayudeme a|me ayudas a|me ayudarias a|ensename a|me ensenas a|explicame como|puedo|se puede|me gustaria|i want to|i need to|help me)\\b.{0,30}\\b${MAKE_VERB}\\b`,
  `^\\s*(crear|agregar|anadir|registrar|configurar|nuev[oa]s?|new|add|create)\\b`,
  `\\b(guia|guiame|guiar|tutorial|pasos para|paso a paso|instrucciones|walk me through|guide)\\b`,
].join('|'));

/** Where something is: "¿dónde están los préstamos?". */
const WHERE_IS = new RegExp(`\\b(donde|en donde|en que parte|where)\\b.{0,20}\\b${FIND_VERB}\\b`);

/** Each topic and the words that say it; the first that matches wins, so the narrower come first. */
const TOPICS: readonly [GuideTopic, RegExp][] = [
  ['expense', /\b(gastos?|compras?)\b.*\bcon (la |mi |una )?tarjeta\b/],
  ['payCard', /\b(pag\w*|abon\w*|pay\w*)\b(?!.*\bcon (la |mi |una )?tarjeta).*\b(tarjetas?|cards?)\b/],
  ['payLoan', /\b(pag\w*|abon\w*|pay\w*)\b.*\b(cuotas?|prestamos?|creditos?|installments?|loans?)\b|\babono\w* a capital\b/],
  ['statement', /\bextractos?\b|\bstatements?\b/],
  ['receipt', /\brecibos?\b|\bfotos?\b|\bescane\w*|\bfactura\w*\b.*\b(foto|leer|escane\w*|camara)\b|\breceipts?\b|\bphotos?\b/],
  ['notices', /\bnotificacion\w*|\bsms\b|\bmensajes? de texto\b|\bmensajes?\b.*\bbancos?\b|\bavisos?\b.*\bbancos?\b|\bnotifications?\b|\btext messages?\b/],
  ['transfer', /\btransferenc\w*|\btransferir\b|\btraslad\w*|\bpasar (plata|dinero)\b|\b(mover|muevo|paso|pasar) (plata|dinero)\b|\bde una cuenta a otra\b|\btransfers?\b/],
  ['card', /\btarjetas?( de credito)?\b|\bcredit cards?\b|\bcards?\b/],
  ['loan', /\b(prestamos?|creditos?|hipotecas?|leasing|me prestaron|loans?|mortgages?)\b/],
  ['debt', /\bdeudas?\b|\bdebts?\b/],
  ['reminder', /\brecordatorios?\b|\balarmas?\b|\breminders?\b/],
  ['cap', /\btopes?\b|\bpresupuestos?\b|\blimites?( de gasto)?\b|\bcaps?\b|\bbudgets?\b/],
  ['goal', /\bmetas?\b|\bfondo de emergencia\b|\bahorrar para\b|\bgoals?\b/],
  ['product', /\bproductos?\b|\bbolsillos?\b|\balcancias?\b|\bcdts?\b|\brendimientos?\b|\bintereses\b|\bcajitas?\b|\bpockets?\b|\bproducts?\b/],
  ['category', /\bcategor\w*/],
  ['account', /\bcuentas?\b|\bbilleteras?\b|\befectivo\b|\baccounts?\b|\bwallets?\b/],
  ['currency', /\bmonedas?\b|\bdivisas?\b|\bdolares\b|\beuros\b|\btrm\b|\bcurrenc\w*|\bdollars?\b/],
  ['backup', /\bcopias?( de seguridad)?\b|\brespaldo\w*|\bbackups?\b|\bdrive\b/],
  ['expense', /\bgastos?\b|\bcompras?\b|\bexpenses?\b|\bspending\b|\bpurchases?\b/],
  ['income', /\bingresos?\b|\bsalario\b|\bsueldo\b|\bnomina\b|\bincome\b|\bsalary\b/],
];

/** Every pattern here, for the assistant's vocabulary (`mend-slips.ts`): a slip in these words is mended too. */
export const GUIDE_WORDS: readonly RegExp[] = [HOW_MAKE, WHERE_IS, ...TOPICS.map(([, words]) => words)];

/** The topic a sentence names, whatever it asks about it. */
export function topicIn(folded: string): GuideTopic | null {
  for (const [topic, words] of TOPICS) if (words.test(folded)) return topic;
  return null;
}

/**
 * What a sentence asks how to make or where to find: a topic, `'any'` when
 * it asks how to make something without saying what, or null when it asks
 * nothing of the kind. `folded` has no accents and no question marks.
 */
export function guideIn(folded: string): GuideTopic | 'any' | null {
  const making = HOW_MAKE.test(folded);
  const finding = WHERE_IS.test(folded);
  if (!making && !finding) return null;
  const topic = topicIn(folded);
  // "¿Dónde están mis gastos?" is a question about one's money, not about the app.
  if (!making && (topic === 'expense' || topic === 'income' || topic === null)) return null;
  // "¿Cómo ingreso?" alone: the verb is no topic.
  return topic ?? 'any';
}
