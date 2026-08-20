'use client';

import { RoleGuard } from '@/components/RoleGuard';
import { BranchConsole } from '@/components/ops/BranchConsole';

export default function HubOfficeDashboardPage() {
  return (
    <RoleGuard allowedRoles={['hub_manager', 'admin', 'super_admin']}>
      <BranchConsole />
    </RoleGuard>
  );
}
