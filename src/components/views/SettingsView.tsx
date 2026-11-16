import React from 'react';
import { Download, Moon, RotateCcw, Sun } from 'lucide-react';
import { HospitalDataset, HospitalSettings } from '../../engine/types';

interface SettingsViewProps {
  dataset: HospitalDataset;
  isDark: boolean;
  onToggleTheme: () => void;
  onUpdateSettings: (patch: Partial<HospitalSettings>) => void;
  onUpdateSimSpeed: (speed: 1 | 2 | 5 | 10) => void;
  onUpdateConfidence: (level: 80 | 90 | 95) => void;
  onResetAllData: () => void;
  onExportFullSnapshot: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  dataset,
  isDark,
  onToggleTheme,
  onUpdateSettings,
  onUpdateSimSpeed,
  onUpdateConfidence,
  onResetAllData,
  onExportFullSnapshot,
}) => {
  const s = dataset.settings;

  return (
    <div className="max-w-4xl space-y-6">
      {/* Facility & Appearance */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
        <div className="pb-3 border-b border-slate-200 dark:border-slate-800">
          <h2 className="font-display font-semibold text-base text-slate-900 dark:text-slate-100">
            Facility Profile & Interface Theme
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Changes update the live dashboard header, reports, and visual theme immediately
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label htmlFor="set-hosp-name" className="block font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Hospital / Facility Name
            </label>
            <input
              id="set-hosp-name"
              type="text"
              value={s.hospitalName}
              onChange={(e) => onUpdateSettings({ hospitalName: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div>
            <span className="block font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Color Theme
            </span>
            <button
              type="button"
              onClick={onToggleTheme}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <span>{isDark ? 'Dark Clinical Mode Active' : 'Light Clinical Mode Active'}</span>
              {isDark ? <Moon className="w-4 h-4 text-blue-400" /> : <Sun className="w-4 h-4 text-amber-500" />}
            </button>
          </div>
        </div>
      </section>

      {/* Congestion & Alert Thresholds */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-5">
        <div className="pb-3 border-b border-slate-200 dark:border-slate-800">
          <h3 className="font-display font-semibold text-base text-slate-900 dark:text-slate-100">
            Congestion & Alert Trigger Thresholds
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Adjust occupancy and wait-time thresholds used by the forecasting engine and alert center
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-xs">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="th-elevated" className="font-medium text-slate-700 dark:text-slate-300">
                Elevated Occupancy Threshold
              </label>
              <span className="font-mono tabular-nums font-semibold text-blue-700 dark:text-blue-400">
                {s.elevatedThreshold}%
              </span>
            </div>
            <input
              id="th-elevated"
              type="range"
              min={55}
              max={80}
              value={s.elevatedThreshold}
              onChange={(e) => onUpdateSettings({ elevatedThreshold: Number(e.target.value) })}
              className="w-full accent-blue-600 cursor-pointer"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="th-high" className="font-medium text-slate-700 dark:text-slate-300">
                High Congestion Threshold
              </label>
              <span className="font-mono tabular-nums font-semibold text-amber-700 dark:text-amber-400">
                {s.highThreshold}%
              </span>
            </div>
            <input
              id="th-high"
              type="range"
              min={75}
              max={92}
              value={s.highThreshold}
              onChange={(e) => onUpdateSettings({ highThreshold: Number(e.target.value) })}
              className="w-full accent-amber-600 cursor-pointer"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="th-crit" className="font-medium text-slate-700 dark:text-slate-300">
                Critical Surge Threshold
              </label>
              <span className="font-mono tabular-nums font-semibold text-rose-700 dark:text-rose-400">
                {s.criticalThreshold}%
              </span>
            </div>
            <input
              id="th-crit"
              type="range"
              min={86}
              max={99}
              value={s.criticalThreshold}
              onChange={(e) => onUpdateSettings({ criticalThreshold: Number(e.target.value) })}
              className="w-full accent-rose-600 cursor-pointer"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="th-wait" className="font-medium text-slate-700 dark:text-slate-300">
                Waiting-Time Alert Target
              </label>
              <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100">
                {s.waitTimeAlertMinutes} min
              </span>
            </div>
            <input
              id="th-wait"
              type="range"
              min={15}
              max={60}
              step={5}
              value={s.waitTimeAlertMinutes}
              onChange={(e) => onUpdateSettings({ waitTimeAlertMinutes: Number(e.target.value) })}
              className="w-full accent-blue-600 cursor-pointer"
            />
          </div>
        </div>
      </section>

      {/* Simulation & Forecast Defaults + Data Export */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-5">
        <div className="pb-3 border-b border-slate-200 dark:border-slate-800">
          <h3 className="font-display font-semibold text-base text-slate-900 dark:text-slate-100">
            Simulation, Prediction Confidence & Data Management
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-xs">
          <div>
            <span className="block font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Simulation Playback Speed
            </span>
            <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
              {([1, 2, 5, 10] as const).map((spd) => (
                <button
                  key={spd}
                  type="button"
                  onClick={() => onUpdateSimSpeed(spd)}
                  className={`py-1.5 font-mono rounded-md transition-colors ${
                    dataset.simulation.speed === spd
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs font-semibold'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {spd}x
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="block font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Prediction Confidence Interval
            </span>
            <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
              {([80, 90, 95] as const).map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => onUpdateConfidence(lvl)}
                  className={`py-1.5 font-mono rounded-md transition-colors ${
                    dataset.forecastConfig.confidenceLevel === lvl
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs font-semibold'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {lvl}% CI
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onExportFullSnapshot}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Full System Snapshot (JSON)</span>
          </button>

          <button
            type="button"
            onClick={onResetAllData}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Hospital Dataset to Default Seed</span>
          </button>
        </div>
      </section>
    </div>
  );
};
