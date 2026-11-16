import React, { useMemo, useState } from 'react';
import { Check, CheckCheck, Download, Trash2 } from 'lucide-react';
import { AlertItem, AlertSeverity, HospitalDataset } from '../../engine/types';
import { SeverityIcon } from '../shared/StatusHelpers';
import { arrayToCsv, downloadTextFile } from '../../utils/exportData';

interface AlertsViewProps {
  dataset: HospitalDataset;
  onAcknowledge: (id: string) => void;
  onDismiss: (id: string) => void;
  onAcknowledgeAll: () => void;
  onExecuteAlertAction: (alert: AlertItem) => void;
}

export const AlertsView: React.FC<AlertsViewProps> = ({
  dataset,
  onAcknowledge,
  onDismiss,
  onAcknowledgeAll,
  onExecuteAlertAction,
}) => {
  const [severityFilter, setSeverityFilter] = useState<AlertSeverity | 'all'>('all');
  const [stateFilter, setStateFilter] = useState<'active' | 'acknowledged' | 'all'>('active');
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(
    dataset.alerts.find((a) => !a.dismissed)?.id ?? null
  );

  const visibleAlerts = useMemo(() => {
    return dataset.alerts.filter((a) => {
      if (a.dismissed) return false;
      if (severityFilter !== 'all' && a.severity !== severityFilter) return false;
      if (stateFilter === 'active' && a.acknowledged) return false;
      if (stateFilter === 'acknowledged' && !a.acknowledged) return false;
      return true;
    });
  }, [dataset.alerts, severityFilter, stateFilter]);

  const activeCount = dataset.alerts.filter((a) => !a.dismissed && !a.acknowledged).length;
  const selectedAlert =
    visibleAlerts.find((a) => a.id === selectedAlertId) ?? visibleAlerts[0] ?? null;

  const handleExportAlerts = () => {
    const csv = arrayToCsv(
      ['Alert ID', 'Severity', 'Category', 'Title', 'Ward/Department', 'Timestamp', 'Recommended Action', 'Acknowledged'],
      visibleAlerts.map((a) => [
        a.id,
        a.severity,
        a.category,
        a.title,
        a.wardOrDepartment,
        a.timestamp,
        a.recommendedAction,
        a.acknowledged ? 'Yes' : 'No',
      ])
    );
    downloadTextFile('ed-operational-alerts.csv', csv, 'text/csv;charset=utf-8;');
  };

  return (
    <div className="space-y-5">
      {/* Filter & Bulk Controls */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
            {(['active', 'acknowledged', 'all'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStateFilter(st)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md capitalize transition-colors ${
                  stateFilter === st
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {st === 'active' ? `Active (${activeCount})` : st}
              </button>
            ))}
          </div>

          <select
            aria-label="Filter by alert severity"
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value as AlertSeverity | 'all')}
            className="px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200"
          >
            <option value="all">All Severities</option>
            <option value="Critical">Critical Only</option>
            <option value="High">High Only</option>
            <option value="Moderate">Moderate Only</option>
            <option value="Advisory">Advisory Only</option>
          </select>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleExportAlerts}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Log</span>
          </button>
          <button
            type="button"
            disabled={activeCount === 0}
            onClick={onAcknowledgeAll}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold hover:opacity-90 disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            <span>Acknowledge All</span>
          </button>
        </div>
      </section>

      {/* Split List + Alert Detail View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <section className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl divide-y divide-slate-200 dark:divide-slate-800">
          {visibleAlerts.length === 0 ? (
            <div className="p-10 text-center space-y-2">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                No alerts in this view
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Run the live simulation or adjust congestion thresholds to test automated alerts.
              </p>
            </div>
          ) : (
            visibleAlerts.map((alert) => {
              const isSelected = selectedAlert?.id === alert.id;
              return (
                <div
                  key={alert.id}
                  onClick={() => setSelectedAlertId(alert.id)}
                  className={`p-4 cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-blue-50/60 dark:bg-blue-950/30'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <SeverityIcon severity={alert.severity} />
                      <div className="min-w-0 space-y-1">
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 leading-snug">
                          {alert.title}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {alert.severity} · {alert.category} · {alert.wardOrDepartment} ·{' '}
                          <span className="font-mono tabular-nums">{alert.timestamp}</span>
                        </p>
                        <p className="text-xs text-slate-600 dark:text-slate-300">
                          {alert.description}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                      {!alert.acknowledged && (
                        <button
                          type="button"
                          onClick={() => onAcknowledge(alert.id)}
                          title="Acknowledge alert"
                          aria-label="Acknowledge alert"
                          className="p-1.5 rounded-md border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onDismiss(alert.id)}
                        title="Dismiss alert"
                        aria-label="Dismiss alert"
                        className="p-1.5 rounded-md border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </section>

        {/* Alert Detail & Action Execution Panel */}
        <aside className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 lg:sticky lg:top-20">
          {selectedAlert ? (
            <div className="space-y-4">
              <div className="pb-3 border-b border-slate-200 dark:border-slate-800">
                <p className="font-mono text-xs text-slate-500 dark:text-slate-400">
                  {selectedAlert.id} · {selectedAlert.timestamp}
                </p>
                <h3 className="font-display font-semibold text-base text-slate-900 dark:text-slate-100 mt-1">
                  {selectedAlert.title}
                </h3>
              </div>

              <dl className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <dt className="text-slate-500 dark:text-slate-400">Severity</dt>
                  <dd className="font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                    {selectedAlert.severity}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500 dark:text-slate-400">Category</dt>
                  <dd className="font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                    {selectedAlert.category}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500 dark:text-slate-400">Target Ward / Dept</dt>
                  <dd className="font-medium text-slate-900 dark:text-slate-100 mt-0.5">
                    {selectedAlert.wardOrDepartment}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500 dark:text-slate-400">Status</dt>
                  <dd className="font-medium text-slate-900 dark:text-slate-100 mt-0.5">
                    {selectedAlert.acknowledged ? 'Acknowledged' : 'Active / Pending'}
                  </dd>
                </div>
              </dl>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-1.5">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Situation Detail</p>
                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                  {selectedAlert.description}
                </p>
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Recommended Intervention
                </p>
                <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  {selectedAlert.recommendedAction}
                </p>

                <div className="flex flex-wrap items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => onExecuteAlertAction(selectedAlert)}
                    className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors"
                  >
                    Execute Recommendation
                  </button>
                  {!selectedAlert.acknowledged && (
                    <button
                      type="button"
                      onClick={() => onAcknowledge(selectedAlert.id)}
                      className="px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      Acknowledge
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="py-10 text-center text-xs text-slate-500 dark:text-slate-400">
              Select an alert to inspect operational guidance.
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};
