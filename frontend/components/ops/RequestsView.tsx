'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  ApiError,
  listAvailabilityRequests,
  resolveAvailabilityRequest,
  RiderAvailabilityRequest,
  listUnlockRequests,
  resolveUnlockRequest,
  RiderUnlockRequest,
  listSupportTicketsStaff,
  getSupportTicketStaff,
  replySupportTicketStaff,
  updateSupportTicketStatus,
  StaffSupportTicket,
} from '@/lib/api';
import { Card, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Check, X, RefreshCw, Loader2, Send, Inbox } from 'lucide-react';

function formatDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

function statusBadge(status: string) {
  switch (status) {
    case 'pending':
    case 'open':
      return <Badge variant="warning" className="capitalize">{status}</Badge>;
    case 'approved':
    case 'resolved':
      return <Badge variant="success" className="capitalize">{status}</Badge>;
    case 'rejected':
      return <Badge variant="danger" className="capitalize">{status}</Badge>;
    case 'in_progress':
      return <Badge variant="info">In progress</Badge>;
    case 'closed':
      return <Badge variant="secondary">Closed</Badge>;
    default:
      return <Badge variant="outline" className="capitalize">{status}</Badge>;
  }
}

function StatusFilter({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[160px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o} value={o} className="capitalize">{o === 'all' ? 'All statuses' : o.replace('_', ' ')}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ============================================================
// TAB: AVAILABILITY REQUESTS
// ============================================================

function AvailabilityRequestsTab({ token }: { token: string | null }) {
  const [items, setItems] = useState<RiderAvailabilityRequest[]>([]);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionTarget, setActionTarget] = useState<{ req: RiderAvailabilityRequest; approve: boolean } | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => {
    if (!token) return;
    setLoading(true);
    listAvailabilityRequests(token, statusFilter)
      .then(setItems)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Failed to load requests'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [token, statusFilter]);

  const submit = async () => {
    if (!token || !actionTarget) return;
    setBusy(true);
    setError('');
    try {
      await resolveAvailabilityRequest(actionTarget.req.id, actionTarget.approve, note || undefined, token);
      setActionTarget(null);
      setNote('');
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to resolve request');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <StatusFilter value={statusFilter} onChange={setStatusFilter} options={['pending', 'approved', 'rejected', 'all']} />
        <Button variant="outline" size="sm" onClick={load}><RefreshCw className="w-3.5 h-3.5" /> Refresh</Button>
      </div>
      {error && <div className="rounded-lg border border-destructive/30 bg-[#FBE9E5] px-3 py-2 text-xs text-destructive">{error}</div>}
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30">
            <TableHead>Rider</TableHead><TableHead>Requesting</TableHead><TableHead>Note</TableHead><TableHead>Submitted</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-6">Loading…</TableCell></TableRow>
          ) : items.length === 0 ? (
            <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-6">No requests</TableCell></TableRow>
          ) : items.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="font-medium">{r.rider_name || r.rider_id}</TableCell>
              <TableCell>{r.requested_is_available ? <Badge variant="success">Go online</Badge> : <Badge variant="secondary">Go offline</Badge>}</TableCell>
              <TableCell className="text-muted-foreground max-w-[220px] truncate">{r.note || '—'}</TableCell>
              <TableCell className="text-muted-foreground whitespace-nowrap">{formatDate(r.created_at)}</TableCell>
              <TableCell>{statusBadge(r.status)}</TableCell>
              <TableCell className="text-right">
                {r.status === 'pending' ? (
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="success" onClick={() => setActionTarget({ req: r, approve: true })}><Check className="w-3.5 h-3.5" /></Button>
                    <Button size="sm" variant="danger" onClick={() => setActionTarget({ req: r, approve: false })}><X className="w-3.5 h-3.5" /></Button>
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">{r.resolution_note || '—'}</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={!!actionTarget} onOpenChange={(open) => !open && setActionTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{actionTarget?.approve ? 'Approve' : 'Reject'} availability request</DialogTitle>
            <DialogDescription>
              {actionTarget?.req.rider_name || 'This rider'} wants to go {actionTarget?.req.requested_is_available ? 'online' : 'offline'}.
            </DialogDescription>
          </DialogHeader>
          <Textarea placeholder="Optional note…" value={note} onChange={(e) => setNote(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionTarget(null)} disabled={busy}>Cancel</Button>
            <Button variant={actionTarget?.approve ? 'success' : 'danger'} onClick={submit} disabled={busy}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : actionTarget?.approve ? 'Approve' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================
// TAB: PARCEL UNLOCK REQUESTS
// ============================================================

function UnlockRequestsTab({ token }: { token: string | null }) {
  const [items, setItems] = useState<RiderUnlockRequest[]>([]);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionTarget, setActionTarget] = useState<{ req: RiderUnlockRequest; approve: boolean } | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => {
    if (!token) return;
    setLoading(true);
    listUnlockRequests(token, statusFilter)
      .then(setItems)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Failed to load requests'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [token, statusFilter]);

  const submit = async () => {
    if (!token || !actionTarget) return;
    setBusy(true);
    setError('');
    try {
      await resolveUnlockRequest(actionTarget.req.id, actionTarget.approve, note || undefined, token);
      setActionTarget(null);
      setNote('');
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to resolve request');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <StatusFilter value={statusFilter} onChange={setStatusFilter} options={['pending', 'approved', 'rejected', 'all']} />
        <Button variant="outline" size="sm" onClick={load}><RefreshCw className="w-3.5 h-3.5" /> Refresh</Button>
      </div>
      {error && <div className="rounded-lg border border-destructive/30 bg-[#FBE9E5] px-3 py-2 text-xs text-destructive">{error}</div>}
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30">
            <TableHead>Rider</TableHead><TableHead>Tracking #</TableHead><TableHead>Reason</TableHead><TableHead>Submitted</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-6">Loading…</TableCell></TableRow>
          ) : items.length === 0 ? (
            <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-6">No requests</TableCell></TableRow>
          ) : items.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="font-medium">{r.rider_name || r.rider_id}</TableCell>
              <TableCell className="font-mono text-xs">{r.tracking_number || '—'}</TableCell>
              <TableCell className="text-muted-foreground max-w-[220px] truncate">{r.reason || '—'}</TableCell>
              <TableCell className="text-muted-foreground whitespace-nowrap">{formatDate(r.created_at)}</TableCell>
              <TableCell>{statusBadge(r.status)}</TableCell>
              <TableCell className="text-right">
                {r.status === 'pending' ? (
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="success" onClick={() => setActionTarget({ req: r, approve: true })}><Check className="w-3.5 h-3.5" /></Button>
                    <Button size="sm" variant="danger" onClick={() => setActionTarget({ req: r, approve: false })}><X className="w-3.5 h-3.5" /></Button>
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">{r.resolution_note || '—'}</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={!!actionTarget} onOpenChange={(open) => !open && setActionTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{actionTarget?.approve ? 'Approve' : 'Reject'} unlock request</DialogTitle>
            <DialogDescription>
              {actionTarget?.approve
                ? `Approving releases ${actionTarget?.req.tracking_number || 'this parcel'} back to the unassigned pool.`
                : `${actionTarget?.req.rider_name || 'This rider'} stays assigned to ${actionTarget?.req.tracking_number || 'this parcel'}.`}
            </DialogDescription>
          </DialogHeader>
          <Textarea placeholder="Optional note…" value={note} onChange={(e) => setNote(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionTarget(null)} disabled={busy}>Cancel</Button>
            <Button variant={actionTarget?.approve ? 'success' : 'danger'} onClick={submit} disabled={busy}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : actionTarget?.approve ? 'Approve' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================
// TAB: SUPPORT TICKETS
// ============================================================

function SupportTicketsTab({ token }: { token: string | null }) {
  const [items, setItems] = useState<StaffSupportTicket[]>([]);
  const [statusFilter, setStatusFilter] = useState('open');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<StaffSupportTicket | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => {
    if (!token) return;
    setLoading(true);
    listSupportTicketsStaff(token, statusFilter)
      .then((rows) => {
        setItems(rows);
        if (selectedId && !rows.some((r) => r.id === selectedId)) setSelectedId(null);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Failed to load tickets'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [token, statusFilter]);

  useEffect(() => {
    if (!token || !selectedId) { setDetail(null); return; }
    setDetailLoading(true);
    getSupportTicketStaff(selectedId, token)
      .then(setDetail)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Failed to load ticket'))
      .finally(() => setDetailLoading(false));
  }, [token, selectedId]);

  const sendReply = async () => {
    if (!token || !detail || !reply.trim()) return;
    setBusy(true);
    setError('');
    try {
      const updated = await replySupportTicketStaff(detail.id, reply.trim(), token);
      setDetail(updated);
      setReply('');
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to send reply');
    } finally {
      setBusy(false);
    }
  };

  const setStatus = async (status: string) => {
    if (!token || !detail) return;
    setBusy(true);
    setError('');
    try {
      const updated = await updateSupportTicketStatus(detail.id, status, token);
      setDetail(updated);
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to update status');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <StatusFilter value={statusFilter} onChange={setStatusFilter} options={['open', 'in_progress', 'resolved', 'closed', 'all']} />
        <Button variant="outline" size="sm" onClick={load}><RefreshCw className="w-3.5 h-3.5" /> Refresh</Button>
      </div>
      {error && <div className="rounded-lg border border-destructive/30 bg-[#FBE9E5] px-3 py-2 text-xs text-destructive">{error}</div>}

      <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead>Subject</TableHead><TableHead>Raised by</TableHead><TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={3} className="text-center text-sm text-muted-foreground py-6">Loading…</TableCell></TableRow>
              ) : items.length === 0 ? (
                <TableRow><TableCell colSpan={3} className="text-center text-sm text-muted-foreground py-6">No tickets</TableCell></TableRow>
              ) : items.map((t) => (
                <TableRow
                  key={t.id}
                  onClick={() => setSelectedId(t.id)}
                  className={`cursor-pointer ${selectedId === t.id ? 'bg-muted/50' : ''}`}
                >
                  <TableCell className="font-medium max-w-[200px] truncate">{t.subject}</TableCell>
                  <TableCell className="text-muted-foreground">{t.raised_by_name || '—'}</TableCell>
                  <TableCell>{statusBadge(t.status)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <Card className="p-4">
          {!detail ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-muted-foreground">
              <Inbox className="w-8 h-8 opacity-40" />
              <p className="text-sm">{detailLoading ? 'Loading ticket…' : 'Select a ticket to view the conversation'}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="font-semibold text-ink">{detail.subject}</h4>
                  <p className="text-xs text-muted-foreground">
                    {detail.raised_by_name || 'Rider'} · {formatDate(detail.created_at)}
                    {detail.tracking_number && <> · <span className="font-mono">{detail.tracking_number}</span></>}
                  </p>
                </div>
                {statusBadge(detail.status)}
              </div>

              <Separator />

              <ScrollArea className="h-[240px] pr-2">
                <div className="flex flex-col gap-3">
                  {detail.messages.map((m) => (
                    <div key={m.id} className="rounded-lg bg-muted/40 px-3 py-2">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <span className="text-xs font-semibold text-ink">{m.sender_name || 'Unknown'}</span>
                        <span className="text-[0.65rem] text-muted-foreground">{formatDate(m.created_at)}</span>
                      </div>
                      <p className="text-sm text-ink whitespace-pre-wrap">{m.body}</p>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              <div className="flex gap-2">
                <Textarea
                  placeholder="Reply to rider…"
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  className="min-h-[40px]"
                />
                <Button variant="navy" size="icon" onClick={sendReply} disabled={busy || !reply.trim()}>
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                {detail.status !== 'resolved' && (
                  <Button size="sm" variant="success" onClick={() => setStatus('resolved')} disabled={busy}>Mark resolved</Button>
                )}
                {detail.status !== 'closed' && (
                  <Button size="sm" variant="secondary" onClick={() => setStatus('closed')} disabled={busy}>Close ticket</Button>
                )}
                {(detail.status === 'resolved' || detail.status === 'closed') && (
                  <Button size="sm" variant="outline" onClick={() => setStatus('open')} disabled={busy}>Reopen</Button>
                )}
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

// ============================================================
// VIEW: REQUESTS (entry point)
// ============================================================

export function RequestsView() {
  const { token } = useAuth();
  const [tab, setTab] = useState('availability');

  return (
    <Card className="p-5">
      <div className="mb-4">
        <CardTitle className="text-base">Rider Requests</CardTitle>
        <CardDescription>Availability changes, parcel unlocks and support tickets raised by riders</CardDescription>
      </div>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="availability">Availability</TabsTrigger>
          <TabsTrigger value="unlock">Parcel Unlocks</TabsTrigger>
          <TabsTrigger value="support">Support Tickets</TabsTrigger>
        </TabsList>
        <TabsContent value="availability"><AvailabilityRequestsTab token={token} /></TabsContent>
        <TabsContent value="unlock"><UnlockRequestsTab token={token} /></TabsContent>
        <TabsContent value="support"><SupportTicketsTab token={token} /></TabsContent>
      </Tabs>
    </Card>
  );
}
