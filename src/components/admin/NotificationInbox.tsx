import { useCallback, useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiCall } from "@/lib/store";
import { formatNaira } from "@/lib/catalog";

interface AdminEvent {
  id: string;
  kind: string;
  order_id: string;
  reference: string | null;
  total_kobo: number;
  created_at: number;
  read_at: number | null;
}
const DESCRIBE: Record<string, string> = {
  "order.created": "New order placed",
  "receipt.uploaded": "Payment receipt uploaded — verification required",
  "payment.verified": "Payment verified",
  "payment.late_review": "Late payment recorded for review",
  "receipt.rejected": "Receipt rejected",
  "order.cancelled": "Order cancelled",
  "order.expired": "Order expired (unpaid)",
  "order.processing": "Fulfilment started",
  "order.shipped": "Order shipped",
  "order.delivered": "Order delivered",
};
/** Payment evidence and decisions open the payment review; everything else opens Orders. */
const TAB: Record<string, string> = {
  "receipt.uploaded": "payments",
  "payment.late_review": "payments",
  "receipt.rejected": "payments",
};
const POLL_MS = 20_000;
const when = (s: number) =>
  new Date(s * 1000).toLocaleString("en-NG", {
    timeZone: "Africa/Lagos",
    dateStyle: "medium",
    timeStyle: "short",
  });

/**
 * Store Management notification inbox: unread count, event list and links to the order. Refreshes
 * every 20 seconds while the page is visible. Optional browser alerts need explicit permission and
 * an open Store Management tab; they are NOT background push.
 */
export function NotificationInbox({ onOpen }: { onOpen: (tab: string) => void }) {
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [permission, setPermission] = useState<string>(() =>
    typeof Notification === "undefined" ? "unsupported" : Notification.permission,
  );
  const seen = useRef<Set<string> | null>(null);
  const load = useCallback(async () => {
    try {
      const data = await apiCall<{ unread: number; events: AdminEvent[] }>("/admin/events");
      setEvents(data.events);
      setUnread(data.unread);
      setError("");
      const fresh = seen.current
        ? data.events.filter((e) => !e.read_at && !seen.current!.has(e.id))
        : [];
      seen.current = new Set(data.events.map((e) => e.id));
      // Only events that arrived after the first load, only with permission, minimal content.
      if (
        fresh.length &&
        typeof Notification !== "undefined" &&
        Notification.permission === "granted" &&
        document.visibilityState === "hidden"
      )
        for (const e of fresh.slice(0, 3))
          new Notification(`Afnan: ${DESCRIBE[e.kind] ?? e.kind}`, {
            body: `Order ${e.reference ?? e.order_id}`,
            tag: e.id,
          });
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    void load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible" || permission === "granted") void load();
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [load, permission]);
  const markRead = async (ids?: string[]) => {
    try {
      await apiCall("/admin/events/read", {
        method: "POST",
        body: JSON.stringify(ids ? { ids } : {}),
      });
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <div className="relative" data-notification-inbox>
      <Button
        variant="outline"
        size="sm"
        className="min-h-10 gap-2"
        aria-expanded={open}
        aria-controls="admin-notifications"
        aria-label={`Notifications, ${unread} unread`}
        onClick={() => setOpen((v) => !v)}
      >
        <Bell className="size-4" aria-hidden />
        Notifications
        {unread > 0 && (
          <span
            data-unread-count
            className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground"
          >
            {unread}
          </span>
        )}
      </Button>
      {open && (
        <section
          id="admin-notifications"
          aria-label="Notifications"
          className="absolute right-0 z-40 mt-2 w-[min(24rem,calc(100vw-2rem))] space-y-3 rounded-xl border bg-card p-4 shadow-soft"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-medium">Notifications</h2>
            <div className="flex flex-wrap gap-2">
              {permission === "default" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => setPermission(await Notification.requestPermission())}
                >
                  Enable browser alerts
                </Button>
              )}
              {unread > 0 && (
                <Button variant="outline" size="sm" onClick={() => void markRead()}>
                  Mark all read
                </Button>
              )}
            </div>
          </div>
          {permission === "granted" && (
            <p className="text-xs text-muted-foreground">
              Browser alerts are on while Store Management is open in this browser.
            </p>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          {!events.length ? (
            <p className="text-sm text-muted-foreground">No notifications yet.</p>
          ) : (
            <ul className="max-h-80 divide-y overflow-y-auto text-sm">
              {events.map((e) => (
                <li key={e.id} className="py-2" data-event={e.kind}>
                  <button
                    type="button"
                    className="w-full text-left"
                    onClick={() => {
                      if (!e.read_at) void markRead([e.id]);
                      setOpen(false);
                      onOpen(TAB[e.kind] ?? "orders");
                    }}
                  >
                    <span className={e.read_at ? "" : "font-semibold"}>
                      {DESCRIBE[e.kind] ?? e.kind}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      Order {e.reference ?? e.order_id} · {formatNaira(e.total_kobo)} ·{" "}
                      {when(e.created_at)}
                      {!e.read_at && " · unread"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
