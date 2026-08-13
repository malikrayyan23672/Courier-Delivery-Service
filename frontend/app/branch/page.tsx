'use client';

import { RoleGuard } from '@/components/RoleGuard';
import { BranchConsole } from '@/components/ops/BranchConsole';

export default function BranchDashboardPage() {
  return (
    // Branch console needs admin oversight too, not just the branch's own staff
    <RoleGuard allowedRoles={['staff', 'admin', 'super_admin']}>
      <BranchConsole />
    </RoleGuard>
  );
}
