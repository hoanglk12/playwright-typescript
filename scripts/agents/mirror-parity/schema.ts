import { z } from 'zod';
import { MAX_PARITY_EXPLANATION_CHARS, MAX_PARITY_MISSING_CHANGE_CHARS } from '../harness/limits.ts';
import { MIRROR_PAIR_IDS } from './pairs.ts';
import type { MirrorPairId } from './pairs.ts';

export const PARITY_STATUSES = ['in-sync', 'needs-mirror', 'intentional-divergence', 'unclear'] as const;
export const PAIR_SIDES = ['source', 'mirror'] as const;

export type ParityStatus = (typeof PARITY_STATUSES)[number];
export type PairSide = (typeof PAIR_SIDES)[number];

export interface ModelPairVerdict {
  pair: MirrorPairId;
  status: ParityStatus;
  explanation: string;
  missingChange: string;
}

export interface ModelParityOutput {
  pairs: ModelPairVerdict[];
}

// The harness adds changedSide from the git scan; the model never reports it.
export interface PairVerdict extends ModelPairVerdict {
  changedSide: PairSide;
}

export interface MirrorParityOutput {
  pairs: PairVerdict[];
}

const modelVerdictShape = {
  pair: z.enum(MIRROR_PAIR_IDS),
  status: z.enum(PARITY_STATUSES),
  explanation: z.string().max(MAX_PARITY_EXPLANATION_CHARS),
  missingChange: z.string().max(MAX_PARITY_MISSING_CHANGE_CHARS),
};

export const ModelParityOutputSchema: z.ZodType<ModelParityOutput> = z.object({
  pairs: z.array(z.object(modelVerdictShape)).max(MIRROR_PAIR_IDS.length),
});

export const MirrorParityOutputSchema: z.ZodType<MirrorParityOutput> = z.object({
  pairs: z.array(z.object({ ...modelVerdictShape, changedSide: z.enum(PAIR_SIDES) })).max(MIRROR_PAIR_IDS.length),
});

export function needsAction(verdict: ModelPairVerdict): boolean {
  return verdict.status === 'needs-mirror' || verdict.status === 'unclear';
}
