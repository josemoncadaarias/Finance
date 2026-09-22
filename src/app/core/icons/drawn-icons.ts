/**
 * The icons this app draws for itself, because Ionicons has none like them.
 *
 * One record, registered once at start-up and checked by the icon test: a
 * name Ionicons does not know and this file does not carry renders as empty
 * space, with no error anywhere, which has already cost this project several
 * rounds of "no veo el icono".
 */

import { PIGGY_BANK } from './piggy-bank';

export const DRAWN_ICONS: Record<string, string> = {
  'piggy-bank': PIGGY_BANK,
};
