import React from 'react';
import {
  Activity,
  BarChart3,
  BedDouble,
  Bell,
  LayoutDashboard,
  Settings,
  TrendingUp,
  Users,
  UserCheck,
  X,
} from 'lucide-react';
import { NavSection } from '../../engine/types';

interface SidebarProps {
  activeSection: NavSection;
  onSelectSection: (section: NavSection) => void;
  activeAlertCount: number;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  hospitalName: string;
}

const NAV_ITEMS: { id: NavSection; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'forecasting', label: 'Crowd Forecasting', icon: TrendingUp },
  { id: 'beds', label: 'Bed Intelligence', icon: BedDouble },
  { id: 'queue', label: 'Patient Queue', icon: Users },
  { id: 'alerts', label: 'Alerts & Insights', icon: Bell },
  { id: 'staff', label: 'Staff & Resources', icon: UserCheck },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export const Sidebar: React.FC<SidebarProps> = ({
  activeSection,
  onSelectSection,
  activeAlertCount,
  mobileOpen,
  onCloseMobile,
  hospitalName,
}) => {
  const navContent = (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800">
      {/* Brand Lockup */}
      <div className="h-16 px-5 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 shrink-0">
        <button
          type="button"
          onClick={() => {
            onSelectSection('overview');
            onCloseMobile();
          }}
          className="flex items-center gap-2.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded-md"
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-teal-600 flex items-center justify-center text-white shrink-0">
            <Activity className="w-4 h-4" />
          </div>
          <span className="font-display font-bold text-base tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap">
            MedPulse ED
          </span>
        </button>

        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Close navigation menu"
          className="lg:hidden p-1.5 rounded-md text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Primary Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto" aria-label="Primary Navigation">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onSelectSection(item.id);
                onCloseMobile();
              }}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150 whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                isActive
                  ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800/70'
              }`}
            >
              <span className="flex items-center gap-3 min-w-0">
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'
                  }`}
                />
                <span className="truncate">{item.label}</span>
              </span>

              {item.id === 'alerts' && activeAlertCount > 0 && (
                <span className="font-mono tabular-nums text-xs font-semibold text-rose-700 dark:text-rose-400">
                  {activeAlertCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Facility Context Footer */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-800 shrink-0">
        <p className="text-xs font-medium text-slate-900 dark:text-slate-200 truncate">
          {hospitalName}
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
          Level 1 Emergency Center · 64 Beds
        </p>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-[252px] shrink-0 h-screen sticky top-0 z-20">
        {navContent}
      </aside>

      {/* Mobile / Tablet Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <aside className="relative w-64 max-w-[80vw] h-full z-10">{navContent}</aside>
        </div>
      )}
    </>
  );
};
