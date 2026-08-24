import {
  eventEmitter,
  type TransactionEvent,
  type TransactionEventType,
} from "./event.publisher";

const transactionEventTypes: TransactionEventType[] = [
  "transaction.created",
  "transaction.processing",
  "transaction.authorized",
  "transaction.captured",
  "transaction.settled",
  "transaction.failed",
  "transaction.refunded",
];

const notifications: TransactionEvent[] = [];

let initialized = false;

function handleTransactionEvent(event: TransactionEvent) {
  notifications.push(event);

  console.log(
    `[NotificationHandler] ${event.eventType}`,
    {
      eventId: event.eventId,
      correlationId: event.correlationId,
    },
  );
}

export function initializeNotificationHandler() {
  if (initialized) {
    return;
  }

  for (const eventType of transactionEventTypes) {
    eventEmitter.on(eventType, handleTransactionEvent);
  }

  initialized = true;
}

export function getNotifications() {
  return [...notifications];
}

export function clearNotifications() {
  notifications.length = 0;
}

// Initialize automatically when this module is imported.
initializeNotificationHandler();
