import React, { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Download } from 'lucide-react';
import { ForecastOutput, HospitalDataset, TriageLevel } from '../../engine/types';
import { arrayToCsv, downloadTextFile } from '../../utils/exportData';

interface AnalyticsViewProps {
  dataset: HospitalDataset;
  forecast: ForecastOutput;
  isDark: boolean;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  dataset,
  forecast,
  isDark,
}) => {
  const [historyRange, setHistoryRange] = useState<'12h' | '24h'>('24h');

  const historyData = useMemo(() => {
    const count = historyRange === '12h' ? 12 : 24;
    return dataset.historicalHours.slice(-count);
  }, [dataset.historicalHours, historyRange]);

  const wardBedDistribution = useMemo(() => {
    return dataset.wards.map((w) => {
      const wBeds = dataset.beds.filter((b) => b.wardId === w.id);
      return {
        ward: w.shortCode,
        wardName: w.name,
        available: wBeds.filter((b) => b.status === 'available').length,
        occupied: wBeds.filter((b) => b.status === 'occupied').length,
        critical: wBeds.filter((b) => b.status === 'critical').length,
        cleaningOrReserved: wBeds.filter(
          (b) => b.status === 'cleaning' || b.status === 'reserved'
        ).length,
      };
    });
  }, [dataset.wards, dataset.beds]);

  const waitByTriage = useMemo(() => {
    const levels: TriageLevel[] = [1, 2, 3, 4, 5];
    return levels.map((lvl) => {
      const pts = dataset.queue.filter((q) => q.triageLevel === lvl);
      const avgWait =
        pts.length > 0
          ? Math.round(pts.reduce((s, p) => s + p.waitingMinutes, 0) / pts.length)
          : lvl === 1
            ? 4
            : lvl * 7;
      return {
        tier: `ESI ${lvl}`,
        avgWait,
        patients: pts.length,
      };
    });
  }, [dataset.queue]);

  const bedAvailabilityProjection = useMemo(() => {
    return forecast.hourlyPoints.map((pt) => ({
      hour: pt.label.split(' ')[0],
      availableBeds: pt.availableBedsProjected,
      occupiedBeds: pt.expectedOccupiedBeds,
      shortage: pt.projectedShortageBeds,
    }));
  }, [forecast.hourlyPoints]);

  const handleExportAnalytics = () => {
    const csv = arrayToCsv(
      ['Hour', 'Arrivals', 'Discharges', 'Occupancy %', 'Avg Wait (min)', 'Congestion Index'],
      historyData.map((h) => [
        h.hourLabel,
        h.arrivals,
        h.discharges,
        h.occupancyPercent,
        h.avgWaitMinutes,
        h.congestionIndex,
      ])
    );
    downloadTextFile('ed-analytics-summary.csv', csv, 'text/csv;charset=utf-8;');
  };

  const gridColor = isDark ? '#1E293B' : '#E2E8F0';
  const axisTextColor = isDark ? '#94A3B8' : '#64748B';
  const tooltipStyle = {
    backgroundColor: isDark ? '#0F172A' : '#FFFFFF',
    borderColor: isDark ? '#334155' : '#E2E8F0',
    borderRadius: '8px',
    fontSize: '12px',
  };

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="font-display font-semibold text-base text-slate-900 dark:text-slate-100">
            Emergency Department Operational Analytics
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Hourly intake mix, bed occupancy distribution, waiting-time diagnostics, and 6h bed projections
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
            {(['12h', '24h'] as const).map((range) => (
              <button
                key={range}
                type="button"
                onClick={() => setHistoryRange(range)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  historyRange === range
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Last {range}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={handleExportAnalytics}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </section>

      {/* Row 1: Hourly Arrival Trends by Acuity + Bed Occupancy Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <h3 className="font-display font-semibold text-sm text-slate-900 dark:text-slate-100">
            Hourly Patient Arrival Trends by Acuity
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
            Stacked intake across High (ESI 1–2), Moderate (ESI 3), and Minor (ESI 4–5)
          </p>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={historyData} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                <XAxis dataKey="hourLabel" tick={{ fontSize: 11, fill: axisTextColor }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: axisTextColor }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="triageHighAcuity" stackId="a" name="High Acuity (ESI 1–2)" fill="#DC2626" />
                <Bar dataKey="triageMidAcuity" stackId="a" name="Urgent (ESI 3)" fill="#2563EB" />
                <Bar dataKey="triageLowAcuity" stackId="a" name="Minor Care (ESI 4–5)" fill="#0D9488" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <h3 className="font-display font-semibold text-sm text-slate-900 dark:text-slate-100">
            Bed Occupancy Distribution by Ward
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
            Live bed state breakdown across all 6 emergency clinical bays
          </p>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={wardBedDistribution} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                <XAxis dataKey="ward" tick={{ fontSize: 11, fill: axisTextColor }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: axisTextColor }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="critical" stackId="b" name="Critical" fill="#DC2626" />
                <Bar dataKey="occupied" stackId="b" name="Occupied" fill="#2563EB" />
                <Bar dataKey="cleaningOrReserved" stackId="b" name="Cleaning / Reserved" fill="#D97706" />
                <Bar dataKey="available" stackId="b" name="Available" fill="#0D9488" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      {/* Row 2: Congestion Severity Trends + Waiting Time Analytics + Bed Availability Projections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <h3 className="font-display font-semibold text-sm text-slate-900 dark:text-slate-100">
            Congestion Severity Index
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
            Composite score (0–100) combining occupancy & wait backlog
          </p>
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={historyData} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                <XAxis dataKey="hourLabel" tick={{ fontSize: 10, fill: axisTextColor }} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: axisTextColor }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area
                  type="monotone"
                  dataKey="congestionIndex"
                  name="Congestion Index"
                  stroke="#4F46E5"
                  fill={isDark ? 'rgba(79, 70, 229, 0.22)' : 'rgba(79, 70, 229, 0.14)'}
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <h3 className="font-display font-semibold text-sm text-slate-900 dark:text-slate-100">
            Patient Waiting-Time Analytics
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
            Current average wait minutes by ESI triage priority tier
          </p>
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={waitByTriage} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                <XAxis dataKey="tier" tick={{ fontSize: 11, fill: axisTextColor }} tickLine={false} />
                <YAxis unit="m" tick={{ fontSize: 10, fill: axisTextColor }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="avgWait" name="Avg Wait (min)" fill="#D97706" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <h3 className="font-display font-semibold text-sm text-slate-900 dark:text-slate-100">
            6-Hour Bed Availability Projection
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
            Projected open beds vs. expected occupied capacity
          </p>
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={bedAvailabilityProjection} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                <XAxis dataKey="hour" tick={{ fontSize: 11, fill: axisTextColor }} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: axisTextColor }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Line
                  type="monotone"
                  dataKey="availableBeds"
                  name="Available Beds"
                  stroke="#0D9488"
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="occupiedBeds"
                  name="Occupied Beds"
                  stroke="#2563EB"
                  strokeWidth={2}
                  dot={{ r: 2.5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
    </div>
  );
};
