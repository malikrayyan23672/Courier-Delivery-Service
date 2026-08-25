'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { RoleGuard } from '@/components/RoleGuard';
import { Logo } from '@/components/Logo';
import {
  bookLocalOfficeOrder,
  downloadLocalOfficeReceipt,
  getLocalOfficeReceiptPreviewUrl,
  getLocalOfficeOrderInvoicePreviewUrl,
  getLocalOfficeOrderLabelPreviewUrl,
  scanLocalOfficeOrder,
  Order,
  ApiError,
} from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Field } from '@/components/Field';
import { SelectField } from '@/components/Select';
import { ScanConsole } from '@/components/ops/ScanConsole';

export default function LocalOfficePage() {
  return (
    <RoleGuard allowedRoles={['local_office_manager', 'admin', 'super_admin']}>
      <LocalOfficeContent />
    </RoleGuard>
  );
}

const USER_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
  </svg>
);

const INITIAL_FORM = {
  guest_full_name: '',
  guest_phone: '',
  pickup_address: '',
  pickup_city: '',
  dropoff_address: '',
  dropoff_city: '',
  weight: '',
  description: '',
  payment_method: 'cash',
};

function LocalOfficeContent() {
  const { token, setToken } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<'book' | 'scan'>('book');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [booked, setBooked] = useState<Order | null>(null);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  function update(key: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleLogout() {
    setToken(null);
    router.push('/login');
  }

  function startNewBooking() {
    if (receiptUrl) URL.revokeObjectURL(receiptUrl);
    setBooked(null);
    setReceiptUrl(null);
    setForm(INITIAL_FORM);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;

    const nextErrors: Record<string, string> = {};
    if (!form.guest_full_name.trim()) nextErrors.guest_full_name = 'Guest full name is required';
    if (!form.guest_phone.trim()) nextErrors.guest_phone = 'Guest phone number is required';
    if (!form.pickup_address.trim()) nextErrors.pickup_address = 'Pickup address is required';
    if (!form.pickup_city.trim()) nextErrors.pickup_city = 'Pickup city is required';
    if (!form.dropoff_address.trim()) nextErrors.dropoff_address = 'Drop-off address is required';
    if (!form.dropoff_city.trim()) nextErrors.dropoff_city = 'Drop-off city is required';

    setFormErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    setError('');

    try {
      const order = await bookLocalOfficeOrder(
        {
          guest_full_name: form.guest_full_name,
          guest_phone: form.guest_phone,
          pickup_address: { full_address: form.pickup_address, city: form.pickup_city },
          dropoff_address: { full_address: form.dropoff_address, city: form.dropoff_city },
          package_weight_kg: form.weight ? parseFloat(form.weight) : undefined,
          package_description: form.description || undefined,
          payment_method: form.payment_method as 'cash' | 'card' | 'online_gateway',
        },
        token
      );

      setBooked(order);
      const previewUrl = await getLocalOfficeReceiptPreviewUrl(order.id, token);
      setReceiptUrl(previewUrl);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not book this parcel.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePrintReceipt() {
    if (!booked || !token) return;
    setDownloading(true);
    try {
      await downloadLocalOfficeReceipt(booked.id, token, booked.tracking_number);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not download receipt.');
    } finally {
      setDownloading(false);
    }
  }

  async function openOrderDocument(kind: 'invoice' | 'label') {
    if (!booked || !token) return;
    try {
      const url = kind === 'invoice'
        ? await getLocalOfficeOrderInvoicePreviewUrl(booked.id, token)
        : await getLocalOfficeOrderLabelPreviewUrl(booked.id, token);
      window.open(url, '_blank');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : `Could not open ${kind}.`);
    }
  }

  return (
    <div className="min-h-screen bg-page">
      <header className="bg-white border-b border-line px-6 md:px-10 py-4 flex items-center justify-between">
        <Logo />
        <div className="flex items-center gap-4">
          <Badge variant="warning">Local Office</Badge>
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-navy" onClick={handleLogout}>
            Log out
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 md:px-10 py-8">
        <div className="flex gap-2 mb-6 border-b border-line">
          <button
            onClick={() => setTab('book')}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
              tab === 'book' ? 'border-orange text-[#db2203]' : 'border-transparent text-muted-foreground hover:text-ink'
            }`}
          >
            Book Guest Parcel
          </button>
          <button
            onClick={() => setTab('scan')}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
              tab === 'scan' ? 'border-orange text-[#db2203]' : 'border-transparent text-muted-foreground hover:text-ink'
            }`}
          >
            Scan Parcel
          </button>
        </div>

        {tab === 'scan' ? (
          <div>
            <h1 className="font-display text-2xl font-bold text-ink mb-1">Scan Parcel Status</h1>
            <ScanConsole
              scanFn={(tn, a) => scanLocalOfficeOrder(tn, a, token!)}
              description="Book a walk-in parcel, then scan it here to send it into the network — e.g. Scan In to route it toward the hub."
            />
          </div>
        ) : booked && receiptUrl ? (
          <div>
            <div className="bg-[#EAF7EF] border border-success/30 rounded-[10px] px-5 py-4 mb-6">
              <p className="font-bold text-success">Parcel booked - status: Booked</p>
              <p className="text-sm text-ink mt-1">
                Tracking number: <span className="font-mono font-bold">{booked.tracking_number}</span>
                {booked.final_price ? ` — Rs. ${booked.final_price}` : ''}
              </p>
            </div>

            <Card className="overflow-hidden">
              <CardHeader>
                <CardTitle className="text-lg">Guest Receipt</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <iframe src={receiptUrl} title="Booking receipt" className="w-full h-[600px] border border-line rounded-[10px]" />
                <div className="flex flex-wrap gap-3">
                  <Button variant="navy" onClick={handlePrintReceipt} disabled={downloading}>
                    {downloading ? 'Preparing…' : 'Print Receipt'}
                  </Button>
                  <Button variant="outline" onClick={() => openOrderDocument('invoice')}>
                    Print Invoice
                  </Button>
                  <Button variant="outline" onClick={() => openOrderDocument('label')}>
                    Print Parcel Label
                  </Button>
                  <Button variant="ghost" onClick={startNewBooking}>
                    Book Another Parcel
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div>
            <h1 className="font-display text-2xl font-bold text-ink mb-1">Book a Guest Parcel</h1>
            <p className="text-muted-foreground text-sm mb-6">
              For walk-in customers booking at this local office counter. A QR receipt is generated on booking.
            </p>

            {error && <p className="text-sm text-[#db2203] mb-4">{error}</p>}

            <form onSubmit={handleSubmit}>
              <Card className="p-6 md:p-8">
                <CardHeader className="px-0 pt-0">
                  <CardTitle className="text-lg">Guest Details</CardTitle>
                </CardHeader>
                <CardContent className="px-0 space-y-6">
                  <div className="grid md:grid-cols-2 gap-x-6 gap-y-4">
                    <Field icon={USER_ICON} id="full_name" label="Full Name" error={formErrors.guest_full_name} placeholder="Guest's name" value={form.guest_full_name} onChange={(e) => update('guest_full_name', e.target.value)} />
                    <Field icon={USER_ICON} error={formErrors.guest_phone} id="phone" label="Phone Number" placeholder="Guest's phone number" value={form.guest_phone} onChange={(e) => update('guest_phone', e.target.value)} />
                  </div>

                  <div>
                    <CardTitle className="text-lg mb-4">Pickup &amp; Drop-off</CardTitle>
                    <div className="grid md:grid-cols-2 gap-x-6 gap-y-4">
                      <Field icon={USER_ICON} error={formErrors.pickup_address} id="pickupaddress" label="Pickup Address" placeholder="House/street, area" value={form.pickup_address} onChange={(e) => update('pickup_address', e.target.value)} />
                      <Field icon={USER_ICON} id="pickupcity" error={formErrors.pickup_city} label="Pickup City" placeholder="Karachi" value={form.pickup_city} onChange={(e) => update('pickup_city', e.target.value)} />
                      <Field icon={USER_ICON} id="dropoffaddress" label="Dropoff Address" error={formErrors.dropoff_address} placeholder="House/street, area" value={form.dropoff_address} onChange={(e) => update('dropoff_address', e.target.value)} />
                      <Field icon={USER_ICON} id="dropoffcity" label="Dropoff City" placeholder="Karachi" error={formErrors.dropoff_city} value={form.dropoff_city} onChange={(e) => update('dropoff_city', e.target.value)} />
                      <Field icon={USER_ICON} label="Package Weight (kg)" id="weight" type="number" placeholder="e.g. 1.5" value={form.weight} onChange={(e) => update('weight', e.target.value)} />
                      <Field icon={USER_ICON} label="Package Description" id="description" placeholder="e.g. Documents" value={form.description} onChange={(e) => update('description', e.target.value)} />
                    </div>
                  </div>

                  <SelectField
                    label="Payment method"
                    value={form.payment_method}
                    onChange={(e) => setForm((f) => ({ ...f, payment_method: e.target.value }))}
                    icon={USER_ICON}
                    options={[
                      { label: 'Cash', value: 'cash' },
                      { label: 'Card', value: 'card' },
                      { label: 'Online', value: 'online_gateway' },
                    ]}
                  />

                  <Button type="submit" disabled={submitting} variant="navy">
                    {submitting ? 'Booking…' : 'Confirm Booking'}
                  </Button>
                </CardContent>
              </Card>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
