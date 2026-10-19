/**
 * Every currency a person can add, ready to use: its code, its flag, its
 * name in both languages and its symbol (Jose, 2026-10-19: no code typed by
 * hand). `auto` says whether the app can work its value in pesos out by
 * itself - the dollar from the TRM, the rest from the European Central
 * Bank's list (frankfurter.dev) times the TRM; any other is typed by hand.
 *
 * Pure: no Angular, so the tests read it as it is.
 */

import { foldText } from '../text/fold-text';

export interface CatalogCurrency {
  code: string;
  flag: string;
  es: string;
  en: string;
  symbol: string;
  /** Its value in pesos is fetched by the app. */
  auto: boolean;
  /** Words a search also finds it by: countries, mostly. */
  also?: string;
}

const c = (code: string, flag: string, es: string, en: string, symbol: string, auto: boolean, also = ''): CatalogCurrency =>
  ({ code, flag, es, en, symbol, auto, also });

export const CATALOG: readonly CatalogCurrency[] = [
  c('COP', '🇨🇴', 'Peso colombiano', 'Colombian peso', '$', true, 'Colombia'),
  c('USD', '🇺🇸', 'Dólar estadounidense', 'US dollar', 'US$', true, 'Estados Unidos United States Ecuador Panamá Panama El Salvador'),
  c('EUR', '🇪🇺', 'Euro', 'Euro', '€', true, 'Unión Europea European Union España Spain Alemania Germany Francia France Italia Italy Portugal'),
  c('GBP', '🇬🇧', 'Libra esterlina', 'Pound sterling', '£', true, 'Reino Unido United Kingdom Inglaterra England'),
  c('CAD', '🇨🇦', 'Dólar canadiense', 'Canadian dollar', 'C$', true, 'Canadá Canada'),
  c('MXN', '🇲🇽', 'Peso mexicano', 'Mexican peso', 'MX$', true, 'México Mexico'),
  c('BRL', '🇧🇷', 'Real brasileño', 'Brazilian real', 'R$', true, 'Brasil Brazil'),
  c('CHF', '🇨🇭', 'Franco suizo', 'Swiss franc', 'CHF', true, 'Suiza Switzerland'),
  c('JPY', '🇯🇵', 'Yen japonés', 'Japanese yen', '¥', true, 'Japón Japan'),
  c('CNY', '🇨🇳', 'Yuan chino', 'Chinese yuan', 'CN¥', true, 'China renminbi'),
  c('AUD', '🇦🇺', 'Dólar australiano', 'Australian dollar', 'A$', true, 'Australia'),
  c('NZD', '🇳🇿', 'Dólar neozelandés', 'New Zealand dollar', 'NZ$', true, 'Nueva Zelanda New Zealand'),
  c('SEK', '🇸🇪', 'Corona sueca', 'Swedish krona', 'kr', true, 'Suecia Sweden'),
  c('NOK', '🇳🇴', 'Corona noruega', 'Norwegian krone', 'kr', true, 'Noruega Norway'),
  c('DKK', '🇩🇰', 'Corona danesa', 'Danish krone', 'kr', true, 'Dinamarca Denmark'),
  c('ISK', '🇮🇸', 'Corona islandesa', 'Icelandic króna', 'kr', true, 'Islandia Iceland'),
  c('PLN', '🇵🇱', 'Esloti polaco', 'Polish złoty', 'zł', true, 'Polonia Poland zloty'),
  c('CZK', '🇨🇿', 'Corona checa', 'Czech koruna', 'Kč', true, 'Chequia Czechia República Checa'),
  c('HUF', '🇭🇺', 'Forinto húngaro', 'Hungarian forint', 'Ft', true, 'Hungría Hungary'),
  c('RON', '🇷🇴', 'Leu rumano', 'Romanian leu', 'lei', true, 'Rumania Romania'),
  c('TRY', '🇹🇷', 'Lira turca', 'Turkish lira', '₺', true, 'Turquía Turkey Türkiye'),
  c('ILS', '🇮🇱', 'Séquel israelí', 'Israeli shekel', '₪', true, 'Israel'),
  c('INR', '🇮🇳', 'Rupia india', 'Indian rupee', '₹', true, 'India'),
  c('IDR', '🇮🇩', 'Rupia indonesia', 'Indonesian rupiah', 'Rp', true, 'Indonesia'),
  c('KRW', '🇰🇷', 'Won surcoreano', 'South Korean won', '₩', true, 'Corea del Sur South Korea'),
  c('HKD', '🇭🇰', 'Dólar de Hong Kong', 'Hong Kong dollar', 'HK$', true, 'Hong Kong'),
  c('SGD', '🇸🇬', 'Dólar de Singapur', 'Singapore dollar', 'S$', true, 'Singapur Singapore'),
  c('MYR', '🇲🇾', 'Ringgit malayo', 'Malaysian ringgit', 'RM', true, 'Malasia Malaysia'),
  c('PHP', '🇵🇭', 'Peso filipino', 'Philippine peso', '₱', true, 'Filipinas Philippines'),
  c('THB', '🇹🇭', 'Baht tailandés', 'Thai baht', '฿', true, 'Tailandia Thailand'),
  c('ZAR', '🇿🇦', 'Rand sudafricano', 'South African rand', 'R', true, 'Sudáfrica South Africa'),
  // No free official source the app can read: typed by hand.
  c('ARS', '🇦🇷', 'Peso argentino', 'Argentine peso', 'AR$', false, 'Argentina'),
  c('CLP', '🇨🇱', 'Peso chileno', 'Chilean peso', 'CLP$', false, 'Chile'),
  c('PEN', '🇵🇪', 'Sol peruano', 'Peruvian sol', 'S/', false, 'Perú Peru'),
  c('UYU', '🇺🇾', 'Peso uruguayo', 'Uruguayan peso', '$U', false, 'Uruguay'),
  c('PYG', '🇵🇾', 'Guaraní paraguayo', 'Paraguayan guaraní', '₲', false, 'Paraguay'),
  c('BOB', '🇧🇴', 'Boliviano', 'Bolivian boliviano', 'Bs', false, 'Bolivia'),
  c('VES', '🇻🇪', 'Bolívar venezolano', 'Venezuelan bolívar', 'Bs.S', false, 'Venezuela'),
  c('DOP', '🇩🇴', 'Peso dominicano', 'Dominican peso', 'RD$', false, 'República Dominicana Dominican Republic'),
  c('CRC', '🇨🇷', 'Colón costarricense', 'Costa Rican colón', '₡', false, 'Costa Rica'),
  c('GTQ', '🇬🇹', 'Quetzal guatemalteco', 'Guatemalan quetzal', 'Q', false, 'Guatemala'),
  c('HNL', '🇭🇳', 'Lempira hondureño', 'Honduran lempira', 'L', false, 'Honduras'),
  c('NIO', '🇳🇮', 'Córdoba nicaragüense', 'Nicaraguan córdoba', 'C$', false, 'Nicaragua'),
  c('PAB', '🇵🇦', 'Balboa panameño', 'Panamanian balboa', 'B/.', false, 'Panamá Panama'),
  c('CUP', '🇨🇺', 'Peso cubano', 'Cuban peso', '$MN', false, 'Cuba'),
  c('JMD', '🇯🇲', 'Dólar jamaiquino', 'Jamaican dollar', 'J$', false, 'Jamaica'),
  c('TTD', '🇹🇹', 'Dólar de Trinidad y Tobago', 'Trinidad and Tobago dollar', 'TT$', false, 'Trinidad Tobago'),
  c('AWG', '🇦🇼', 'Florín arubeño', 'Aruban florin', 'Afl', false, 'Aruba'),
  c('ANG', '🇨🇼', 'Florín antillano', 'Netherlands Antillean guilder', 'ƒ', false, 'Curazao Curaçao'),
  c('BGN', '🇧🇬', 'Lev búlgaro', 'Bulgarian lev', 'лв', false, 'Bulgaria'),
  c('RSD', '🇷🇸', 'Dinar serbio', 'Serbian dinar', 'дин', false, 'Serbia'),
  c('UAH', '🇺🇦', 'Grivna ucraniana', 'Ukrainian hryvnia', '₴', false, 'Ucrania Ukraine'),
  c('RUB', '🇷🇺', 'Rublo ruso', 'Russian ruble', '₽', false, 'Rusia Russia'),
  c('AED', '🇦🇪', 'Dírham de los Emiratos', 'UAE dirham', 'AED', false, 'Emiratos Árabes Unidos United Arab Emirates Dubái Dubai'),
  c('SAR', '🇸🇦', 'Riyal saudí', 'Saudi riyal', 'SAR', false, 'Arabia Saudita Saudi Arabia'),
  c('QAR', '🇶🇦', 'Riyal catarí', 'Qatari riyal', 'QAR', false, 'Catar Qatar'),
  c('TWD', '🇹🇼', 'Dólar taiwanés', 'New Taiwan dollar', 'NT$', false, 'Taiwán Taiwan'),
  c('VND', '🇻🇳', 'Dong vietnamita', 'Vietnamese đồng', '₫', false, 'Vietnam'),
  c('EGP', '🇪🇬', 'Libra egipcia', 'Egyptian pound', 'E£', false, 'Egipto Egypt'),
  c('MAD', '🇲🇦', 'Dírham marroquí', 'Moroccan dirham', 'MAD', false, 'Marruecos Morocco'),
  c('NGN', '🇳🇬', 'Naira nigeriana', 'Nigerian naira', '₦', false, 'Nigeria'),
  c('KES', '🇰🇪', 'Chelín keniano', 'Kenyan shilling', 'KSh', false, 'Kenia Kenya'),
];

const BY_CODE = new Map(CATALOG.map(one => [one.code, one]));

export function catalogOf(code: string): CatalogCurrency | undefined {
  return BY_CODE.get(code);
}

/** Its flag, or nothing for a code outside the list (an older backup). */
export function flagOf(code: string): string {
  return BY_CODE.get(code)?.flag ?? '';
}

/** Its name in the app's language; a code outside the list keeps the stored one. */
export function currencyName(code: string, stored: string, lang: 'es' | 'en'): string {
  const one = BY_CODE.get(code);
  return one ? one[lang] : stored;
}

/** The catalogue narrowed by what was typed: code, name in either language, country. */
export function searchCatalog(query: string): CatalogCurrency[] {
  const words = foldText(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [...CATALOG];
  return CATALOG.filter(one => {
    const text = foldText(`${one.code} ${one.es} ${one.en} ${one.also ?? ''}`);
    return words.every(word => text.includes(word));
  });
}
