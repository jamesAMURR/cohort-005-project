// PROTOTYPE — throwaway floating variant switcher (prototype skill). Hidden in production builds.
import { useEffect, type ReactNode } from "react";
import { useSearchParams } from "react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function PrototypeSwitcher({
  variants,
  names,
  children,
}: {
  variants: readonly string[];
  names?: Record<string, string>;
  children?: ReactNode;
}) {
  const [params, setParams] = useSearchParams();
  const current = params.get("variant") ?? variants[0];
  const idx = Math.max(0, variants.indexOf(current));

  function go(delta: number) {
    const next = variants[(idx + delta + variants.length) % variants.length];
    setParams(
      (p) => {
        p.set("variant", next);
        return p;
      },
      { replace: true }
    );
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (import.meta.env.PROD) return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-[100] flex -translate-x-1/2 items-center gap-2 rounded-full bg-fuchsia-700 px-2 py-1.5 text-sm text-white shadow-2xl ring-2 ring-white">
      <button onClick={() => go(-1)} className="rounded-full p-1 hover:bg-white/20">
        <ChevronLeft className="size-4" />
      </button>
      <span className="min-w-52 text-center font-medium">
        {variants[idx]}
        {names?.[variants[idx]] && ` (${names[variants[idx]]})`}
      </span>
      <button onClick={() => go(1)} className="rounded-full p-1 hover:bg-white/20">
        <ChevronRight className="size-4" />
      </button>
      {children && <div className="flex items-center gap-1 border-l border-white/30 pl-2">{children}</div>}
    </div>
  );
}
