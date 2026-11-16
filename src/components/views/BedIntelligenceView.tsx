import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRightLeft,
  Search,
  Sparkles,
  UserPlus,
  X,
} from 'lucide-react';
import {
  Bed,
  BedStatus,
  DepartmentName,
  ForecastOutput,
  HospitalDataset,
  WardId,
} from '../../engine/types';
import { classifyCongestion } from '../../engine/forecastEngine';
import {
  BED_STATUS_META,
  BedStatusIcon,
  getCongestionTextClass,
  getTriageLabel,
} from '../shared/StatusHelpers';

interface BedIntelligenceViewProps {
  dataset: HospitalDataset;
  forecast: ForecastOutput;
  initialWardFilter?: WardId | 'all';
  onUpdateBed: (bedId: string, updater: (bed: Bed) => Bed) => void;
  onAssignWaitingPatientToBed: (bedId: string) => void;
  onExpediteAllCleanings: () => void;
  onSimulateBedTurnover: () => void;
}

const ALL_STATUSES: BedStatus[] = [
  'available',
  'occupied',
  'critical',
  'reserved',
  'cleaning',
  'out_of_service',
];

export const BedIntelligenceView: React.FC<BedIntelligenceViewProps> = ({
  dataset,
  forecast,
  initialWardFilter = 'all',
  onUpdateBed,
  onAssignWaitingPatientToBed,
  onExpediteAllCleanings,
  onSimulateBedTurnover,
}) => {
  const [selectedWard, setSelectedWard] = useState<WardId | 'all'>(initialWardFilter);
  const [selectedStatus, setSelectedStatus] = useState<BedStatus | 'all'>('all');
  const [selectedDept, setSelectedDept] = useState<DepartmentName | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeBedId, setActiveBedId] = useState<string | null>(dataset.beds[0]?.id ?? null);

  // Sync if navigated here from Overview ward click
  React.useEffect(() => {
    if (initialWardFilter && initialWardFilter !== 'all') {
      setSelectedWard(initialWardFilter);
    }
  }, [initialWardFilter]);

  const counts = useMemo(() => {
    const map: Record<BedStatus, number> = {
      available: 0,
      occupied: 0,
      critical: 0,
      reserved: 0,
      cleaning: 0,
      out_of_service: 0,
    };
    for (const b of dataset.beds) {
      map[b.status] += 1;
    }
    return map;
  }, [dataset.beds]);

  const waitingPatientsCount = dataset.queue.filter(
    (p) => p.status === 'waiting' || p.status === 'triaged' || p.status === 'awaiting_bed'
  ).length;

  const filteredBeds = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return dataset.beds.filter((b) => {
      if (selectedWard !== 'all' && b.wardId !== selectedWard) return false;
      if (selectedStatus !== 'all' && b.status !== selectedStatus) return false;
      if (selectedDept !== 'all' && b.department !== selectedDept) return false;
      if (q) {
        const hay = `${b.id} ${b.patientId ?? ''} ${b.patientCategory ?? ''} ${b.department}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [dataset.beds, selectedWard, selectedStatus, selectedDept, searchQuery]);

  const activeBed = useMemo(
    () => dataset.beds.find((b) => b.id === activeBedId) ?? null,
    [dataset.beds, activeBedId]
  );

  const activeBedWard = useMemo(
    () => dataset.wards.find((w) => w.id === activeBed?.wardId) ?? null,
    [dataset.wards, activeBed]
  );

  const wardRiskMap = useMemo(() => {
    const m = new Map<WardId, (typeof forecast.wardRisks)[number]>();
    for (const r of forecast.wardRisks) m.set(r.wardId, r);
    return m;
  }, [forecast.wardRisks]);

  const departments = useMemo(
    () => Array.from(new Set(dataset.wards.map((w) => w.department))),
    [dataset.wards]
  );

  const handleSetBedStatus = (bed: Bed, nextStatus: BedStatus) => {
    onUpdateBed(bed.id, (prev) => {
      if (nextStatus === 'available') {
        return {
          ...prev,
          status: 'available',
          patientId: null,
          patientCategory: null,
          triageLevel: null,
          admittedAt: null,
          estimatedDischargeMinutes: null,
          cleaningRemainingMinutes: null,
          acuityScore: null,
          notes: 'Cleared and verified ready for admission.',
        };
      }
      if (nextStatus === 'cleaning') {
        return {
          ...prev,
          status: 'cleaning',
          patientId: null,
          patientCategory: null,
          triageLevel: null,
          admittedAt: null,
          estimatedDischargeMinutes: null,
          cleaningRemainingMinutes: 12,
          acuityScore: null,
          notes: 'Terminal sanitation cycle initiated.',
        };
      }
      if (nextStatus === 'reserved') {
        return {
          ...prev,
          status: 'reserved',
          patientId: prev.patientId ?? `EMS-${Math.floor(100 + Math.random() * 899)}`,
          patientCategory: prev.patientCategory ?? 'Inbound EMS Hold',
          triageLevel: prev.triageLevel ?? 2,
          estimatedDischargeMinutes: null,
          cleaningRemainingMinutes: null,
          notes: 'Reserved for incoming EMS or high-acuity transfer.',
        };
      }
      if (nextStatus === 'out_of_service') {
        return {
          ...prev,
          status: 'out_of_service',
          patientId: null,
          patientCategory: null,
          triageLevel: null,
          admittedAt: null,
          estimatedDischargeMinutes: null,
          cleaningRemainingMinutes: null,
          acuityScore: null,
          notes: 'Temporarily offline for equipment inspection.',
        };
      }
      return {
        ...prev,
        status: nextStatus,
        patientId: prev.patientId ?? `PT-${dataset.nextPatientSeq}`,
        patientCategory: prev.patientCategory ?? 'Acute Evaluation',
        triageLevel: prev.triageLevel ?? (nextStatus === 'critical' ? 1 : 3),
        admittedAt: prev.admittedAt ?? 'Now',
        estimatedDischargeMinutes: prev.estimatedDischargeMinutes ?? (nextStatus === 'critical' ? 90 : 45),
        cleaningRemainingMinutes: null,
        acuityScore: nextStatus === 'critical' ? 9 : 5,
        notes:
          nextStatus === 'critical'
            ? 'Escalated to critical surveillance protocol.'
            : 'Bed occupied for active ED care.',
      };
    });
  };

  return (
    <div className="space-y-5">
      {/* Top Bed Intelligence Telemetry & Quick Operations Strip */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5">
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 flex-1">
            {ALL_STATUSES.map((st) => {
              const meta = BED_STATUS_META[st];
              const isSelected = selectedStatus === st;
              return (
                <button
                  key={st}
                  type="button"
                  onClick={() => setSelectedStatus(isSelected ? 'all' : st)}
                  className={`p-2.5 rounded-lg border text-left transition-colors ${
                    isSelected
                      ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/50 dark:border-blue-500'
                      : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className={`w-2 h-2 rounded-full ${meta.dotClass}`} />
                    <span className="font-mono tabular-nums text-base font-bold text-slate-900 dark:text-slate-100">
                      {counts[st]}
                    </span>
                  </div>
                  <p className="text-xs font-medium text-slate-600 dark:text-slate-300 mt-1 truncate">
                    {meta.label}
                  </p>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onExpediteAllCleanings}
              disabled={counts.cleaning === 0}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-45 disabled:pointer-events-none transition-colors whitespace-nowrap"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>Clear Cleaning ({counts.cleaning})</span>
            </button>
            <button
              type="button"
              onClick={onSimulateBedTurnover}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors whitespace-nowrap"
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              <span>Simulate Bed Turnover</span>
            </button>
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center gap-3">
          <div className="relative flex-1 min-w-0">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search Bed ID (e.g. TR-02), Patient ID (PT-4105), or complaint..."
              className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Filter by ward"
              value={selectedWard}
              onChange={(e) => setSelectedWard(e.target.value as WardId | 'all')}
              className="px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="all">All Wards (64 Beds)</option>
              {dataset.wards.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter by department"
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value as DepartmentName | 'all')}
              className="px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="all">All Departments</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>

            {(selectedWard !== 'all' || selectedStatus !== 'all' || selectedDept !== 'all' || searchQuery) && (
              <button
                type="button"
                onClick={() => {
                  setSelectedWard('all');
                  setSelectedStatus('all');
                  setSelectedDept('all');
                  setSearchQuery('');
                }}
                className="px-2.5 py-2 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Main Split: Interactive Ward Map (Left 8 cols) + Bed Detail Inspector (Right 4 cols) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Visual Ward Bays */}
        <div className="xl:col-span-8 space-y-5">
          {dataset.wards
            .filter((w) => selectedWard === 'all' || w.id === selectedWard)
            .map((ward) => {
              const wardBeds = filteredBeds.filter((b) => b.wardId === ward.id);
              const allWardBeds = dataset.beds.filter((b) => b.wardId === ward.id);
              if (wardBeds.length === 0 && (selectedStatus !== 'all' || searchQuery || selectedDept !== 'all')) {
                return null;
              }

              const usableInWard = allWardBeds.filter((b) => b.status !== 'out_of_service');
              const busyInWard = usableInWard.filter(
                (b) => b.status === 'occupied' || b.status === 'critical' || b.status === 'reserved'
              ).length;
              const availInWard = usableInWard.filter((b) => b.status === 'available').length;
              const occPct = Math.round((busyInWard / Math.max(1, usableInWard.length)) * 100);
              const wardLevel = classifyCongestion(
                occPct,
                dataset.settings.elevatedThreshold,
                dataset.settings.highThreshold,
                dataset.settings.criticalThreshold
              );
              const risk = wardRiskMap.get(ward.id);

              return (
                <section
                  key={ward.id}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5"
                >
                  {/* Ward Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 mb-4 border-b border-slate-200 dark:border-slate-800">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-display font-semibold text-base text-slate-900 dark:text-slate-100">
                          {ward.name}
                        </h3>
                        <span className={`text-xs font-semibold ${getCongestionTextClass(wardLevel)}`}>
                          {wardLevel} ({occPct}%)
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {ward.floor} · {availInWard} open of {usableInWard.length} usable · Target turnover{' '}
                        {ward.targetTurnoverMinutes}m
                      </p>
                    </div>

                    {risk && risk.projectedDeficit3h > 0 && (
                      <div className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-700 dark:text-rose-400">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span className="tabular-nums">
                          Projected 3h deficit: {risk.projectedDeficit3h} bed{risk.projectedDeficit3h > 1 ? 's' : ''}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Individual Bed Bay Tiles */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
                    {wardBeds.map((bed) => {
                      const meta = BED_STATUS_META[bed.status];
                      const isSelected = activeBed?.id === bed.id;
                      return (
                        <button
                          key={bed.id}
                          type="button"
                          onClick={() => setActiveBedId(bed.id)}
                          className={`group relative p-2.5 rounded-lg border text-left transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                            meta.surfaceClass
                          } ${
                            isSelected
                              ? 'ring-2 ring-blue-600 border-blue-600 dark:ring-blue-400 dark:border-blue-400'
                              : `${meta.borderClass} hover:brightness-95 dark:hover:brightness-110`
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-mono tabular-nums text-xs font-bold text-slate-900 dark:text-slate-100">
                              {bed.id}
                            </span>
                            <BedStatusIcon status={bed.status} className={`w-3.5 h-3.5 ${meta.textClass}`} />
                          </div>

                          <p className={`text-[11px] font-semibold mt-1 truncate ${meta.textClass}`}>
                            {meta.shortLabel}
                          </p>

                          <div className="mt-1.5 min-h-[26px]">
                            {bed.patientId ? (
                              <>
                                <p className="font-mono tabular-nums text-[11px] text-slate-700 dark:text-slate-300 truncate">
                                  {bed.patientId}
                                </p>
                                <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate tabular-nums">
                                  {bed.estimatedDischargeMinutes !== null
                                    ? `ETA ${bed.estimatedDischargeMinutes}m`
                                    : bed.patientCategory}
                                </p>
                              </>
                            ) : bed.status === 'cleaning' && bed.cleaningRemainingMinutes !== null ? (
                              <p className="text-[10px] text-amber-700 dark:text-amber-300 tabular-nums">
                                Ready in {bed.cleaningRemainingMinutes}m
                              </p>
                            ) : (
                              <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                                {bed.status === 'available' ? 'Ready for intake' : 'Maintenance'}
                              </p>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>
              );
            })}

          {filteredBeds.length === 0 && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-10 text-center space-y-2">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                No matching beds found
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Adjust your ward, status, or search filter to inspect bed units.
              </p>
            </div>
          )}
        </div>

        {/* Right Side: Interactive Bed Detail Inspector */}
        <aside className="xl:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 xl:sticky xl:top-20">
          {activeBed ? (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {activeBedWard?.name} · {activeBedWard?.floor}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <h3 className="font-mono text-xl font-bold text-slate-900 dark:text-slate-100">
                      Bed {activeBed.id}
                    </h3>
                    <span className={`text-xs font-semibold ${BED_STATUS_META[activeBed.status].textClass}`}>
                      · {BED_STATUS_META[activeBed.status].label}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveBedId(null)}
                  aria-label="Close bed inspector"
                  className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 xl:hidden"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Clinical Details */}
              <dl className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <dt className="text-slate-500 dark:text-slate-400">Department</dt>
                  <dd className="font-medium text-slate-900 dark:text-slate-100 mt-0.5">
                    {activeBed.department}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500 dark:text-slate-400">Synthetic Patient ID</dt>
                  <dd className="font-mono tabular-nums font-medium text-slate-900 dark:text-slate-100 mt-0.5">
                    {activeBed.patientId ?? 'Unassigned'}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500 dark:text-slate-400">Clinical Category</dt>
                  <dd className="font-medium text-slate-900 dark:text-slate-100 mt-0.5">
                    {activeBed.patientCategory ?? '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500 dark:text-slate-400">Triage Level</dt>
                  <dd className="font-medium text-slate-900 dark:text-slate-100 mt-0.5">
                    {activeBed.triageLevel ? getTriageLabel(activeBed.triageLevel) : '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500 dark:text-slate-400">Admitted Time</dt>
                  <dd className="font-mono tabular-nums font-medium text-slate-900 dark:text-slate-100 mt-0.5">
                    {activeBed.admittedAt ?? '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500 dark:text-slate-400">Est. Discharge / Ready</dt>
                  <dd className="font-mono tabular-nums font-medium text-slate-900 dark:text-slate-100 mt-0.5">
                    {activeBed.estimatedDischargeMinutes !== null
                      ? `In ${activeBed.estimatedDischargeMinutes} min`
                      : activeBed.cleaningRemainingMinutes !== null
                        ? `Clean in ${activeBed.cleaningRemainingMinutes} min`
                        : 'Immediate'}
                  </dd>
                </div>
              </dl>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-1">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Operational Notes</p>
                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                  {activeBed.notes}
                </p>
              </div>

              {/* Dynamic Actions on Selected Bed */}
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-3">
                {activeBed.status === 'available' && waitingPatientsCount > 0 && (
                  <button
                    type="button"
                    onClick={() => onAssignWaitingPatientToBed(activeBed.id)}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>Admit Highest-Priority Waiting Patient</span>
                  </button>
                )}

                {(activeBed.status === 'occupied' || activeBed.status === 'critical') && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateBed(activeBed.id, (b) => ({
                          ...b,
                          estimatedDischargeMinutes: Math.max(5, (b.estimatedDischargeMinutes ?? 30) - 15),
                        }))
                      }
                      className="flex-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      Expedite ETA (-15m)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSetBedStatus(activeBed, 'cleaning')}
                      className="flex-1 px-3 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold transition-colors"
                    >
                      Discharge to Clean
                    </button>
                  </div>
                )}

                <div>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
                    Update Bed State
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {ALL_STATUSES.map((st) => {
                      const meta = BED_STATUS_META[st];
                      const active = activeBed.status === st;
                      return (
                        <button
                          key={st}
                          type="button"
                          disabled={active}
                          onClick={() => handleSetBedStatus(activeBed, st)}
                          className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium text-left flex items-center gap-1.5 transition-colors ${
                            active
                              ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300'
                              : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                        >
                          <span className={`w-2 h-2 rounded-full shrink-0 ${meta.dotClass}`} />
                          <span className="truncate">{meta.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-xs text-slate-500 dark:text-slate-400">
              Select any bed unit on the ward map to inspect clinical details and update occupancy state.
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};
