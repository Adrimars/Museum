import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api';

interface PaginatedResponse<T> {
  data: T[];
  cursor: string | null;
  hasMore: boolean;
}

function useCount(key: string, endpoint: string) {
  return useQuery({
    queryKey: [key, 'count'],
    queryFn: () =>
      api
        .get<{ data: PaginatedResponse<unknown> }>(endpoint, { params: { limit: 100 } })
        .then((r) => {
          const page = r.data.data;
          const count = page.data.length;
          return page.hasMore ? '100+' : String(count);
        }),
  });
}

export default function DashboardPage() {
  const museums = useCount('museums', '/museums');
  const users = useCount('users', '/users');

  const kpiCards = [
    { label: 'Total Museums', query: museums },
    { label: 'Total Users', query: users },
    { label: 'Active Sessions', query: null },
    { label: "Today's Scans", query: null },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">Museum analytics and management overview.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpiCards.map(({ label, query }) => {
          let value = '—';
          if (query) {
            if (query.isLoading) value = '…';
            else if (query.isError) value = 'err';
            else value = query.data ?? '—';
          }
          return (
            <div key={label} className="rounded-xl border bg-white p-6 shadow-sm">
              <p className="text-sm text-gray-500">{label}</p>
              <p className="mt-2 text-3xl font-semibold text-gray-900">{value}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
