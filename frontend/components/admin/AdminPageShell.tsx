'use client';

import Link from 'next/link';
import { RoleGuard } from '@/components/RoleGuard';
import { ChevronLeft } from 'lucide-react';

const ADMIN_NAV = [
  { href: '/admin/dashboard', label: 'Dashboard' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/corridors', label: 'Corridors' },
  { href: '/admin/pricing', label: 'Pricing' },
  { href: '/admin/audit-log', label: 'Audit Log' },
];

export function AdminPageShell({
  title,
  description,
  activeHref,
  children,
}: {
  title: string;
  description?: string;
  activeHref: string;
  children: React.ReactNode;
}) {
  return (
    <RoleGuard allowedRoles={['admin', 'super_admin']}>
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-5 py-3.5 md:px-8">
            <Link href="/admin" className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-ink transition-colors">
              <ChevronLeft className="h-4 w-4" /> Command Center
            </Link>
            <div className="h-4 w-px bg-border" />
            <nav className="flex flex-wrap items-center gap-1">
              {ADMIN_NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                    item.href === activeHref ? 'bg-navy text-white' : 'text-muted-foreground hover:bg-muted hover:text-ink'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-5 py-6 md:px-8 md:py-8">
          <div className="mb-6">
            <h1 className="font-display text-xl font-bold text-ink md:text-2xl">{title}</h1>
            {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
          </div>
          {children}
        </main>
      </div>
    </RoleGuard>
  );
}
