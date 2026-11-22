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
  // The save action trims the body before it checks or stores it, so the
  // draft is judged by what would actually be saved.
  const trimmed = body.trim();
  const tooLong = trimmed.length > maxLength;
  const blank = trimmed.length === 0;
  const dirty = trimmed !== savedBody;

  return {
    length: trimmed.length,
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
