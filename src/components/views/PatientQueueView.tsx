import React, { useMemo, useState } from 'react';
import { Download, Plus, Search, UserPlus, X } from 'lucide-react';
import {
  DepartmentName,
  HospitalDataset,
  PatientQueueItem,
  QueueStatus,
  TriageLevel,
  WardId,
} from '../../engine/types';
import { getTriageLabel, getTriageTextClass } from '../shared/StatusHelpers';
import { arrayToCsv, downloadTextFile } from '../../utils/exportData';

interface PatientQueueViewProps {
  dataset: HospitalDataset;
  onAssignBedToPatient: (patientId: string) => void;
  onUpdatePatientStatus: (patientId: string, status: QueueStatus) => void;
  onAddPatient: (input: {
    triageLevel: TriageLevel;
    chiefComplaint: string;
    ageGroup: string;
    department: DepartmentName;
    wardPreference: WardId;
  }) => void;
}

const STATUS_LABELS: Record<QueueStatus, string> = {
  waiting: 'Waiting Triage',
  triaged: 'Triaged',
  awaiting_bed: 'Awaiting Bed',
  in_treatment: 'In Treatment',
  discharged: 'Discharged',
};

const DEPT_TO_WARD: Record<DepartmentName, WardId> = {
  'Trauma & Resuscitation': 'trauma',
  'Acute Emergency': 'acute',
  'Cardiac Care': 'cardiac',
  'Pediatric ED': 'pediatric',
  'Fast Track / Minor Care': 'fast_track',
  'Short-Stay Observation': 'observation',
};

export const PatientQueueView: React.FC<PatientQueueViewProps> = ({
  dataset,
  onAssignBedToPatient,
  onUpdatePatientStatus,
  onAddPatient,
}) => {
  const [search, setSearch] = useState('');
  const [triageFilter, setTriageFilter] = useState<TriageLevel | 'all'>('all');
  const [deptFilter, setDeptFilter] = useState<DepartmentName | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<QueueStatus | 'all'>('all');
  const [sortBy, setSortBy] = useState<'priority' | 'wait_desc' | 'arrival'>('priority');
  const [showAddModal, setShowAddModal] = useState(false);

  // Modal form state
  const [newComplaint, setNewComplaint] = useState('Acute chest discomfort');
  const [newTriage, setNewTriage] = useState<TriageLevel>(2);
  const [newDept, setNewDept] = useState<DepartmentName>('Cardiac Care');
  const [newAge, setNewAge] = useState('45–64 yrs');

  const departments = Object.keys(DEPT_TO_WARD) as DepartmentName[];

  const filteredQueue = useMemo(() => {
    const q = search.trim().toLowerCase();
    return dataset.queue
      .filter((p) => {
        if (triageFilter !== 'all' && p.triageLevel !== triageFilter) return false;
        if (deptFilter !== 'all' && p.department !== deptFilter) return false;
        if (statusFilter !== 'all' && p.status !== statusFilter) return false;
        if (q) {
          const hay = `${p.id} ${p.chiefComplaint} ${p.department} ${p.assignedBedId ?? ''}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'wait_desc') return b.waitingMinutes - a.waitingMinutes;
        if (sortBy === 'arrival') return b.arrivalOffsetMinutes - a.arrivalOffsetMinutes;
        return a.triageLevel - b.triageLevel || b.waitingMinutes - a.waitingMinutes;
      });
  }, [dataset.queue, search, triageFilter, deptFilter, statusFilter, sortBy]);

  const summary = useMemo(() => {
    const waiting = dataset.queue.filter(
      (p) => p.status === 'waiting' || p.status === 'triaged' || p.status === 'awaiting_bed'
    );
    const highAcuity = waiting.filter((p) => p.triageLevel <= 2).length;
    const avgWait =
      waiting.length > 0
        ? Math.round(waiting.reduce((s, p) => s + p.waitingMinutes, 0) / waiting.length)
        : 0;
    const maxWait = waiting.reduce((m, p) => Math.max(m, p.waitingMinutes), 0);
    return { waitingCount: waiting.length, highAcuity, avgWait, maxWait };
  }, [dataset.queue]);

  const handleExportCsv = () => {
    const csv = arrayToCsv(
      ['Patient ID', 'ESI Triage', 'Chief Complaint', 'Age Group', 'Arrival Time', 'Wait (min)', 'Department', 'Status', 'Assigned Bed'],
      filteredQueue.map((p) => [
        p.id,
        `ESI ${p.triageLevel}`,
        p.chiefComplaint,
        p.ageGroup,
        p.arrivalTime,
        p.waitingMinutes,
        p.department,
        STATUS_LABELS[p.status],
        p.assignedBedId ?? 'Unassigned',
      ])
    );
    downloadTextFile('ed-patient-queue.csv', csv, 'text/csv;charset=utf-8;');
  };

  const handleCreatePatient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComplaint.trim()) return;
    onAddPatient({
      triageLevel: newTriage,
      chiefComplaint: newComplaint.trim(),
      ageGroup: newAge,
      department: newDept,
      wardPreference: DEPT_TO_WARD[newDept],
    });
    setShowAddModal(false);
    setNewComplaint('Acute shortness of breath');
  };

  return (
    <div className="space-y-5">
      {/* Queue Metrics Strip */}
      <section className="grid grid-cols-2 lg:grid-cols-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl divide-y lg:divide-y-0 lg:divide-x divide-slate-200 dark:divide-slate-800">
        <div className="p-4 sm:p-5 border-r lg:border-r-0 border-slate-200 dark:border-slate-800">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Active Waiting Queue</p>
          <p className="font-mono tabular-nums text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
            {summary.waitingCount}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Awaiting bed or intake</p>
        </div>
        <div className="p-4 sm:p-5">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">High-Acuity (ESI 1–2)</p>
          <p className="font-mono tabular-nums text-2xl font-bold text-rose-700 dark:text-rose-400 mt-1">
            {summary.highAcuity}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Priority bed placement</p>
        </div>
        <div className="p-4 sm:p-5 border-r lg:border-r-0 border-slate-200 dark:border-slate-800">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Average Wait Duration</p>
          <p className="font-mono tabular-nums text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
            {summary.avgWait}m
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Target &lt; {dataset.settings.waitTimeAlertMinutes}m
          </p>
        </div>
        <div className="p-4 sm:p-5">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Longest Current Wait</p>
          <p className="font-mono tabular-nums text-2xl font-bold text-amber-700 dark:text-amber-400 mt-1">
            {summary.maxWait}m
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Synthetic queue records</p>
        </div>
      </section>

      {/* Filters & Action Bar */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="relative flex-1 min-w-0">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search Patient ID, chief complaint, department, or assigned bed..."
              className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Synthetic Intake</span>
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            aria-label="Filter by triage level"
            value={triageFilter}
            onChange={(e) =>
              setTriageFilter(e.target.value === 'all' ? 'all' : (Number(e.target.value) as TriageLevel))
            }
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200"
          >
            <option value="all">All Triage Levels</option>
            <option value={1}>ESI 1 · Resuscitation</option>
            <option value={2}>ESI 2 · Emergent</option>
            <option value={3}>ESI 3 · Urgent</option>
            <option value={4}>ESI 4 · Less Urgent</option>
            <option value={5}>ESI 5 · Non-Urgent</option>
          </select>

          <select
            aria-label="Filter by department"
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value as DepartmentName | 'all')}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200"
          >
            <option value="all">All Departments</option>
            {departments.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter by treatment status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as QueueStatus | 'all')}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200"
          >
            <option value="all">All Statuses</option>
            <option value="awaiting_bed">Awaiting Bed</option>
            <option value="triaged">Triaged</option>
            <option value="waiting">Waiting Triage</option>
            <option value="in_treatment">In Treatment</option>
          </select>

          <select
            aria-label="Sort patient queue"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'priority' | 'wait_desc' | 'arrival')}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200"
          >
            <option value="priority">Sort: Triage Priority</option>
            <option value="wait_desc">Sort: Longest Wait First</option>
            <option value="arrival">Sort: Most Recent Arrival</option>
          </select>
        </div>

        {/* Queue Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                <th className="py-2.5 pr-3 font-medium">Patient ID</th>
                <th className="py-2.5 px-3 font-medium">Triage Category</th>
                <th className="py-2.5 px-3 font-medium">Chief Complaint</th>
                <th className="py-2.5 px-3 font-medium">Department</th>
                <th className="py-2.5 px-3 font-medium">Arrival</th>
                <th className="py-2.5 px-3 font-medium text-right">Wait</th>
                <th className="py-2.5 px-3 font-medium">Status</th>
                <th className="py-2.5 pl-3 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {filteredQueue.map((p: PatientQueueItem) => (
                <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="py-2.5 pr-3 font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                    {p.id}
                  </td>
                  <td className={`py-2.5 px-3 whitespace-nowrap ${getTriageTextClass(p.triageLevel)}`}>
                    {getTriageLabel(p.triageLevel)}
                  </td>
                  <td className="py-2.5 px-3 text-slate-800 dark:text-slate-200">
                    <span>{p.chiefComplaint}</span>
                    <span className="text-slate-400 dark:text-slate-500 ml-1.5">· {p.ageGroup}</span>
                  </td>
                  <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                    {p.department}
                  </td>
                  <td className="py-2.5 px-3 font-mono tabular-nums text-slate-600 dark:text-slate-400 whitespace-nowrap">
                    {p.arrivalTime}
                  </td>
                  <td
                    className={`py-2.5 px-3 text-right font-mono tabular-nums font-semibold whitespace-nowrap ${
                      p.waitingMinutes >= dataset.settings.waitTimeAlertMinutes && p.status !== 'in_treatment'
                        ? 'text-rose-700 dark:text-rose-400'
                        : 'text-slate-800 dark:text-slate-200'
                    }`}
                  >
                    {p.waitingMinutes}m
                  </td>
                  <td className="py-2.5 px-3 whitespace-nowrap">
                    <span className="text-slate-700 dark:text-slate-300 font-medium">
                      {STATUS_LABELS[p.status]}
                    </span>
                    {p.assignedBedId && (
                      <span className="font-mono text-blue-700 dark:text-blue-400 ml-1.5">
                        ({p.assignedBedId})
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 pl-3 text-right whitespace-nowrap">
                    {p.status !== 'in_treatment' ? (
                      <button
                        type="button"
                        onClick={() => onAssignBedToPatient(p.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-colors"
                      >
                        <UserPlus className="w-3 h-3" />
                        <span>Assign Bed</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onUpdatePatientStatus(p.id, 'discharged')}
                        className="px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        Discharge
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredQueue.length === 0 && (
            <div className="py-10 text-center text-xs text-slate-500 dark:text-slate-400">
              No synthetic patient records match the current filters.
            </div>
          )}
        </div>
      </section>

      {/* Add Synthetic Patient Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-lg">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200 dark:border-slate-800">
              <h3 className="font-display font-semibold text-base text-slate-900 dark:text-slate-100">
                Register Synthetic Emergency Arrival
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                aria-label="Close dialog"
                className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreatePatient} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Chief Complaint
                </label>
                <input
                  type="text"
                  required
                  value={newComplaint}
                  onChange={(e) => setNewComplaint(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    ESI Triage Level
                  </label>
                  <select
                    value={newTriage}
                    onChange={(e) => setNewTriage(Number(e.target.value) as TriageLevel)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  >
                    <option value={1}>ESI 1 · Resuscitation</option>
                    <option value={2}>ESI 2 · Emergent</option>
                    <option value={3}>ESI 3 · Urgent</option>
                    <option value={4}>ESI 4 · Less Urgent</option>
                    <option value={5}>ESI 5 · Non-Urgent</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Age Group
                  </label>
                  <select
                    value={newAge}
                    onChange={(e) => setNewAge(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  >
                    <option value="0–12 yrs">0–12 yrs</option>
                    <option value="13–24 yrs">13–24 yrs</option>
                    <option value="25–44 yrs">25–44 yrs</option>
                    <option value="45–64 yrs">45–64 yrs</option>
                    <option value="65–79 yrs">65–79 yrs</option>
                    <option value="80+ yrs">80+ yrs</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Assigned Department
                </label>
                <select
                  value={newDept}
                  onChange={(e) => setNewDept(e.target.value as DepartmentName)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                >
                  {departments.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                >
                  Add to Queue
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
