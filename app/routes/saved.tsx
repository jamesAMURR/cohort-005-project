import { Link } from "react-router";
import type { ReactNode } from "react";
import type { Route } from "./+types/saved";
import { db } from "~/db";
import { listBookmarks, listNotes } from "~/lib/saved.server";
import { requireUserId } from "~/lib/access.server";
import { Card, CardContent } from "~/components/ui/card";
import { Bookmark, NotebookPen } from "lucide-react";
import { formatRelativeTime } from "~/lib/utils";

export function meta() {
  return [
    { title: "Saved — Cadence" },
    { name: "description", content: "Your bookmarks and notes" },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const studentId = await requireUserId(request);

  return {
    savedBookmarks: listBookmarks(db, studentId),
    savedNotes: listNotes(db, studentId),
  };
}

export default function Saved({ loaderData }: Route.ComponentProps) {
  const { savedBookmarks, savedNotes } = loaderData;

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Saved</h1>
        <p className="text-sm text-muted-foreground">
          The lessons you flagged, and what you wrote about them.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SavedSection
          title="Bookmarks"
          icon={<Bookmark className="size-4 text-muted-foreground" />}
          emptyText="No bookmarks yet."
          isEmpty={savedBookmarks.length === 0}
        >
          {savedBookmarks.map((bookmark) => (
            <Card key={bookmark.id}>
              <CardContent className="py-3">
                <SavedLessonLink lesson={bookmark} />
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {bookmark.courseTitle} · {bookmark.moduleTitle}
                </p>
              </CardContent>
            </Card>
          ))}
        </SavedSection>

        <SavedSection
          title="Notes"
          icon={<NotebookPen className="size-4 text-muted-foreground" />}
          emptyText="No notes yet."
          isEmpty={savedNotes.length === 0}
        >
          {savedNotes.map((note) => (
            <Card key={note.id}>
              <CardContent className="space-y-1 py-3">
                <SavedLessonLink lesson={note} />
                <p className="text-xs text-muted-foreground">
                  {note.courseTitle}
                </p>
                {/* Plain text. A Note is never rendered as Markdown. */}
                <p className="whitespace-pre-wrap text-sm">{note.body}</p>
                <p
                  suppressHydrationWarning
                  className="text-xs text-muted-foreground"
                >
                  Edited {formatRelativeTime(note.updatedAt)}
                </p>
              </CardContent>
            </Card>
          ))}
        </SavedSection>
      </div>
    </div>
  );
}

function SavedSection({
  title,
  icon,
  emptyText,
  isEmpty,
  children,
}: {
  title: string;
  icon: ReactNode;
  emptyText: string;
  isEmpty: boolean;
  children: ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-3 flex items-center gap-2 font-semibold">
        {icon}
        {title}
      </h2>
      {isEmpty ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            {emptyText}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">{children}</div>
      )}
    </section>
  );
}

function SavedLessonLink({
  lesson,
}: {
  lesson: { courseSlug: string; lessonId: number; lessonTitle: string };
}) {
  return (
    <Link
      to={`/courses/${lesson.courseSlug}/lessons/${lesson.lessonId}`}
      className="text-sm font-medium hover:underline"
    >
      {lesson.lessonTitle}
    </Link>
  );
}
