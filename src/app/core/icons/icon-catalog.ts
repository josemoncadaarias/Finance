/**
 * The built-in icons an account or a category can wear.
 *
 * Ionicons ships around 1,300 icons. Offering all of them is not generosity,
 * it is a search problem handed to the user; these are the ones that mean
 * something in a Colombian personal-finance app, grouped so the right one is
 * found by looking rather than by scrolling.
 *
 * Anything not here is served by a user-supplied image, which is the real
 * answer for a bank's own logo.
 */

export interface IconGroup {
  /** Translation key for the group's name. */
  key: string;
  icons: string[];
}

export const ACCOUNT_ICONS: IconGroup[] = [
  {
    key: 'icons.money',
    icons: [
      'wallet', 'card', 'cash', 'business', 'briefcase', 'home',
      'phone-portrait', 'globe', 'save', 'lock-closed',
    ],
  },
  {
    key: 'icons.investing',
    icons: [
      'trending-up', 'bar-chart', 'stats-chart', 'pie-chart', 'diamond',
      'rocket', 'leaf', 'shield-checkmark',
    ],
  },
  {
    key: 'icons.other',
    icons: [
      'people', 'person', 'gift', 'heart', 'star', 'flag',
      'cube', 'key', 'ellipsis-horizontal',
    ],
  },
];

export const CATEGORY_ICONS_CATALOG: IconGroup[] = [
  {
    key: 'icons.everyday',
    icons: [
      'basket', 'restaurant', 'fast-food', 'cafe', 'beer', 'wine',
      'cart', 'pricetag', 'bag-handle',
    ],
  },
  {
    key: 'icons.home',
    icons: [
      'home', 'bed', 'water', 'flash', 'flame', 'wifi', 'tv',
      'construct', 'shirt', 'cut',
    ],
  },
  {
    key: 'icons.moving',
    icons: [
      'car', 'bus', 'bicycle', 'airplane', 'boat', 'train', 'walk',
      'speedometer', 'map',
    ],
  },
  {
    key: 'icons.living',
    icons: [
      'medkit', 'fitness', 'school', 'book', 'game-controller', 'film',
      'musical-notes', 'football', 'paw', 'happy',
    ],
  },
  {
    key: 'icons.money',
    icons: [
      'cash', 'card', 'wallet', 'trending-up', 'trending-down', 'receipt',
      'document-text', 'briefcase', 'gift', 'people',
    ],
  },
];

/**
 * Every icon the app itself ever gives an account or a category - the
 * starter categories, the ones it makes for a loan or a product, the sample
 * data, the categories of the app it was seeded from (Jose, 2026-11-05: a
 * phone with the sample data had "Intereses CDT" with a ribbon, and on his
 * own phone that ribbon could not be chosen). Whatever a catalog lacks of
 * these goes into its last group, "Más íconos" (`icons.rest`), so nothing the app has drawn
 * is missing from the list to choose from; `icon-catalog.test.mjs` fails on
 * an icon the app uses that no catalog offers.
 */
export const APP_ICONS: readonly string[] = [
  'airplane', 'arrow-down-circle', 'barbell', 'basket', 'bicycle', 'briefcase', 'build',
  'bus', 'business', 'call', 'car', 'car-sport', 'card', 'cash', 'cube', 'cut', 'earth',
  'ellipsis-horizontal-circle', 'film', 'flag', 'football', 'game-controller', 'gift',
  'globe', 'heart', 'home', 'laptop', 'leaf', 'medkit', 'paw', 'phone-portrait',
  'play-circle', 'pricetag', 'pricetags', 'receipt', 'restaurant', 'ribbon', 'school',
  'shield-checkmark', 'shirt', 'stats-chart', 'trending-down', 'trending-up', 'wallet',
  'water', 'wine', 'cart', 'construct', 'fast-food', 'fitness', 'happy', 'bar-chart',
  'pie-chart', 'diamond', 'rocket', 'people', 'person', 'star', 'key', 'ellipsis-horizontal',
  'save', 'lock-closed', 'arrow-up-circle', 'swap-horizontal', 'calendar', 'umbrella',
  'hammer', 'newspaper', 'storefront', 'ticket', 'bandage', 'flower', 'camera',
  'headset', 'desktop', 'tablet-portrait', 'bulb', 'trophy',
];

/** A catalog with "Más íconos" at its end: every app icon it does not offer yet. */
function withTheRest(groups: IconGroup[]): IconGroup[] {
  const has = new Set(groups.flatMap(g => g.icons));
  const rest = APP_ICONS.filter(icon => !has.has(icon));
  return rest.length ? [...groups, { key: 'icons.rest', icons: rest }] : groups;
}

ACCOUNT_ICONS.splice(0, ACCOUNT_ICONS.length, ...withTheRest(ACCOUNT_ICONS));
CATEGORY_ICONS_CATALOG.splice(0, CATEGORY_ICONS_CATALOG.length, ...withTheRest(CATEGORY_ICONS_CATALOG));

/** Every name any catalog offers, for registering them with Ionicons. */
export function everyCatalogIcon(): string[] {
  const names = new Set<string>();
  for (const group of [...ACCOUNT_ICONS, ...CATEGORY_ICONS_CATALOG]) {
    for (const icon of group.icons) names.add(icon);
  }
  return [...names];
}

/**
 * The outline form of an icon name, whichever form it arrives in.
 *
 * Icons reach the app from three places — the account plan, the category map,
 * and this catalog — and they do not agree on whether the name carries its
 * `-outline` suffix. Appending it blindly produced `car-outline-outline`,
 * which Ionicons draws as nothing at all: an icon that silently disappears
 * rather than complaining.
 */
export function outlined(name: string | null | undefined): string {
  const base = (name ?? 'pricetag').trim();
  // A brand's logo has no outlined drawing of its own.
  if (base.startsWith('logo-')) return base;
  return base.endsWith('-outline') ? base : `${base}-outline`;
}

/** The name without its suffix, for comparing against the catalog. */
export function bareIcon(name: string | null | undefined): string | null {
  if (!name) return null;
  return name.endsWith('-outline') ? name.slice(0, -'-outline'.length) : name;
}
