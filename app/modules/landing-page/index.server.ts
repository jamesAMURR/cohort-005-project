import { db } from "~/db";
import { getLandingPage, type Db } from "./lib/landing-page";

export type { FeaturedCourse, LandingPage } from "./lib/landing-page";

/**
 * What the landing page at `/` shows, bound to a database. The app uses
 * `landingPage`; tests build their own against a test database.
 */
export function createLandingPage(database: Db) {
  return {
    /**
     * The newest published courses, each with its instructor, category and
     * lesson count, and the published-course and category totals.
     */
    get() {
      return getLandingPage(database);
    },
  };
}

export const landingPage = createLandingPage(db);
