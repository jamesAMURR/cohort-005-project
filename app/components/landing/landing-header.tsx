import { Link } from "react-router";
import { Moon, Sun } from "lucide-react";
import { Button } from "~/components/ui/button";
import { useDarkMode } from "~/components/use-dark-mode";

const navLinkClass =
  "whitespace-nowrap text-sm font-medium text-muted-foreground transition-colors hover:text-foreground";

export function LandingHeader({ signedIn }: { signedIn: boolean }) {
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-6">
        <Link to="/" className="text-xl font-bold tracking-tight">
          Cadence
        </Link>
        <nav className="flex items-center gap-3 sm:gap-6">
          <Link to="/courses" className={navLinkClass}>
            Courses
          </Link>
          <DarkModeToggle />
          {signedIn ? (
            <Button asChild size="sm">
              <Link to="/dashboard">Dashboard</Link>
            </Button>
          ) : (
            <>
              <Link to="/login" className={navLinkClass}>
                Log In
              </Link>
              <Button asChild size="sm">
                <Link to="/signup">Sign Up</Link>
              </Button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

function DarkModeToggle() {
  const { isDark, toggleDarkMode } = useDarkMode();

  return (
    <button
      onClick={toggleDarkMode}
      className="rounded-md p-2 text-muted-foreground transition-colors hover:text-foreground"
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}
