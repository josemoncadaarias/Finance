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

/** Every name any catalog offers, for registering them with Ionicons. */
export function everyCatalogIcon(): string[] {
  const names = new Set<string>();
  for (const group of [...ACCOUNT_ICONS, ...CATEGORY_ICONS_CATALOG]) {
    for (const icon of group.icons) names.add(icon);
  }
  return [...names];
}
