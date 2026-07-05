'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, panelPathForRole } from '@/context/AuthContext';

export function RoleGuard({
  allowedRoles,
  children,
}: {
  allowedRoles: string[];
  children: React.ReactNode;
}) {
  const { token, role, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!token) {
      router.push('/login');
      return;
    }
    if (role && !allowedRoles.includes(role)) {
      // Logged in, but wrong role for this page - send them to their own panel
      router.push(panelPathForRole(role));
    }
  }, [isLoading, token, role, allowedRoles, router]);

  if (isLoading || !token || (role && !allowedRoles.includes(role))) return null;

  return <>{children}</>;
}
