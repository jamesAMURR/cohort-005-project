import { describe, it, expect, beforeEach } from "vitest";
import { createTestDb, seedBaseData, type TestDb } from "~/test/setup";
import * as schema from "~/db/schema";
import { CourseStatus } from "~/db/schema";
import { markdown } from "~/lib/text";
import { createLandingPage } from "../index.server";

let db: TestDb;
let instructorId: number;
let categoryId: number;
let baseCourseId: number;

beforeEach(() => {
  db = createTestDb();
  const base = seedBaseData(db);
  instructorId = base.instructor.id;
  categoryId = base.category.id;
  baseCourseId = base.course.id;
});

function landing() {
  return createLandingPage(db).get();
}

// ─── Fixtures ───
// The landing page only reads courses; nothing in this module writes them,
// so rows go in directly. Kept in one place so a schema change touches only
// this block.

let slugCounter = 0;

function addCourse(
  title: string,
  options: { status?: CourseStatus; createdAt?: string } = {}
) {
  slugCounter += 1;
  return db
    .insert(schema.courses)
    .values({
      title,
      slug: `course-${slugCounter}`,
      description: `${title} description`,
      salesCopy: markdown(`## ${title}`),
      instructorId,
      categoryId,
      status: options.status ?? CourseStatus.Published,
      createdAt: options.createdAt,
    })
    .returning()
    .get();
}

function addLessons(courseId: number, perModule: number[]) {
  perModule.forEach((lessonCount, position) => {
    const mod = db
      .insert(schema.modules)
      .values({ courseId, title: `Module ${position}`, position })
      .returning()
      .get();
    for (let i = 0; i < lessonCount; i++) {
      db.insert(schema.lessons)
        .values({ moduleId: mod.id, title: `Lesson ${i}`, position: i })
        .run();
    }
  });
}

function addCategory(name: string) {
  db.insert(schema.categories).values({ name, slug: name.toLowerCase() }).run();
}

function dayInNovember(day: number) {
  return `2026-11-${String(day).padStart(2, "0")}T12:00:00.000Z`;
}

// ─── Tests ───

describe("featured courses", () => {
  it("lists the newest published courses first, at most three", () => {
    db.delete(schema.courses).run();
    addCourse("Oldest", { createdAt: dayInNovember(1) });
    addCourse("Newest", { createdAt: dayInNovember(4) });
    addCourse("Middle", { createdAt: dayInNovember(2) });
    addCourse("Third", { createdAt: dayInNovember(3) });

    const titles = landing().featuredCourses.map((course) => course.title);

    expect(titles).toEqual(["Newest", "Third", "Middle"]);
  });

  it("leaves out courses that are not published", () => {
    db.delete(schema.courses).run();
    addCourse("Draft", { status: CourseStatus.Draft });
    addCourse("Archived", { status: CourseStatus.Archived });
    addCourse("Live");

    const titles = landing().featuredCourses.map((course) => course.title);

    expect(titles).toEqual(["Live"]);
  });

  it("is empty when nothing is published", () => {
    db.delete(schema.courses).run();
    addCourse("Draft", { status: CourseStatus.Draft });

    expect(landing().featuredCourses).toEqual([]);
  });

  it("names each course's instructor and category", () => {
    const [course] = landing().featuredCourses;

    expect(course).toMatchObject({
      id: baseCourseId,
      title: "Test Course",
      slug: "test-course",
      description: "A test course",
      coverImageUrl: null,
      instructorName: "Test Instructor",
      categoryName: "Programming",
    });
  });

  it("counts lessons across every module of each course", () => {
    const busy = addCourse("Busy", { createdAt: dayInNovember(2) });
    const quiet = addCourse("Quiet", { createdAt: dayInNovember(1) });
    addLessons(busy.id, [3, 2]);
    addLessons(quiet.id, [1]);

    const counts = Object.fromEntries(
      landing().featuredCourses.map((c) => [c.title, c.lessonCount])
    );

    expect(counts).toEqual({ Busy: 5, Quiet: 1, "Test Course": 0 });
  });
});

describe("totals", () => {
  it("counts every published course, not only the featured ones", () => {
    for (let i = 0; i < 4; i++) addCourse(`Published ${i}`);
    addCourse("Draft", { status: CourseStatus.Draft });

    expect(landing().publishedCourseCount).toBe(5);
  });

  it("counts every category", () => {
    addCategory("Design");
    addCategory("Data");

    expect(landing().categoryCount).toBe(3);
  });

  it("reports zero when the catalogue is empty", () => {
    db.delete(schema.courses).run();
    db.delete(schema.categories).run();

    expect(landing()).toEqual({
      featuredCourses: [],
      publishedCourseCount: 0,
      categoryCount: 0,
    });
  });
});
