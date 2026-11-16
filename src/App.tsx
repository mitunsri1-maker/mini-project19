/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Sidebar } from './components/layout/Sidebar';
import { TopHeader } from './components/layout/TopHeader';
import { AlertsView } from './components/views/AlertsView';
import { AnalyticsView } from './components/views/AnalyticsView';
import { BedIntelligenceView } from './components/views/BedIntelligenceView';
import { ForecastingView } from './components/views/ForecastingView';
import { OverviewView } from './components/views/OverviewView';
import { PatientQueueView } from './components/views/PatientQueueView';
import { SettingsView } from './components/views/SettingsView';
import { StaffResourcesView } from './components/views/StaffResourcesView';
import { computeForecast } from './engine/forecastEngine';
import { createInitialDataset, formatClockTime } from './engine/seedData';
import { advanceSimulationTick } from './engine/simulationEngine';
import {
  AlertItem,
  Bed,
  DepartmentName,
  ForecastConfig,
  HospitalDataset,
  HospitalSettings,
  NavSection,
  QueueStatus,
  TriageLevel,
  WardId,
} from './engine/types';
import { downloadTextFile } from './utils/exportData';

export default function App() {
  const [dataset, setDataset] = useState<HospitalDataset>(() => createInitialDataset());
  const [activeSection, setActiveSection] = useState<NavSection>('overview');
  const [bedWardFilter, setBedWardFilter] = useState<WardId | 'all'>('all');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Sync Tailwind .dark class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [isDark]);

  // Auto-dismiss transient operational feedback toast
  useEffect(() => {
    if (!toastMessage) return;
    const timer = window.setTimeout(() => setToastMessage(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  // Live Simulation Loop
  useEffect(() => {
    if (!dataset.simulation.isRunning) return;
    const intervalMs = Math.max(350, Math.round(1800 / dataset.simulation.speed));
    const timer = window.setInterval(() => {
      setDataset((prev) => advanceSimulationTick(prev, 5));
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [dataset.simulation.isRunning, dataset.simulation.speed]);

  const forecast = useMemo(() => computeForecast(dataset), [dataset]);

  const activeAlertCount = useMemo(
    () => dataset.alerts.filter((a) => !a.dismissed && !a.acknowledged).length,
    [dataset.alerts]
  );

  const notify = (msg: string) => setToastMessage(msg);

  const handleNavigate = (section: NavSection, wardFilter?: WardId) => {
    setActiveSection(section);
    if (wardFilter) {
      setBedWardFilter(wardFilter);
    } else if (section === 'beds') {
      setBedWardFilter('all');
    }
  };

  // Simulation controls
  const handleToggleSimulation = () => {
    setDataset((prev) => ({
      ...prev,
      simulation: { ...prev.simulation, isRunning: !prev.simulation.isRunning },
    }));
  };

  const handleResetSimulation = () => {
    setDataset((prev) => {
      const fresh = createInitialDataset();
      return {
        ...fresh,
        settings: prev.settings,
      };
    });
    notify('Simulation reset to baseline shift state.');
  };

  const handleChangeSpeed = (speed: 1 | 2 | 5 | 10) => {
    setDataset((prev) => ({
      ...prev,
      simulation: { ...prev.simulation, speed },
      settings: { ...prev.settings, defaultSimSpeed: speed },
    }));
  };

  const handleManualPulse = () => {
    setDataset((prev) => advanceSimulationTick(prev, 5));
    notify('Simulated +5m clinical shift pulse.');
  };

  // Bed mutations
  const handleUpdateBed = (bedId: string, updater: (bed: Bed) => Bed) => {
    setDataset((prev) => ({
      ...prev,
      beds: prev.beds.map((b) => (b.id === bedId ? updater(b) : b)),
    }));
    notify(`Updated status for Bed ${bedId}.`);
  };

  const handleAssignWaitingPatientToBed = (bedId: string) => {
    setDataset((prev) => {
      const bed = prev.beds.find((b) => b.id === bedId);
      if (!bed || bed.status !== 'available') return prev;

      const waiting = prev.queue
        .filter((p) => p.status === 'waiting' || p.status === 'triaged' || p.status === 'awaiting_bed')
        .sort((a, b) => {
          const sameWardA = a.wardPreference === bed.wardId ? 0 : 1;
          const sameWardB = b.wardPreference === bed.wardId ? 0 : 1;
          return sameWardA - sameWardB || a.triageLevel - b.triageLevel || b.waitingMinutes - a.waitingMinutes;
        });

      if (waiting.length === 0) {
        notify('No waiting patients currently in queue.');
        return prev;
      }

      const targetPatient = waiting[0];
      const isCrit = targetPatient.triageLevel === 1;

      return {
        ...prev,
        beds: prev.beds.map((b) =>
          b.id === bedId
            ? {
                ...b,
                status: isCrit ? 'critical' : 'occupied',
                patientId: targetPatient.id,
                patientCategory: targetPatient.chiefComplaint,
                triageLevel: targetPatient.triageLevel,
                admittedAt: formatClockTime(prev.simulation.simTimestamp),
                estimatedDischargeMinutes: targetPatient.estimatedTreatmentMinutes,
                cleaningRemainingMinutes: null,
                acuityScore: isCrit ? 9 : Math.max(3, 8 - targetPatient.triageLevel),
                notes: `Assigned from triage queue (${targetPatient.waitingMinutes}m wait).`,
              }
            : b
        ),
        queue: prev.queue.map((p) =>
          p.id === targetPatient.id
            ? { ...p, status: 'in_treatment', assignedBedId: bedId }
            : p
        ),
      };
    });
    notify(`Admitted next priority patient into Bed ${bedId}.`);
  };

  const handleExpediteAllCleanings = () => {
    setDataset((prev) => ({
      ...prev,
      beds: prev.beds.map((b) =>
        b.status === 'cleaning'
          ? {
              ...b,
              status: 'available',
              cleaningRemainingMinutes: null,
              notes: 'Expedited EVS turnaround completed.',
            }
          : b
      ),
    }));
    notify('All cleaning beds cleared and marked Available.');
  };

  const handleSimulateBedTurnover = () => {
    setDataset((prev) => {
      // Discharge 2 occupied beds with lowest ETA & clear 1 cleaning bed
      const sortedOcc = prev.beds
        .filter((b) => b.status === 'occupied')
        .sort((a, b) => (a.estimatedDischargeMinutes ?? 99) - (b.estimatedDischargeMinutes ?? 99));
      const toDischargeIds = new Set(sortedOcc.slice(0, 2).map((b) => b.id));
      const dischargedPatientIds = new Set(
        sortedOcc
          .slice(0, 2)
          .map((b) => b.patientId)
          .filter(Boolean) as string[]
      );

      let cleanedOne = false;
      const nextBeds = prev.beds.map((b) => {
        if (toDischargeIds.has(b.id)) {
          return {
            ...b,
            status: 'cleaning' as const,
            patientId: null,
            patientCategory: null,
            triageLevel: null,
            admittedAt: null,
            estimatedDischargeMinutes: null,
            cleaningRemainingMinutes: 10,
            acuityScore: null,
            notes: 'Discharged; EVS sanitization underway.',
          };
        }
        if (!cleanedOne && b.status === 'cleaning') {
          cleanedOne = true;
          return {
            ...b,
            status: 'available' as const,
            cleaningRemainingMinutes: null,
            notes: 'Sanitized and ready for admission.',
          };
        }
        return b;
      });

      return {
        ...prev,
        beds: nextBeds,
        queue: prev.queue.filter((p) => !dischargedPatientIds.has(p.id)),
      };
    });
    notify('Simulated bed turnover: 2 discharges initiated, 1 bed cleared.');
  };

  // Queue handlers
  const handleAssignBedToPatient = (patientId: string) => {
    setDataset((prev) => {
      const patient = prev.queue.find((p) => p.id === patientId);
      if (!patient) return prev;

      let targetBed = prev.beds.find(
        (b) => b.status === 'available' && b.wardId === patient.wardPreference
      );
      if (!targetBed) {
        targetBed = prev.beds.find((b) => b.status === 'available');
      }
      if (!targetBed) {
        notify('No available beds at this moment. Expedite cleaning or turn over a bed.');
        return prev;
      }

      const isCrit = patient.triageLevel === 1;
      notify(`Assigned ${patient.id} to Bed ${targetBed.id}.`);

      return {
        ...prev,
        beds: prev.beds.map((b) =>
          b.id === targetBed!.id
            ? {
                ...b,
                status: isCrit ? 'critical' : 'occupied',
                patientId: patient.id,
                patientCategory: patient.chiefComplaint,
                triageLevel: patient.triageLevel,
                admittedAt: formatClockTime(prev.simulation.simTimestamp),
                estimatedDischargeMinutes: patient.estimatedTreatmentMinutes,
                cleaningRemainingMinutes: null,
                acuityScore: isCrit ? 9 : Math.max(3, 8 - patient.triageLevel),
                notes: 'Placed directly from Patient Queue Intelligence.',
              }
            : b
        ),
        queue: prev.queue.map((p) =>
          p.id === patientId
            ? { ...p, status: 'in_treatment', assignedBedId: targetBed!.id }
            : p
        ),
      };
    });
  };

  const handleUpdatePatientStatus = (patientId: string, status: QueueStatus) => {
    setDataset((prev) => {
      const target = prev.queue.find((p) => p.id === patientId);
      if (!target) return prev;
      const bedId = target.assignedBedId;

      return {
        ...prev,
        queue:
          status === 'discharged'
            ? prev.queue.filter((p) => p.id !== patientId)
            : prev.queue.map((p) => (p.id === patientId ? { ...p, status } : p)),
        beds:
          status === 'discharged' && bedId
            ? prev.beds.map((b) =>
                b.id === bedId
                  ? {
                      ...b,
                      status: 'cleaning',
                      patientId: null,
                      patientCategory: null,
                      triageLevel: null,
                      admittedAt: null,
                      estimatedDischargeMinutes: null,
                      cleaningRemainingMinutes: 12,
                      acuityScore: null,
                      notes: 'Patient discharged; awaiting cleaning.',
                    }
                  : b
              )
            : prev.beds,
      };
    });
    if (status === 'discharged') notify(`Discharged ${patientId} and queued bed cleaning.`);
  };

  const handleAddPatient = (input: {
    triageLevel: TriageLevel;
    chiefComplaint: string;
    ageGroup: string;
    department: DepartmentName;
    wardPreference: WardId;
  }) => {
    setDataset((prev) => {
      const id = `PT-${prev.nextPatientSeq}`;
      return {
        ...prev,
        nextPatientSeq: prev.nextPatientSeq + 1,
        queue: [
          {
            id,
            triageLevel: input.triageLevel,
            chiefComplaint: input.chiefComplaint,
            ageGroup: input.ageGroup,
            arrivalTime: formatClockTime(prev.simulation.simTimestamp),
            arrivalOffsetMinutes: prev.simulation.elapsedSimMinutes,
            waitingMinutes: 0,
            department: input.department,
            wardPreference: input.wardPreference,
            status: input.triageLevel === 1 ? 'awaiting_bed' : 'waiting',
            assignedBedId: null,
            estimatedTreatmentMinutes: input.triageLevel <= 2 ? 65 : 40,
          },
          ...prev.queue,
        ],
      };
    });
    notify('Added synthetic patient intake to triage queue.');
  };

  // Forecast config handlers
  const handleUpdateForecastConfig = (patch: Partial<ForecastConfig>) => {
    setDataset((prev) => ({
      ...prev,
      forecastConfig: { ...prev.forecastConfig, ...patch },
    }));
  };

  const handleResetForecastConfig = () => {
    const fresh = createInitialDataset();
    setDataset((prev) => ({
      ...prev,
      forecastConfig: fresh.forecastConfig,
    }));
    notify('Forecast parameters reset to live defaults.');
  };

  // Alert handlers
  const handleAcknowledgeAlert = (id: string) => {
    setDataset((prev) => ({
      ...prev,
      alerts: prev.alerts.map((a) => (a.id === id ? { ...a, acknowledged: true } : a)),
    }));
  };

  const handleDismissAlert = (id: string) => {
    setDataset((prev) => ({
      ...prev,
      alerts: prev.alerts.map((a) => (a.id === id ? { ...a, dismissed: true } : a)),
    }));
  };

  const handleAcknowledgeAllAlerts = () => {
    setDataset((prev) => ({
      ...prev,
      alerts: prev.alerts.map((a) => ({ ...a, acknowledged: true })),
    }));
    notify('All active alerts acknowledged.');
  };

  const handleExecuteAlertAction = (alert: AlertItem) => {
    if (alert.actionType === 'expedite_cleaning') {
      handleExpediteAllCleanings();
    } else if (alert.actionType === 'allocate_staff') {
      handleAutoBalanceStaff();
    } else if (alert.actionType === 'open_overflow') {
      handleSimulateBedTurnover();
    } else if (alert.actionType === 'divert_fast_track') {
      setDataset((prev) => ({
        ...prev,
        forecastConfig: {
          ...prev.forecastConfig,
          avgTreatmentMinutes: Math.max(30, prev.forecastConfig.avgTreatmentMinutes - 4),
        },
      }));
      notify('Fast Track diversion applied; average treatment throughput improved.');
    }
    handleAcknowledgeAlert(alert.id);
  };

  // Staffing handlers
  const handleAdjustFloatStaff = (roleId: string, delta: number) => {
    setDataset((prev) => ({
      ...prev,
      staffRoles: prev.staffRoles.map((r) => {
        if (r.id !== roleId) return r;
        const nextFloat = Math.max(0, r.floatAllocated + delta);
        const nextOnDuty = r.scheduledBase + nextFloat;
        const nextUtil = Math.min(115, Math.round((r.recommendedRequired / Math.max(1, nextOnDuty)) * 88));
        return {
          ...r,
          floatAllocated: nextFloat,
          onDuty: nextOnDuty,
          utilizationPercent: nextUtil,
        };
      }),
    }));
  };

  const handleAutoBalanceStaff = () => {
    setDataset((prev) => ({
      ...prev,
      staffRoles: prev.staffRoles.map((r) => {
        const neededFloat = Math.max(r.floatAllocated, r.recommendedRequired - r.scheduledBase);
        const nextOnDuty = r.scheduledBase + neededFloat;
        return {
          ...r,
          floatAllocated: neededFloat,
          onDuty: nextOnDuty,
          utilizationPercent: Math.round((r.recommendedRequired / Math.max(1, nextOnDuty)) * 88),
        };
      }),
    }));
    notify('Float clinical staff allocated to match 3-hour surge demand.');
  };

  // Settings & Export handlers
  const handleUpdateSettings = (patch: Partial<HospitalSettings>) => {
    setDataset((prev) => ({
      ...prev,
      settings: { ...prev.settings, ...patch },
    }));
  };

  const handleExportReport = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      facility: dataset.settings.hospitalName,
      shiftClock: formatClockTime(dataset.simulation.simTimestamp),
      forecastSummary: {
        arrivals1h: forecast.arrivals1h,
        arrivals3h: forecast.arrivals3h,
        arrivals6h: forecast.arrivals6h,
        expectedOccupancy3h: forecast.expectedOccupancy3h,
        timeToShortage: forecast.timeToShortageLabel,
      },
      beds: dataset.beds,
      queue: dataset.queue,
      alerts: dataset.alerts.filter((a) => !a.dismissed),
      staffRoles: dataset.staffRoles,
    };
    downloadTextFile(
      'medpulse-ed-intelligence-report.json',
      JSON.stringify(payload, null, 2),
      'application/json'
    );
    notify('Downloaded full ED operational intelligence report (JSON).');
  };

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <Sidebar
        activeSection={activeSection}
        onSelectSection={(sec) => handleNavigate(sec)}
        activeAlertCount={activeAlertCount}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        hospitalName={dataset.settings.hospitalName}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <TopHeader
          activeSection={activeSection}
          simulation={dataset.simulation}
          isDark={isDark}
          onToggleTheme={() => setIsDark((d) => !d)}
          onToggleSimulation={handleToggleSimulation}
          onResetSimulation={handleResetSimulation}
          onChangeSpeed={handleChangeSpeed}
          onExportReport={handleExportReport}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
        />

        <main className="flex-1 p-4 sm:p-6 max-w-[1440px] w-full mx-auto">
          {activeSection === 'overview' && (
            <OverviewView
              dataset={dataset}
              forecast={forecast}
              isDark={isDark}
              onNavigate={handleNavigate}
              onAcknowledgeAlert={handleAcknowledgeAlert}
              onExecuteAlertAction={handleExecuteAlertAction}
              onManualRefreshPulse={handleManualPulse}
            />
          )}

          {activeSection === 'forecasting' && (
            <ForecastingView
              dataset={dataset}
              forecast={forecast}
              isDark={isDark}
              onUpdateForecastConfig={handleUpdateForecastConfig}
              onResetForecastConfig={handleResetForecastConfig}
            />
          )}

          {activeSection === 'beds' && (
            <BedIntelligenceView
              dataset={dataset}
              forecast={forecast}
              initialWardFilter={bedWardFilter}
              onUpdateBed={handleUpdateBed}
              onAssignWaitingPatientToBed={handleAssignWaitingPatientToBed}
              onExpediteAllCleanings={handleExpediteAllCleanings}
              onSimulateBedTurnover={handleSimulateBedTurnover}
            />
          )}

          {activeSection === 'queue' && (
            <PatientQueueView
              dataset={dataset}
              onAssignBedToPatient={handleAssignBedToPatient}
              onUpdatePatientStatus={handleUpdatePatientStatus}
              onAddPatient={handleAddPatient}
            />
          )}

          {activeSection === 'alerts' && (
            <AlertsView
              dataset={dataset}
              onAcknowledge={handleAcknowledgeAlert}
              onDismiss={handleDismissAlert}
              onAcknowledgeAll={handleAcknowledgeAllAlerts}
              onExecuteAlertAction={handleExecuteAlertAction}
            />
          )}

          {activeSection === 'staff' && (
            <StaffResourcesView
              dataset={dataset}
              forecast={forecast}
              onAdjustFloatStaff={handleAdjustFloatStaff}
              onAutoBalanceStaff={handleAutoBalanceStaff}
            />
          )}

          {activeSection === 'analytics' && (
            <AnalyticsView dataset={dataset} forecast={forecast} isDark={isDark} />
          )}

          {activeSection === 'settings' && (
            <SettingsView
              dataset={dataset}
              isDark={isDark}
              onToggleTheme={() => setIsDark((d) => !d)}
              onUpdateSettings={handleUpdateSettings}
              onUpdateSimSpeed={handleChangeSpeed}
              onUpdateConfidence={(level) => handleUpdateForecastConfig({ confidenceLevel: level })}
              onResetAllData={handleResetSimulation}
              onExportFullSnapshot={handleExportReport}
            />
          )}
        </main>
      </div>

      {/* Transient Action Feedback Toast */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-5 right-5 z-50 px-4 py-2.5 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-medium shadow-lg border border-slate-700 dark:border-slate-300"
        >
          {toastMessage}
        </div>
      )}
    </div>
  );
}
