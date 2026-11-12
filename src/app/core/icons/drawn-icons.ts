/**
 * The icons this app draws for itself, because Ionicons has none like them.
 *
 * One record, registered once at start-up and checked by the icon test: a
 * name Ionicons does not know and this file does not carry renders as empty
 * space, with no error anywhere, which has already cost this project several
 * rounds of "no veo el icono".
 */

import { ACCOUNT_EDIT } from './account-edit';
import { DATA_TRANSFER } from './data-transfer';
import { PIGGY_BANK } from './piggy-bank';

export const DRAWN_ICONS: Record<string, string> = {
  'piggy-bank': PIGGY_BANK,
  'account-edit': ACCOUNT_EDIT,
  'data-transfer': DATA_TRANSFER,
  // A badge asks for every icon by its outlined name: the drawn ones are
  // outlines already, so both names are the same drawing.
  'piggy-bank-outline': PIGGY_BANK,
  'data-transfer-outline': DATA_TRANSFER,
};
