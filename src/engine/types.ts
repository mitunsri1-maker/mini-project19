export type NavSection =
  | 'overview'
  | 'forecasting'
  | 'beds'
  | 'queue'
  | 'alerts'
  | 'staff'
  | 'analytics'
  | 'settings';

export type BedStatus =
  | 'available'
  | 'occupied'
  | 'reserved'
  | 'cleaning'
  | 'critical'
  | 'out_of_service';

export type WardId =
  | 'trauma'
  | 'acute'
  | 'cardiac'
  | 'pediatric'
  | 'fast_track'
  | 'observation';

export type DepartmentName =
  | 'Trauma & Resuscitation'
  | 'Acute Emergency'
  | 'Cardiac Care'
  | 'Pediatric ED'
  | 'Fast Track / Minor Care'
  | 'Short-Stay Observation';

export type TriageLevel = 1 | 2 | 3 | 4 | 5;

export type CongestionLevel = 'Normal' | 'Elevated' | 'High' | 'Critical';

export type WeatherCondition = 'Clear' | 'Heavy Rain' | 'Heatwave' | 'Severe Storm / Ice';

export type DayType = 'Weekday' | 'Weekend' | 'Public Holiday';

export type ForecastModelMode = 'Balanced Ensemble' | 'Surge Sensitive' | 'Seasonal Baseline';

export type QueueStatus =
  | 'waiting'
  | 'triaged'
  | 'awaiting_bed'
  | 'in_treatment'
  | 'discharged';

export interface Ward {
  id: WardId;
  name: string;
  shortCode: string;
  department: DepartmentName;
  floor: string;
  targetTurnoverMinutes: number;
}

export interface Bed {
  id: string;
  wardId: WardId;
  department: DepartmentName;
  status: BedStatus;
  patientId: string | null;
  patientCategory: string | null;
  triageLevel: TriageLevel | null;
  admittedAt: string | null;
  estimatedDischargeMinutes: number | null; // minutes remaining from simClock
  cleaningRemainingMinutes: number | null;
  acuityScore: number | null; // 1-10
  notes: string;
}

export interface PatientQueueItem {
  id: string;
  triageLevel: TriageLevel;
  chiefComplaint: string;
  ageGroup: string;
  arrivalTime: string;
  arrivalOffsetMinutes: number; // relative to start of day or simClock
  waitingMinutes: number;
  department: DepartmentName;
  wardPreference: WardId;
  status: QueueStatus;
  assignedBedId: string | null;
  estimatedTreatmentMinutes: number;
}

export type AlertSeverity = 'Critical' | 'High' | 'Moderate' | 'Advisory';

export type AlertCategory =
  | 'Overcrowding'
  | 'Bed Shortage'
  | 'Wait Time'
  | 'Staffing'
  | 'Congestion';

export interface AlertItem {
  id: string;
  severity: AlertSeverity;
  category: AlertCategory;
  title: string;
  description: string;
  timestamp: string;
  wardOrDepartment: string;
  recommendedAction: string;
  actionType: 'allocate_staff' | 'expedite_cleaning' | 'open_overflow' | 'divert_fast_track' | 'acknowledge_only';
  acknowledged: boolean;
  dismissed: boolean;
}

export interface StaffRoleMetric {
  id: string;
  role: string;
  department: string;
  onDuty: number;
  scheduledBase: number;
  floatAllocated: number;
  recommendedRequired: number;
  utilizationPercent: number;
}

export interface HistoricalHourPoint {
  hourLabel: string;
  hourOfDay: number;
  arrivals: number;
  discharges: number;
  occupancyPercent: number;
  avgWaitMinutes: number;
  congestionIndex: number;
  triageHighAcuity: number; // ESI 1-2
  triageMidAcuity: number;  // ESI 3
  triageLowAcuity: number;  // ESI 4-5
}

export interface ForecastConfig {
  horizonHours: 1 | 3 | 6;
  weather: WeatherCondition;
  dayType: DayType;
  isHolidaySurge: boolean;
  avgTreatmentMinutes: number;
  modelMode: ForecastModelMode;
  confidenceLevel: 80 | 90 | 95;
}

export interface ForecastHourPoint {
  stepHour: number;
  label: string;
  hourOfDay: number;
  predictedArrivals: number;
  lowerBound: number;
  upperBound: number;
  expectedDischarges: number;
  expectedOccupiedBeds: number;
  expectedOccupancyPercent: number;
  availableBedsProjected: number;
  congestionIndex: number;
  congestionLevel: CongestionLevel;
  projectedShortageBeds: number;
}

export interface FeatureAttribution {
  factor: string;
  impactPercent: number;
  direction: 'increase' | 'decrease' | 'neutral';
  detail: string;
}

export interface WardForecastRisk {
  wardId: WardId;
  wardName: string;
  totalBeds: number;
  currentlyAvailable: number;
  occupiedOrCritical: number;
  cleaningOrReserved: number;
  predictedDemand3h: number;
  projectedDeficit3h: number;
  riskLevel: CongestionLevel;
}

export interface ForecastOutput {
  hourlyPoints: ForecastHourPoint[];
  arrivals1h: number;
  arrivals3h: number;
  arrivals6h: number;
  confidenceMargin1h: number;
  confidenceMargin3h: number;
  confidenceMargin6h: number;
  expectedOccupancy1h: number;
  expectedOccupancy3h: number;
  expectedOccupancy6h: number;
  predictedCongestion1h: CongestionLevel;
  predictedCongestion3h: CongestionLevel;
  predictedCongestion6h: CongestionLevel;
  trendDirection: 'Surging' | 'Rising' | 'Stable' | 'Easing';
  peakHourLabel: string;
  peakOccupancyPercent: number;
  timeToShortageLabel: string;
  featureAttributions: FeatureAttribution[];
  wardRisks: WardForecastRisk[];
}

export interface HospitalSettings {
  hospitalName: string;
  elevatedThreshold: number;
  highThreshold: number;
  criticalThreshold: number;
  waitTimeAlertMinutes: number;
  defaultSimSpeed: 1 | 2 | 5 | 10;
  confidenceLevel: 80 | 90 | 95;
}

export interface SimulationState {
  isRunning: boolean;
  speed: 1 | 2 | 5 | 10;
  elapsedSimMinutes: number;
  tickCount: number;
  simTimestamp: number; // epoch ms
  totalSimulatedArrivals: number;
  totalSimulatedDischarges: number;
}

export interface HospitalDataset {
  wards: Ward[];
  beds: Bed[];
  queue: PatientQueueItem[];
  historicalHours: HistoricalHourPoint[];
  staffRoles: StaffRoleMetric[];
  alerts: AlertItem[];
  forecastConfig: ForecastConfig;
  settings: HospitalSettings;
  simulation: SimulationState;
  nextPatientSeq: number;
  nextAlertSeq: number;
}
