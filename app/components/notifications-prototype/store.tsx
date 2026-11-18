// PROTOTYPE — throwaway. Wayfinder ticket "How the bell and Inbox look and behave" (#10).
// In-memory fake Message Ledger so the bell/Inbox variants have something to show.
// Nothing here touches the database; reload resets it.
import { createContext, useContext, useState, type ReactNode } from "react";
import { toast } from "sonner";

export type Message = {
  id: number;
  kind: string;
  title: string;
  body: string;
  href: string;
  createdAt: number; // epoch ms
  read: boolean;
  toast: boolean; // decided at creation from Knock preferences
};

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

type Seed = Omit<Message, "id" | "createdAt" | "read"> & { ago: number; read?: boolean };

const seeds: Record<string, Seed[]> = {
  student: [
    { kind: "lesson-added", title: "New lesson in Advanced TypeScript", body: "\"Conditional types in practice\" was added to Module 3.", href: "/courses", ago: 12 * MIN, toast: true },
    { kind: "reply", title: "Sarah Chen replied to your comment", body: "\"Good question — the generic is inferred from the first argument…\"", href: "/courses", ago: 2 * HOUR, toast: true },
    { kind: "refund-approved", title: "Refund Request approved", body: "Your refund for Intro to React ($49.00) was approved.", href: "/dashboard", ago: 1 * DAY + 3 * HOUR, toast: true, read: true },
    { kind: "purchase", title: "Receipt: Advanced TypeScript", body: "You're enrolled. Paid $79.00.", href: "/dashboard", ago: 4 * DAY, toast: true, read: true },
    { kind: "signup", title: "Welcome to Cadence", body: "Browse courses to get started.", href: "/courses", ago: 30 * DAY, toast: false, read: true },
  ],
  instructor: [
    { kind: "question", title: "New question on \"Generics 101\"", body: "Alex Kim: \"Why does the constraint not narrow here?\"", href: "/instructor/questions", ago: 5 * MIN, toast: true },
    { kind: "enrollment", title: "New Enrollment in Advanced TypeScript", body: "Jordan Lee bought the course.", href: "/instructor", ago: 40 * MIN, toast: true },
    { kind: "enrollment", title: "New Enrollment in Advanced TypeScript", body: "A Seat was claimed by Priya Patel (Acme Team).", href: "/instructor", ago: 3 * HOUR, toast: true },
    { kind: "course-status", title: "Course published by a Platform Admin", body: "\"Advanced TypeScript\" is now Published.", href: "/instructor", ago: 2 * DAY, toast: true, read: true },
  ],
  admin: [
    { kind: "refund-raised", title: "New Refund Request", body: "Jordan Lee asked for a refund on Intro to React ($49.00).", href: "/admin/refunds", ago: 8 * MIN, toast: true },
    { kind: "refund-failed", title: "Refund Failed", body: "Refund for Sam Ortiz (Advanced TypeScript) failed at the gateway.", href: "/admin/refunds", ago: 6 * HOUR, toast: true },
    { kind: "refund-raised", title: "New Refund Request", body: "Sam Ortiz asked for a refund on Advanced TypeScript ($79.00).", href: "/admin/refunds", ago: 1 * DAY, toast: true, read: true },
  ],
};

const arrivals: Record<string, Omit<Seed, "ago">[]> = {
  student: [
    { kind: "lesson-added", title: "New lesson in Advanced TypeScript", body: "\"Mapped types\" was added to Module 4.", href: "/courses", toast: true },
    { kind: "reply", title: "Instructor answered your question", body: "\"Use `satisfies` there instead of a cast.\"", href: "/courses", toast: true },
    { kind: "course-archived", title: "Course archived: Legacy jQuery", body: "You keep access to lessons you've started.", href: "/dashboard", toast: false },
  ],
  instructor: [
    { kind: "question", title: "New question on \"Mapped types\"", body: "Taylor Wu: \"Is `as` remapping supported in 4.0?\"", href: "/instructor/questions", toast: true },
    { kind: "enrollment", title: "New Enrollment in Advanced TypeScript", body: "Morgan Diaz bought the course.", href: "/instructor", toast: false },
  ],
  admin: [
    { kind: "refund-raised", title: "New Refund Request", body: "Casey Bell asked for a refund on Generics 101 ($29.00).", href: "/admin/refunds", toast: true },
  ],
};

function seedFor(role: string): Message[] {
  const now = Date.now();
  return (seeds[role] ?? seeds.student).map((s, i) => ({
    id: i + 1,
    kind: s.kind,
    title: s.title,
    body: s.body,
    href: s.href,
    toast: s.toast,
    createdAt: now - s.ago,
    read: s.read ?? false,
  }));
}

type Store = {
  messages: Message[];
  unreadCount: number;
  markRead: (id: number) => void;
  markUnread: (id: number) => void;
  markAllRead: () => void;
  remove: (id: number) => void;
  simulateArrival: () => void;
  clearAll: () => void;
  reset: () => void;
};

const Ctx = createContext<Store | null>(null);

export function MessageStoreProvider({ role, children }: { role: string; children: ReactNode }) {
  const [messages, setMessages] = useState<Message[]>(() => seedFor(role));
  const [arrivalIdx, setArrivalIdx] = useState(0);

  const store: Store = {
    messages,
    unreadCount: messages.filter((m) => !m.read).length,
    markRead: (id) => setMessages((ms) => ms.map((m) => (m.id === id ? { ...m, read: true } : m))),
    markUnread: (id) => setMessages((ms) => ms.map((m) => (m.id === id ? { ...m, read: false } : m))),
    markAllRead: () => setMessages((ms) => ms.map((m) => ({ ...m, read: true }))),
    remove: (id) => setMessages((ms) => ms.filter((m) => m.id !== id)),
    clearAll: () => setMessages([]),
    reset: () => setMessages(seedFor(role)),
    simulateArrival: () => {
      const pool = arrivals[role] ?? arrivals.student;
      const a = pool[arrivalIdx % pool.length];
      setArrivalIdx((i) => i + 1);
      const msg: Message = { ...a, id: Date.now(), createdAt: Date.now(), read: false };
      setMessages((ms) => [msg, ...ms]);
      // The toast is the in-app Notification; the bell count updates regardless.
      if (msg.toast) toast(msg.title, { description: msg.body });
    },
  };

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useMessages() {
  const s = useContext(Ctx);
  if (!s) throw new Error("useMessages outside MessageStoreProvider");
  return s;
}

export function timeAgo(ts: number) {
  const d = Date.now() - ts;
  if (d < MIN) return "just now";
  if (d < HOUR) return `${Math.floor(d / MIN)}m`;
  if (d < DAY) return `${Math.floor(d / HOUR)}h`;
  if (d < 7 * DAY) return `${Math.floor(d / DAY)}d`;
  return new Date(ts).toLocaleDateString();
}

export function dayBucket(ts: number) {
  const d = Date.now() - ts;
  if (d < DAY) return "Today";
  if (d < 2 * DAY) return "Yesterday";
  if (d < 7 * DAY) return "This week";
  return "Earlier";
}
