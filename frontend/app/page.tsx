'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, panelPathForRole } from '@/context/AuthContext';

export default function HomePage() {
  const { token, role, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    router.push(token ? panelPathForRole(role) : '/login');
  }, [isLoading, token, role, router]);

  return null;
}
