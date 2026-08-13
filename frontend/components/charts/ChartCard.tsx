'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function ChartCard({
  title,
  description,
  loading,
  empty,
  emptyMessage = 'No data yet.',
  children,
  action,
}: {
  title: string;
  description?: string;
  loading?: boolean;
  empty?: boolean;
  emptyMessage?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="text-base">{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </div>
        {action}
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-56 w-full rounded-lg" />
        ) : empty ? (
          <p className="py-14 text-center text-sm text-muted-foreground">{emptyMessage}</p>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}
