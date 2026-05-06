const KPI_CARDS = [
  { label: 'Total Museums', value: '—' },
  { label: 'Total Users', value: '—' },
  { label: 'Active Sessions', value: '—' },
  { label: "Today's Scans", value: '—' },
];

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">Museum analytics and management overview.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {KPI_CARDS.map(({ label, value }) => (
          <div key={label} className="rounded-xl border bg-white p-6 shadow-sm">
            <p className="text-sm text-gray-500">{label}</p>
            <p className="mt-2 text-3xl font-semibold text-gray-900">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
