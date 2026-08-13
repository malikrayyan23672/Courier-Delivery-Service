'use client';

import { RoleGuard } from '@/components/RoleGuard';
import { BranchConsole } from '@/components/ops/BranchConsole';

export default function StaffDashboardPage() {
  return (
    <RoleGuard allowedRoles={['staff']}>
      <BranchConsole />
    </RoleGuard>
  );
}
