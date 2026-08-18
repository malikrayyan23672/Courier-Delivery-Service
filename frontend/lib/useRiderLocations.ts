import { useEffect, useState } from 'react';

import { ApiError, listRiderLocations, RiderLocation } from '@/lib/api';

const POLL_INTERVAL_MS = 12_000;

/**
 * Polls the rider live-location endpoint on an interval, but only while
 * `enabled` is true (the caller should tie this to the Live Map tab being
 * active, so we don't keep hitting the backend from a hidden panel).
 */
export function useRiderLocations(
  token: string | null | undefined,
  params: { isAdmin: boolean; zoneId?: string },
  enabled: boolean
) {
  const [locations, setLocations] = useState<RiderLocation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { isAdmin, zoneId } = params;

  useEffect(() => {
    if (!enabled || !token) return;

    let cancelled = false;

    function poll() {
      if (!token) return;
      setLoading(true);
      listRiderLocations(token, { isAdmin, zoneId })
        .then((data) => {
          if (!cancelled) {
            setLocations(data);
            setError('');
          }
        })
        .catch((err) => {
          if (!cancelled) {
            setError(err instanceof ApiError ? err.message : 'Could not load rider locations.');
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }

    poll();
    const id = setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [token, isAdmin, zoneId, enabled]);

  return { locations, loading, error };
}
