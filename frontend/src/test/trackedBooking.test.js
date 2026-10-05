import { describe, it, expect } from "vitest";
import { pickTrackedBooking } from "@/lib/trackedBooking";

const NOW = new Date("2026-10-05T18:00:00+05:30").getTime();
const ago = (min) => new Date(NOW - min * 60000).toISOString();
const pick = (list, opts = {}) => pickTrackedBooking(list, { now: NOW, ...opts })?._id ?? null;

// /bookings returns newest first.
const oldCompletedUnrated = { _id: "old", status: "completed", rating: 0, updatedAt: ago(3 * 24 * 60), completedAt: ago(3 * 24 * 60) };

describe("pickTrackedBooking", () => {
  it("cancelling a booking shows that cancellation, not an old unrated completed job", () => {
    const justCancelled = { _id: "new", status: "cancelled", updatedAt: ago(1) };
    expect(pick([justCancelled, oldCompletedUnrated], { trackedId: "new" })).toBe("new");
    // ...even after a reload, when nothing is being tracked yet
    expect(pick([justCancelled, oldCompletedUnrated])).toBe("new");
  });

  it("never falls back to an old unrated completed booking", () => {
    expect(pick([oldCompletedUnrated])).toBeNull();
    const oldCancelled = { _id: "c", status: "cancelled", updatedAt: ago(20) };
    expect(pick([oldCancelled, oldCompletedUnrated])).toBeNull();
  });

  it("a booking in progress always wins", () => {
    const live = { _id: "live", status: "on_the_way", updatedAt: ago(30) };
    const justCancelled = { _id: "x", status: "cancelled", updatedAt: ago(1) };
    expect(pick([justCancelled, live, oldCompletedUnrated], { trackedId: "x" })).toBe("live");
  });

  it("the booking on screen keeps the screen when it completes", () => {
    const tracked = { _id: "t", status: "completed", rating: 0, updatedAt: ago(5 * 60) };
    expect(pick([tracked, oldCompletedUnrated], { trackedId: "t" })).toBe("t");
  });

  it("a job completed in the last hour still opens its bill", () => {
    const done = { _id: "d", status: "completed", rating: 0, completedAt: ago(10), updatedAt: ago(10) };
    expect(pick([done, oldCompletedUnrated])).toBe("d");
    expect(pick([{ ...done, rating: 5 }])).toBeNull();
  });

  it("the most recent of a fresh cancellation and a fresh completion wins", () => {
    const cancelled = { _id: "c", status: "cancelled", updatedAt: ago(2) };
    const completed = { _id: "d", status: "completed", rating: 0, completedAt: ago(30), updatedAt: ago(30) };
    expect(pick([cancelled, completed])).toBe("c");
    expect(pick([{ ...cancelled, updatedAt: ago(40) }, { ...completed, completedAt: ago(5), updatedAt: ago(5) }])).toBe("d");
  });

  it("a dismissed cancellation is not shown again", () => {
    const cancelled = { _id: "c", status: "cancelled", updatedAt: ago(2) };
    expect(pick([cancelled], { dismissed: ["c"] })).toBeNull();
  });

  it("copes with an empty or missing list", () => {
    expect(pick([])).toBeNull();
    expect(pick(undefined)).toBeNull();
  });
});
