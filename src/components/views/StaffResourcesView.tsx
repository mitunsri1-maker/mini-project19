import React from 'react';
import { Minus, Plus, UserCheck } from 'lucide-react';
import { ForecastOutput, HospitalDataset } from '../../engine/types';
import { getCongestionTextClass } from '../shared/StatusHelpers';

interface StaffResourcesViewProps {
  dataset: HospitalDataset;
  forecast: ForecastOutput;
  onAdjustFloatStaff: (roleId: string, delta: number) => void;
  onAutoBalanceStaff: () => void;
}

export const StaffResourcesView: React.FC<StaffResourcesViewProps> = ({
  dataset,
  forecast,
  onAdjustFloatStaff,
  onAutoBalanceStaff,
}) => {
  const totalOnDuty = dataset.staffRoles.reduce((s, r) => s + r.onDuty, 0);
  const totalRequired = dataset.staffRoles.reduce((s, r) => s + r.recommendedRequired, 0);
  const staffingGap = Math.max(0, totalRequired - totalOnDuty);
  const totalFloatAdded = dataset.staffRoles.reduce((s, r) => s + r.floatAllocated, 0);

  return (
    <div className="space-y-6">
      {/* Resource Summary Strip */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 flex-1">
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Current Staff On Duty</p>
            <p className="font-mono tabular-nums text-2xl font-bold text-slate-900 dark:text-slate-100 mt-0.5">
              {totalOnDuty}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Forecasted Demand (3h)</p>
            <p className="font-mono tabular-nums text-2xl font-bold text-blue-700 dark:text-blue-400 mt-0.5">
              {totalRequired}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Recommended Additional</p>
            <p
              className={`font-mono tabular-nums text-2xl font-bold mt-0.5 ${
                staffingGap > 0
                  ? 'text-rose-700 dark:text-rose-400'
                  : 'text-teal-700 dark:text-teal-400'
              }`}
            >
              {staffingGap > 0 ? `+${staffingGap}` : '0'}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Float Pool Allocated</p>
            <p className="font-mono tabular-nums text-2xl font-bold text-slate-900 dark:text-slate-100 mt-0.5">
              {totalFloatAdded}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onAutoBalanceStaff}
          disabled={staffingGap === 0}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold disabled:opacity-45 disabled:pointer-events-none transition-colors whitespace-nowrap shrink-0"
        >
          <UserCheck className="w-4 h-4" />
          <span>Auto-Allocate Required Float Staff</span>
        </button>
      </section>

      {/* Staffing Allocation Matrix */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 overflow-x-auto">
        <div className="mb-4">
          <h2 className="font-display font-semibold text-base text-slate-900 dark:text-slate-100">
            Clinical Staffing Availability & Forecasted Demand
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Allocate float personnel in real time; adding clinical capacity improves discharge throughput in the forecasting engine
          </p>
        </div>

        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
              <th className="py-2.5 pr-3 font-medium">Role</th>
              <th className="py-2.5 px-3 font-medium">Primary Coverage</th>
              <th className="py-2.5 px-3 font-medium text-right">On Duty</th>
              <th className="py-2.5 px-3 font-medium text-right">Forecast Need</th>
              <th className="py-2.5 px-3 font-medium text-right">Gap</th>
              <th className="py-2.5 px-3 font-medium text-right">Utilization</th>
              <th className="py-2.5 pl-3 font-medium text-right">Float Control</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {dataset.staffRoles.map((role) => {
              const gap = Math.max(0, role.recommendedRequired - role.onDuty);
              return (
                <tr key={role.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="py-3 pr-3 font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                    {role.role}
                  </td>
                  <td className="py-3 px-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                    {role.department}
                  </td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100">
                    {role.onDuty}{' '}
                    {role.floatAllocated > 0 && (
                      <span className="text-teal-700 dark:text-teal-400">(+{role.floatAllocated})</span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                    {role.recommendedRequired}
                  </td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums font-semibold">
                    {gap > 0 ? (
                      <span className="text-rose-700 dark:text-rose-400">-{gap}</span>
                    ) : (
                      <span className="text-teal-700 dark:text-teal-400">Covered</span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums">
                    <span
                      className={
                        role.utilizationPercent >= 95
                          ? 'text-rose-700 dark:text-rose-400 font-semibold'
                          : role.utilizationPercent >= 85
                            ? 'text-amber-700 dark:text-amber-400 font-semibold'
                            : 'text-slate-700 dark:text-slate-300'
                      }
                    >
                      {role.utilizationPercent}%
                    </span>
                  </td>
                  <td className="py-3 pl-3 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        disabled={role.floatAllocated <= 0}
                        onClick={() => onAdjustFloatStaff(role.id, -1)}
                        aria-label={`Release 1 float ${role.role}`}
                        className="p-1.5 rounded-md border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-35 disabled:pointer-events-none"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onAdjustFloatStaff(role.id, 1)}
                        aria-label={`Assign 1 float ${role.role}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Float</span>
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {/* Bed Allocation Recommendations & Upcoming Congestion Periods */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <h3 className="font-display font-semibold text-base text-slate-900 dark:text-slate-100 mb-1">
            Ward Bed Reallocation Recommendations
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
            Derived from ward-specific 3-hour arrival demand and current cleaning pipeline
          </p>

          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {forecast.wardRisks.map((w) => (
              <div key={w.wardId} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">{w.wardName}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {w.projectedDeficit3h > 0
                      ? `Recommend flexing +${w.projectedDeficit3h} observation/overflow slot${w.projectedDeficit3h > 1 ? 's' : ''}`
                      : `Capacity adequate (${w.currentlyAvailable} open, ${w.cleaningOrReserved} turning over)`}
                  </p>
                </div>
                <span className={`text-xs font-semibold whitespace-nowrap ${getCongestionTextClass(w.riskLevel)}`}>
                  {w.riskLevel}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <h3 className="font-display font-semibold text-base text-slate-900 dark:text-slate-100 mb-1">
            Upcoming 6-Hour Congestion Windows
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
            Hour-by-hour expected load for shift lead pre-positioning
          </p>

          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {forecast.hourlyPoints.map((pt) => (
              <div key={pt.stepHour} className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between text-xs">
                <span className="font-mono tabular-nums font-medium text-slate-800 dark:text-slate-200">
                  {pt.label}
                </span>
                <span className="font-mono tabular-nums text-slate-600 dark:text-slate-400">
                  +{pt.predictedArrivals} arrivals · {pt.expectedOccupancyPercent}% occ
                </span>
                <span className={`font-semibold w-20 text-right ${getCongestionTextClass(pt.congestionLevel)}`}>
                  {pt.congestionLevel}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};
