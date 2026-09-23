/**
 * Turning an answered proposal into a movement.
 *
 * The only place where a reading becomes money on record, and it goes through
 * the ordinary repositories: a movement born here is a movement like any
 * other afterwards, editable, deletable, and counted by everything that counts
 * movements. Nothing about it says "imported" except the note that it came
 * from a statement, which is kept so it can be explained.
 *
 * Two of them at once when they are the halves of one transfer, because
 * accepting those apart would write a false expense and a false income. Rule
 * 22.
 */

import type { ProposalsRepository, MovementProposal } from '../database/repositories/proposals.repository';
import type { TransactionsRepository } from '../database/repositories/transactions.repository';
import type { TransfersRepository } from '../database/repositories/transfers.repository';

export interface AcceptResult {
  /** How many movements were written. A joined transfer counts as one. */
  written: number;
  /** Proposals that could not be written, and why. */
  refused: { id: number; reason: 'incomplete' }[];
}

interface Repos {
  proposals: ProposalsRepository;
  transactions: TransactionsRepository;
  transfers: TransfersRepository;
}

/** Everything a proposal needs before it can become a movement. */
export function isComplete(proposal: MovementProposal): boolean {
  return proposal.account_id !== null
    && proposal.occurred_on !== null
    && proposal.amount_minor !== null
    && proposal.amount_minor !== 0;
}

/**
 * Accepts proposals, in the order given.
 *
 * A pair is written once, as a transfer, and both halves are marked against
 * it. Anything still missing its account, its date or its amount is refused
 * and left waiting rather than written half-formed - which is the case of a
 * notification that only said "you have a new movement".
 */
export async function accept(
  repos: Repos,
  proposals: readonly MovementProposal[],
): Promise<AcceptResult> {
  const byId = new Map(proposals.map(proposal => [proposal.id, proposal]));
  const done = new Set<number>();
  const result: AcceptResult = { written: 0, refused: [] };

  for (const proposal of proposals) {
    if (done.has(proposal.id)) continue;
    if (!isComplete(proposal)) {
      result.refused.push({ id: proposal.id, reason: 'incomplete' });
      continue;
    }

    const other = proposal.pairs_with === null ? undefined : byId.get(proposal.pairs_with);
    if (other && !done.has(other.id) && isComplete(other)) {
      const leaving = proposal.amount_minor! < 0 ? proposal : other;
      const arriving = proposal.amount_minor! < 0 ? other : proposal;
      const transferId = await repos.transfers.create({
        occurred_on: leaving.occurred_on!,
        description: leaving.description ?? arriving.description ?? null,
        from: { account_id: leaving.account_id!, amount_minor: Math.abs(leaving.amount_minor!) },
        to: { account_id: arriving.account_id!, amount_minor: arriving.amount_minor! },
      });
      // Both halves point at the transfer they became; which leg is which is
      // already on record in `transfers`.
      await repos.proposals.accepted(leaving.id, transferId);
      await repos.proposals.accepted(arriving.id, transferId);
      done.add(leaving.id);
      done.add(arriving.id);
      result.written += 1;
      continue;
    }

    const id = await repos.transactions.create({
      account_id: proposal.account_id!,
      category_id: proposal.category_id,
      occurred_on: proposal.occurred_on!,
      amount_minor: proposal.amount_minor!,
      description: proposal.description,
      source: 'manual',
    });
    await repos.proposals.accepted(proposal.id, id);
    // What it was filed under is what the next one from this shop will be
    // proposed as - including a category the person corrected here, which is
    // the app being taught rather than the app guessing again.
    await repos.proposals.learn(proposal.description, proposal.category_id, proposal.occurred_on!);
    done.add(proposal.id);
    result.written += 1;
  }

  return result;
}
