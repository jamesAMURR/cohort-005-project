// PROTOTYPE — throwaway. Wayfinder ticket "How the bell and Inbox look and behave" (#10).
// Three structurally different bell + Inbox designs, switched by ?variant= in the app layout.
//   A  Popover:      bell in the sidebar header, numeric badge, dropdown list IS the Inbox.
//   B  Inbox page:   "Inbox" nav item with count, full /inbox page with list + reading pane.
//   C  Top bar:      bell top-right of the main area, dot-only "new since you looked" badge,
//                    right-hand slide-over drawer grouped by day.
import { useState } from "react";
import { NavLink, useNavigate } from "react-router";
import { Popover, Dialog } from "radix-ui";
import { Bell, BellOff, Check, CheckCheck, Inbox as InboxIcon, Trash2, X, ArrowRight, Mail, MailOpen } from "lucide-react";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { useMessages, timeAgo, dayBucket, type Message } from "./store";

export const VARIANTS = ["A", "B", "C"] as const;
export const VARIANT_NAMES: Record<string, string> = {
  A: "Sidebar bell + popover",
  B: "Inbox nav item + full page",
  C: "Top bar bell + drawer",
};

function badgeText(n: number) {
  return n > 9 ? "9+" : String(n);
}

function EmptyState({ compact }: { compact?: boolean }) {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center text-muted-foreground", compact ? "py-10" : "py-24")}>
      <BellOff className="mb-3 size-8 opacity-50" />
      <div className="text-sm font-medium text-foreground">You're all caught up</div>
      <div className="mt-1 max-w-56 text-xs">
        Messages about your courses, purchases and questions will show up here.
      </div>
    </div>
  );
}

function UnreadDot({ show }: { show: boolean }) {
  return <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", show ? "bg-primary" : "bg-transparent")} />;
}

// ───────────────────────────── Variant A ─────────────────────────────
// Bell beside the "Cadence" wordmark. Count badge = unread count.
// Click a Message → mark read + navigate + close. Hover → mark read/unread, delete.
export function VariantABell() {
  const { messages, unreadCount, markRead, markUnread, markAllRead, remove } = useMessages();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button className="relative ml-auto rounded-md p-1.5 text-sidebar-foreground/70 hover:bg-sidebar-accent" title="Inbox">
          <Bell className="size-4" />
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
              {badgeText(unreadCount)}
            </span>
          )}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content side="right" align="start" sideOffset={12} className="z-50 w-96 rounded-lg border bg-popover text-popover-foreground shadow-xl">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="text-sm font-semibold">Inbox</div>
            <button
              disabled={unreadCount === 0}
              onClick={markAllRead}
              className="text-xs text-primary hover:underline disabled:text-muted-foreground disabled:no-underline"
            >
              Mark all as read
            </button>
          </div>
          <div className="max-h-[28rem] overflow-y-auto">
            {messages.length === 0 && <EmptyState compact />}
            {messages.map((m) => (
              <div
                key={m.id}
                className={cn("group relative flex cursor-pointer gap-3 border-b px-4 py-3 last:border-0 hover:bg-accent", !m.read && "bg-primary/5")}
                onClick={() => {
                  markRead(m.id);
                  setOpen(false);
                  navigate(m.href);
                }}
              >
                <UnreadDot show={!m.read} />
                <div className="min-w-0 flex-1">
                  <div className={cn("text-sm", !m.read && "font-semibold")}>{m.title}</div>
                  <div className="line-clamp-2 text-xs text-muted-foreground">{m.body}</div>
                  <div className="mt-1 text-[11px] text-muted-foreground">{timeAgo(m.createdAt)}</div>
                </div>
                <div className="absolute right-2 top-2 hidden gap-1 group-hover:flex">
                  <button
                    title={m.read ? "Mark as unread" : "Mark as read"}
                    className="rounded bg-background p-1 shadow-sm hover:bg-muted"
                    onClick={(e) => {
                      e.stopPropagation();
                      m.read ? markUnread(m.id) : markRead(m.id);
                    }}
                  >
                    {m.read ? <Mail className="size-3.5" /> : <Check className="size-3.5" />}
                  </button>
                  <button
                    title="Delete"
                    className="rounded bg-background p-1 shadow-sm hover:bg-muted"
                    onClick={(e) => {
                      e.stopPropagation();
                      remove(m.id);
                    }}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

// ───────────────────────────── Variant B ─────────────────────────────
// A first-class "Inbox" nav item with a count pill; no popover at all.
export function VariantBNavItem() {
  const { unreadCount } = useMessages();
  return (
    <NavLink
      to="/inbox"
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
          isActive
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        )
      }
    >
      <InboxIcon className="size-4" />
      Inbox
      {unreadCount > 0 && (
        <span className="ml-auto rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground">
          {unreadCount}
        </span>
      )}
    </NavLink>
  );
}

// Full page: list on the left, reading pane on the right. Selecting marks read;
// the reading pane has the "Go to …" link, so clicking never yanks you away.
export function VariantBInboxPage() {
  const { messages, unreadCount, markRead, markUnread, markAllRead, remove } = useMessages();
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const shown = filter === "unread" ? messages.filter((m) => !m.read) : messages;
  const selected = messages.find((m) => m.id === selectedId) ?? null;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-4 border-b px-6 py-4">
        <h1 className="text-xl font-semibold">Inbox</h1>
        <div className="flex rounded-md border p-0.5 text-sm">
          {(["all", "unread"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={cn("rounded px-3 py-1 capitalize", filter === f && "bg-muted font-medium")}>
              {f}
              {f === "unread" && unreadCount > 0 && ` (${unreadCount})`}
            </button>
          ))}
        </div>
        <Button variant="outline" size="sm" className="ml-auto" disabled={unreadCount === 0} onClick={markAllRead}>
          <CheckCheck /> Mark all as read
        </Button>
      </div>
      {messages.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="flex min-h-0 flex-1">
          <ul className="w-96 shrink-0 overflow-y-auto border-r">
            {shown.length === 0 && <li className="p-6 text-sm text-muted-foreground">No unread Messages.</li>}
            {shown.map((m) => (
              <li
                key={m.id}
                onClick={() => {
                  setSelectedId(m.id);
                  markRead(m.id);
                }}
                className={cn("flex cursor-pointer gap-3 border-b px-4 py-3 hover:bg-accent", selectedId === m.id && "bg-accent")}
              >
                <UnreadDot show={!m.read} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <div className={cn("truncate text-sm", !m.read && "font-semibold")}>{m.title}</div>
                    <div className="ml-auto shrink-0 text-[11px] text-muted-foreground">{timeAgo(m.createdAt)}</div>
                  </div>
                  <div className="truncate text-xs text-muted-foreground">{m.body}</div>
                </div>
              </li>
            ))}
          </ul>
          <div className="flex-1 overflow-y-auto p-8">
            {selected ? (
              <div className="max-w-xl">
                <div className="text-xs text-muted-foreground">{new Date(selected.createdAt).toLocaleString()}</div>
                <h2 className="mt-1 text-lg font-semibold">{selected.title}</h2>
                <p className="mt-3 text-sm">{selected.body}</p>
                <div className="mt-6 flex gap-2">
                  <Button asChild size="sm">
                    <NavLink to={selected.href}>
                      Go to it <ArrowRight />
                    </NavLink>
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => markUnread(selected.id)}>
                    <Mail /> Mark as unread
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      remove(selected.id);
                      setSelectedId(null);
                    }}
                  >
                    <Trash2 /> Delete
                  </Button>
                </div>
              </div>
            ) : (
              <div className="pt-20 text-center text-sm text-muted-foreground">Select a Message to read it.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ───────────────────────────── Variant C ─────────────────────────────
// Thin top bar over the main area with the bell top-right.
// Badge is a dot meaning "something new since you last opened the drawer" (seen ≠ read).
// Drawer: Unread/All tabs, grouped by day, click → mark read + navigate + close.
export function VariantCTopBar() {
  const { messages, unreadCount, markRead, markAllRead, remove } = useMessages();
  const [open, setOpen] = useState(false);
  const [lastOpenedAt, setLastOpenedAt] = useState(() => Date.now() - 60 * 60_000);
  const [tab, setTab] = useState<"unread" | "all">("unread");
  const navigate = useNavigate();
  const hasNew = messages.some((m) => !m.read && m.createdAt > lastOpenedAt);
  const shown = tab === "unread" ? messages.filter((m) => !m.read) : messages;

  const groups: [string, Message[]][] = [];
  for (const m of shown) {
    const b = dayBucket(m.createdAt);
    const g = groups.find(([k]) => k === b);
    g ? g[1].push(m) : groups.push([b, [m]]);
  }

  return (
    <div className="sticky top-0 z-20 flex h-14 items-center justify-end border-b bg-background/95 px-6 backdrop-blur">
      <Dialog.Root
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (o) setLastOpenedAt(Date.now());
        }}
      >
        <Dialog.Trigger asChild>
          <button className="relative flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm hover:bg-accent">
            <Bell className="size-4" />
            {unreadCount > 0 ? `${unreadCount} unread` : "Inbox"}
            {hasNew && <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-red-600 ring-2 ring-background" />}
          </button>
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/30" />
          <Dialog.Content className="fixed inset-y-0 right-0 z-50 flex w-[26rem] flex-col border-l bg-background shadow-2xl">
            <div className="flex items-center gap-3 border-b px-5 py-4">
              <Dialog.Title className="text-base font-semibold">Inbox</Dialog.Title>
              <div className="flex gap-1 text-sm">
                {(["unread", "all"] as const).map((t) => (
                  <button key={t} onClick={() => setTab(t)} className={cn("rounded-full px-3 py-0.5 capitalize", tab === t ? "bg-foreground text-background" : "hover:bg-muted")}>
                    {t}
                  </button>
                ))}
              </div>
              <Dialog.Close className="ml-auto rounded p-1 hover:bg-muted">
                <X className="size-4" />
              </Dialog.Close>
            </div>
            <div className="flex-1 overflow-y-auto">
              {messages.length === 0 ? (
                <EmptyState />
              ) : shown.length === 0 ? (
                <div className="flex flex-col items-center py-16 text-sm text-muted-foreground">
                  <MailOpen className="mb-2 size-6" />
                  No unread Messages.
                  <button className="mt-2 text-primary hover:underline" onClick={() => setTab("all")}>
                    Show all
                  </button>
                </div>
              ) : (
                groups.map(([bucket, ms]) => (
                  <div key={bucket}>
                    <div className="sticky top-0 bg-muted/80 px-5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground backdrop-blur">
                      {bucket}
                    </div>
                    {ms.map((m) => (
                      <div key={m.id} className="group flex gap-3 border-b px-5 py-3 hover:bg-accent">
                        <button
                          className="flex min-w-0 flex-1 gap-3 text-left"
                          onClick={() => {
                            markRead(m.id);
                            setOpen(false);
                            navigate(m.href);
                          }}
                        >
                          <UnreadDot show={!m.read} />
                          <div className="min-w-0 flex-1">
                            <div className={cn("text-sm", !m.read && "font-semibold")}>{m.title}</div>
                            <div className="line-clamp-2 text-xs text-muted-foreground">{m.body}</div>
                          </div>
                          <div className="shrink-0 text-[11px] text-muted-foreground">{timeAgo(m.createdAt)}</div>
                        </button>
                        <button title="Delete" className="self-start rounded p-1 opacity-0 hover:bg-muted group-hover:opacity-100" onClick={() => remove(m.id)}>
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                ))
              )}
            </div>
            <div className="border-t px-5 py-3">
              <Button variant="outline" size="sm" className="w-full" disabled={unreadCount === 0} onClick={markAllRead}>
                <CheckCheck /> Mark all as read
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
