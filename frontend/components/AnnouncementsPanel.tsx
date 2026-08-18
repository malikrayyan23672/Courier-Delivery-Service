'use client';

import { useCallback, useEffect, useState } from 'react';
import { BellPlus, Megaphone, Send, Trash2, Power } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import {
  listVisibleAnnouncements, listAdminAnnouncements, createAnnouncement,
  toggleAnnouncement, deleteAnnouncement, sendNotification,
  listBranches, Branch, AnnouncementItem, ApiError,
} from '@/lib/api';

const TARGET_ROLES = ['staff', 'rider', 'manager', 'finance', 'business', 'customer'];

function timeAgo(iso: string | null): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${Math.max(mins, 1)}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/**
 * Shared announcements + broadcast panel. Renders the live announcement
 * feed for the current user, and (when `admin` mode is on) the "send
 * notification" composer and announcement manager used by admins and
 * branch managers.
 */
export function AnnouncementsPanel({ token, admin = false, className }: {
  token: string;
  admin?: boolean;
  className?: string;
}) {
  const [visible, setVisible] = useState<AnnouncementItem[]>([]);
  const [all, setAll] = useState<AnnouncementItem[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // broadcast form
  const [nTitle, setNTitle] = useState('');
  const [nMessage, setNMessage] = useState('');
  const [nTarget, setNTarget] = useState<'all' | 'role' | 'branch'>('all');
  const [nRole, setNRole] = useState('staff');
  const [nBranch, setNBranch] = useState('');
  const [sending, setSending] = useState(false);

  // announcement form
  const [aTitle, setATitle] = useState('');
  const [aBody, setABody] = useState('');
  const [aBranch, setABranch] = useState('');
  const [posting, setPosting] = useState(false);

  const load = useCallback(() => {
    if (!token) return;
    listVisibleAnnouncements(token).then(setVisible).catch(() => {});
    if (admin) {
      listAdminAnnouncements(token).then(setAll).catch(() => {});
      listBranches(token).then(setBranches).catch(() => {});
    }
  }, [token, admin]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSend() {
    if (!nTitle.trim() || !nMessage.trim()) return;
    setSending(true); setError(''); setSuccess('');
    try {
      const target =
        nTarget === 'role' ? { scope: 'role', role: nRole } :
        nTarget === 'branch' ? { scope: 'branch', branch_id: nBranch } :
        { scope: 'all' };
      const res = await sendNotification({ title: nTitle.trim(), message: nMessage.trim(), type: 'info', target }, token);
      setSuccess(res.message);
      setNTitle(''); setNMessage('');
    } catch (e) {
      setError(e instanceof ApiError ? String(e.message) : 'Failed to send');
    } finally {
      setSending(false);
    }
  }

  async function handlePost() {
    if (!aTitle.trim() || !aBody.trim()) return;
    setPosting(true); setError(''); setSuccess('');
    try {
      await createAnnouncement({ title: aTitle.trim(), body: aBody.trim(), branch_id: aBranch || null }, token);
      setSuccess('Announcement published');
      setATitle(''); setABody(''); setABranch('');
      load();
    } catch (e) {
      setError(e instanceof ApiError ? String(e.message) : 'Failed to post');
    } finally {
      setPosting(false);
    }
  }

  async function handleToggle(a: AnnouncementItem) {
    try { await toggleAnnouncement(a.id, { is_active: !a.is_active }, token); load(); } catch { /* ignore */ }
  }

  async function handleDelete(id: string) {
    try { await deleteAnnouncement(id, token); load(); } catch { /* ignore */ }
  }

  return (
    <div className={cn('space-y-6', className)}>
      {(error || success) && (
        <div className={cn('rounded-lg px-3 py-2 text-sm', error ? 'bg-destructive/10 text-destructive' : 'bg-success/10 text-success')}>
          {error || success}
        </div>
      )}

      {admin && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="h-4 w-4" /> Send notification
            </CardTitle>
            <CardDescription>Broadcast a notification to users, a role, a branch, or the whole network</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Title</Label>
                <Input value={nTitle} onChange={(e) => setNTitle(e.target.value)} placeholder="e.g. Dispatch schedule update" />
              </div>
              <div className="space-y-1.5">
                <Label>Target</Label>
                <Select value={nTarget} onValueChange={(v) => setNTarget(v as 'all' | 'role' | 'branch')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Entire network</SelectItem>
                    <SelectItem value="role">Everyone with a role</SelectItem>
                    <SelectItem value="branch">Everyone at a branch</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {nTarget === 'role' && (
              <div className="space-y-1.5">
                <Label>Role</Label>
                <Select value={nRole} onValueChange={setNRole}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TARGET_ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {nTarget === 'branch' && (
              <div className="space-y-1.5">
                <Label>Branch</Label>
                <Select value={nBranch} onValueChange={setNBranch}>
                  <SelectTrigger><SelectValue placeholder="Choose a branch" /></SelectTrigger>
                  <SelectContent>
                    {branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Message</Label>
              <Textarea value={nMessage} onChange={(e) => setNMessage(e.target.value)} placeholder="What should recipients know?" rows={3} />
            </div>
            <Button onClick={handleSend} disabled={sending || !nTitle.trim() || !nMessage.trim() || (nTarget === 'branch' && !nBranch)}>
              <Send className="mr-1.5 h-4 w-4" /> {sending ? 'Sending…' : 'Send notification'}
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Megaphone className="h-4 w-4" /> Announcements
          </CardTitle>
          <CardDescription>Network-wide and branch announcements</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {admin && (
            <div className="space-y-3 rounded-lg border border-border p-4">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-1.5">
                  <Label>Title</Label>
                  <Input value={aTitle} onChange={(e) => setATitle(e.target.value)} placeholder="Announcement title" />
                </div>
                <div className="space-y-1.5">
                  <Label>Branch (optional)</Label>
                  <Select value={aBranch} onValueChange={setABranch}>
                    <SelectTrigger><SelectValue placeholder="All branches" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all">All branches</SelectItem>
                      {branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>&nbsp;</Label>
                  <Button onClick={handlePost} disabled={posting || !aTitle.trim() || !aBody.trim()} className="w-full">
                    <BellPlus className="mr-1.5 h-4 w-4" /> {posting ? 'Posting…' : 'Publish'}
                  </Button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Body</Label>
                <Textarea value={aBody} onChange={(e) => setABody(e.target.value)} placeholder="Full announcement text" rows={2} />
              </div>
            </div>
          )}

          <ScrollArea className="max-h-80">
            <div className="space-y-2.5">
              {(admin ? all : visible).map((a) => (
                <div key={a.id} className="flex items-start justify-between gap-3 rounded-lg border border-border px-3.5 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-ink">{a.title}</span>
                      {a.branch_name && <Badge variant="secondary">{a.branch_name}</Badge>}
                      {a.created_by && <span className="text-[0.7rem] text-muted-foreground">by {a.created_by}</span>}
                      <span className="text-[0.7rem] text-muted-foreground">{timeAgo(a.created_at)}</span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{a.body}</p>
                  </div>
                  {admin && (
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        variant="ghost" size="icon" className="h-8 w-8"
                        title={a.is_active ? 'Deactivate' : 'Activate'}
                        onClick={() => handleToggle(a)}
                      >
                        <Power className={cn('h-4 w-4', a.is_active ? 'text-success' : 'text-muted-foreground')} />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" title="Delete" onClick={() => handleDelete(a.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
              {visible.length === 0 && (admin ? all : visible).length === 0 && (
                <div className="py-6 text-center text-sm text-muted-foreground">No announcements yet.</div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}