'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { RoleGuard } from '@/components/RoleGuard';
import { useAuth } from '@/context/AuthContext';
import { Barcode } from '@/components/Barcode';
import { ApiError, getSellerMarketplaceOrder, SellerMarketplaceOrderDetail } from '@/lib/api';
import { Printer, ArrowLeft } from 'lucide-react';

function titleCase(s: string) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function PrintOrderPage() {
  return (
    <RoleGuard allowedRoles={['business']}>
      <PrintOrderContent />
    </RoleGuard>
  );
}

function PrintOrderContent() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { token } = useAuth();
  const [order, setOrder] = useState<SellerMarketplaceOrderDetail | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token || !id) return;
    getSellerMarketplaceOrder(id, token)
      .then(setOrder)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load this order.'));
  }, [token, id]);

  if (error) return <div className="max-w-lg mx-auto mt-10 text-sm text-[#db2203]">{error}</div>;
  if (!order) return <div className="max-w-lg mx-auto mt-10 text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="min-h-screen bg-page">
      <div className="print:hidden sticky top-0 z-10 bg-white border-b border-line px-6 py-3.5 flex items-center justify-between">
        <button onClick={() => router.back()} className="text-sm font-semibold text-muted-foreground hover:text-navy flex items-center gap-1.5">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <button onClick={() => window.print()} className="text-sm font-bold bg-navy text-white px-4 py-2 rounded-[10px] hover:bg-navy-light transition-colors flex items-center gap-1.5">
          <Printer className="w-4 h-4" /> Print
        </button>
      </div>

      <div className="max-w-xl mx-auto px-6 py-8 print:py-0 print:px-0 print:max-w-none">
        <div className="bg-white rounded-card shadow-card print:shadow-none print:rounded-none p-8 print:p-4">
          <div className="flex items-start justify-between mb-6 pb-6 border-b border-line">
            <div>
              <div className="font-display text-lg font-extrabold text-navy leading-none">
                RAFTAAR<span className="text-[#db2203]">EXPRESS</span>
              </div>
              <div className="text-[0.6rem] tracking-[0.2em] text-muted-foreground font-semibold mt-1">PACKING SLIP</div>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#FBF3EA] text-[#db2203]">{titleCase(order.status)}</span>
          </div>

          <div className="flex flex-col items-center mb-6">
            <Barcode value={order.tracking_number} height={70} />
          </div>

          <div className="grid grid-cols-2 gap-6 mb-6">
            <div>
              <p className="text-[0.65rem] font-bold uppercase tracking-wide text-muted-foreground mb-1">From (seller)</p>
              <p className="text-sm font-semibold text-ink">{order.seller_name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{order.seller_address}{order.seller_city ? `, ${order.seller_city}` : ''}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{order.seller_phone}</p>
            </div>
            <div>
              <p className="text-[0.65rem] font-bold uppercase tracking-wide text-muted-foreground mb-1">Deliver to</p>
              <p className="text-sm font-semibold text-ink">{order.dropoff_contact_name || order.buyer_name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{order.dropoff_full_address}{order.dropoff_city ? `, ${order.dropoff_city}` : ''}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{order.dropoff_contact_phone || order.buyer_phone}</p>
            </div>
          </div>

          <table className="w-full text-sm mb-6">
            <thead>
              <tr className="border-b border-line text-left text-xs text-muted-foreground uppercase">
                <th className="py-2 font-semibold">Item</th>
                <th className="py-2 font-semibold text-right">Qty</th>
                <th className="py-2 font-semibold text-right">Unit price</th>
                <th className="py-2 font-semibold text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-line">
                <td className="py-2.5 text-ink">{order.product_name}</td>
                <td className="py-2.5 text-right text-ink">{order.quantity}</td>
                <td className="py-2.5 text-right text-ink">Rs {(order.unit_price ?? 0).toLocaleString()}</td>
                <td className="py-2.5 text-right text-ink">Rs {order.goods_amount.toLocaleString()}</td>
              </tr>
            </tbody>
          </table>

          <div className="flex flex-col items-end gap-1 text-sm mb-6">
            <div className="flex gap-8"><span className="text-muted-foreground">Delivery fee</span><span className="text-ink w-24 text-right">Rs {(order.delivery_fee ?? 0).toLocaleString()}</span></div>
            {!!order.discount_amount && (
              <div className="flex gap-8"><span className="text-muted-foreground">Discount</span><span className="text-success w-24 text-right">- Rs {order.discount_amount.toLocaleString()}</span></div>
            )}
            <div className="flex gap-8 pt-1 border-t border-line font-bold"><span className="text-ink">Total ({order.payment_method === 'cash' ? 'COD' : 'Prepaid'})</span><span className="text-navy w-24 text-right">Rs {(order.final_price ?? 0).toLocaleString()}</span></div>
          </div>

          <p className="text-center text-xs text-muted-foreground pt-4 border-t border-line">
            Tracking: <span className="font-mono font-semibold text-ink">{order.tracking_number}</span> · Hand to rider at pickup scan
          </p>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          @page { margin: 12mm; }
          body { background: #fff !important; }
        }
      `}</style>
    </div>
  );
}
