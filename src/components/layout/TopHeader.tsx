import React from 'react';
import {
  Download,
  Menu,
  Moon,
  Pause,
  Play,
  RotateCcw,
  Sun,
} from 'lucide-react';
import { NavSection, SimulationState } from '../../engine/types';
import { formatClockTime } from '../../engine/seedData';

interface TopHeaderProps {
  activeSection: NavSection;
  simulation: SimulationState;
  isDark: boolean;
  onToggleTheme: () => void;
  onToggleSimulation: () => void;
  onResetSimulation: () => void;
  onChangeSpeed: (speed: 1 | 2 | 5 | 10) => void;
  onExportReport: () => void;
  onOpenMobileMenu: () => void;
}

const SECTION_TITLES: Record<NavSection, string> = {
  overview: 'Operations Overview',
  forecasting: 'Crowd Forecasting',
  beds: 'Bed Intelligence',
  queue: 'Patient Queue',
  alerts: 'Alerts & Insights',
  staff: 'Staff & Resources',
  analytics: 'Analytics',
  settings: 'Settings',
};

export const TopHeader: React.FC<TopHeaderProps> = ({
  activeSection,
  simulation,
  isDark,
  onToggleTheme,
  onToggleSimulation,
  onResetSimulation,
  onChangeSpeed,
  onExportReport,
  onOpenMobileMenu,
}) => {
  const simTime = formatClockTime(simulation.simTimestamp);

  return (
    <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 lg:px-6 flex items-center justify-between gap-4 sticky top-0 z-10 shrink-0">
      {/* Left: Mobile Menu + Contextual Breadcrumb + Sim Clock */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          aria-label="Open navigation menu"
          className="lg:hidden p-2 -ml-1 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 text-sm min-w-0">
          <span className="hidden sm:inline text-slate-400 dark:text-slate-500 whitespace-nowrap">
            MedPulse ED
          </span>
          <span className="hidden sm:inline text-slate-300 dark:text-slate-700" aria-hidden="true">
            /
          </span>
          <h1 className="font-display font-semibold text-slate-900 dark:text-slate-100 truncate">
            {SECTION_TITLES[activeSection]}
          </h1>
          <span className="hidden md:inline text-slate-300 dark:text-slate-700" aria-hidden="true">
            ·
          </span>
          <span className="hidden md:inline font-mono tabular-nums text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
            Shift {simTime}
          </span>
          {simulation.isRunning && (
            <span className="hidden xl:inline-flex items-center gap-1.5 text-xs font-medium text-teal-700 dark:text-teal-400 whitespace-nowrap ml-1">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-600 dark:bg-teal-400 animate-pulse" />
              Live Simulation (+{simulation.elapsedSimMinutes}m)
            </span>
          )}
        </div>
      </div>

      {/* Right: Simulation Controls + Theme + Export */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Simulation Speed Selector */}
        <div className="hidden sm:flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5 border border-slate-200 dark:border-slate-700">
          {([1, 2, 5, 10] as const).map((spd) => (
            <button
              key={spd}
              type="button"
              onClick={() => onChangeSpeed(spd)}
              title={`Set simulation speed to ${spd}x`}
              className={`px-2 py-1 text-xs font-mono tabular-nums rounded-md transition-colors whitespace-nowrap ${
                simulation.speed === spd
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {spd}x
            </button>
          ))}
        </div>

        {/* Start / Pause Simulation */}
        <button
          type="button"
          onClick={onToggleSimulation}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
            simulation.isRunning
              ? 'bg-amber-600 hover:bg-amber-700 text-white'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          {simulation.isRunning ? (
            <>
              <Pause className="w-3.5 h-3.5" />
              <span>Pause Sim</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5" />
              <span>Start Sim</span>
            </>
          )}
        </button>

        {/* Reset Simulation */}
        <button
          type="button"
          onClick={onResetSimulation}
          title="Reset simulation to baseline"
          aria-label="Reset simulation"
          className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors shrink-0"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        {/* Export Snapshot */}
        <button
          type="button"
          onClick={onExportReport}
          className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export</span>
        </button>

        {/* Dark / Light Toggle */}
        <button
          type="button"
          onClick={onToggleTheme}
          aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors shrink-0"
        >
          {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>
    </header>
  );
};
