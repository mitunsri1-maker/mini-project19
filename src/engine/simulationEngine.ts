import { computeForecast } from './forecastEngine';
import { baselineHourlyArrivalRate, formatClockTime, formatHourLabel } from './seedData';
import {
  AlertItem,
  Bed,
  DepartmentName,
  HospitalDataset,
  PatientQueueItem,
  TriageLevel,
  WardId,
} from './types';

const SIM_COMPLAINTS: { dept: DepartmentName; ward: WardId; complaints: string[]; triage: TriageLevel[] }[] = [
  {
    dept: 'Trauma & Resuscitation',
    ward: 'trauma',
    complaints: ['Road traffic injury', 'Acute head trauma', 'Severe laceration w/ bleed'],
    triage: [1, 2],
  },
  {
    dept: 'Cardiac Care',
    ward: 'cardiac',
    complaints: ['Acute chest tightness', 'Rapid arrhythmia / palpitations', 'Transient ischemic symptoms'],
    triage: [1, 2],
  },
  {
    dept: 'Acute Emergency',
    ward: 'acute',
    complaints: ['High fever & chills', 'Acute abdominal guarding', 'Moderate respiratory distress'],
    triage: [2, 3],
  },
  {
    dept: 'Pediatric ED',
    ward: 'pediatric',
    complaints: ['Pediatric croup / stridor', 'Acute gastroenteritis', 'Minor limb injury'],
    triage: [2, 3, 4],
  },
  {
    dept: 'Fast Track / Minor Care',
    ward: 'fast_track',
    complaints: ['Minor ankle sprain', 'Localized dermatologic flare', 'Uncomplicated wound check'],
    triage: [4, 5],
  },
];

const AGE_GROUPS = ['0–12 yrs', '13–24 yrs', '25–44 yrs', '45–64 yrs', '65–79 yrs', '80+ yrs'];

/**
 * Advances the entire hospital simulation by stepMinutes (default 5 simulated minutes per tick).
 * Updates bed discharge countdowns, cleaning turnovers, patient wait times, bed allocations,
 * arrival bursts, historical hourly rollups, staffing demands, and dynamic alerts.
 */
export function advanceSimulationTick(prev: HospitalDataset, stepMinutes = 5): HospitalDataset {
  const nextTick = prev.simulation.tickCount + 1;
  const newSimTimestamp = prev.simulation.simTimestamp + stepMinutes * 60_000;
  const newElapsed = prev.simulation.elapsedSimMinutes + stepMinutes;

  let nextPatientSeq = prev.nextPatientSeq;
  let nextAlertSeq = prev.nextAlertSeq;
  let newArrivalsCount = 0;
  let newDischargesCount = 0;

  // Deterministic pseudo-random pulse based on tick so runs are smooth and dynamic
  const pseudoRand = (salt: number) => {
    const x = Math.sin((nextTick + 1) * 12.9898 + salt * 78.233) * 43758.5453;
    return x - Math.floor(x);
  };

  // 1. Update beds: advance discharge countdowns and cleaning cycles
  let updatedBeds: Bed[] = prev.beds.map((bed) => {
    if (bed.status === 'cleaning' && bed.cleaningRemainingMinutes !== null) {
      const rem = bed.cleaningRemainingMinutes - stepMinutes;
      if (rem <= 0) {
        return {
          ...bed,
          status: 'available',
          cleaningRemainingMinutes: null,
          notes: 'Sanitized and cleared for next intake.',
        };
      }
      return { ...bed, cleaningRemainingMinutes: rem };
    }

    if (
      (bed.status === 'occupied' || bed.status === 'critical') &&
      bed.estimatedDischargeMinutes !== null
    ) {
      const rem = bed.estimatedDischargeMinutes - stepMinutes;
      if (rem <= 0) {
        newDischargesCount += 1;
        return {
          ...bed,
          status: 'cleaning',
          patientId: null,
          patientCategory: null,
          triageLevel: null,
          admittedAt: null,
          estimatedDischargeMinutes: null,
          cleaningRemainingMinutes: 12,
          acuityScore: null,
          notes: 'Patient discharged; terminal sanitation started.',
        };
      }
      return { ...bed, estimatedDischargeMinutes: rem };
    }

    return bed;
  });

  // 2. Update existing patient queue wait times & remove discharged beds from active treatment
  const dischargedPatientIds = new Set(
    prev.beds
      .filter((oldB, i) => {
        const newB = updatedBeds[i];
        return (
          (oldB.status === 'occupied' || oldB.status === 'critical') &&
          newB.status === 'cleaning' &&
          oldB.patientId
        );
      })
      .map((b) => b.patientId!)
  );

  let updatedQueue: PatientQueueItem[] = prev.queue
    .map((p) => {
      if (p.assignedBedId && dischargedPatientIds.has(p.id)) {
        return { ...p, status: 'discharged' as const };
      }
      if (p.status === 'waiting' || p.status === 'triaged' || p.status === 'awaiting_bed') {
        const nextWait = p.waitingMinutes + stepMinutes;
        const promotedStatus =
          p.status === 'waiting' && nextWait >= 10
            ? 'triaged'
            : p.status === 'triaged' && nextWait >= 20
              ? 'awaiting_bed'
              : p.status;
        return { ...p, waitingMinutes: nextWait, status: promotedStatus };
      }
      return p;
    })
    .filter((p) => p.status !== 'discharged');

  // 3. Assign available beds to highest-priority waiting patients (ESI 1 -> 5, longest wait first)
  const sortedWaiting = updatedQueue
    .filter((p) => p.status === 'waiting' || p.status === 'triaged' || p.status === 'awaiting_bed')
    .sort((a, b) => a.triageLevel - b.triageLevel || b.waitingMinutes - a.waitingMinutes);

  const newlyAdmittedIds = new Map<string, string>();
  for (const patient of sortedWaiting) {
    // Prefer matching ward, fallback to acute or observation for ESI 2-3
    let matchBedIdx = updatedBeds.findIndex(
      (b) => b.status === 'available' && b.wardId === patient.wardPreference
    );
    if (matchBedIdx === -1 && patient.triageLevel <= 3) {
      matchBedIdx = updatedBeds.findIndex(
        (b) => b.status === 'available' && (b.wardId === 'acute' || b.wardId === 'observation')
      );
    }

    if (matchBedIdx !== -1) {
      const targetBed = updatedBeds[matchBedIdx];
      const isCrit = patient.triageLevel === 1;
      updatedBeds[matchBedIdx] = {
        ...targetBed,
        status: isCrit ? 'critical' : 'occupied',
        patientId: patient.id,
        patientCategory: patient.chiefComplaint,
        triageLevel: patient.triageLevel,
        admittedAt: formatClockTime(newSimTimestamp),
        estimatedDischargeMinutes: Math.max(
          20,
          Math.round(prev.forecastConfig.avgTreatmentMinutes * (patient.triageLevel <= 2 ? 1.35 : 0.85))
        ),
        cleaningRemainingMinutes: null,
        acuityScore: isCrit ? 9 : Math.max(3, 8 - patient.triageLevel),
        notes: 'Admitted automatically via live triage bed matching.',
      };
      newlyAdmittedIds.set(patient.id, targetBed.id);
    }
  }

  if (newlyAdmittedIds.size > 0) {
    updatedQueue = updatedQueue.map((p) =>
      newlyAdmittedIds.has(p.id)
        ? { ...p, status: 'in_treatment', assignedBedId: newlyAdmittedIds.get(p.id)! }
        : p
    );
  }

  // 4. Generate new incoming patient arrivals based on hourly rate + weather/day multipliers
  const simHour = new Date(newSimTimestamp).getHours();
  const baseRatePerHour = baselineHourlyArrivalRate(simHour);
  const weatherBoost =
    prev.forecastConfig.weather === 'Severe Storm / Ice'
      ? 1.28
      : prev.forecastConfig.weather === 'Heatwave'
        ? 1.16
        : prev.forecastConfig.weather === 'Heavy Rain'
          ? 1.12
          : 1.0;
  const dayBoost =
    prev.forecastConfig.dayType === 'Public Holiday'
      ? 1.24
      : prev.forecastConfig.dayType === 'Weekend'
        ? 1.14
        : 1.0;

  const expectedInStep = (baseRatePerHour * weatherBoost * dayBoost * stepMinutes) / 60;
  const wholeArrivals = Math.floor(expectedInStep);
  const fractionalChance = expectedInStep - wholeArrivals;
  const arrivalsThisTick = wholeArrivals + (pseudoRand(1) < fractionalChance ? 1 : 0);

  for (let i = 0; i < arrivalsThisTick; i++) {
    const spec = SIM_COMPLAINTS[Math.floor(pseudoRand(10 + i) * SIM_COMPLAINTS.length)];
    const complaint = spec.complaints[Math.floor(pseudoRand(20 + i) * spec.complaints.length)];
    const triage = spec.triage[Math.floor(pseudoRand(30 + i) * spec.triage.length)];
    const patientId = `PT-${nextPatientSeq}`;
    nextPatientSeq += 1;
    newArrivalsCount += 1;

    updatedQueue.unshift({
      id: patientId,
      triageLevel: triage,
      chiefComplaint: complaint,
      ageGroup:
        spec.ward === 'pediatric'
          ? '0–12 yrs'
          : AGE_GROUPS[1 + Math.floor(pseudoRand(40 + i) * (AGE_GROUPS.length - 1))],
      arrivalTime: formatClockTime(newSimTimestamp),
      arrivalOffsetMinutes: newElapsed,
      waitingMinutes: 0,
      department: spec.dept,
      wardPreference: spec.ward,
      status: triage === 1 ? 'awaiting_bed' : 'waiting',
      assignedBedId: null,
      estimatedTreatmentMinutes: triage <= 2 ? 65 : triage === 3 ? 45 : 25,
    });
  }

  // 5. Update current hour in historicalHours so charts visibly respond to live arrivals
  const updatedHistory = [...prev.historicalHours];
  const lastIdx = updatedHistory.length - 1;
  const usableTotal = Math.max(1, updatedBeds.filter((b) => b.status !== 'out_of_service').length);
  const occCount = updatedBeds.filter(
    (b) => b.status === 'occupied' || b.status === 'critical' || b.status === 'reserved'
  ).length;
  const liveOccPct = Math.round((occCount / usableTotal) * 100);
  const waitingList = updatedQueue.filter(
    (p) => p.status === 'waiting' || p.status === 'triaged' || p.status === 'awaiting_bed'
  );
  const avgWait =
    waitingList.length > 0
      ? Math.round(waitingList.reduce((s, p) => s + p.waitingMinutes, 0) / waitingList.length)
      : 8;

  if (lastIdx >= 0) {
    const curHourLabel = formatHourLabel(simHour);
    if (updatedHistory[lastIdx].hourLabel === curHourLabel) {
      const prevPt = updatedHistory[lastIdx];
      updatedHistory[lastIdx] = {
        ...prevPt,
        arrivals: prevPt.arrivals + newArrivalsCount,
        discharges: prevPt.discharges + newDischargesCount,
        occupancyPercent: liveOccPct,
        avgWaitMinutes: avgWait,
        congestionIndex: Math.min(100, Math.round(liveOccPct * 0.76 + avgWait * 0.45)),
      };
    } else {
      updatedHistory.shift();
      updatedHistory.push({
        hourLabel: curHourLabel,
        hourOfDay: simHour,
        arrivals: Math.max(1, newArrivalsCount),
        discharges: newDischargesCount,
        occupancyPercent: liveOccPct,
        avgWaitMinutes: avgWait,
        congestionIndex: Math.min(100, Math.round(liveOccPct * 0.76 + avgWait * 0.45)),
        triageHighAcuity: 1,
        triageMidAcuity: Math.max(0, newArrivalsCount - 1),
        triageLowAcuity: 0,
      });
    }
  }

  // 6. Dynamically recalculate staffing demand based on occupancy + forecast
  const tempDataset: HospitalDataset = {
    ...prev,
    beds: updatedBeds,
    queue: updatedQueue,
    historicalHours: updatedHistory,
    simulation: {
      ...prev.simulation,
      simTimestamp: newSimTimestamp,
      elapsedSimMinutes: newElapsed,
      tickCount: nextTick,
    },
  };
  const liveForecast = computeForecast(tempDataset);

  const demandMultiplier = liveOccPct >= prev.settings.criticalThreshold ? 1.25 : liveOccPct >= prev.settings.highThreshold ? 1.12 : 1.0;
  const updatedStaff = prev.staffRoles.map((role) => {
    const baseReq =
      role.id === 'rn-bedside'
        ? Math.ceil((occCount / 3.0) * demandMultiplier)
        : role.id === 'md-attending'
          ? Math.ceil((liveForecast.arrivals1h / 2.2) * demandMultiplier)
          : role.id === 'rn-triage'
            ? Math.max(3, Math.ceil(waitingList.length / 4.5))
            : role.id === 'evs-turn'
              ? Math.max(3, Math.ceil(updatedBeds.filter((b) => b.status === 'cleaning').length * 1.4 + 2))
              : Math.max(3, Math.ceil(demandMultiplier * 3.2));

    const util = Math.min(115, Math.round((baseReq / Math.max(1, role.onDuty)) * 88));
    return {
      ...role,
      recommendedRequired: Math.max(role.scheduledBase - 1, baseReq),
      utilizationPercent: util,
    };
  });

  // 7. Trigger new operational alerts when thresholds are crossed
  const updatedAlerts: AlertItem[] = [...prev.alerts];
  const hasActiveCategory = (cat: AlertItem['category']) =>
    updatedAlerts.some((a) => !a.dismissed && !a.acknowledged && a.category === cat);

  if (liveOccPct >= prev.settings.criticalThreshold && !hasActiveCategory('Congestion')) {
    updatedAlerts.unshift({
      id: `ALT-${nextAlertSeq}`,
      severity: 'Critical',
      category: 'Congestion',
      title: `Critical ED Congestion Reached (${liveOccPct}% Bed Occupancy)`,
      description: `Live occupancy crossed the ${prev.settings.criticalThreshold}% critical threshold with ${waitingList.length} patients in active queue.`,
      timestamp: formatClockTime(newSimTimestamp),
      wardOrDepartment: 'All ED Wards',
      recommendedAction: 'Activate surge overflow beds & expedite EVS turnaround',
      actionType: 'open_overflow',
      acknowledged: false,
      dismissed: false,
    });
    nextAlertSeq += 1;
  } else if (
    avgWait >= prev.settings.waitTimeAlertMinutes &&
    !hasActiveCategory('Wait Time')
  ) {
    updatedAlerts.unshift({
      id: `ALT-${nextAlertSeq}`,
      severity: 'High',
      category: 'Wait Time',
      title: `Average Waiting Time Surpassed ${prev.settings.waitTimeAlertMinutes} Min`,
      description: `Current queue average wait is ${avgWait} minutes across ${waitingList.length} waiting patients.`,
      timestamp: formatClockTime(newSimTimestamp),
      wardOrDepartment: 'Intake & Triage',
      recommendedAction: 'Assign float triage specialist & divert ESI 4-5 to Fast Track',
      actionType: 'divert_fast_track',
      acknowledged: false,
      dismissed: false,
    });
    nextAlertSeq += 1;
  }

  return {
    ...prev,
    beds: updatedBeds,
    queue: updatedQueue,
    historicalHours: updatedHistory,
    staffRoles: updatedStaff,
    alerts: updatedAlerts.slice(0, 25),
    simulation: {
      ...prev.simulation,
      simTimestamp: newSimTimestamp,
      elapsedSimMinutes: newElapsed,
      tickCount: nextTick,
      totalSimulatedArrivals: prev.simulation.totalSimulatedArrivals + newArrivalsCount,
      totalSimulatedDischarges: prev.simulation.totalSimulatedDischarges + newDischargesCount,
    },
    nextPatientSeq,
    nextAlertSeq,
  };
}
