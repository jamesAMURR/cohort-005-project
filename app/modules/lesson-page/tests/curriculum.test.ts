import { describe, it, expect } from "vitest";
import { flattenCourseLessons } from "../curriculum";

describe("flattenCourseLessons", () => {
  it("lists every lesson in module order, tagged with its module", () => {
    const flat = flattenCourseLessons({
      modules: [
        {
          id: 1,
          title: "Basics",
          lessons: [
            { id: 10, title: "Hello", moduleId: 1 },
            { id: 11, title: "Types", moduleId: 1 },
          ],
        },
        {
          id: 2,
          title: "Advanced",
          lessons: [{ id: 20, title: "Generics", moduleId: 2 }],
        },
      ],
    });

    expect(flat).toEqual([
      { id: 10, title: "Hello", moduleId: 1, moduleTitle: "Basics" },
      { id: 11, title: "Types", moduleId: 1, moduleTitle: "Basics" },
      { id: 20, title: "Generics", moduleId: 2, moduleTitle: "Advanced" },
    ]);
  });

  it("skips modules that have no lessons", () => {
    const flat = flattenCourseLessons({
      modules: [
        { id: 1, title: "Empty", lessons: [] },
        {
          id: 2,
          title: "Full",
          lessons: [{ id: 20, title: "Only", moduleId: 2 }],
        },
      ],
    });

    expect(flat.map((lesson) => lesson.id)).toEqual([20]);
  });

  it("is empty for a course with no modules", () => {
    expect(flattenCourseLessons({ modules: [] })).toEqual([]);
  });
});
