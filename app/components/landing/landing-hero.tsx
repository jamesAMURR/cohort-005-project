import { Link } from "react-router";
import {
  ArrowRight,
  CircleCheck,
  Layers,
  ListChecks,
  type LucideIcon,
} from "lucide-react";
import { Button } from "~/components/ui/button";

export function LandingHero({
  signedIn,
  publishedCourseCount,
  categoryCount,
}: {
  signedIn: boolean;
  publishedCourseCount: number;
  categoryCount: number;
}) {
  return (
    <section className="mx-auto grid max-w-6xl gap-12 px-6 py-16 sm:py-24 lg:grid-cols-12 lg:items-center lg:gap-16">
      <div className="lg:col-span-7">
        <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground">
          <span className="size-1.5 rounded-full bg-primary" />
          Courses for developers
        </p>
        <h1 className="text-5xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
          Learn to code,
          <br />
          <span className="text-muted-foreground">at your own pace.</span>
        </h1>
        <p className="mt-6 max-w-xl text-lg text-muted-foreground">
          Structured courses built by experienced instructors. Track your
          progress, take quizzes, and build real-world skills.
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-3">
          <Button asChild size="lg">
            <Link to="/courses">
              Browse Courses
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            {signedIn ? (
              <Link to="/dashboard">Go to your dashboard</Link>
            ) : (
              <Link to="/signup">Create an account</Link>
            )}
          </Button>
        </div>
        <dl className="mt-12 flex gap-10 border-t border-border pt-8">
          <Stat value={publishedCourseCount} label="Published courses" />
          <Stat value={categoryCount} label="Categories" />
        </dl>
      </div>
      <HowItWorks />
    </section>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <dd className="text-3xl font-bold tracking-tight">{value}</dd>
      <dt className="mt-1 text-sm text-muted-foreground">{label}</dt>
    </div>
  );
}

const STEPS: Array<{ icon: LucideIcon; title: string; body: string }> = [
  {
    icon: Layers,
    title: "Structured modules",
    body: "Every course is broken into short lessons, in order.",
  },
  {
    icon: ListChecks,
    title: "Quizzes as you go",
    body: "Check what stuck before you move on.",
  },
  {
    icon: CircleCheck,
    title: "Progress that keeps your place",
    body: "Pick up exactly where you left off.",
  },
];

function HowItWorks() {
  return (
    <div className="relative isolate lg:col-span-5">
      <div
        aria-hidden
        className="absolute -inset-4 -z-10 rounded-3xl bg-gradient-to-br from-primary/15 via-muted to-transparent"
      />
      <ol className="space-y-6 rounded-2xl border border-border bg-card p-8 shadow-sm">
        {STEPS.map(({ icon: Icon, title, body }) => (
          <li key={title} className="flex gap-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Icon className="size-5" />
            </div>
            <div>
              <p className="font-semibold">{title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{body}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
