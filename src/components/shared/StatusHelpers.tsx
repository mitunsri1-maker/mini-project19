import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  HeartPulse,
  ShieldAlert,
  Sparkles,
  Wrench,
} from 'lucide-react';
import { AlertSeverity, BedStatus, CongestionLevel, TriageLevel } from '../../engine/types';

export function getCongestionTextClass(level: CongestionLevel): string {
  switch (level) {
    case 'Critical':
      return 'text-rose-700 dark:text-rose-400';
    case 'High':
      return 'text-amber-700 dark:text-amber-400';
    case 'Elevated':
      return 'text-blue-700 dark:text-blue-400';
    default:
      return 'text-teal-700 dark:text-teal-400';
  }
}

export function getCongestionBarClass(level: CongestionLevel): string {
  switch (level) {
    case 'Critical':
      return 'bg-rose-600 dark:bg-rose-500';
    case 'High':
      return 'bg-amber-500 dark:bg-amber-400';
    case 'Elevated':
      return 'bg-blue-600 dark:bg-blue-500';
    default:
      return 'bg-teal-600 dark:bg-teal-500';
  }
}

export const BED_STATUS_META: Record<
  BedStatus,
  {
    label: string;
    shortLabel: string;
    surfaceClass: string;
    textClass: string;
    borderClass: string;
    dotClass: string;
  }
> = {
  available: {
    label: 'Available',
    shortLabel: 'Open',
    surfaceClass: 'bg-teal-50/70 dark:bg-teal-950/30',
    textClass: 'text-teal-800 dark:text-teal-300',
    borderClass: 'border-teal-200 dark:border-teal-800/80',
    dotClass: 'bg-teal-600 dark:bg-teal-400',
  },
  occupied: {
    label: 'Occupied',
    shortLabel: 'Occupied',
    surfaceClass: 'bg-blue-50/70 dark:bg-blue-950/30',
    textClass: 'text-blue-800 dark:text-blue-300',
    borderClass: 'border-blue-200 dark:border-blue-800/80',
    dotClass: 'bg-blue-600 dark:bg-blue-400',
  },
  critical: {
    label: 'Critical Patient',
    shortLabel: 'Critical',
    surfaceClass: 'bg-rose-50/80 dark:bg-rose-950/35',
    textClass: 'text-rose-800 dark:text-rose-300',
    borderClass: 'border-rose-300 dark:border-rose-800',
    dotClass: 'bg-rose-600 dark:bg-rose-400',
  },
  reserved: {
    label: 'Reserved',
    shortLabel: 'Reserved',
    surfaceClass: 'bg-indigo-50/70 dark:bg-indigo-950/30',
    textClass: 'text-indigo-800 dark:text-indigo-300',
    borderClass: 'border-indigo-200 dark:border-indigo-800/80',
    dotClass: 'bg-indigo-600 dark:bg-indigo-400',
  },
  cleaning: {
    label: 'Cleaning',
    shortLabel: 'Sanitizing',
    surfaceClass: 'bg-amber-50/70 dark:bg-amber-950/30',
    textClass: 'text-amber-800 dark:text-amber-300',
    borderClass: 'border-amber-200 dark:border-amber-800/80',
    dotClass: 'bg-amber-500 dark:bg-amber-400',
  },
  out_of_service: {
    label: 'Out of Service',
    shortLabel: 'Offline',
    surfaceClass: 'bg-slate-100 dark:bg-slate-800/60',
    textClass: 'text-slate-600 dark:text-slate-400',
    borderClass: 'border-slate-300 dark:border-slate-700',
    dotClass: 'bg-slate-400 dark:bg-slate-500',
  },
};

export function BedStatusIcon({ status, className = 'w-3.5 h-3.5' }: { status: BedStatus; className?: string }) {
  switch (status) {
    case 'available':
      return <CheckCircle2 className={className} />;
    case 'critical':
      return <HeartPulse className={className} />;
    case 'reserved':
      return <Clock className={className} />;
    case 'cleaning':
      return <Sparkles className={className} />;
    case 'out_of_service':
      return <Wrench className={className} />;
    default:
      return <ShieldAlert className={className} />;
  }
}

export function getTriageLabel(level: TriageLevel): string {
  switch (level) {
    case 1:
      return 'ESI 1 · Resuscitation';
    case 2:
      return 'ESI 2 · Emergent';
    case 3:
      return 'ESI 3 · Urgent';
    case 4:
      return 'ESI 4 · Less Urgent';
    case 5:
      return 'ESI 5 · Non-Urgent';
  }
}

export function getTriageTextClass(level: TriageLevel): string {
  switch (level) {
    case 1:
      return 'text-rose-700 dark:text-rose-400 font-semibold';
    case 2:
      return 'text-amber-700 dark:text-amber-400 font-semibold';
    case 3:
      return 'text-blue-700 dark:text-blue-400 font-medium';
    case 4:
      return 'text-teal-700 dark:text-teal-400 font-medium';
    case 5:
      return 'text-slate-600 dark:text-slate-400';
  }
}

export function SeverityIcon({ severity }: { severity: AlertSeverity }) {
  if (severity === 'Critical') {
    return <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />;
  }
  if (severity === 'High') {
    return <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />;
  }
  return <ShieldAlert className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />;
}
