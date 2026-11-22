export type NoteDraftStatus =
  | "error"
  | "saving"
  | "unsaved"
  | "saved"
  | "empty";

export type NoteDraftInput = {
  body: string;
  savedBody: string;
  maxLength: number;
  isSaving: boolean;
  error?: string;
};

export type NoteDraft = {
  length: number;
  tooLong: boolean;
  canSave: boolean;
  status: NoteDraftStatus;
};

export function describe({
  body,
  savedBody,
  maxLength,
  isSaving,
  error,
}: NoteDraftInput): NoteDraft {
  const tooLong = body.length > maxLength;
  // The save action rejects a blank note, so a blank draft is not savable.
  const blank = body.trim().length === 0;
  const dirty = body !== savedBody;

  return {
    length: body.length,
    tooLong,
    canSave: dirty && !blank && !tooLong && !isSaving,
    status: statusOf({ isSaving, error, dirty, savedBody }),
  };
}

function statusOf({
  isSaving,
  error,
  dirty,
  savedBody,
}: {
  isSaving: boolean;
  error?: string;
  dirty: boolean;
  savedBody: string;
}): NoteDraftStatus {
  if (isSaving) return "saving";
  if (error) return "error";
  if (dirty) return "unsaved";
  return savedBody === "" ? "empty" : "saved";
}
