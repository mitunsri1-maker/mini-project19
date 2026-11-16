import React, { useMemo, useState } from 'react';
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ArrowRight, Check, RefreshCw } from 'lucide-react';
import {
  AlertItem,
  ForecastOutput,
  HospitalDataset,
  NavSection,
  WardId,
} from '../../engine/types';
import { classifyCongestion } from '../../engine/forecastEngine';
import {
  SeverityIcon,
  getCongestionBarClass,
  getCongestionTextClass,
} from '../shared/StatusHelpers';

interface OverviewViewProps {
  dataset: HospitalDataset;
  forecast: ForecastOutput;
  isDark: boolean;
  onNavigate: (section: NavSection, wardFilter?: WardId) => void;
  onAcknowledgeAlert: (id: string) => void;
  onExecuteAlertAction: (alert: AlertItem) => void;
  onManualRefreshPulse: () => void;
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  dataset,
  forecast,
  isDark,
  onNavigate,
  onAcknowledgeAlert,
  onExecuteAlertAction,
  onManualRefreshPulse,
}) => {
  const [chartWindow, setChartWindow] = useState<'6h' | '3h' | '1h'>('6h');

  const usableBeds = dataset.beds.filter((b) => b.status !== 'out_of_service');
  const occupiedCount = dataset.beds.filter(
    (b) => b.status === 'occupied' || b.status === 'critical' || b.status === 'reserved'
  ).length;
  const availableCount = dataset.beds.filter((b) => b.status === 'available').length;
  const cleaningCount = dataset.beds.filter((b) => b.status === 'cleaning').length;
  const occupancyPct = Math.round((occupiedCount / Math.max(1, usableBeds.length)) * 100);

  const awaitingQueue = dataset.queue.filter(
    (p) => p.status === 'waiting' || p.status === 'triaged' || p.status === 'awaiting_bed'
  );
  const inTreatmentCount = dataset.queue.filter((p) => p.status === 'in_treatment').length;
  const totalEdPatients = occupiedCount + awaitingQueue.length;
  const avgWaitMinutes =
    awaitingQueue.length > 0
      ? Math.round(
          awaitingQueue.reduce((sum, p) => sum + p.waitingMinutes, 0) / awaitingQueue.length
        )
      : 0;

  const currentCongestion = classifyCongestion(
    occupancyPct,
    dataset.settings.elevatedThreshold,
    dataset.settings.highThreshold,
    dataset.settings.criticalThreshold
  );

  // Combine last 8 historical hours + next 1/3/6 forecast hours for a seamless timeline chart
  const combinedTimeline = useMemo(() => {
    const histSlice = dataset.historicalHours.slice(-8).map((h, i, arr) => ({
      time: h.hourLabel,
      historicalArrivals: h.arrivals,
      predictedArrivals: i === arr.length - 1 ? h.arrivals : null,
      confidenceBand: null as [number, number] | null,
      occupancyPct: h.occupancyPercent,
      isForecast: false,
    }));

    const horizonCount = chartWindow === '1h' ? 1 : chartWindow === '3h' ? 3 : 6;
    const predSlice = forecast.hourlyPoints.slice(0, horizonCount).map((p) => ({
      time: p.label.split(' ')[1]?.replace(/[()]/g, '') || p.label,
      historicalArrivals: null as number | null,
      predictedArrivals: p.predictedArrivals,
      confidenceBand: [p.lowerBound, p.upperBound] as [number, number],
      occupancyPct: p.expectedOccupancyPercent,
      isForecast: true,
    }));

    return [...histSlice, ...predSlice];
  }, [dataset.historicalHours, forecast.hourlyPoints, chartWindow]);

  const nowLabel = dataset.historicalHours[dataset.historicalHours.length - 1]?.hourLabel;

  // Ward summary bars
  const wardSummaries = useMemo(() => {
    return dataset.wards.map((w) => {
      const wBeds = dataset.beds.filter((b) => b.wardId === w.id && b.status !== 'out_of_service');
      const busy = wBeds.filter(
        (b) => b.status === 'occupied' || b.status === 'critical' || b.status === 'reserved'
      ).length;
      const avail = wBeds.filter((b) => b.status === 'available').length;
      const pct = Math.round((busy / Math.max(1, wBeds.length)) * 100);
      const level = classifyCongestion(
        pct,
        dataset.settings.elevatedThreshold,
        dataset.settings.highThreshold,
        dataset.settings.criticalThreshold
      );
      return {
        id: w.id,
        name: w.name,
        shortCode: w.shortCode,
        busy,
        total: wBeds.length,
        avail,
        pct,
        level,
      };
    });
  }, [dataset.wards, dataset.beds, dataset.settings]);

  const activeAlerts = dataset.alerts.filter((a) => !a.dismissed && !a.acknowledged).slice(0, 4);

  const gridColor = isDark ? '#1E293B' : '#E2E8F0';
  const axisTextColor = isDark ? '#94A3B8' : '#64748B';

  return (
    <div className="space-y-6">
      {/* Top Operational Summary Header */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span className="font-medium text-slate-700 dark:text-slate-300">
              {dataset.settings.hospitalName}
            </span>
            <span aria-hidden="true">·</span>
            <span>Weather: {dataset.forecastConfig.weather}</span>
            <span aria-hidden="true">·</span>
            <span>{dataset.forecastConfig.dayType}</span>
            <span aria-hidden="true">·</span>
            <span>Model: {dataset.forecastConfig.modelMode}</span>
          </div>
          <h2 className="font-display text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            Emergency Department Status:{' '}
            <span className={getCongestionTextClass(currentCongestion)}>{currentCongestion}</span>
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Forecast projects{' '}
            <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100">
              +{forecast.arrivals3h}
            </span>{' '}
            arrivals over the next 3 hours ({forecast.trendDirection.toLowerCase()} trend, peak{' '}
            <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100">
              {forecast.peakOccupancyPercent}%
            </span>{' '}
            at {forecast.peakHourLabel}).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onManualRefreshPulse}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Step +5m Pulse</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('beds')}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors whitespace-nowrap"
          >
            <span>Open Bed Map</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </section>

      {/* Primary KPI Grid (8 core metrics, structured hairline grid, zero nested cards) */}
      <section className="grid grid-cols-2 md:grid-cols-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl divide-y md:divide-y-0 md:divide-x divide-slate-200 dark:divide-slate-800 overflow-hidden">
        <div className="p-4 sm:p-5 space-y-1 border-r md:border-r-0 border-slate-200 dark:border-slate-800">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Current ED Patients</p>
          <p className="font-mono tabular-nums text-2xl font-bold text-slate-900 dark:text-slate-100">
            {totalEdPatients}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {inTreatmentCount} tracked in treatment
          </p>
        </div>

        <div className="p-4 sm:p-5 space-y-1">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Bed Occupancy ({occupiedCount}/{usableBeds.length})
          </p>
          <p className={`font-mono tabular-nums text-2xl font-bold ${getCongestionTextClass(currentCongestion)}`}>
            {occupancyPct}%
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {availableCount} open · {cleaningCount} cleaning
          </p>
        </div>

        <div className="p-4 sm:p-5 space-y-1 border-r md:border-r-0 border-slate-200 dark:border-slate-800">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Awaiting Treatment</p>
          <p className="font-mono tabular-nums text-2xl font-bold text-slate-900 dark:text-slate-100">
            {awaitingQueue.length}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            Avg wait {avgWaitMinutes} min · Avg tx {dataset.forecastConfig.avgTreatmentMinutes}m
          </p>
        </div>

        <div className="p-4 sm:p-5 space-y-1">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Predicted Arrivals (1h / 3h / 6h)
          </p>
          <p className="font-mono tabular-nums text-2xl font-bold text-blue-700 dark:text-blue-400">
            {forecast.arrivals1h} <span className="text-slate-400 text-base font-normal">/</span>{' '}
            {forecast.arrivals3h} <span className="text-slate-400 text-base font-normal">/</span>{' '}
            {forecast.arrivals6h}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            Shortage risk: {forecast.timeToShortageLabel}
          </p>
        </div>
      </section>

      {/* Main Focal Visualization + Alerts Split */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-stretch">
        {/* Historical vs Predicted Arrivals & Occupancy Chart */}
        <section className="xl:col-span-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <div>
              <h3 className="font-display font-semibold text-base text-slate-900 dark:text-slate-100">
                Historical vs. Predicted ED Patient Arrivals
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Solid blue: observed hourly intake · Dashed teal: AI forecast · Shaded band: {dataset.forecastConfig.confidenceLevel}% confidence
              </p>
            </div>

            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg self-start sm:self-auto">
              {(['1h', '3h', '6h'] as const).map((win) => (
                <button
                  key={win}
                  type="button"
                  onClick={() => setChartWindow(win)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    chartWindow === win
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  Next {win}
                </button>
              ))}
            </div>
          </div>

          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={combinedTimeline} margin={{ top: 10, right: 16, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 11, fill: axisTextColor }}
                  tickLine={false}
                  axisLine={{ stroke: gridColor }}
                />
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 11, fill: axisTextColor }}
                  tickLine={false}
                  axisLine={false}
                  label={{
                    value: 'Patients / hr',
                    angle: -90,
                    position: 'insideLeft',
                    offset: 18,
                    style: { fontSize: 11, fill: axisTextColor },
                  }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  domain={[30, 115]}
                  tick={{ fontSize: 11, fill: axisTextColor }}
                  tickLine={false}
                  axisLine={false}
                  unit="%"
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: isDark ? '#0F172A' : '#FFFFFF',
                    borderColor: isDark ? '#334155' : '#E2E8F0',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                {nowLabel && (
                  <ReferenceLine
                    x={nowLabel}
                    yAxisId="left"
                    stroke={isDark ? '#64748B' : '#94A3B8'}
                    strokeDasharray="4 4"
                    label={{
                      value: 'Now',
                      position: 'top',
                      fill: axisTextColor,
                      fontSize: 11,
                    }}
                  />
                )}
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="confidenceBand"
                  name="Confidence Range"
                  fill={isDark ? 'rgba(20, 184, 166, 0.18)' : 'rgba(13, 148, 136, 0.14)'}
                  stroke="none"
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="historicalArrivals"
                  name="Actual Arrivals"
                  stroke="#2563EB"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: '#2563EB' }}
                  connectNulls={false}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="predictedArrivals"
                  name="Predicted Arrivals"
                  stroke="#0D9488"
                  strokeWidth={2.5}
                  strokeDasharray="5 4"
                  dot={{ r: 3.5, fill: '#0D9488' }}
                  connectNulls={false}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="occupancyPct"
                  name="Occupancy %"
                  stroke="#6366F1"
                  strokeWidth={1.75}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Active Critical Alerts & Operational Recommendations */}
        <section className="xl:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-4">
              <h3 className="font-display font-semibold text-base text-slate-900 dark:text-slate-100">
                Active Operational Alerts
              </h3>
              <button
                type="button"
                onClick={() => onNavigate('alerts')}
                className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap"
              >
                View all ({dataset.alerts.filter((a) => !a.dismissed).length})
              </button>
            </div>

            {activeAlerts.length === 0 ? (
              <div className="py-10 text-center space-y-2">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  No unacknowledged alerts
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  All ED thresholds are currently within acknowledged parameters.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-200 dark:divide-slate-800">
                {activeAlerts.map((alert) => (
                  <div key={alert.id} className="py-3 first:pt-0 last:pb-0 space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2 min-w-0">
                        <SeverityIcon severity={alert.severity} />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 leading-snug">
                            {alert.title}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            {alert.severity} · {alert.wardOrDepartment} ·{' '}
                            <span className="font-mono tabular-nums">{alert.timestamp}</span>
                          </p>
                        </div>
                      </div>
                    </div>

                    <p className="text-xs text-slate-600 dark:text-slate-300 pl-6">
                      Action: {alert.recommendedAction}
                    </p>

                    <div className="flex items-center gap-2 pl-6 pt-1">
                      <button
                        type="button"
                        onClick={() => onExecuteAlertAction(alert)}
                        className="px-2.5 py-1 rounded-md bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-medium hover:opacity-90 transition-opacity whitespace-nowrap"
                      >
                        Apply Action
                      </button>
                      <button
                        type="button"
                        onClick={() => onAcknowledgeAlert(alert.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
                      >
                        <Check className="w-3 h-3" />
                        <span>Acknowledge</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Ward Capacity Breakdown & 6-Hour Occupancy Curve */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Ward Occupancy Interactive List */}
        <section className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between gap-2 mb-4">
            <div>
              <h3 className="font-display font-semibold text-base text-slate-900 dark:text-slate-100">
                Ward Capacity & Congestion Snapshot
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Click any ward to inspect individual bed units in Bed Intelligence
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('beds')}
              className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap"
            >
              Full Ward Map
            </button>
          </div>

          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {wardSummaries.map((w) => (
              <button
                key={w.id}
                type="button"
                onClick={() => onNavigate('beds', w.id)}
                className="w-full py-3 flex items-center justify-between gap-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 px-2 -mx-2 rounded-lg transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                      {w.name}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums whitespace-nowrap">
                      {w.busy}/{w.total} occupied · {w.avail} open
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${getCongestionBarClass(w.level)}`}
                      style={{ width: `${Math.min(100, w.pct)}%` }}
                    />
                  </div>
                </div>
                <div className="text-right shrink-0 w-20">
                  <span className={`font-mono tabular-nums text-sm font-semibold ${getCongestionTextClass(w.level)}`}>
                    {w.pct}%
                  </span>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{w.level}</p>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* Predicted Arrivals vs Expected Discharges Next 6h */}
        <section className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col">
          <div className="mb-4">
            <h3 className="font-display font-semibold text-base text-slate-900 dark:text-slate-100">
              6-Hour Intake vs. Discharge Balance
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Net positive intake drives bed queue buildup unless turnover accelerates
            </p>
          </div>

          <div className="h-[250px] w-full flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={forecast.hourlyPoints} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                <XAxis
                  dataKey="label"
                  tickFormatter={(val: string) => val.split(' ')[0]}
                  tick={{ fontSize: 11, fill: axisTextColor }}
                  tickLine={false}
                  axisLine={{ stroke: gridColor }}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: axisTextColor }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: isDark ? '#0F172A' : '#FFFFFF',
                    borderColor: isDark ? '#334155' : '#E2E8F0',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="predictedArrivals" name="Predicted Arrivals" fill="#2563EB" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expectedDischarges" name="Expected Discharges" fill="#0D9488" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
    </div>
  );
};
