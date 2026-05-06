import { useQuery } from '@tanstack/react-query';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';

import { api } from '@/lib/api';

interface Museum {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  createdAt: string;
}

const columnHelper = createColumnHelper<Museum>();

const columns = [
  columnHelper.accessor('name', { header: 'Name' }),
  columnHelper.accessor('slug', { header: 'Slug' }),
  columnHelper.accessor('isActive', {
    header: 'Status',
    cell: (info) =>
      info.getValue() ? (
        <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
          Active
        </span>
      ) : (
        <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
          Inactive
        </span>
      ),
  }),
  columnHelper.accessor('createdAt', {
    header: 'Created At',
    cell: (info) => new Date(info.getValue()).toLocaleDateString(),
  }),
];

export default function MuseumsPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['museums'],
    queryFn: () =>
      api
        .get<{ data: { data: Museum[]; cursor: string | null; hasMore: boolean } }>('/museums')
        .then((r) => r.data.data.data),
  });

  const table = useReactTable({
    data: data ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Museums</h1>
        <p className="mt-1 text-sm text-gray-500">Manage all registered museums.</p>
      </div>

      <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
        {isLoading && <p className="p-6 text-sm text-gray-500">Loading…</p>}
        {isError && <p className="p-6 text-sm text-red-500">Failed to load museums.</p>}
        {!isLoading && !isError && (
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500"
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-gray-100">
              {table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3 text-gray-700">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
              {table.getRowModel().rows.length === 0 && (
                <tr>
                  <td colSpan={columns.length} className="px-4 py-6 text-center text-gray-400">
                    No museums found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
