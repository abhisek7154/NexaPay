import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import HomePage from "./page";

describe("NexaPay page", () => {
  it("renders the payment demo with seeded users", () => {
    const html = renderToStaticMarkup(<HomePage />);

    expect(html).toContain("NexaPay");
    expect(html).toContain("Abhishek");
    expect(html).toContain("Rahul");
    expect(html).toContain("SEND PAYMENT");
  });
});