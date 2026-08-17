'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { AdminPageShell } from '@/components/admin/AdminPageShell';
import {
  ApiError, AdminUser, AdminSeller, Zone, Branch, AdminCreateUserPayload,
  listStaffAndRiders, createStaffOrRider, deleteUserbyAdmin, setUserActiveStatus, editUser,
  listZones, listBranches, listSellersAdmin, approveSeller, rejectSeller, deactivateSeller, activateSeller,
} from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { UserPlus, Search } from 'lucide-react';

type SubTab = 'team' | 'sellers';

export default function AdminUsersPage() {
  const { token } = useAuth();
  const [subTab, setSubTab] = useState<SubTab>('team');

  return (
    <AdminPageShell
      title="Users & Sellers"
      description="Create, edit and deactivate accounts across the network. Approve or suspend seller businesses."
      activeHref="/admin/users"
    >
      <div className="mb-5 flex w-fit gap-1 rounded-xl bg-muted p-1">
        <button
          onClick={() => setSubTab('team')}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${subTab === 'team' ? 'bg-card text-ink shadow-sm' : 'text-muted-foreground'}`}
        >
          Team Accounts
        </button>
        <button
          onClick={() => setSubTab('sellers')}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${subTab === 'sellers' ? 'bg-card text-ink shadow-sm' : 'text-muted-foreground'}`}
        >
          Seller Approval
        </button>
      </div>

      {subTab === 'team' ? <TeamAccountsSection token={token!} /> : <SellerApprovalSection token={token!} />}
    </AdminPageShell>
  );
}

// ============================================================
// TEAM ACCOUNTS - create / edit / deactivate
// ============================================================

interface FormState {
  full_name: string; email: string; phone: string; cnic: string; password: string;
  role: 'staff' | 'rider' | 'admin' | 'customer';
  designation: string; zone_id: string; branch_id: string;
}
const INITIAL_FORM: FormState = { full_name: '', email: '', phone: '', cnic: '', password: '', role: 'staff', designation: '', zone_id: '', branch_id: '' };

function TeamAccountsSection({ token }: { token: string }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');

  function load() {
    setLoading(true);
    Promise.all([listStaffAndRiders(token), listZones(token), listBranches(token)])
      .then(([u, z, b]) => { setUsers(u); setZones(z); setBranches(b); })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load team.'))
      .finally(() => setLoading(false));
  }

  useEffect(load, [token]);

  const filteredBranches = branches.filter((b) => b.zone_id === form.zone_id);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => [u.full_name, u.email, u.phone].filter(Boolean).join(' ').toLowerCase().includes(q));
  }, [users, search]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const payload: AdminCreateUserPayload = { ...form };
      const created = await createStaffOrRider(payload, token);
      setUsers((prev) => [created, ...prev]);
      setShowForm(false);
      setForm(INITIAL_FORM);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create account.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleActive(u: AdminUser) {
    try {
      await setUserActiveStatus(u.id, !u.is_active, token);
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, is_active: !x.is_active } : x)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update account status.');
    }
  }

  function openEdit(u: AdminUser) {
    setEditingUser(u);
    setEditName(u.full_name);
    setEditPhone(u.phone);
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingUser) return;
    try {
      await editUser(editingUser.id, { full_name: editName, phone: editPhone }, token);
      setUsers((prev) => prev.map((x) => (x.id === editingUser.id ? { ...x, full_name: editName, phone: editPhone } : x)));
      setEditingUser(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save changes.');
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Permanently delete this user? This cannot be undone.')) return;
    try {
      await deleteUserbyAdmin(id, token);
      setUsers((prev) => prev.filter((u) => u.id !== id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not delete user.');
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email, phone…"
            className="h-9 w-full rounded-lg border border-input bg-card pl-9 pr-3 text-sm outline-none focus:border-ring" />
        </div>
        <Button onClick={() => setShowForm((s) => !s)}>
          <UserPlus className="mr-1.5 h-4 w-4" /> {showForm ? 'Cancel' : 'New Account'}
        </Button>
      </div>

      {error && <div className="rounded-lg border border-destructive/30 bg-[#FBE9E5] px-4 py-3 text-sm text-destructive">{error}</div>}

      {showForm && (
        <Card>
          <CardHeader><CardTitle>New team member</CardTitle><CardDescription>Create a staff, rider or admin account (skips OTP - admin vouches directly)</CardDescription></CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="grid gap-4 md:grid-cols-2">
              <TextField label="Full name" required value={form.full_name} onChange={(v) => setForm((f) => ({ ...f, full_name: v }))} />
              <TextField label="Email" type="email" required value={form.email} onChange={(v) => setForm((f) => ({ ...f, email: v }))} />
              <TextField label="Phone" required value={form.phone} onChange={(v) => setForm((f) => ({ ...f, phone: v }))} />
              <TextField label="CNIC" required value={form.cnic} onChange={(v) => setForm((f) => ({ ...f, cnic: v }))} />
              <TextField label="Temporary password" type="password" required value={form.password} onChange={(v) => setForm((f) => ({ ...f, password: v }))} />
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-ink">Role</label>
                <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as FormState['role'], zone_id: '', branch_id: '' }))}
                  className="h-11 w-full rounded-lg border-[1.5px] border-input bg-[#FBFCFE] px-3 text-sm outline-none focus:border-ring">
                  <option value="staff">Staff</option>
                  <option value="rider">Rider</option>
                  <option value="admin">Admin</option>
                  <option value="customer">Customer</option>
                </select>
              </div>
              {(form.role === 'staff' || form.role === 'rider') && (
                <>
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-ink">Zone</label>
                    <select value={form.zone_id} onChange={(e) => setForm((f) => ({ ...f, zone_id: e.target.value, branch_id: '' }))}
                      className="h-11 w-full rounded-lg border-[1.5px] border-input bg-[#FBFCFE] px-3 text-sm outline-none focus:border-ring">
                      <option value="">Select zone</option>
                      {zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-ink">Branch</label>
                    <select value={form.branch_id} onChange={(e) => setForm((f) => ({ ...f, branch_id: e.target.value }))}
                      className="h-11 w-full rounded-lg border-[1.5px] border-input bg-[#FBFCFE] px-3 text-sm outline-none focus:border-ring">
                      <option value="">Select branch</option>
                      {filteredBranches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>
                </>
              )}
              {form.role === 'staff' && (
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-ink">Designation</label>
                  <select value={form.designation} onChange={(e) => setForm((f) => ({ ...f, designation: e.target.value }))}
                    className="h-11 w-full rounded-lg border-[1.5px] border-input bg-[#FBFCFE] px-3 text-sm outline-none focus:border-ring">
                    <option value="">Select designation</option>
                    <option value="manager">Manager</option>
                    <option value="operator">Operator</option>
                  </select>
                </div>
              )}
              <div className="md:col-span-2">
                <Button type="submit" variant="navy" disabled={submitting}>{submitting ? 'Creating…' : 'Create Account'}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {editingUser && (
        <Card>
          <CardHeader><CardTitle>Edit {editingUser.full_name}</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleSaveEdit} className="grid gap-4 md:grid-cols-2">
              <TextField label="Full name" required value={editName} onChange={setEditName} />
              <TextField label="Phone" required value={editPhone} onChange={setEditPhone} />
              <div className="flex gap-2 md:col-span-2">
                <Button type="submit">Save changes</Button>
                <Button type="button" variant="ghost" onClick={() => setEditingUser(null)}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>All accounts</CardTitle><CardDescription>{filtered.length} of {users.length} shown</CardDescription></CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex flex-col gap-2 p-6"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
          ) : filtered.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No accounts match.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Phone</TableHead>
                  <TableHead>Role</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-semibold text-ink">{u.full_name}</TableCell>
                    <TableCell className="text-muted-foreground">{u.email}</TableCell>
                    <TableCell className="text-muted-foreground">{u.phone}</TableCell>
                    <TableCell><Badge variant="info" className="capitalize">{u.role.replace('_', ' ')}</Badge></TableCell>
                    <TableCell>
                      <Badge variant={u.is_active ? 'success' : 'secondary'}>{u.is_active ? 'Active' : 'Deactivated'}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(u)}>Edit</Button>
                        <Button variant="ghost" size="sm" onClick={() => handleToggleActive(u)}>
                          {u.is_active ? 'Deactivate' : 'Activate'}
                        </Button>
                        <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDelete(u.id)}>Delete</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function TextField({ label, value, onChange, type = 'text', required }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-semibold text-ink">{label}</label>
      <input type={type} required={required} value={value} onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full rounded-lg border-[1.5px] border-input bg-[#FBFCFE] px-3 text-sm outline-none focus:border-ring" />
    </div>
  );
}

// ============================================================
// SELLER APPROVAL WORKFLOW
// ============================================================

function SellerApprovalSection({ token }: { token: string }) {
  const [sellers, setSellers] = useState<AdminSeller[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('pending');

  function load() {
    setLoading(true);
    listSellersAdmin(token)
      .then(setSellers)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load sellers.'))
      .finally(() => setLoading(false));
  }

  useEffect(load, [token]);

  async function runAction(businessId: string, action: (id: string, t: string) => Promise<any>) {
    setBusyId(businessId);
    setError('');
    try {
      const updated = await action(businessId, token);
      setSellers((prev) => prev.map((s) => (s.business_id === businessId ? { ...s, status: updated.status, is_active: updated.is_active } : s)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update seller.');
    } finally {
      setBusyId(null);
    }
  }

  const statuses = ['all', 'pending', 'active', 'rejected', 'suspended'];
  const filtered = statusFilter === 'all' ? sellers : sellers.filter((s) => s.status === statusFilter);
  const pendingCount = sellers.filter((s) => s.status === 'pending').length;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card><CardContent className="p-4"><div className="text-2xl font-bold text-ink">{sellers.length}</div><div className="text-xs font-semibold text-muted-foreground">Total sellers</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-2xl font-bold text-orange">{pendingCount}</div><div className="text-xs font-semibold text-muted-foreground">Pending approval</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-2xl font-bold text-success">{sellers.filter((s) => s.status === 'active').length}</div><div className="text-xs font-semibold text-muted-foreground">Active</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-2xl font-bold text-danger">{sellers.filter((s) => s.status === 'suspended' || s.status === 'rejected').length}</div><div className="text-xs font-semibold text-muted-foreground">Suspended / rejected</div></CardContent></Card>
      </div>

      {error && <div className="rounded-lg border border-destructive/30 bg-[#FBE9E5] px-4 py-3 text-sm text-destructive">{error}</div>}

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div><CardTitle>Sellers</CardTitle><CardDescription>{filtered.length} shown</CardDescription></div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 rounded-md border border-input bg-card px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
            {statuses.map((s) => <option key={s} value={s}>{s === 'all' ? 'Any status' : s[0].toUpperCase() + s.slice(1)}</option>)}
          </select>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex flex-col gap-2 p-6"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
          ) : filtered.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No sellers in this status.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Business</TableHead><TableHead>Owner</TableHead><TableHead>Contact</TableHead>
                  <TableHead>City</TableHead><TableHead>Orders</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((s) => (
                  <TableRow key={s.business_id}>
                    <TableCell className="font-semibold text-ink">{s.company_name}</TableCell>
                    <TableCell className="text-muted-foreground">{s.owner_name || '—'}</TableCell>
                    <TableCell className="text-muted-foreground">
                      <div>{s.phone}</div><div className="text-xs">{s.email}</div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{s.city}</TableCell>
                    <TableCell className="text-ink">{s.total_orders}</TableCell>
                    <TableCell>
                      <Badge variant={s.status === 'active' ? 'success' : s.status === 'pending' ? 'warning' : 'danger'} className="capitalize">
                        {s.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {s.status === 'pending' && (
                          <>
                            <Button size="sm" disabled={busyId === s.business_id} onClick={() => runAction(s.business_id, approveSeller)}>Approve</Button>
                            <Button size="sm" variant="ghost" className="text-destructive" disabled={busyId === s.business_id} onClick={() => runAction(s.business_id, rejectSeller)}>Reject</Button>
                          </>
                        )}
                        {s.status === 'active' && (
                          <Button size="sm" variant="ghost" className="text-destructive" disabled={busyId === s.business_id} onClick={() => runAction(s.business_id, deactivateSeller)}>Deactivate</Button>
                        )}
                        {(s.status === 'suspended' || s.status === 'rejected') && (
                          <Button size="sm" variant="ghost" disabled={busyId === s.business_id} onClick={() => runAction(s.business_id, activateSeller)}>Reactivate</Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
