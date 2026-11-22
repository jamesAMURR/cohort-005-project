import { useState } from "react";
import { useFetcher } from "react-router";
import type { LessonLoaderData } from "./types";
import { MAX_NOTE_LENGTH } from "~/lib/notes";
import { describeNoteDraft, type NoteDraftStatus } from "~/modules/note-draft";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Textarea } from "~/components/ui/textarea";
import { Check, Lock, NotebookPen } from "lucide-react";
import { cn, formatRelativeTime } from "~/lib/utils";

export function LessonNote({ note }: { note: LessonLoaderData["note"] }) {
  const fetcher = useFetcher<{ ok: boolean; error?: string }>();
  const savedBody = note?.body ?? "";
  const [body, setBody] = useState(savedBody);
  const draft = describeNoteDraft({
    body,
    savedBody,
    maxLength: MAX_NOTE_LENGTH,
    isSaving: fetcher.state !== "idle",
    error: fetcher.data?.error,
  });

  return (
    <Card className="mb-8">
      <CardContent>
        <NoteHeader />

        <fetcher.Form method="post" className="space-y-2">
          <input type="hidden" name="intent" value="save-note" />
          <Textarea
            name="body"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            aria-label="Your notes"
            placeholder="Jot down what you want to remember from this lesson..."
            className="min-h-32 resize-y"
          />
          <div className="flex items-center gap-3">
            <Button type="submit" size="sm" disabled={!draft.canSave}>
              {draft.status === "saving" ? "Saving..." : "Save note"}
            </Button>
            <NoteStatus
              status={draft.status}
              error={fetcher.data?.error}
              updatedAt={note?.updatedAt}
            />
            <span
              className={cn(
                "ml-auto text-xs",
                draft.tooLong ? "text-destructive" : "text-muted-foreground"
              )}
            >
              {draft.length} / {MAX_NOTE_LENGTH}
            </span>
          </div>
        </fetcher.Form>
      </CardContent>
    </Card>
  );
}

function NoteHeader() {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="flex items-center gap-2">
        <NotebookPen className="size-5 text-primary" />
        <h2 className="text-xl font-semibold">Your notes</h2>
      </div>
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Lock className="size-3" />
        Only you can see these
      </span>
    </div>
  );
}

function NoteStatus({
  status,
  error,
  updatedAt,
}: {
  status: NoteDraftStatus;
  error?: string;
  updatedAt?: string;
}) {
  if (status === "error") {
    return <span className="text-sm text-destructive">{error}</span>;
  }
  if (status === "unsaved") {
    return (
      <span className="text-xs text-muted-foreground">Unsaved changes</span>
    );
  }
  if (status === "saved" && updatedAt) {
    return (
      <span
        suppressHydrationWarning
        className="flex items-center gap-1 text-xs text-muted-foreground"
      >
        <Check className="size-3" />
        Saved {formatRelativeTime(updatedAt)}
      </span>
    );
  }
  return null;
}
