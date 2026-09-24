/**
 * The DANE's consumer price index, from the Banco de la Republica.
 *
 * The same rules as the TRM client: a response that cannot be trusted is an
 * error, never a number, and nothing waits on it.
 *
 * Two things about this service, found on 2026-09-24, that decide how it is
 * called:
 *
 *   - It answers an empty body unless the request carries a Referer from its
 *     own site. A web page cannot set that header, and the service sends no
 *     CORS header either, so from a browser it simply cannot be read. On the
 *     phone the request goes through Capacitor's native HTTP, which can.
 *   - Its certificate chain is sent incomplete. Whether the phone's native
 *     HTTP accepts it has NOT been verified yet. If it does not, the months
 *     the app shipped with stay, and later ones are estimated and labelled.
 */

import type { InflationMonth } from './inflation';

export const IPC_URL =
  'https://suameca.banrep.gov.co/estadisticas-economicas-back/rest/estadisticaEconomicaRestService/consultaMenuXId?idMenu=100002';
export const IPC_REFERER = 'https://suameca.banrep.gov.co/estadisticas-economicas/';

/** The series of the national IPC, base December 2018. */
const SERIES_ID = 15000;

/** Bogota is five hours behind UTC all year: the service dates its points at local midnight. */
const BOGOTA_OFFSET_MS = 5 * 3_600_000;

export class IpcError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IpcError';
  }
}

/** The months in an answer of the service, oldest first. */
export function parseIpc(payload: unknown): InflationMonth[] {
  const series = (payload as { SERIES?: unknown })?.SERIES;
  if (!Array.isArray(series)) throw new IpcError('The IPC service answered something unexpected');
  const ipc = series.find(one => (one as { id?: unknown })?.id === SERIES_ID) as { data?: unknown } | undefined;
  if (!ipc || !Array.isArray(ipc.data)) throw new IpcError('The IPC series is not in the answer');

  const months: InflationMonth[] = [];
  for (const point of ipc.data) {
    if (!Array.isArray(point) || point.length < 2) continue;
    const [time, value] = point;
    if (typeof time !== 'number' || typeof value !== 'number' || !(value > 0)) continue;
    const month = new Date(time - BOGOTA_OFFSET_MS).toISOString().slice(0, 7);
    months.push({ month, index_scaled: Math.round(value * 100) });
  }
  if (months.length === 0) throw new IpcError('The IPC series came back empty');
  return months.sort((a, b) => a.month.localeCompare(b.month));
}
