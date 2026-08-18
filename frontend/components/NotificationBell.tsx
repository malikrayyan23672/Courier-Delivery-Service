'use client';

import { useCallback, useEffect, useState } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  listMyNotifications, markNotificationRead, readAllNotifications,
  NotificationItem,
} from '@/lib/api';

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

/**
 * Reusable notification bell. Pulls the signed-in user's notifications from
 * the shared /notifications endpoint so every panel (admin, hub, seller)
 * shows real data instead of mock alerts.
 */
export function NotificationBell({ token, className }: { token: string; className?: string }) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);

  const load = useCallback(() => {
    if (!token) return;
    listMyNotifications(token)
      .then((d) => { setNotifications(d.notifications); setUnread(d.unread); })
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    load();
    const timer = setInterval(load, 60000);
    return () => clearInterval(timer);
  }, [load]);

  async function markRead(id: string) {
    try { await markNotificationRead(id, token); } catch { /* ignore */ }
    load();
  }

  async function markAll() {
    try { await readAllNotifications(token); } catch { /* ignore */ }
    load();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className={cn('relative', className)}>
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[0.6rem] font-bold text-white ring-2 ring-background">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between pr-2">
          <DropdownMenuLabel>Notifications</DropdownMenuLabel>
          {unread > 0 && (
            <button
              onClick={markAll}
              className="flex items-center gap-1 text-[0.7rem] font-semibold text-primary hover:underline"
            >
              <CheckCheck className="h-3 w-3" /> Mark all read
            </button>
          )}
        </div>
        <DropdownMenuSeparator />
        <ScrollArea className="h-80">
          {notifications.length === 0 ? (
            <div className="px-2 py-8 text-center text-sm text-muted-foreground">
              You are all caught up.
            </div>
          ) : (
            notifications.map((n) => (
              <DropdownMenuItem
                key={n.id}
                onClick={() => !n.is_read && markRead(n.id)}
                className={cn('items-start gap-2.5 py-2.5', !n.is_read && 'bg-muted/60')}
              >
                <span
                  className={cn(
                    'mt-1 h-2 w-2 shrink-0 rounded-full',
                    n.is_read ? 'bg-muted-foreground/30' : 'bg-primary'
                  )}
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className={cn('text-sm', n.is_read ? 'text-muted-foreground' : 'font-semibold text-ink')}>
                      {n.title}
                    </span>
                    <span className="shrink-0 text-[0.65rem] text-muted-foreground">{relativeTime(n.created_at)}</span>
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{n.message}</span>
                </span>
              </DropdownMenuItem>
            ))
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}