import { describe, expect, it } from "vitest";
import { computePriorityScore, sortByPriority } from "./priority.service.js";

describe("computePriorityScore", () => {
  it("ranks emergency above normal", () => {
    const emergency = computePriorityScore({ urgency: "emergency", category: null, createdAt: new Date() });
    const normal = computePriorityScore({ urgency: "normal", category: null, createdAt: new Date() });
    expect(emergency).toBeGreaterThan(normal);
  });

  it("ranks a high-priority category above a plain one within the same urgency", () => {
    const fire = computePriorityScore({ urgency: "normal", category: "chay_no", createdAt: new Date() });
    const plain = computePriorityScore({ urgency: "normal", category: "khac", createdAt: new Date() });
    expect(fire).toBeGreaterThan(plain);
  });
});

describe("sortByPriority", () => {
  it("puts emergency reports before normal ones regardless of submission order", () => {
    const now = Date.now();
    const normal = { id: "a", urgency: "normal", category: null, createdAt: new Date(now - 1000) };
    const emergency = { id: "b", urgency: "emergency", category: null, createdAt: new Date(now) };
    const sorted = sortByPriority([normal, emergency]);
    expect(sorted.map((r) => r.id)).toEqual(["b", "a"]);
  });

  it("breaks ties within the same priority tier by oldest-first", () => {
    const now = Date.now();
    const older = { id: "older", urgency: "normal", category: null, createdAt: new Date(now - 5000) };
    const newer = { id: "newer", urgency: "normal", category: null, createdAt: new Date(now) };
    const sorted = sortByPriority([newer, older]);
    expect(sorted.map((r) => r.id)).toEqual(["older", "newer"]);
  });

  it("does not mutate the input array", () => {
    const input = [
      { id: "a", urgency: "normal", category: null, createdAt: new Date(1) },
      { id: "b", urgency: "emergency", category: null, createdAt: new Date(2) },
    ];
    const copy = [...input];
    sortByPriority(input);
    expect(input).toEqual(copy);
  });
});
