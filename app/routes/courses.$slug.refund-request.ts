import { data, redirect } from "react-router";
import { z } from "zod";
import type { Route } from "./+types/courses.$slug.refund-request";
import { getCurrentUserId } from "~/lib/session";
import { db } from "~/db";
import {
  courses,
  purchases,
  refundRequests,
  users,
  RefundRequestStatus,
} from "~/db/schema";
import { and, eq } from "drizzle-orm";
import { parseFormData, parseParams } from "~/lib/validation";
import {
  describeRefundIneligibility,
  getRefundEligibility,
} from "~/lib/refunds.server";
import { buildRefundRequestReceivedEmail } from "~/lib/refund-emails";

const refundRequestParamsSchema = z.object({
  slug: z.string().min(1),
});

const refundRequestActionSchema = z.object({
  purchaseId: z.coerce.number().int().positive(),
  reason: z
    .string()
    .trim()
    .min(10, "Tell us a little more about why you want a refund.")
    .max(1000, "Please keep your reason under 1000 characters."),
});

function getCourseBySlug(slug: string) {
  return db.select().from(courses).where(eq(courses.slug, slug)).get();
}

function getLearnersPurchase(
  userId: number,
  courseId: number,
  purchaseId: number
) {
  return db
    .select()
    .from(purchases)
    .where(
      and(
        eq(purchases.id, purchaseId),
        eq(purchases.userId, userId),
        eq(purchases.courseId, courseId)
      )
    )
    .get();
}

export async function action({ params, request }: Route.ActionArgs) {
  const currentUserId = await getCurrentUserId(request);

  if (!currentUserId) {
    throw data("You must be logged in to request a refund.", { status: 401 });
  }

  const { slug } = parseParams(params, refundRequestParamsSchema);
  const course = getCourseBySlug(slug);

  if (!course) {
    throw data("Course not found", { status: 404 });
  }

  const learner = db
    .select()
    .from(users)
    .where(eq(users.id, currentUserId))
    .get();

  if (!learner) {
    throw data("User not found", { status: 404 });
  }

  const formData = await request.formData();
  const parsed = parseFormData(formData, refundRequestActionSchema);

  if (!parsed.success) {
    return data({ errors: parsed.errors }, { status: 400 });
  }

  // A Refund Request is always about one named purchase, and only the
  // Learner's own purchase of this course.
  const purchase = getLearnersPurchase(
    currentUserId,
    course.id,
    parsed.data.purchaseId
  );

  if (!purchase) {
    throw data("You have not bought this course.", { status: 403 });
  }

  const eligibility = getRefundEligibility(purchase);

  if (!eligibility.eligible) {
    const status = eligibility.reason === "request-open" ? 409 : 403;
    throw data(describeRefundIneligibility(eligibility.reason), { status });
  }

  db.insert(refundRequests)
    .values({
      purchaseId: purchase.id,
      status: RefundRequestStatus.Requested,
      reason: parsed.data.reason,
    })
    .run();

  const email = buildRefundRequestReceivedEmail({
    learnerName: learner.name,
    learnerEmail: learner.email,
    courseTitle: course.title,
    refundAmount: eligibility.purchase.refundAmount,
  });

  console.log(`[email] to=${email.to} subject=${email.subject}\n${email.body}`);

  return redirect("/settings");
}
