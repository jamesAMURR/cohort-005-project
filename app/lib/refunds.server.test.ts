import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, seedBaseData } from "~/test/setup";
import * as schema from "~/db/schema";
import { eq } from "drizzle-orm";

const testDb = vi.hoisted(() => ({
  current: undefined as unknown,
}));

vi.mock("~/db", () => ({
  db: new Proxy(
    {},
    {
      get(_target, prop) {
        const target = testDb.current as Record<string | symbol, unknown>;
        const value = Reflect.get(target, prop);
        return typeof value === "function" ? value.bind(target) : value;
      },
    }
  ),
}));

import {
  amountKeptAfterRefunds,
  formatRefundDeadline,
  getRefundablePurchases,
  getRefundDeadline,
  getRefundEligibility,
  isWithinRefundPeriod,
  REFUND_WATCH_LIMIT_SECONDS,
} from "./refunds.server";
import { buildRefundRequestReceivedEmail } from "./refund-emails";

type TestDb = ReturnType<typeof createTestDb>;

let db: TestDb;
let learnerId: number;
let courseId: number;
let lessonIds: number[];

const PURCHASED_AT = "2026-11-01T10:00:00.000Z";
const DAY_3 = new Date("2026-11-04T12:00:00.000Z");

function addPurchase(amountPaid: number, createdAt = PURCHASED_AT) {
  return db
    .insert(schema.purchases)
    .values({ userId: learnerId, courseId, amountPaid, country: "US", createdAt })
    .returning()
    .get();
}

function addTeamSeats(purchaseId: number, count: number, claimed = 0) {
  const team = db.insert(schema.teams).values({}).returning().get();
  for (let i = 0; i < count; i++) {
    db.insert(schema.coupons)
      .values({
        teamId: team.id,
        courseId,
        code: `SEAT-${purchaseId}-${i}`,
        purchaseId,
        redeemedAt: i < claimed ? PURCHASED_AT : null,
      })
      .run();
  }
}

function addRefundRequest(
  purchaseId: number,
  status: schema.RefundRequestStatus,
  amountRefunded: number | null = null
) {
  db.insert(schema.refundRequests)
    .values({ purchaseId, status, reason: "It was not for me.", amountRefunded })
    .run();
}

beforeEach(() => {
  db = createTestDb();
  testDb.current = db;
  const base = seedBaseData(db);
  learnerId = base.user.id;
  courseId = base.course.id;

  const courseModule = db
    .insert(schema.modules)
    .values({ courseId, title: "Module", position: 1 })
    .returning()
    .get();
  lessonIds = [1, 2, 3, 4].map(
    (position) =>
      db
        .insert(schema.lessons)
        .values({ moduleId: courseModule.id, title: `L${position}`, position })
        .returning()
        .get().id
  );
});

describe("the Refund Period", () => {
  it("ends 14 calendar days after purchase, counted in UTC", () => {
    expect(getRefundDeadline(PURCHASED_AT)).toBe("2026-11-15");
  });

  it("gives a purchase made late in the UTC day its whole fourteenth day", () => {
    // S6: 23:30 UTC on Nov 1 still has until the end of Nov 15.
    const lateNight = "2026-11-01T23:30:00.000Z";
    expect(getRefundDeadline(lateNight)).toBe("2026-11-15");
    expect(
      isWithinRefundPeriod(lateNight, new Date("2026-11-15T23:59:00.000Z"))
    ).toBe(true);
    expect(
      isWithinRefundPeriod(lateNight, new Date("2026-11-16T00:00:00.000Z"))
    ).toBe(false);
  });

  it("shows the Refund Deadline as a UTC date", () => {
    expect(formatRefundDeadline("2026-11-15")).toBe("15 Nov 2026 (UTC)");
  });
});

describe("getRefundEligibility", () => {
  it("offers exactly what was paid as the Refund Amount", () => {
    // Q6: not the course's current list price.
    db.update(schema.courses).set({ price: 15000 }).run();
    const purchase = addPurchase(10000);

    const result = getRefundEligibility(purchase, DAY_3);

    expect(result).toEqual({
      eligible: true,
      purchase: {
        purchaseId: purchase.id,
        purchasedAt: PURCHASED_AT,
        refundAmount: 10000,
        refundDeadline: "2026-11-15",
        teamSeats: null,
      },
    });
  });

  it("refuses once the Refund Period has ended", () => {
    const purchase = addPurchase(10000);
    expect(
      getRefundEligibility(purchase, new Date("2026-11-16T09:00:00.000Z"))
    ).toEqual({ eligible: false, reason: "refund-period-ended" });
  });

  it("refuses while a Refund Request is open on the purchase", () => {
    const purchase = addPurchase(10000);
    addRefundRequest(purchase.id, schema.RefundRequestStatus.Requested);
    expect(getRefundEligibility(purchase, DAY_3)).toEqual({
      eligible: false,
      reason: "request-open",
    });
  });

  it("allows asking again after a Declined request", () => {
    // S3: a decline is not final.
    const purchase = addPurchase(10000);
    addRefundRequest(purchase.id, schema.RefundRequestStatus.Declined);
    expect(getRefundEligibility(purchase, DAY_3).eligible).toBe(true);
  });

  it("refunds a whole team purchase when no seat is claimed", () => {
    // S1: Ben's 5 seats at $100 are refunded as $500.
    const purchase = addPurchase(50000);
    addTeamSeats(purchase.id, 5);
    const result = getRefundEligibility(purchase, DAY_3);
    expect(result.eligible && result.purchase.refundAmount).toBe(50000);
    expect(result.eligible && result.purchase.teamSeats).toBe(5);
  });

  it("refuses a team purchase once any seat is claimed", () => {
    // S2: all-or-nothing.
    const purchase = addPurchase(50000);
    addTeamSeats(purchase.id, 5, 2);
    expect(getRefundEligibility(purchase, DAY_3)).toEqual({
      eligible: false,
      reason: "claimed-seat",
    });
  });

  it("refuses once half the lessons are completed", () => {
    const purchase = addPurchase(10000);
    for (const lessonId of lessonIds.slice(0, 2)) {
      db.insert(schema.lessonProgress)
        .values({
          userId: learnerId,
          lessonId,
          status: schema.LessonProgressStatus.Completed,
        })
        .run();
    }
    expect(getRefundEligibility(purchase, DAY_3)).toEqual({
      eligible: false,
      reason: "completion-limit",
    });
  });

  it("refuses once the watch-time limit is reached, from stored watch events", () => {
    const purchase = addPurchase(10000);
    const half = REFUND_WATCH_LIMIT_SECONDS / 2;
    for (const lessonId of lessonIds.slice(0, 2)) {
      db.insert(schema.videoWatchEvents)
        .values({
          userId: learnerId,
          lessonId,
          eventType: "progress",
          positionSeconds: half,
        })
        .run();
    }
    expect(getRefundEligibility(purchase, DAY_3)).toEqual({
      eligible: false,
      reason: "watch-limit",
    });
  });
});

describe("getRefundablePurchases", () => {
  it("lists each eligible purchase so the Learner can pick one", () => {
    // S5: an own purchase and a later team purchase of the same course.
    const own = addPurchase(10000, "2026-11-01T10:00:00.000Z");
    const team = addPurchase(30000, "2026-11-05T10:00:00.000Z");
    addTeamSeats(team.id, 3);

    const result = getRefundablePurchases(
      learnerId,
      courseId,
      new Date("2026-11-06T10:00:00.000Z")
    );

    expect(result.map((p) => [p.purchaseId, p.refundAmount, p.teamSeats])).toEqual([
      [own.id, 10000, null],
      [team.id, 30000, 3],
    ]);
  });
});

describe("amountKeptAfterRefunds", () => {
  function keptFor(purchaseId: number) {
    return db
      .select({ kept: amountKeptAfterRefunds })
      .from(schema.purchases)
      .where(eq(schema.purchases.id, purchaseId))
      .get()?.kept;
  }

  it("is reduced only by approved Refunds, never by open or declined requests", () => {
    // R6: instructor revenue drops when a Refund exists, not when one is asked for.
    const open = addPurchase(10000);
    addRefundRequest(open.id, schema.RefundRequestStatus.Requested);
    const declined = addPurchase(10000);
    addRefundRequest(declined.id, schema.RefundRequestStatus.Declined);
    const refunded = addPurchase(10000);
    addRefundRequest(refunded.id, schema.RefundRequestStatus.Declined);
    addRefundRequest(refunded.id, schema.RefundRequestStatus.Approved, 10000);

    expect(keptFor(open.id)).toBe(10000);
    expect(keptFor(declined.id)).toBe(10000);
    expect(keptFor(refunded.id)).toBe(0);
  });
});

describe("buildRefundRequestReceivedEmail", () => {
  it("speaks of a refund request and the amount paid, never a reversal", () => {
    const email = buildRefundRequestReceivedEmail({
      learnerName: "Hana",
      learnerEmail: "hana@example.com",
      courseTitle: "Intro to Testing",
      refundAmount: 4999,
    });

    expect(email.subject).toBe(
      "We've received your refund request: Intro to Testing"
    );
    expect(email.body).toContain("$49.99");
    expect(email.body.toLowerCase()).not.toMatch(/reversal|chargeback|cancel/);
  });
});
