import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "~/db";
import {
  coupons,
  lessonProgress,
  lessons,
  LessonProgressStatus,
  modules,
  purchases,
  refundRequests,
  RefundRequestStatus,
  videoWatchEvents,
} from "~/db/schema";

// One place that answers "may this Learner raise a Refund Request on this
// purchase?". The course page and the request action both ask here, so the
// button and the server can never disagree. See GLOSSARY.md for the terms.

export const REFUND_PERIOD_DAYS = 14;
export const REFUND_WATCH_LIMIT_SECONDS = 2 * 60 * 60;
export const REFUND_COMPLETION_LIMIT = 0.5;

/** A calendar day in UTC, as YYYY-MM-DD. */
function utcDay(when: Date): string {
  return when.toISOString().slice(0, 10);
}

/**
 * The last day of the Refund Period, as a UTC date (YYYY-MM-DD). The period
 * is counted in whole days, so a purchase at 23:30 still gets its whole
 * fourteenth day.
 */
export function getRefundDeadline(purchasedAtIso: string): string {
  const deadline = new Date(purchasedAtIso);
  deadline.setUTCDate(deadline.getUTCDate() + REFUND_PERIOD_DAYS);
  return utcDay(deadline);
}

export function isWithinRefundPeriod(
  purchasedAtIso: string,
  now: Date = new Date()
): boolean {
  return utcDay(now) <= getRefundDeadline(purchasedAtIso);
}

/** "15 Nov 2026 (UTC)" — how a Refund Deadline is shown to a Learner. */
export function formatRefundDeadline(deadline: string): string {
  const formatted = new Date(`${deadline}T00:00:00Z`).toLocaleDateString(
    "en-GB",
    { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }
  );
  return `${formatted} (UTC)`;
}

export type RefundIneligibleReason =
  | "refund-period-ended"
  | "completion-limit"
  | "watch-limit"
  | "claimed-seat"
  | "request-open";

/** What the Learner is told when they cannot raise a Refund Request. */
export function describeRefundIneligibility(
  reason: RefundIneligibleReason
): string {
  switch (reason) {
    case "refund-period-ended":
      return `The ${REFUND_PERIOD_DAYS}-day refund period has ended.`;
    case "completion-limit":
      return "You have completed too much of this course to request a refund.";
    case "watch-limit":
      return "You have watched too much of this course to request a refund.";
    case "claimed-seat":
      return "A team seat on this purchase has been claimed, so it cannot be refunded.";
    case "request-open":
      return "You already have a refund request open on this purchase.";
  }
}

type Purchase = typeof purchases.$inferSelect;

export type RefundablePurchase = {
  purchaseId: number;
  purchasedAt: string;
  refundAmount: number;
  refundDeadline: string;
  /** Null for a Learner's own purchase; the number of seats for a team one. */
  teamSeats: number | null;
};

export type RefundEligibility =
  | { eligible: true; purchase: RefundablePurchase }
  | { eligible: false; reason: RefundIneligibleReason };

function getCourseLessonIds(courseId: number): number[] {
  return db
    .select({ id: lessons.id })
    .from(lessons)
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .where(eq(modules.courseId, courseId))
    .all()
    .map((row) => row.id);
}

function getCompletedLessonCount(userId: number, lessonIds: number[]) {
  if (lessonIds.length === 0) return 0;
  const result = db
    .select({ count: sql<number>`count(*)` })
    .from(lessonProgress)
    .where(
      and(
        eq(lessonProgress.userId, userId),
        eq(lessonProgress.status, LessonProgressStatus.Completed),
        inArray(lessonProgress.lessonId, lessonIds)
      )
    )
    .get();
  return result?.count ?? 0;
}

// Watch time is the furthest point reached in each lesson, summed. It is read
// from the stored watch events — never from anything the browser sends with
// the request.
function getSecondsWatched(userId: number, lessonIds: number[]) {
  if (lessonIds.length === 0) return 0;
  return db
    .select({
      furthest: sql<number>`max(${videoWatchEvents.positionSeconds})`,
    })
    .from(videoWatchEvents)
    .where(
      and(
        eq(videoWatchEvents.userId, userId),
        inArray(videoWatchEvents.lessonId, lessonIds)
      )
    )
    .groupBy(videoWatchEvents.lessonId)
    .all()
    .reduce((total, row) => total + row.furthest, 0);
}

function countSeats(purchaseId: number) {
  const result = db
    .select({
      seats: sql<number>`count(*)`,
      claimed: sql<number>`count(${coupons.redeemedAt})`,
    })
    .from(coupons)
    .where(eq(coupons.purchaseId, purchaseId))
    .get();
  return { seats: result?.seats ?? 0, claimed: result?.claimed ?? 0 };
}

function hasOpenRefundRequest(purchaseId: number) {
  return !!db
    .select({ id: refundRequests.id })
    .from(refundRequests)
    .where(
      and(
        eq(refundRequests.purchaseId, purchaseId),
        eq(refundRequests.status, RefundRequestStatus.Requested)
      )
    )
    .get();
}

/**
 * Refund Eligibility for one purchase, judged at `now`. The watch-time and
 * completion limits are about how much of the course this Learner has taken,
 * so they apply to every purchase they hold for it.
 */
export function getRefundEligibility(
  purchase: Purchase,
  now: Date = new Date()
): RefundEligibility {
  if (!isWithinRefundPeriod(purchase.createdAt, now)) {
    return { eligible: false, reason: "refund-period-ended" };
  }

  if (hasOpenRefundRequest(purchase.id)) {
    return { eligible: false, reason: "request-open" };
  }

  const { seats, claimed } = countSeats(purchase.id);
  if (claimed > 0) {
    return { eligible: false, reason: "claimed-seat" };
  }

  const lessonIds = getCourseLessonIds(purchase.courseId);

  if (
    lessonIds.length > 0 &&
    getCompletedLessonCount(purchase.userId, lessonIds) / lessonIds.length >=
      REFUND_COMPLETION_LIMIT
  ) {
    return { eligible: false, reason: "completion-limit" };
  }

  if (
    getSecondsWatched(purchase.userId, lessonIds) >= REFUND_WATCH_LIMIT_SECONDS
  ) {
    return { eligible: false, reason: "watch-limit" };
  }

  return {
    eligible: true,
    purchase: {
      purchaseId: purchase.id,
      purchasedAt: purchase.createdAt,
      refundAmount: purchase.amountPaid,
      refundDeadline: getRefundDeadline(purchase.createdAt),
      teamSeats: seats > 0 ? seats : null,
    },
  };
}

export function getPurchasesForCourse(userId: number, courseId: number) {
  return db
    .select()
    .from(purchases)
    .where(and(eq(purchases.userId, userId), eq(purchases.courseId, courseId)))
    .orderBy(asc(purchases.createdAt), asc(purchases.id))
    .all();
}

/** Every purchase of this course the Learner may raise a Refund Request on. */
export function getRefundablePurchases(
  userId: number,
  courseId: number,
  now: Date = new Date()
): RefundablePurchase[] {
  return getPurchasesForCourse(userId, courseId).flatMap((purchase) => {
    const eligibility = getRefundEligibility(purchase, now);
    return eligibility.eligible ? [eligibility.purchase] : [];
  });
}

/**
 * What the platform kept from a purchase: the amount paid, less any approved
 * Refunds on it. Only Refunds reduce revenue; an open Refund Request does not.
 * Use it in a query that selects from `purchases`, unaliased.
 *
 * The column names are written out with their tables on purpose: drizzle
 * leaves interpolated columns unqualified inside a select list, and an
 * unqualified "id" in the subquery would bind to refund_requests.id.
 */
export const amountKeptAfterRefunds = sql<number>`("purchases"."amount_paid" - coalesce((
  select sum("rr"."amount_refunded")
  from "refund_requests" as "rr"
  where "rr"."purchase_id" = "purchases"."id"
    and "rr"."status" = ${RefundRequestStatus.Approved}
), 0))`;
