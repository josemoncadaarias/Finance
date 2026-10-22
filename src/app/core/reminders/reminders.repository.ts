/**
 * Reminders as stored (migration 060). Read once and answered in memory by
 * `reminders.ts`; written one row at a time, as a person makes them.
 */
import type { SqlDriver } from '../database/sql-driver';
import type { Reminder, Repeat } from './reminders';

interface Row {
  id: number;
  title: string;
  amount_minor: number | null;
  account_id: number | null;
  category_id: number | null;
  note: string | null;
  repeat: Repeat;
  day_of_month: number | null;
  on_date: string | null;
  hour: number;
  minute: number | null;
  days_before: number;
  shop: string | null;
  active: number;
  done_month: string | null;
  snoozed_to: string | null;
}

/** What a person gives to make or change one. */
export type ReminderInput = Omit<Reminder, 'id' | 'active' | 'doneMonth' | 'snoozedTo'> & { active?: boolean };

function fromRow(row: Row): Reminder {
  return {
    id: row.id, title: row.title, amountMinor: row.amount_minor, accountId: row.account_id, categoryId: row.category_id,
    note: row.note, repeat: row.repeat, dayOfMonth: row.day_of_month, onDate: row.on_date, hour: row.hour, minute: row.minute ?? 0,
    daysBefore: row.days_before, shop: row.shop, active: row.active === 1, doneMonth: row.done_month, snoozedTo: row.snoozed_to,
  };
}

export class RemindersRepository {
  private readonly db: SqlDriver;
  private readonly now: () => string;

  constructor(db: SqlDriver, now: () => string = () => new Date().toISOString()) {
    this.db = db;
    this.now = now;
  }

  async all(): Promise<Reminder[]> {
    return (await this.db.query<Row>('SELECT * FROM reminders ORDER BY id')).map(fromRow);
  }

  async get(id: number): Promise<Reminder | null> {
    const row = await this.db.queryOne<Row>('SELECT * FROM reminders WHERE id = ?', [id]);
    return row ? fromRow(row) : null;
  }

  /** The one following a fixed payment, if any. */
  async byShop(shop: string): Promise<Reminder | null> {
    const row = await this.db.queryOne<Row>('SELECT * FROM reminders WHERE shop = ? LIMIT 1', [shop]);
    return row ? fromRow(row) : null;
  }

  async create(input: ReminderInput): Promise<number> {
    const t = this.now();
    const result = await this.db.run(
      `INSERT INTO reminders (title, amount_minor, account_id, category_id, note, repeat, day_of_month, on_date,
                              hour, minute, days_before, shop, active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [input.title.trim(), input.amountMinor, input.accountId, input.categoryId, input.note, input.repeat,
        input.repeat === 'monthly' ? input.dayOfMonth : null, input.repeat === 'once' ? input.onDate : null,
        input.hour, input.minute ?? 0, input.daysBefore, input.shop, input.active === false ? 0 : 1, t, t]);
    return Number(result.lastId);
  }

  /** Its terms changed: the month already settled stays settled, a snooze goes. */
  async update(id: number, input: ReminderInput): Promise<void> {
    await this.db.run(
      `UPDATE reminders SET title = ?, amount_minor = ?, account_id = ?, category_id = ?, note = ?, repeat = ?,
              day_of_month = ?, on_date = ?, hour = ?, minute = ?, days_before = ?, shop = ?, active = ?, snoozed_to = NULL,
              updated_at = ? WHERE id = ?`,
      [input.title.trim(), input.amountMinor, input.accountId, input.categoryId, input.note, input.repeat,
        input.repeat === 'monthly' ? input.dayOfMonth : null, input.repeat === 'once' ? input.onDate : null,
        input.hour, input.minute ?? 0, input.daysBefore, input.shop, input.active === false ? 0 : 1, this.now(), id]);
  }

  async setActive(id: number, active: boolean): Promise<void> {
    await this.db.run('UPDATE reminders SET active = ?, updated_at = ? WHERE id = ?', [active ? 1 : 0, this.now(), id]);
  }

  /** This month (or a one-off) is settled: registered, or paid some other way. */
  async markDone(id: number, month: string): Promise<void> {
    await this.db.run('UPDATE reminders SET done_month = ?, snoozed_to = NULL, updated_at = ? WHERE id = ?', [month, this.now(), id]);
  }

  /** Undoes `markDone` for that month. */
  async undoDone(id: number, previous: string | null): Promise<void> {
    await this.db.run('UPDATE reminders SET done_month = ?, updated_at = ? WHERE id = ?', [previous, this.now(), id]);
  }

  async snooze(id: number, day: string): Promise<void> {
    await this.db.run('UPDATE reminders SET snoozed_to = ?, updated_at = ? WHERE id = ?', [day, this.now(), id]);
  }

  async remove(id: number): Promise<void> {
    await this.db.run('DELETE FROM reminders WHERE id = ?', [id]);
  }
}
