import { describe, expect, it } from "vitest";
import { transition, validTransition } from "./state-machine";

describe("Transaction State Machine", () => {
  it("allows valid transitions", () => {
    expect(validTransition("PENDING", "PROCESSING")).toBe(true);
    expect(validTransition("PROCESSING", "AWAITING_AUTH")).toBe(true);
    expect(validTransition("AWAITING_AUTH", "AUTHORIZED")).toBe(true);
    expect(validTransition("AUTHORIZED", "CAPTURED")).toBe(true);
    expect(validTransition("CAPTURED", "SETTLED")).toBe(true);
    expect(validTransition("AUTHORIZED", "CANCELLED")).toBe(true);
    expect(validTransition("CAPTURED", "REFUNDED")).toBe(true);
    expect(validTransition("CAPTURED", "PARTIALLY_REFUNDED")).toBe(true);
  });

  it("rejects invalid transitions", () => {
    expect(validTransition("SETTLED", "PROCESSING")).toBe(false);
    expect(validTransition("CAPTURED", "PROCESSING")).toBe(false);
    expect(validTransition("FAILED", "CAPTURED")).toBe(false);
  });

  it("throws on an invalid transition", () => {
    expect(() => transition("SETTLED", "PROCESSING")).toThrow(
      "Invalid transaction state transition",
    );
  });
});