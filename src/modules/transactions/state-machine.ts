export const TRANSACTION_STATES = [
  "PENDING",
  "PROCESSING",
  "AWAITING_AUTH",
  "AUTHORIZED",
  "CAPTURED",
  "SETTLED",
  "FAILED",
  "REFUNDED",
  "PARTIALLY_REFUNDED",
  "DISPUTED",
  "CANCELLED",
] as const;

export type TransactionState = (typeof TRANSACTION_STATES)[number];

// INITIATED is kept as a legacy/compatibility input.
type TransitionState = TransactionState | "INITIATED";

const transitions: Record<string, readonly string[]> = {
  PENDING: ["PROCESSING", "FAILED", "CANCELLED"],
  INITIATED: ["PROCESSING"],
  PROCESSING: ["AWAITING_AUTH", "AUTHORIZED", "FAILED", "CANCELLED"],
  AWAITING_AUTH: ["AUTHORIZED", "FAILED", "CANCELLED"],
  AUTHORIZED: ["CAPTURED", "CANCELLED", "FAILED"],
  CAPTURED: ["SETTLED", "REFUNDED", "PARTIALLY_REFUNDED", "DISPUTED"],
  SETTLED: ["REFUNDED", "PARTIALLY_REFUNDED", "DISPUTED"],
  FAILED: [],
  REFUNDED: [],
  PARTIALLY_REFUNDED: ["REFUNDED"],
  DISPUTED: ["REFUNDED", "PARTIALLY_REFUNDED"],
  CANCELLED: [],
};

export function validTransition(
  from: TransitionState,
  to: TransactionState,
): boolean {
  return transitions[from]?.includes(to) ?? false;
}

export function transition(
  from: TransitionState,
  to: TransactionState,
): TransactionState {
  if (!validTransition(from, to)) {
    throw new Error(
      `Invalid transaction state transition: ${from} → ${to}`,
    );
  }

  return to;
}