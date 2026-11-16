import { baselineHourlyArrivalRate, formatHourLabel } from './seedData';
import {
  CongestionLevel,
  FeatureAttribution,
  ForecastConfig,
  ForecastHourPoint,
  ForecastOutput,
  HospitalDataset,
  WardForecastRisk,
  WardId,
} from './types';

export function classifyCongestion(
  occupancyPercent: number,
  elevated = 72,
  high = 84,
  critical = 93
): CongestionLevel {
  if (occupancyPercent >= critical) return 'Critical';
  if (occupancyPercent >= high) return 'High';
  if (occupancyPercent >= elevated) return 'Elevated';
  return 'Normal';
}

/**
 * Multi-factor statistical + autoregressive forecasting engine.
 * Combines:
 * 1. Diurnal hour-of-day seasonal curve
 * 2. Day-of-week & holiday surge multipliers
 * 3. Weather risk factors (rain/heatwave/severe storm)
 * 4. Exponentially weighted arrival momentum from last 3 observed hours
 * 5. Queue backlog pressure & treatment duration outflow elasticity
 */
export function computeForecast(
  dataset: HospitalDataset,
  overrideConfig?: Partial<ForecastConfig>
): ForecastOutput {
  const cfg: ForecastConfig = {
    ...dataset.forecastConfig,
    ...overrideConfig,
  };
  const { settings, beds, queue, historicalHours, simulation, staffRoles } = dataset;

  const usableBeds = beds.filter((b) => b.status !== 'out_of_service');
  const totalUsableBeds = Math.max(1, usableBeds.length);
  const currentlyOccupied = beds.filter(
    (b) => b.status === 'occupied' || b.status === 'critical' || b.status === 'reserved'
  ).length;

  const waitingQueueCount = queue.filter(
    (p) => p.status === 'waiting' || p.status === 'triaged' || p.status === 'awaiting_bed'
  ).length;

  // 1. Weather factor
  const weatherMultiplierMap: Record<ForecastConfig['weather'], number> = {
    Clear: 1.0,
    'Heavy Rain': 1.12,
    Heatwave: 1.16,
    'Severe Storm / Ice': 1.27,
  };
  const weatherMult = weatherMultiplierMap[cfg.weather];

  // 2. Day-type & holiday factor
  const dayMult =
    cfg.dayType === 'Weekend' ? 1.14 : cfg.dayType === 'Public Holiday' ? 1.24 : 1.0;
  const holidayMult = cfg.isHolidaySurge ? 1.15 : 1.0;

  // 3. Model mode sensitivity
  const modeMult =
    cfg.modelMode === 'Surge Sensitive'
      ? 1.09
      : cfg.modelMode === 'Seasonal Baseline'
        ? 0.96
        : 1.0;

  // 4. Autoregressive recent momentum from last 3 historical hours vs baseline
  const recent3 = historicalHours.slice(-3);
  let momentumRatio = 1.0;
  if (recent3.length > 0) {
    const weights = [0.2, 0.3, 0.5];
    let weightedRatio = 0;
    let totalW = 0;
    recent3.forEach((pt, idx) => {
      const w = weights[idx] ?? 0.33;
      const base = Math.max(1, baselineHourlyArrivalRate(pt.hourOfDay));
      weightedRatio += (pt.arrivals / base) * w;
      totalW += w;
    });
    // Dampen toward 1.0 so spikes don't explode indefinitely
    momentumRatio = 1 + (weightedRatio / totalW - 1) * 0.55;
    momentumRatio = Math.max(0.82, Math.min(1.32, momentumRatio));
  }

  // 5. Treatment duration & staff capacity impact on discharge throughput
  // Longer treatment duration reduces hourly discharges; float staff increases throughput slightly
  const totalOnDuty = staffRoles.reduce((acc, r) => acc + r.onDuty, 0);
  const totalRecommended = staffRoles.reduce((acc, r) => acc + r.recommendedRequired, 0);
  const staffingEfficiency = Math.max(0.84, Math.min(1.12, totalOnDuty / Math.max(1, totalRecommended)));
  const treatmentThroughputFactor = (48 / Math.max(25, cfg.avgTreatmentMinutes)) * staffingEfficiency;

  // Z-score for confidence interval
  const zScore = cfg.confidenceLevel === 95 ? 1.96 : cfg.confidenceLevel === 90 ? 1.645 : 1.28;

  const currentHour = new Date(simulation.simTimestamp).getHours();
  const hourlyPoints: ForecastHourPoint[] = [];

  let runningOccupied = currentlyOccupied;
  let runningBacklog = waitingQueueCount;

  for (let step = 1; step <= 6; step++) {
    const targetHour = (currentHour + step) % 24;
    const seasonalBase = baselineHourlyArrivalRate(targetHour);

    // Autoregressive momentum decays over horizon
    const decayedMomentum = 1 + (momentumRatio - 1) * Math.pow(0.75, step - 1);

    const predictedExact =
      seasonalBase * weatherMult * dayMult * holidayMult * modeMult * decayedMomentum;
    const predictedArrivals = Math.max(2, Math.round(predictedExact));

    // Standard error grows with sqrt(step)
    const sigma = Math.sqrt(predictedExact) * (0.38 + step * 0.11);
    const margin = Math.max(1, Math.round(zScore * sigma));
    const lowerBound = Math.max(1, predictedArrivals - margin);
    const upperBound = predictedArrivals + margin;

    // Estimate scheduled discharges in this 1-hour window from actual beds + ongoing turnover
    const windowStartMin = (step - 1) * 60;
    const windowEndMin = step * 60;
    const scheduledFromCurrentBeds = beds.filter(
      (b) =>
        (b.status === 'occupied' || b.status === 'critical') &&
        b.estimatedDischargeMinutes !== null &&
        b.estimatedDischargeMinutes > windowStartMin &&
        b.estimatedDischargeMinutes <= windowEndMin
    ).length;

    const steadyTurnover = Math.round(
      (runningOccupied * 0.24 * treatmentThroughputFactor) + scheduledFromCurrentBeds * 0.45
    );
    const expectedDischarges = Math.max(3, Math.min(runningOccupied, steadyTurnover));

    // Net demand hitting beds = arrivals + fraction of backlog clearing into beds
    const backlogConversion = Math.round(runningBacklog * 0.35);
    const netChange = predictedArrivals + backlogConversion - expectedDischarges;

    const rawProjectedOccupied = Math.max(10, runningOccupied + netChange);
    const projectedShortageBeds = Math.max(0, rawProjectedOccupied - totalUsableBeds);
    runningOccupied = Math.min(totalUsableBeds + 12, rawProjectedOccupied);
    runningBacklog = Math.max(
      0,
      runningBacklog + Math.max(0, rawProjectedOccupied - totalUsableBeds) - Math.floor(backlogConversion * 0.6)
    );

    const expectedOccupancyPercent = Math.min(
      118,
      Math.round((rawProjectedOccupied / totalUsableBeds) * 100)
    );
    const availableBedsProjected = Math.max(0, totalUsableBeds - rawProjectedOccupied);

    const congestionIndex = Math.min(
      100,
      Math.round(expectedOccupancyPercent * 0.78 + Math.min(25, runningBacklog * 1.15))
    );
    const congestionLevel = classifyCongestion(
      expectedOccupancyPercent,
      settings.elevatedThreshold,
      settings.highThreshold,
      settings.criticalThreshold
    );

    hourlyPoints.push({
      stepHour: step,
      label: `+${step}h (${formatHourLabel(targetHour)})`,
      hourOfDay: targetHour,
      predictedArrivals,
      lowerBound,
      upperBound,
      expectedDischarges,
      expectedOccupiedBeds: Math.min(totalUsableBeds, rawProjectedOccupied),
      expectedOccupancyPercent,
      availableBedsProjected,
      congestionIndex,
      congestionLevel,
      projectedShortageBeds,
    });
  }

  const arrivals1h = hourlyPoints[0].predictedArrivals;
  const arrivals3h = hourlyPoints.slice(0, 3).reduce((s, p) => s + p.predictedArrivals, 0);
  const arrivals6h = hourlyPoints.reduce((s, p) => s + p.predictedArrivals, 0);

  const margin1h = Math.round((hourlyPoints[0].upperBound - hourlyPoints[0].lowerBound) / 2);
  const margin3h = Math.round(
    hourlyPoints.slice(0, 3).reduce((s, p) => s + (p.upperBound - p.lowerBound) / 2, 0) * 0.68
  );
  const margin6h = Math.round(
    hourlyPoints.reduce((s, p) => s + (p.upperBound - p.lowerBound) / 2, 0) * 0.56
  );

  const expectedOccupancy1h = hourlyPoints[0].expectedOccupancyPercent;
  const expectedOccupancy3h = hourlyPoints[2].expectedOccupancyPercent;
  const expectedOccupancy6h = hourlyPoints[5].expectedOccupancyPercent;

  const currentOccPercent = Math.round((currentlyOccupied / totalUsableBeds) * 100);
  const peakPoint = hourlyPoints.reduce(
    (best, pt) => (pt.expectedOccupancyPercent > best.expectedOccupancyPercent ? pt : best),
    hourlyPoints[0]
  );

  const delta3h = expectedOccupancy3h - currentOccPercent;
  const trendDirection: ForecastOutput['trendDirection'] =
    delta3h >= 9 ? 'Surging' : delta3h >= 3 ? 'Rising' : delta3h <= -4 ? 'Easing' : 'Stable';

  const firstShortage = hourlyPoints.find(
    (p) => p.projectedShortageBeds > 0 || p.expectedOccupancyPercent >= settings.criticalThreshold
  );
  const timeToShortageLabel = firstShortage
    ? `~${firstShortage.stepHour} hr${firstShortage.stepHour > 1 ? 's' : ''} (${formatHourLabel(firstShortage.hourOfDay)})`
    : 'No shortage in 6h';

  // Feature Attributions
  const weatherImpact = Math.round((weatherMult - 1) * 100);
  const dayImpact = Math.round((dayMult * holidayMult - 1) * 100);
  const momentumImpact = Math.round((momentumRatio - 1) * 100);
  const backlogImpact = Math.round((waitingQueueCount / totalUsableBeds) * 65);
  const diurnalDelta = Math.round(
    ((hourlyPoints[2].predictedArrivals / Math.max(1, baselineHourlyArrivalRate(currentHour))) - 1) * 32
  );

  const featureAttributions: FeatureAttribution[] = [
    {
      factor: 'Hour-of-Day Diurnal Pattern',
      impactPercent: Math.abs(diurnalDelta) + 18,
      direction: diurnalDelta >= 0 ? 'increase' : 'decrease',
      detail: `Midday/evening ED arrival curve shifting into ${formatHourLabel((currentHour + 3) % 24)}`,
    },
    {
      factor: 'Active Queue & Bed Backlog',
      impactPercent: Math.max(8, backlogImpact),
      direction: waitingQueueCount > 8 ? 'increase' : 'neutral',
      detail: `${waitingQueueCount} patients awaiting triage or bed placement`,
    },
    {
      factor: 'Recent 3h Arrival Momentum',
      impactPercent: Math.max(5, Math.abs(momentumImpact) + 7),
      direction: momentumImpact > 2 ? 'increase' : momentumImpact < -2 ? 'decrease' : 'neutral',
      detail: `Autoregressive EWMA ratio at ${momentumRatio.toFixed(2)}x seasonal baseline`,
    },
    {
      factor: 'Weather & Environmental Risk',
      impactPercent: weatherImpact > 0 ? weatherImpact + 4 : 4,
      direction: weatherImpact > 0 ? 'increase' : 'neutral',
      detail: `${cfg.weather} conditions (${weatherMult.toFixed(2)}x arrival factor)`,
    },
    {
      factor: 'Calendar & Treatment Duration',
      impactPercent: Math.max(5, dayImpact + Math.abs(cfg.avgTreatmentMinutes - 48) * 0.4),
      direction: dayImpact > 0 || cfg.avgTreatmentMinutes > 48 ? 'increase' : 'decrease',
      detail: `${cfg.dayType}${cfg.isHolidaySurge ? ' + Holiday' : ''} · ${cfg.avgTreatmentMinutes}m avg treatment`,
    },
  ];

  // Ward-level 3h shortage risk breakdown
  const wardArrivalShare: Record<WardId, number> = {
    trauma: 0.14,
    acute: 0.31,
    cardiac: 0.16,
    pediatric: 0.14,
    fast_track: 0.18,
    observation: 0.07,
  };

  const wardRisks: WardForecastRisk[] = dataset.wards.map((w) => {
    const wBeds = beds.filter((b) => b.wardId === w.id && b.status !== 'out_of_service');
    const available = wBeds.filter((b) => b.status === 'available').length;
    const occOrCrit = wBeds.filter((b) => b.status === 'occupied' || b.status === 'critical').length;
    const cleanOrRes = wBeds.filter((b) => b.status === 'cleaning' || b.status === 'reserved').length;

    const queueForWard = queue.filter(
      (q) =>
        q.wardPreference === w.id &&
        (q.status === 'waiting' || q.status === 'triaged' || q.status === 'awaiting_bed')
    ).length;

    const predictedDemand3h = Math.max(
      1,
      Math.round(arrivals3h * wardArrivalShare[w.id] * 0.55 + queueForWard)
    );
    const expectedTurnovers3h = Math.max(
      1,
      wBeds.filter(
        (b) =>
          (b.status === 'occupied' || b.status === 'critical') &&
          b.estimatedDischargeMinutes !== null &&
          b.estimatedDischargeMinutes <= 180
      ).length
    );

    const netCapacity3h = available + cleanOrRes + expectedTurnovers3h;
    const projectedDeficit3h = Math.max(0, predictedDemand3h - netCapacity3h);
    const projectedOccPct = Math.round(
      ((occOrCrit + Math.max(0, predictedDemand3h - expectedTurnovers3h)) / Math.max(1, wBeds.length)) * 100
    );

    return {
      wardId: w.id,
      wardName: w.name,
      totalBeds: wBeds.length,
      currentlyAvailable: available,
      occupiedOrCritical: occOrCrit,
      cleaningOrReserved: cleanOrRes,
      predictedDemand3h,
      projectedDeficit3h,
      riskLevel: classifyCongestion(
        projectedOccPct,
        settings.elevatedThreshold,
        settings.highThreshold,
        settings.criticalThreshold
      ),
    };
  });

  return {
    hourlyPoints,
    arrivals1h,
    arrivals3h,
    arrivals6h,
    confidenceMargin1h: margin1h,
    confidenceMargin3h: margin3h,
    confidenceMargin6h: margin6h,
    expectedOccupancy1h,
    expectedOccupancy3h,
    expectedOccupancy6h,
    predictedCongestion1h: hourlyPoints[0].congestionLevel,
    predictedCongestion3h: hourlyPoints[2].congestionLevel,
    predictedCongestion6h: hourlyPoints[5].congestionLevel,
    trendDirection,
    peakHourLabel: formatHourLabel(peakPoint.hourOfDay),
    peakOccupancyPercent: peakPoint.expectedOccupancyPercent,
    timeToShortageLabel,
    featureAttributions,
    wardRisks,
  };
}
