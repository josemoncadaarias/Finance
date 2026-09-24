/**
 * Row types mirroring the SQLite schema one-to-one.
 *
 * Property names match column names on purpose: what comes back from a query
 * is exactly one of these, with no mapping step in between. Amounts are
 * integers in minor units (cents) and rates are integers scaled by 10,000 —
 * see `money.ts` for the conversions.
 */

export type AccountType = 'debit' | 'credit' | 'cash' | 'investment';
export type CategoryKind = 'income' | 'expense';
export type RateSource = 'manual' | 'derived' | 'trm' | 'cached';
export type Confidence = 'high' | 'low';
export type TransferLeg = 'from' | 'to';
export type TransactionSource = 'manual' | 'monefy';

/** SQLite has no boolean type; 0 and 1 are what actually cross the wire. */
export type SqlBool = 0 | 1;

/** ISO calendar day, `YYYY-MM-DD`. Sorts chronologically as plain text. */
export type IsoDate = string;

/** ISO instant, `YYYY-MM-DDTHH:MM:SSZ`. */
export type IsoDateTime = string;

export interface CurrencyRow {
  code: string;
  name: string;
  symbol: string;
  minor_units: number;
}

export interface CustomIconRow {
  id: number;
  name: string;
  mime_type: 'image/png' | 'image/jpeg' | 'image/svg+xml' | 'image/webp';
  data: Uint8Array;
  created_at: IsoDateTime;
}

/**
 * One real-world account that holds several currencies, such as Global66
 * (COP and USD) or ARQ (USD and EUR). Each currency is its own `AccountRow`;
 * this is what ties them back together.
 */
export interface AccountGroupRow {
  id: number;
  name: string;
  builtin_icon: string | null;
  custom_icon_id: number | null;
  color: string;
  sort_order: number;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface AccountRow {
  id: number;
  name: string;
  type: AccountType;
  /** Exactly one currency per row. */
  currency_code: string;
  /** The multi-currency account this is one currency of, if any. */
  group_id: number | null;
  /** Exactly one of `builtin_icon` and `custom_icon_id` is set. */
  builtin_icon: string | null;
  custom_icon_id: number | null;
  color: string;
  /** Credit cards only. The debt itself lives in the balance. */
  credit_limit_minor: number | null;
  include_in_net_worth: SqlBool;
  opening_balance_minor: number;
  /** The same opening balance in the base currency, frozen at opening day. */
  opening_balance_base_minor: number;
  opened_on: IsoDate;
  archived: SqlBool;
  sort_order: number;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface CategoryRow {
  id: number;
  name: string;
  kind: CategoryKind;
  builtin_icon: string | null;
  custom_icon_id: number | null;
  color: string;
  parent_id: number | null;
  archived: SqlBool;
  sort_order: number;
  /** What an investment earned or lost, not money put in (migration 047). */
  counts_as_return: SqlBool;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface TransferRow {
  id: number;
  occurred_on: IsoDate;
  description: string | null;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface TransactionRow {
  id: number;
  account_id: number;
  /** Null on a transfer leg: what it is, is the transfer. */
  category_id: number | null;
  /** Which product inside the account, when the account has more than one. */
  product_id: number | null;
  occurred_on: IsoDate;
  /** In the account's own currency. Negative out, positive in. */
  amount_minor: number;
  /** Null on a plain COP transaction. */
  rate_scaled: number | null;
  /** COP equivalent, frozen at the rate that applied. Never recalculated. */
  amount_base_minor: number;
  rate_source: RateSource | null;
  confidence: Confidence;
  description: string | null;
  transfer_id: number | null;
  transfer_leg: TransferLeg | null;
  source: TransactionSource;
  import_fingerprint: string | null;
  import_seq: number | null;
  import_batch_id: number | null;
  /** 1 once the user has edited it by hand; a re-import must skip it. */
  locked: SqlBool;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface ExchangeRateRow {
  on_date: IsoDate;
  base_code: string;
  quote_code: string;
  rate_scaled: number;
  source: string;
  fetched_at: IsoDateTime;
}

export interface AccountRateRow {
  id: number;
  account_id: number;
  annual_rate_scaled: number;
  valid_from: IsoDate;
  /** Null means still in effect. */
  valid_to: IsoDate | null;
  note: string | null;
  created_at: IsoDateTime;
}

export interface InterestAccrualRow {
  id: number;
  account_id: number;
  period_start: IsoDate;
  period_end: IsoDate;
  /** What the app worked out from the rate history. */
  computed_minor: number | null;
  /** What the bank actually paid. The gap between the two is the point. */
  actual_minor: number | null;
  note: string | null;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface CashbackRow {
  id: number;
  account_id: number;
  /** The purchase that produced it, if it is still around. */
  source_transaction_id: number | null;
  occurred_on: IsoDate;
  amount_minor: number;
  description: string | null;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface ImportBatchRow {
  id: number;
  file_name: string;
  file_hash: string;
  imported_at: IsoDateTime;
  rows_read: number;
  rows_inserted: number;
  rows_skipped: number;
  rows_flagged: number;
  notes: string | null;
}

export interface ReviewQueueRow {
  id: number;
  kind: string;
  entity_type: 'transaction' | 'transfer' | 'account' | 'category' | 'cashback' | null;
  entity_id: number | null;
  batch_id: number | null;
  reason: string;
  /** Free-form JSON payload describing the unresolved case. */
  payload: string | null;
  resolved: SqlBool;
  resolved_at: IsoDateTime | null;
  note: string | null;
  created_at: IsoDateTime;
}

export interface SettingRow {
  key: string;
  value: string;
  updated_at: IsoDateTime;
}

/** An account plus the balance derived from its transactions. */
export interface AccountBalance {
  account: AccountRow;
  balance_minor: number;
  /** Credit cards only: limit minus debt. */
  available_credit_minor: number | null;
}

/**
 * A multi-currency account with one balance per currency.
 *
 * There is deliberately no single total here: 500 USD and 300 EUR do not add
 * up to anything without a rate, and which rate to use is a decision for the
 * screen asking the question, not for the repository.
 */
export interface GroupedBalance {
  group: AccountGroupRow | null;
  balances: AccountBalance[];
}
