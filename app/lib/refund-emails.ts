import { formatPrice } from "~/lib/utils";

/**
 * The confirmation the Learner gets in their inbox once their Refund Request
 * is in. There is no mail transport wired up yet, so the built message goes
 * to the server log.
 */
export function buildRefundRequestReceivedEmail(input: {
  learnerName: string;
  learnerEmail: string;
  courseTitle: string;
  refundAmount: number;
}) {
  return {
    to: input.learnerEmail,
    subject: `We've received your refund request: ${input.courseTitle}`,
    body: [
      `Hi ${input.learnerName},`,
      "",
      `We've received your refund request for "${input.courseTitle}".`,
      `If it is approved, your refund will be ${formatPrice(input.refundAmount)}, the amount you paid.`,
      "",
      "Someone on our team reviews every refund request by hand. You do not need to do anything else. We will email you again once it has been reviewed.",
      "",
      "— The Cadence team",
    ].join("\n"),
  };
}
