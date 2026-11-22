import { describe, type NoteDraft, type NoteDraftInput } from "./lib/describe";

export type {
  NoteDraft,
  NoteDraftInput,
  NoteDraftStatus,
} from "./lib/describe";

/**
 * What the lesson note editor should show for the text in the box: the
 * character count, whether Save is allowed, and which status line to show.
 */
export function describeNoteDraft(input: NoteDraftInput): NoteDraft {
  return describe(input);
}
