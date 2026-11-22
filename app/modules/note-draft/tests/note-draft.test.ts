import { describe, it, expect } from "vitest";
import { describeNoteDraft, type NoteDraftInput } from "../index";

const base: NoteDraftInput = {
  body: "",
  savedBody: "",
  maxLength: 10,
  isSaving: false,
};

describe("describeNoteDraft", () => {
  it("starts empty and unsavable when there is no note", () => {
    expect(describeNoteDraft(base)).toEqual({
      length: 0,
      tooLong: false,
      canSave: false,
      status: "empty",
    });
  });

  it("allows saving a new draft and marks it unsaved", () => {
    const draft = describeNoteDraft({ ...base, body: "hello" });
    expect(draft.canSave).toBe(true);
    expect(draft.status).toBe("unsaved");
    expect(draft.length).toBe(5);
  });

  it("shows a saved note as saved and does not offer to save it again", () => {
    const draft = describeNoteDraft({
      ...base,
      body: "hello",
      savedBody: "hello",
    });
    expect(draft.status).toBe("saved");
    expect(draft.canSave).toBe(false);
  });

  it("blocks saving a blank draft, even when it differs from the note", () => {
    const draft = describeNoteDraft({ ...base, body: "   ", savedBody: "x" });
    expect(draft.canSave).toBe(false);
    expect(draft.status).toBe("unsaved");
  });

  it("allows exactly the maximum length", () => {
    const draft = describeNoteDraft({ ...base, body: "a".repeat(10) });
    expect(draft.tooLong).toBe(false);
    expect(draft.canSave).toBe(true);
  });

  it("blocks saving one character over the maximum", () => {
    const draft = describeNoteDraft({ ...base, body: "a".repeat(11) });
    expect(draft.tooLong).toBe(true);
    expect(draft.canSave).toBe(false);
  });

  it("reports saving while the request is in flight, over any error", () => {
    const draft = describeNoteDraft({
      ...base,
      body: "hello",
      isSaving: true,
      error: "boom",
    });
    expect(draft.status).toBe("saving");
    expect(draft.canSave).toBe(false);
  });

  it("reports the server's error once the request settles", () => {
    const draft = describeNoteDraft({
      ...base,
      body: "hello",
      savedBody: "hello",
      error: "Too long",
    });
    expect(draft.status).toBe("error");
  });
});
