import {
  AlertItem,
  Bed,
  BedStatus,
  DepartmentName,
  ForecastConfig,
  HistoricalHourPoint,
  HospitalDataset,
  HospitalSettings,
  PatientQueueItem,
  StaffRoleMetric,
  TriageLevel,
  Ward,
  WardId,
} from './types';

// Deterministic Mulberry32 PRNG for reproducible demo states
export function createSeededRng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const WARDS: Ward[] = [
  {
    id: 'trauma',
    name: 'Trauma & Resuscitation Bay',
    shortCode: 'TR',
    department: 'Trauma & Resuscitation',
    floor: 'Level 1 · Zone A',
    targetTurnoverMinutes: 18,
  },
  {
    id: 'acute',
    name: 'Acute Medical Care',
    shortCode: 'AC',
    department: 'Acute Emergency',
    floor: 'Level 1 · Zone B',
    targetTurnoverMinutes: 22,
  },
  {
    id: 'cardiac',
    name: 'Cardiac / Stroke Unit',
    shortCode: 'CR',
    department: 'Cardiac Care',
    floor: 'Level 1 · Zone C',
    targetTurnoverMinutes: 20,
  },
  {
    id: 'pediatric',
    name: 'Pediatric Emergency',
    shortCode: 'PD',
    department: 'Pediatric ED',
    floor: 'Level 1 · West Wing',
    targetTurnoverMinutes: 16,
  },
  {
    id: 'fast_track',
    name: 'Fast Track / Rapid Care',
    shortCode: 'FT',
    department: 'Fast Track / Minor Care',
    floor: 'Level 1 · East Wing',
    targetTurnoverMinutes: 12,
  },
  {
    id: 'observation',
    name: 'ED Observation Unit',
    shortCode: 'OB',
    department: 'Short-Stay Observation',
    floor: 'Level 2 · North',
    targetTurnoverMinutes: 25,
  },
];

const WARD_BED_COUNTS: Record<WardId, number> = {
  trauma: 10,
  acute: 16,
  cardiac: 10,
  pediatric: 10,
  fast_track: 10,
  observation: 8,
};

const CATEGORIES_BY_WARD: Record<WardId, string[]> = {
  trauma: ['Polytrauma MVA', 'Acute Head Injury', 'Penetrating Trauma', 'Severe Fall', 'Major Burn Stabilization'],
  acute: ['Acute Abdominal Pain', 'Sepsis Protocol', 'Community Pneumonia', 'GI Hemorrhage', 'COPD Exacerbation', 'Pyelonephritis'],
  cardiac: ['STEMI Rule-Out', 'Acute Chest Pain', 'Hypertensive Crisis', 'Atrial Fibrillation RVR', 'Acute Stroke Code'],
  pediatric: ['Pediatric Bronchiolitis', 'Febrile Seizure', 'Acute Asthma Flare', 'Pediatric Fracture', 'Severe Dehydration'],
  fast_track: ['Laceration Repair', 'Ankle Sprain', 'Otitis Media', 'Mild Allergic Reaction', 'Urinary Tract Infection'],
  observation: ['Post-Syncope Monitoring', 'Chest Pain Serial Troponin', 'Asthma Observation', 'Headache Stabilization'],
};

const COMPLAINTS_BY_DEPT: {
  dept: DepartmentName;
  ward: WardId;
  complaints: string[];
  triagePool: TriageLevel[];
}[] = [
  {
    dept: 'Trauma & Resuscitation',
    ward: 'trauma',
    complaints: ['Motor vehicle collision', 'High-velocity fall', 'Severe laceration w/ hemorrhage', 'Chest blunt trauma'],
    triagePool: [1, 1, 2],
  },
  {
    dept: 'Cardiac Care',
    ward: 'cardiac',
    complaints: ['Substernal chest pain', 'Acute dyspnea & palpitations', 'Sudden facial droop / slurred speech', 'Syncope episode'],
    triagePool: [1, 2, 2],
  },
  {
    dept: 'Acute Emergency',
    ward: 'acute',
    complaints: ['High fever & hypotension', 'Severe right lower quadrant pain', 'Acute shortness of breath', 'Persistent vomiting & dehydration'],
    triagePool: [2, 3, 3],
  },
  {
    dept: 'Pediatric ED',
    ward: 'pediatric',
    complaints: ['Pediatric wheezing & retractions', 'High fever (infant)', 'Forearm deformity after fall', 'Febrile seizure recovery'],
    triagePool: [2, 3, 3, 4],
  },
  {
    dept: 'Fast Track / Minor Care',
    ward: 'fast_track',
    complaints: ['Minor wrist sprain', 'Simple finger laceration', 'Acute ear pain', 'Localized skin rash'],
    triagePool: [4, 4, 5],
  },
  {
    dept: 'Short-Stay Observation',
    ward: 'observation',
    complaints: ['Observation post-anaphylaxis', 'Mild concussion monitoring', 'Post-rehydration check'],
    triagePool: [3, 4],
  },
];

const AGE_GROUPS = ['0–12 yrs', '13–24 yrs', '25–44 yrs', '45–64 yrs', '65–79 yrs', '80+ yrs'];

export function formatClockTime(epochMs: number): string {
  const d = new Date(epochMs);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function formatHourLabel(hour24: number): string {
  const normalized = ((hour24 % 24) + 24) % 24;
  return `${normalized.toString().padStart(2, '0')}:00`;
}

// Baseline diurnal arrival rate (patients per hour) for a mid-size urban Level-1 ED (~64 beds)
export function baselineHourlyArrivalRate(hourOfDay: number): number {
  const curve = [
    6.2, 5.1, 4.4, 3.9, 4.2, 5.3, // 00-05
    7.4, 9.6, 12.2, 14.5, 16.4, 17.8, // 06-11
    17.4, 16.9, 16.2, 15.8, 16.6, 17.9, // 12-17
    19.1, 18.4, 16.8, 14.2, 11.4, 8.5, // 18-23
  ];
  return curve[((hourOfDay % 24) + 24) % 24];
}

export function createInitialDataset(seed = 20261116): HospitalDataset {
  const rng = createSeededRng(seed);
  // Anchor simulated time to 10:45 AM local clinical shift
  const baseDate = new Date(2026, 10, 16, 10, 45, 0, 0);
  const simTimestamp = baseDate.getTime();

  const beds: Bed[] = [];
  let patientCounter = 4100;

  // Target initial status distributions per ward to create realistic hot-spots
  const wardProfiles: Record<WardId, { critical: number; occupied: number; reserved: number; cleaning: number; oos: number }> = {
    trauma: { critical: 3, occupied: 5, reserved: 1, cleaning: 0, oos: 0 },      // 9/10 busy
    acute: { critical: 2, occupied: 10, reserved: 1, cleaning: 1, oos: 0 },      // 14/16 busy
    cardiac: { critical: 3, occupied: 5, reserved: 1, cleaning: 0, oos: 0 },     // 9/10 busy
    pediatric: { critical: 1, occupied: 5, reserved: 1, cleaning: 1, oos: 0 },   // 8/10 busy
    fast_track: { critical: 0, occupied: 5, reserved: 0, cleaning: 1, oos: 1 },  // 7/10 busy
    observation: { critical: 0, occupied: 5, reserved: 1, cleaning: 0, oos: 0 }, // 6/8 busy
  };

  for (const ward of WARDS) {
    const count = WARD_BED_COUNTS[ward.id];
    const profile = wardProfiles[ward.id];
    const statuses: BedStatus[] = [];

    for (let i = 0; i < profile.critical; i++) statuses.push('critical');
    for (let i = 0; i < profile.occupied; i++) statuses.push('occupied');
    for (let i = 0; i < profile.reserved; i++) statuses.push('reserved');
    for (let i = 0; i < profile.cleaning; i++) statuses.push('cleaning');
    for (let i = 0; i < profile.oos; i++) statuses.push('out_of_service');
    while (statuses.length < count) statuses.push('available');

    // Deterministic shuffle per ward
    for (let i = statuses.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [statuses[i], statuses[j]] = [statuses[j], statuses[i]];
    }

    for (let idx = 1; idx <= count; idx++) {
      const status = statuses[idx - 1];
      const bedId = `${ward.shortCode}-${idx.toString().padStart(2, '0')}`;
      const cats = CATEGORIES_BY_WARD[ward.id];
      const cat = cats[Math.floor(rng() * cats.length)];

      if (status === 'occupied' || status === 'critical') {
        patientCounter += 1;
        const admitOffsetMin = Math.floor(25 + rng() * 145);
        const dischargeEtaMin = status === 'critical'
          ? Math.floor(55 + rng() * 110)
          : Math.floor(18 + rng() * 85);
        const triage: TriageLevel =
          status === 'critical'
            ? (rng() > 0.45 ? 1 : 2)
            : ward.id === 'fast_track'
              ? (rng() > 0.4 ? 4 : 5)
              : (rng() > 0.5 ? 2 : 3);

        beds.push({
          id: bedId,
          wardId: ward.id,
          department: ward.department,
          status,
          patientId: `PT-${patientCounter}`,
          patientCategory: cat,
          triageLevel: triage,
          admittedAt: formatClockTime(simTimestamp - admitOffsetMin * 60_000),
          estimatedDischargeMinutes: dischargeEtaMin,
          cleaningRemainingMinutes: null,
          acuityScore: status === 'critical' ? Math.floor(8 + rng() * 3) : Math.floor(4 + rng() * 4),
          notes:
            status === 'critical'
              ? 'Continuous telemetry & 1:1 nursing surveillance active.'
              : 'Active diagnostic workup and bedside monitoring.',
        });
      } else if (status === 'reserved') {
        patientCounter += 1;
        beds.push({
          id: bedId,
          wardId: ward.id,
          department: ward.department,
          status: 'reserved',
          patientId: `PT-${patientCounter}`,
          patientCategory: `Inbound EMS · ${cat}`,
          triageLevel: ward.id === 'trauma' || ward.id === 'cardiac' ? 1 : 2,
          admittedAt: null,
          estimatedDischargeMinutes: null,
          cleaningRemainingMinutes: null,
          acuityScore: 7,
          notes: 'Held for incoming ambulance / high-priority triage transfer.',
        });
      } else if (status === 'cleaning') {
        beds.push({
          id: bedId,
          wardId: ward.id,
          department: ward.department,
          status: 'cleaning',
          patientId: null,
          patientCategory: null,
          triageLevel: null,
          admittedAt: null,
          estimatedDischargeMinutes: null,
          cleaningRemainingMinutes: Math.floor(4 + rng() * 14),
          acuityScore: null,
          notes: 'EVS terminal sanitation & linen turnaround in progress.',
        });
      } else if (status === 'out_of_service') {
        beds.push({
          id: bedId,
          wardId: ward.id,
          department: ward.department,
          status: 'out_of_service',
          patientId: null,
          patientCategory: null,
          triageLevel: null,
          admittedAt: null,
          estimatedDischargeMinutes: null,
          cleaningRemainingMinutes: null,
          acuityScore: null,
          notes: 'Scheduled biomedical equipment calibration.',
        });
      } else {
        beds.push({
          id: bedId,
          wardId: ward.id,
          department: ward.department,
          status: 'available',
          patientId: null,
          patientCategory: null,
          triageLevel: null,
          admittedAt: null,
          estimatedDischargeMinutes: null,
          cleaningRemainingMinutes: null,
          acuityScore: null,
          notes: 'Sanitized, stocked, and ready for immediate intake.',
        });
      }
    }
  }

  // Generate 24 hours of historical hourly data leading up to current hour (10:00)
  const currentHour = baseDate.getHours(); // 10
  const historicalHours: HistoricalHourPoint[] = [];
  for (let offset = -23; offset <= 0; offset++) {
    const h = ((currentHour + offset) % 24 + 24) % 24;
    const baseRate = baselineHourlyArrivalRate(h);
    const noise = (rng() - 0.45) * 3.2;
    const arrivals = Math.max(3, Math.round(baseRate + noise));
    const discharges = Math.max(3, Math.round(arrivals * (0.86 + rng() * 0.22)));
    const occRaw = 52 + (baseRate / 19.1) * 30 + (rng() - 0.5) * 6;
    const occupancyPercent = Math.min(96, Math.max(44, Math.round(occRaw)));
    const avgWaitMinutes = Math.round(14 + Math.max(0, occupancyPercent - 58) * 0.95 + rng() * 6);
    const congestionIndex = Math.min(98, Math.round(occupancyPercent * 0.72 + (avgWaitMinutes / 60) * 28));

    const high = Math.max(1, Math.round(arrivals * (0.22 + rng() * 0.08)));
    const mid = Math.max(1, Math.round(arrivals * (0.44 + rng() * 0.08)));
    const low = Math.max(0, arrivals - high - mid);

    historicalHours.push({
      hourLabel: formatHourLabel(h),
      hourOfDay: h,
      arrivals,
      discharges,
      occupancyPercent,
      avgWaitMinutes,
      congestionIndex,
      triageHighAcuity: high,
      triageMidAcuity: mid,
      triageLowAcuity: low,
    });
  }

  // Generate initial active Patient Queue (patients waiting, triaged, awaiting bed, or in fast-track treatment)
  const queue: PatientQueueItem[] = [];
  const initialQueueSpecs: { status: PatientQueueItem['status']; waitMin: number; forcedTriage?: TriageLevel }[] = [
    { status: 'awaiting_bed', waitMin: 48, forcedTriage: 2 },
    { status: 'awaiting_bed', waitMin: 41, forcedTriage: 2 },
    { status: 'awaiting_bed', waitMin: 36, forcedTriage: 3 },
    { status: 'awaiting_bed', waitMin: 31, forcedTriage: 3 },
    { status: 'triaged', waitMin: 39, forcedTriage: 2 },
    { status: 'triaged', waitMin: 29, forcedTriage: 3 },
    { status: 'triaged', waitMin: 24, forcedTriage: 3 },
    { status: 'triaged', waitMin: 22, forcedTriage: 3 },
    { status: 'triaged', waitMin: 19, forcedTriage: 4 },
    { status: 'waiting', waitMin: 34, forcedTriage: 3 },
    { status: 'waiting', waitMin: 27, forcedTriage: 4 },
    { status: 'waiting', waitMin: 18, forcedTriage: 4 },
    { status: 'waiting', waitMin: 15, forcedTriage: 4 },
    { status: 'waiting', waitMin: 12, forcedTriage: 5 },
    { status: 'waiting', waitMin: 9, forcedTriage: 4 },
    { status: 'waiting', waitMin: 6, forcedTriage: 5 },
    { status: 'waiting', waitMin: 3, forcedTriage: 3 },
    // Plus a few currently in treatment linked to occupied beds
  ];

  // Link 5 occupied beds to active queue records for cohesive tracking
  const occupiedBeds = beds.filter((b) => b.status === 'occupied' || b.status === 'critical').slice(0, 6);
  for (const ob of occupiedBeds) {
    queue.push({
      id: ob.patientId!,
      triageLevel: ob.triageLevel || 3,
      chiefComplaint: ob.patientCategory || 'Acute Evaluation',
      ageGroup: AGE_GROUPS[Math.floor(rng() * AGE_GROUPS.length)],
      arrivalTime: ob.admittedAt || '09:30',
      arrivalOffsetMinutes: -60,
      waitingMinutes: Math.floor(8 + rng() * 14),
      department: ob.department,
      wardPreference: ob.wardId,
      status: 'in_treatment',
      assignedBedId: ob.id,
      estimatedTreatmentMinutes: ob.estimatedDischargeMinutes || 45,
    });
  }

  for (const spec of initialQueueSpecs) {
    patientCounter += 1;
    const deptSpec = COMPLAINTS_BY_DEPT[Math.floor(rng() * COMPLAINTS_BY_DEPT.length)];
    const complaint = deptSpec.complaints[Math.floor(rng() * deptSpec.complaints.length)];
    const triage = spec.forcedTriage ?? deptSpec.triagePool[Math.floor(rng() * deptSpec.triagePool.length)];
    const arrivalEpoch = simTimestamp - spec.waitMin * 60_000;

    queue.push({
      id: `PT-${patientCounter}`,
      triageLevel: triage,
      chiefComplaint: complaint,
      ageGroup:
        deptSpec.ward === 'pediatric'
          ? '0–12 yrs'
          : AGE_GROUPS[1 + Math.floor(rng() * (AGE_GROUPS.length - 1))],
      arrivalTime: formatClockTime(arrivalEpoch),
      arrivalOffsetMinutes: -spec.waitMin,
      waitingMinutes: spec.waitMin,
      department: deptSpec.dept,
      wardPreference: deptSpec.ward,
      status: spec.status,
      assignedBedId: null,
      estimatedTreatmentMinutes: triage <= 2 ? 68 : triage === 3 ? 48 : 28,
    });
  }

  const staffRoles: StaffRoleMetric[] = [
    {
      id: 'md-attending',
      role: 'Emergency Physicians',
      department: 'All ED Zones',
      onDuty: 7,
      scheduledBase: 7,
      floatAllocated: 0,
      recommendedRequired: 8,
      utilizationPercent: 92,
    },
    {
      id: 'rn-bedside',
      role: 'Bedside ED Nurses (RN)',
      department: 'Acute & Trauma',
      onDuty: 18,
      scheduledBase: 18,
      floatAllocated: 0,
      recommendedRequired: 21,
      utilizationPercent: 94,
    },
    {
      id: 'rn-triage',
      role: 'Triage Specialists',
      department: 'Intake & Screening',
      onDuty: 4,
      scheduledBase: 4,
      floatAllocated: 0,
      recommendedRequired: 5,
      utilizationPercent: 89,
    },
    {
      id: 'rt-resp',
      role: 'Respiratory Therapists',
      department: 'Trauma & Cardiac',
      onDuty: 3,
      scheduledBase: 3,
      floatAllocated: 0,
      recommendedRequired: 4,
      utilizationPercent: 86,
    },
    {
      id: 'evs-turn',
      role: 'Bed Turnaround / EVS Techs',
      department: 'Sanitation & Logistics',
      onDuty: 4,
      scheduledBase: 4,
      floatAllocated: 0,
      recommendedRequired: 5,
      utilizationPercent: 88,
    },
  ];

  const alerts: AlertItem[] = [
    {
      id: 'ALT-1001',
      severity: 'Critical',
      category: 'Bed Shortage',
      title: 'Acute & Cardiac Bays Approaching 90% Capacity',
      description:
        'Only 1 Trauma bed and 1 Cardiac bed remain available while 4 ESI-2/3 patients await bed assignment.',
      timestamp: formatClockTime(simTimestamp - 4 * 60_000),
      wardOrDepartment: 'Cardiac Care & Trauma',
      recommendedAction: 'Expedite 3 pending cleanings & open Observation overflow',
      actionType: 'expedite_cleaning',
      acknowledged: false,
      dismissed: false,
    },
    {
      id: 'ALT-1002',
      severity: 'High',
      category: 'Overcrowding',
      title: 'Forecasted Midday Arrival Surge (+28% in Next 3h)',
      description:
        'Time-series model projects 52 incoming patients between 11:00 and 14:00, exceeding baseline turnover.',
      timestamp: formatClockTime(simTimestamp - 11 * 60_000),
      wardOrDepartment: 'Acute Emergency',
      recommendedAction: 'Recall 2 float ED RNs before 12:00 peak window',
      actionType: 'allocate_staff',
      acknowledged: false,
      dismissed: false,
    },
    {
      id: 'ALT-1003',
      severity: 'Moderate',
      category: 'Wait Time',
      title: 'Triage-to-Bed Wait Exceeding 35 Min Target',
      description:
        'Awaiting-bed backlog reached 4 patients with longest wait at 48 minutes in Acute Emergency.',
      timestamp: formatClockTime(simTimestamp - 18 * 60_000),
      wardOrDepartment: 'Fast Track / Minor Care',
      recommendedAction: 'Divert ESI 4–5 patients directly to Fast Track discharge stream',
      actionType: 'divert_fast_track',
      acknowledged: false,
      dismissed: false,
    },
  ];

  const forecastConfig: ForecastConfig = {
    horizonHours: 6,
    weather: 'Clear',
    dayType: 'Weekday',
    isHolidaySurge: false,
    avgTreatmentMinutes: 48,
    modelMode: 'Balanced Ensemble',
    confidenceLevel: 90,
  };

  const settings: HospitalSettings = {
    hospitalName: 'St. Jude Metropolitan Medical Center',
    elevatedThreshold: 72,
    highThreshold: 84,
    criticalThreshold: 93,
    waitTimeAlertMinutes: 30,
    defaultSimSpeed: 2,
    confidenceLevel: 90,
  };

  return {
    wards: WARDS,
    beds,
    queue,
    historicalHours,
    staffRoles,
    alerts,
    forecastConfig,
    settings,
    simulation: {
      isRunning: false,
      speed: 2,
      elapsedSimMinutes: 0,
      tickCount: 0,
      simTimestamp,
      totalSimulatedArrivals: 0,
      totalSimulatedDischarges: 0,
    },
    nextPatientSeq: patientCounter + 1,
    nextAlertSeq: 1004,
  };
}
