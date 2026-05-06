import { BarChart2, Building2, LogOut, Users } from 'lucide-react';
import { NavLink } from 'react-router-dom';

import { useAuthStore } from '@/store/auth.store';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: BarChart2, end: true },
  { to: '/museums', label: 'Museums', icon: Building2, end: false },
  { to: '/users', label: 'Users', icon: Users, end: false },
];

export default function Sidebar() {
  const { user, logout } = useAuthStore();

  return (
    <aside className="flex h-screen w-56 flex-col border-r bg-white">
      <div className="flex h-14 items-center border-b px-4">
        <span className="text-sm font-semibold tracking-tight">MuseumQuest Admin</span>
      </div>

      <nav className="flex-1 space-y-1 px-2 py-4">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-gray-100 text-gray-900'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`
            }
          >
            <Icon className="h-4 w-4" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t p-4">
        <p className="truncate text-xs text-gray-500">{user?.email ?? '—'}</p>
        <p className="text-xs font-medium text-gray-700">{user?.role ?? ''}</p>
        <button
          onClick={() => void logout()}
          className="mt-2 flex items-center gap-2 text-xs text-gray-500 hover:text-gray-700"
        >
          <LogOut className="h-3 w-3" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
