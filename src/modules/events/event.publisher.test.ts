import { describe, expect, it } from "vitest";
import { EventEmitter } from "events";

describe("Transaction Events", () => {
  it("publishes transaction.created and subscriber receives it", () => {
    const emitter = new EventEmitter();

    const transaction = {
      id: "test-txn-001",
      status: "PENDING",
      amount: 100,
    };

    const receivedEvents: unknown[] = [];

    emitter.on("transaction.created", (event) => {
      receivedEvents.push(event);
    });

    const event = {
      eventId: "event-001",
      eventType: "transaction.created",
      version: 1,
      timestamp: new Date(),
      source: "transaction-service",
      correlationId: "correlation-001",
      data: transaction,
      metadata: {},
    };

    emitter.emit("transaction.created", event);

    expect(receivedEvents).toHaveLength(1);
    expect(receivedEvents[0]).toEqual(event);
  });

  it("contains the required event fields", () => {
    const event = {
      eventId: "event-001",
      eventType: "transaction.created",
      version: 1,
      timestamp: new Date(),
      source: "transaction-service",
      correlationId: "correlation-001",
      data: { id: "test-txn-001" },
      metadata: {},
    };

    expect(event.eventId).toBeDefined();
    expect(event.eventType).toBe("transaction.created");
    expect(event.version).toBe(1);
    expect(event.timestamp).toBeInstanceOf(Date);
    expect(event.source).toBeDefined();
    expect(event.correlationId).toBeDefined();
    expect(event.data).toBeDefined();
  });
});