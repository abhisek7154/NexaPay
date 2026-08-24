import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";

export type TransactionEventType =
  | "transaction.created"
  | "transaction.processing"
  | "transaction.authorized"
  | "transaction.captured"
  | "transaction.settled"
  | "transaction.failed"
  | "transaction.refunded";

export interface TransactionEvent<T = unknown> {
  eventId: string;
  eventType: TransactionEventType;
  version: number;
  timestamp: string;
  source: string;
  correlationId: string;
  data: T;
  metadata: Record<string, unknown>;
}

export const eventEmitter = new EventEmitter();

export function publish<T>(
  eventType: TransactionEventType,
  data: T,
  options?: {
    correlationId?: string;
    source?: string;
    metadata?: Record<string, unknown>;
  },
): TransactionEvent<T> {
  const event: TransactionEvent<T> = {
    eventId: randomUUID(),
    eventType,
    version: 1,
    timestamp: new Date().toISOString(),
    source: options?.source ?? "isu-payment-api",
    correlationId: options?.correlationId ?? randomUUID(),
    data,
    metadata: options?.metadata ?? {},
  };

  eventEmitter.emit(eventType, event);

  return event;
}

export function subscribe(
  eventType: TransactionEventType,
  handler: (event: TransactionEvent) => void,
) {
  eventEmitter.on(eventType, handler);

  return () => {
    eventEmitter.off(eventType, handler);
  };
}