import React, { useMemo } from 'react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { RotateCcw } from 'lucide-react';
import {
  DayType,
  ForecastConfig,
  ForecastModelMode,
  ForecastOutput,
  HospitalDataset,
  WeatherCondition,
} from '../../engine/types';
import { getCongestionTextClass } from '../shared/StatusHelpers';

interface ForecastingViewProps {
  dataset: HospitalDataset;
  forecast: ForecastOutput;
  isDark: boolean;
  onUpdateForecastConfig: (patch: Partial<ForecastConfig>) => void;
  onResetForecastConfig: () => void;
}

export const ForecastingView: React.FC<ForecastingViewProps> = ({
  dataset,
  forecast,
  isDark,
  onUpdateForecastConfig,
  onResetForecastConfig,
}) => {
  const cfg = dataset.forecastConfig;

  const arrivalChartData = useMemo(() => {
    const hist = dataset.historicalHours.slice(-6).map((h, i, arr) => ({
      time: h.hourLabel,
      actual: h.arrivals,
      predicted: i === arr.length - 1 ? h.arrivals : null,
      band: null as [number, number] | null,
      expectedOcc: h.occupancyPercent,
    }));
    const pred = forecast.hourlyPoints.slice(0, cfg.horizonHours).map((p) => ({
      time: p.label.split(' ')[1]?.replace(/[()]/g, '') || p.label,
      actual: null as number | null,
      predicted: p.predictedArrivals,
      band: [p.lowerBound, p.upperBound] as [number, number],
      expectedOcc: p.expectedOccupancyPercent,
    }));
    return [...hist, ...pred];
  }, [dataset.historicalHours, forecast.hourlyPoints, cfg.horizonHours]);

  const gridColor = isDark ? '#1E293B' : '#E2E8F0';
  const axisTextColor = isDark ? '#94A3B8' : '#64748B';

  return (
    <div className="space-y-6">
      {/* Interactive Forecasting Parameter Controls */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 mb-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h2 className="font-display font-semibold text-base text-slate-900 dark:text-slate-100">
              AI Crowd Forecasting Model Parameters
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Adjust environmental, calendar, and clinical throughput variables to recalculate 1–6 hour projections live
            </p>
          </div>
          <button
            type="button"
            onClick={onResetForecastConfig}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors self-start sm:self-auto whitespace-nowrap"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Parameters</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Horizon */}
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
              Forecast Horizon
            </label>
            <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
              {([1, 3, 6] as const).map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => onUpdateForecastConfig({ horizonHours: h })}
                  className={`py-1.5 text-xs font-medium rounded-md transition-colors ${
                    cfg.horizonHours === h
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {h} Hr{h > 1 ? 's' : ''}
                </button>
              ))}
            </div>
          </div>

          {/* Weather */}
          <div>
            <label htmlFor="fc-weather" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
              Weather Condition
            </label>
            <select
              id="fc-weather"
              value={cfg.weather}
              onChange={(e) => onUpdateForecastConfig({ weather: e.target.value as WeatherCondition })}
              className="w-full px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="Clear">Clear (1.00x)</option>
              <option value="Heavy Rain">Heavy Rain (+12%)</option>
              <option value="Heatwave">Heatwave (+16%)</option>
              <option value="Severe Storm / Ice">Severe Storm / Ice (+27%)</option>
            </select>
          </div>

          {/* Day Type */}
          <div>
            <label htmlFor="fc-day" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
              Day & Calendar Mode
            </label>
            <select
              id="fc-day"
              value={cfg.dayType}
              onChange={(e) => onUpdateForecastConfig({ dayType: e.target.value as DayType })}
              className="w-full px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="Weekday">Weekday Baseline</option>
              <option value="Weekend">Weekend (+14%)</option>
              <option value="Public Holiday">Public Holiday (+24%)</option>
            </select>
          </div>

          {/* Model Mode */}
          <div>
            <label htmlFor="fc-model" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
              Ensemble Sensitivity
            </label>
            <select
              id="fc-model"
              value={cfg.modelMode}
              onChange={(e) => onUpdateForecastConfig({ modelMode: e.target.value as ForecastModelMode })}
              className="w-full px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="Balanced Ensemble">Balanced Ensemble</option>
              <option value="Surge Sensitive">Surge Sensitive (+9%)</option>
              <option value="Seasonal Baseline">Seasonal Baseline (-4%)</option>
            </select>
          </div>

          {/* Treatment Duration Slider */}
          <div>
            <div className="flex items-center justify-between text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
              <label htmlFor="fc-tx">Avg Treatment Duration</label>
              <span className="font-mono tabular-nums text-slate-900 dark:text-slate-100">
                {cfg.avgTreatmentMinutes}m
              </span>
            </div>
            <input
              id="fc-tx"
              type="range"
              min={25}
              max={90}
              step={1}
              value={cfg.avgTreatmentMinutes}
              onChange={(e) => onUpdateForecastConfig({ avgTreatmentMinutes: Number(e.target.value) })}
              className="w-full accent-blue-600 cursor-pointer"
            />
            <label className="mt-1.5 inline-flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
              <input
                type="checkbox"
                checked={cfg.isHolidaySurge}
                onChange={(e) => onUpdateForecastConfig({ isHolidaySurge: e.target.checked })}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-600"
              />
              <span>Regional Event / Holiday Surge (+15%)</span>
            </label>
          </div>
        </div>
      </section>

      {/* 1h / 3h / 6h Horizon Forecast Cards */}
      <section className="grid grid-cols-1 md:grid-cols-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl divide-y md:divide-y-0 md:divide-x divide-slate-200 dark:divide-slate-800">
        {[
          {
            window: 'Next 1 Hour',
            arrivals: forecast.arrivals1h,
            margin: forecast.confidenceMargin1h,
            occ: forecast.expectedOccupancy1h,
            congestion: forecast.predictedCongestion1h,
          },
          {
            window: 'Next 3 Hours',
            arrivals: forecast.arrivals3h,
            margin: forecast.confidenceMargin3h,
            occ: forecast.expectedOccupancy3h,
            congestion: forecast.predictedCongestion3h,
          },
          {
            window: 'Next 6 Hours',
            arrivals: forecast.arrivals6h,
            margin: forecast.confidenceMargin6h,
            occ: forecast.expectedOccupancy6h,
            congestion: forecast.predictedCongestion6h,
          },
        ].map((item) => (
          <div key={item.window} className="p-5 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span className="font-medium">{item.window}</span>
              <span className={`font-semibold ${getCongestionTextClass(item.congestion)}`}>
                {item.congestion} Congestion
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-mono tabular-nums text-3xl font-bold text-slate-900 dark:text-slate-100">
                {item.arrivals}
              </span>
              <span className="font-mono tabular-nums text-xs text-slate-500 dark:text-slate-400">
                ±{item.margin} patients ({cfg.confidenceLevel}% CI)
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 tabular-nums">
              Expected Occupancy: <span className="font-mono font-semibold">{item.occ}%</span> · Trend:{' '}
              {forecast.trendDirection}
            </p>
          </div>
        ))}
      </section>

      {/* Dual Forecast Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <h3 className="font-display font-semibold text-base text-slate-900 dark:text-slate-100">
            Predicted Arrival Trajectory & Uncertainty Band
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
            Hourly arrivals with {cfg.confidenceLevel}% prediction interval over selected {cfg.horizonHours}h horizon
          </p>
          <div className="h-[270px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={arrivalChartData} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                <XAxis dataKey="time" tick={{ fontSize: 11, fill: axisTextColor }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: axisTextColor }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: isDark ? '#0F172A' : '#FFFFFF',
                    borderColor: isDark ? '#334155' : '#E2E8F0',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="band"
                  name={`${cfg.confidenceLevel}% Interval`}
                  fill={isDark ? 'rgba(37, 99, 235, 0.22)' : 'rgba(37, 99, 235, 0.14)'}
                  stroke="none"
                />
                <Line
                  type="monotone"
                  dataKey="actual"
                  name="Observed Arrivals"
                  stroke="#64748B"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  connectNulls={false}
                />
                <Line
                  type="monotone"
                  dataKey="predicted"
                  name="Forecast Arrivals"
                  stroke="#2563EB"
                  strokeWidth={2.5}
                  dot={{ r: 3.5, fill: '#2563EB' }}
                  connectNulls={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <h3 className="font-display font-semibold text-base text-slate-900 dark:text-slate-100">
            Projected ED Occupancy vs. Capacity Thresholds
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
            Dashed lines indicate High ({dataset.settings.highThreshold}%) and Critical ({dataset.settings.criticalThreshold}%) congestion triggers
          </p>
          <div className="h-[270px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={forecast.hourlyPoints} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                <XAxis
                  dataKey="label"
                  tickFormatter={(v: string) => v.split(' ')[0]}
                  tick={{ fontSize: 11, fill: axisTextColor }}
                  tickLine={false}
                />
                <YAxis domain={[40, 115]} unit="%" tick={{ fontSize: 11, fill: axisTextColor }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: isDark ? '#0F172A' : '#FFFFFF',
                    borderColor: isDark ? '#334155' : '#E2E8F0',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <ReferenceLine
                  y={dataset.settings.highThreshold}
                  stroke="#D97706"
                  strokeDasharray="4 4"
                  label={{ value: 'High', position: 'right', fill: '#D97706', fontSize: 10 }}
                />
                <ReferenceLine
                  y={dataset.settings.criticalThreshold}
                  stroke="#DC2626"
                  strokeDasharray="4 4"
                  label={{ value: 'Critical', position: 'right', fill: '#DC2626', fontSize: 10 }}
                />
                <Area
                  type="monotone"
                  dataKey="expectedOccupancyPercent"
                  name="Projected Occupancy %"
                  fill={isDark ? 'rgba(99, 102, 241, 0.22)' : 'rgba(99, 102, 241, 0.14)'}
                  stroke="#4F46E5"
                  strokeWidth={2.5}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      {/* Feature Attribution & Ward Shortage Risk */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <h3 className="font-display font-semibold text-base text-slate-900 dark:text-slate-100 mb-1">
            Model Feature Attribution
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
            Relative weight of factors driving the current arrival prediction
          </p>

          <div className="space-y-3.5">
            {forecast.featureAttributions.map((feat) => (
              <div key={feat.factor} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-800 dark:text-slate-200">{feat.factor}</span>
                  <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100">
                    {Math.round(feat.impactPercent)}% weight
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      feat.direction === 'increase'
                        ? 'bg-blue-600 dark:bg-blue-500'
                        : feat.direction === 'decrease'
                          ? 'bg-teal-600 dark:bg-teal-500'
                          : 'bg-slate-400 dark:bg-slate-500'
                    }`}
                    style={{ width: `${Math.min(100, feat.impactPercent * 2)}%` }}
                  />
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">{feat.detail}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 overflow-x-auto">
          <h3 className="font-display font-semibold text-base text-slate-900 dark:text-slate-100 mb-1">
            Ward-Level Capacity & 3-Hour Shortage Projection
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
            Identifies wards where predicted arrivals exceed open beds and expected discharges
          </p>

          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                <th className="py-2.5 pr-3 font-medium">Ward</th>
                <th className="py-2.5 px-3 font-medium text-right">Open Now</th>
                <th className="py-2.5 px-3 font-medium text-right">3h Demand</th>
                <th className="py-2.5 px-3 font-medium text-right">Projected Deficit</th>
                <th className="py-2.5 pl-3 font-medium text-right">Risk Level</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {forecast.wardRisks.map((wr) => (
                <tr key={wr.wardId} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="py-2.5 pr-3 font-medium text-slate-900 dark:text-slate-100">
                    {wr.wardName}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                    {wr.currentlyAvailable}/{wr.totalBeds}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                    {wr.predictedDemand3h} pts
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold">
                    {wr.projectedDeficit3h > 0 ? (
                      <span className="text-rose-700 dark:text-rose-400">-{wr.projectedDeficit3h} beds</span>
                    ) : (
                      <span className="text-teal-700 dark:text-teal-400">Balanced</span>
                    )}
                  </td>
                  <td className={`py-2.5 pl-3 text-right font-semibold ${getCongestionTextClass(wr.riskLevel)}`}>
                    {wr.riskLevel}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
};
