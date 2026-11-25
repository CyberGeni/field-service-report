import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Edit, Trash2, X, User } from 'lucide-react';
import { ServiceRecord, ServiceActivity, Settings, Profile } from '../types';
import { ActivityMeta, getActivityMeta, getAvailableActivities, isCreditActivity } from '../utils/activityTypes';
import { generateFieldServicePlan } from '../utils/calculations';
import { getDaysInMonth, getFirstDayOfMonth, isFieldServiceDay, formatHoursMinutes } from '../utils/dateUtils';
import { useToast } from './ui/toast';
import { useStudents } from '../hooks/useStudents';
import { usePlanClock } from '../hooks/usePlanClock';

interface CalendarTabProps {
  records: ServiceRecord[];
  settings: Settings;
  profile?: Profile | null;
  onSaveRecord: (record: ServiceRecord) => void;
  onDeleteRecord?: (id: string) => void;
}

interface StudentVisitEntry {
  entryId: string;
  visitId?: string;  // set when editing an existing DB visit
  studentId: string;
  notes: string;
  placeStopped: string;
  isNew: boolean;
  newName: string;
  newAddress: string;
}

interface EntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (record: ServiceRecord) => void;
  onDelete?: (id: string) => void;
  selectedDate: string;
  existingRecords: ServiceRecord[];
  // Which service types this user may log - volunteer credit only for volunteers
  activities: ActivityMeta[];
}

const EntryModal: React.FC<EntryModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onDelete,
  selectedDate,
  existingRecords,
  activities
}) => {
  const [selectedType, setSelectedType] = useState<ServiceActivity>('h2h');
  const [hours, setHours] = useState('');
  const [minutes, setMinutes] = useState('');
  const [notes, setNotes] = useState('');
  const [studentEntries, setStudentEntries] = useState<StudentVisitEntry[]>([]);
  const [loadingVisits, setLoadingVisits] = useState(false);
  const [removedVisitIds, setRemovedVisitIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [timeError, setTimeError] = useState(false);
  const { addToast } = useToast();
  const { students, saveStudent, saveStudentVisit, updateStudentVisit, deleteStudentVisit, loadVisitsByDate } = useStudents();

  // Load time/notes for a given service type — does NOT touch student entries
  const loadFormForType = (type: ServiceActivity) => {
    const existing = existingRecords.find(r => r.type === type);
    setHours(existing ? existing.hours.toString() : '');
    setMinutes(existing ? existing.minutes.toString() : '');
    setNotes(existing?.notes || '');
  };

  // Initialise on modal open — load form fields and pre-populate existing student visits
  React.useEffect(() => {
    if (isOpen) {
      // Focus whichever type was already logged, preferring the first one on offer
      // so a day holding only a credit opens on that credit rather than on an empty
      // House to House form.
      const logged = activities.find(activity =>
        existingRecords.some(record => record.type === activity.id)
      );
      const defaultType: ServiceActivity = logged?.id ?? 'h2h';
      setSelectedType(defaultType);
      loadFormForType(defaultType);
      setSaving(false);
      setTimeError(false);
      setRemovedVisitIds([]);

      // Load any student visits already recorded for this date
      setLoadingVisits(true);
      loadVisitsByDate(selectedDate)
        .then(visits => {
          setStudentEntries(visits.map(v => ({
            entryId: crypto.randomUUID(),
            visitId: v.id,
            studentId: v.student_id,
            notes: v.notes || '',
            placeStopped: v.place_stopped || '',
            isNew: false,
            newName: '',
            newAddress: ''
          })));
        })
        .catch(() => setStudentEntries([]))
        .finally(() => setLoadingVisits(false));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // ── Student entry helpers ──────────────────────────────────────────────────

  const addStudentEntry = () => {
    setStudentEntries(prev => [...prev, {
      entryId: crypto.randomUUID(),
      studentId: '',
      notes: '',
      placeStopped: '',
      isNew: false,
      newName: '',
      newAddress: ''
    }]);
  };

  const removeStudentEntry = (entryId: string) => {
    setStudentEntries(prev => {
      const entry = prev.find(e => e.entryId === entryId);
      if (entry?.visitId) {
        setRemovedVisitIds(ids => [...ids, entry.visitId!]);
      }
      return prev.filter(e => e.entryId !== entryId);
    });
  };

  const updateStudentEntry = (entryId: string, updates: Partial<StudentVisitEntry>) => {
    setStudentEntries(prev => prev.map(e => e.entryId === entryId ? { ...e, ...updates } : e));
  };

  // ── Save / Delete ──────────────────────────────────────────────────────────

  const handleSave = async () => {
    const hoursNum = parseInt(hours) || 0;
    const minutesNum = parseInt(minutes) || 0;
    const existingRecord = existingRecords.find(r => r.type === selectedType);
    // A school or volunteer credit is not a visit to anyone, so nothing new is
    // recorded against it; removals stay, since those were an explicit action.
    const validEntries = isCreditActivity(selectedType)
      ? []
      : studentEntries.filter(e => e.studentId || (e.isNew && e.newName.trim()));

    // Only require time when ADDING a new entry — not when editing an existing one,
    // because the user may intentionally clear time to delete the record while still
    // recording student visits.
    if (hoursNum === 0 && minutesNum === 0 && validEntries.length > 0 && !existingRecord) {
      setTimeError(true);
      addToast({
        type: 'error',
        title: 'Time Required',
        description: 'Please enter the hours you spent before saving'
      });
      return;
    }
    setTimeError(false);

    setSaving(true);
    try {
      if (hoursNum === 0 && minutesNum === 0) {
        if (existingRecord && onDelete) {
          await onDelete(existingRecord.id);
          addToast({ type: 'success', title: 'Entry Deleted', description: `${getActivityMeta(selectedType).label} record removed` });
        } else {
          addToast({ type: 'info', title: 'No Changes', description: 'No time entered and no existing record to delete' });
        }
        onClose();
        return;
      }

      // Save the service record
      const record: ServiceRecord = {
        id: existingRecord?.id || crypto.randomUUID(),
        date: selectedDate,
        hours: hoursNum,
        minutes: minutesNum,
        type: selectedType,
        notes: notes.trim() || undefined,
      };
      await onSave(record);

      // Delete any visits the user removed from the list
      for (const visitId of removedVisitIds) {
        try {
          await deleteStudentVisit(visitId, { silent: true });
        } catch (err) {
          console.error('Failed to delete student visit:', err);
        }
      }

      // Save or update student visits (silently — one summary toast below)
      let newVisitCount = 0;
      let updatedVisitCount = 0;
      for (const entry of validEntries) {
        try {
          let studentId = entry.studentId;

          if (entry.isNew && entry.newName.trim()) {
            const created = await saveStudent({
              name: entry.newName.trim(),
              address: entry.newAddress.trim(),
              date_met: selectedDate,
              publication_left: '',
              place_stopped: entry.placeStopped.trim(),
              last_visit_date: selectedDate,
              last_study_notes: entry.notes.trim()
            });
            studentId = created.id;
            addToast({ type: 'success', title: 'Student Created', description: `${entry.newName.trim()} added to your students` });
          }

          if (!studentId) continue;

          if (entry.visitId) {
            // Update existing visit record
            await updateStudentVisit(entry.visitId, {
              place_stopped: entry.placeStopped.trim() || undefined,
              notes: entry.notes.trim() || undefined
            }, { silent: true });
            updatedVisitCount++;
          } else {
            // New visit
            await saveStudentVisit({
              student_id: studentId,
              visit_date: selectedDate,
              place_stopped: entry.placeStopped.trim() || undefined,
              notes: entry.notes.trim() || undefined
            }, { silent: true });
            newVisitCount++;
          }
        } catch (err) {
          console.error('Failed to save student visit:', err);
        }
      }

      // Build a concise summary of what happened with student visits
      const studentParts: string[] = [];
      if (newVisitCount > 0) studentParts.push(`${newVisitCount} visit${newVisitCount > 1 ? 's' : ''} recorded`);
      if (updatedVisitCount > 0) studentParts.push(`${updatedVisitCount} updated`);
      if (removedVisitIds.length > 0) studentParts.push(`${removedVisitIds.length} removed`);
      const studentSummary = studentParts.length > 0 ? ` · ${studentParts.join(', ')}` : '';

      addToast({
        type: 'success',
        title: existingRecord ? 'Entry Updated' : 'Entry Added',
        description: `${hoursNum}h ${minutesNum}m logged${studentSummary}`
      });

      onClose();
    } catch {
      addToast({ type: 'error', title: 'Save Failed', description: 'Failed to save service record' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const existingRecord = existingRecords.find(r => r.type === selectedType);
    if (!existingRecord || !onDelete) return;
    setSaving(true);
    try {
      await onDelete(existingRecord.id);
      addToast({ type: 'success', title: 'Entry Deleted', description: `${getActivityMeta(selectedType).label} record removed` });
      onClose();
    } catch {
      addToast({ type: 'error', title: 'Delete Failed', description: 'Failed to delete service record' });
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateString: string) => {
    const [y, m, d] = dateString.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  };

  const existingRecord = existingRecords.find(r => r.type === selectedType);
  const hasExistingRecord = !!existingRecord;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-800">{hasExistingRecord ? 'Edit Entry' : 'Add Entry'}</h3>
              <p className="text-sm text-gray-600">{formatDate(selectedDate)}</p>
            </div>
            <button onClick={onClose} disabled={saving} className="p-2 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors">
              <X size={20} className="text-gray-500" />
            </button>
          </div>

          <div className="space-y-5">
            {/* Service Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">Service Type</label>
              <div className="grid grid-cols-2 gap-3">
                {activities.map(({ id, label, subtitle, icon: Icon, selectedCard, selectedIconBg }) => (
                  <button
                    key={id}
                    onClick={() => { setSelectedType(id); loadFormForType(id); }}
                    disabled={saving}
                    className={`p-4 rounded-xl transition-all duration-200 border-2 text-left disabled:opacity-60 disabled:cursor-not-allowed ${selectedType === id ? selectedCard : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border-gray-200 hover:border-gray-300'}`}
                  >
                    <div className="flex flex-col items-center text-center space-y-2">
                      <div className={`p-2 rounded-lg ${selectedType === id ? selectedIconBg : 'bg-white'}`}>
                        <Icon size={24} />
                      </div>
                      <div>
                        <div className="font-semibold text-sm">{label}</div>
                        <div className="text-xs opacity-75 mt-1">{subtitle}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Time - worked for preaching, awarded for a credit */}
            <div>
              {getActivityMeta(selectedType).hint && (
                <p className="text-sm text-gray-500 mb-3">{getActivityMeta(selectedType).hint}</p>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium mb-2 ${timeError ? 'text-red-600' : 'text-gray-700'}`}>
                    Hours {timeError && <span className="text-red-500">*</span>}
                  </label>
                  {/* A school credit is 30 hours in one go, so the day's cap only
                      applies to time that was actually spent */}
                  <input type="number" min="0" max={isCreditActivity(selectedType) ? 999 : 24} value={hours}
                    onChange={e => { setHours(e.target.value); if (timeError) setTimeError(false); }}
                    disabled={saving}
                    className={`w-full p-3 rounded-xl focus:ring-2 focus:bg-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
                      timeError
                        ? 'bg-red-50 border-2 border-red-400 focus:ring-red-400'
                        : 'bg-gray-50 focus:ring-blue-500'
                    }`} placeholder="0" />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-2 ${timeError ? 'text-red-600' : 'text-gray-700'}`}>
                    Minutes {timeError && <span className="text-red-500">*</span>}
                  </label>
                  <input type="number" min="0" max="59" value={minutes}
                    onChange={e => { setMinutes(e.target.value); if (timeError) setTimeError(false); }}
                    disabled={saving}
                    className={`w-full p-3 rounded-xl focus:ring-2 focus:bg-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
                      timeError
                        ? 'bg-red-50 border-2 border-red-400 focus:ring-red-400'
                        : 'bg-gray-50 focus:ring-blue-500'
                    }`} placeholder="0" />
                </div>
              </div>
              {timeError && (
                <p className="mt-2 text-sm text-red-600 flex items-center space-x-1">
                  <span>⚠️</span>
                  <span>Enter the time you spent before saving</span>
                </p>
              )}
            </div>

            {/* General Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Notes (optional)</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                disabled={saving}
                placeholder={
                  isCreditActivity(selectedType)
                    ? `What this ${getActivityMeta(selectedType).label.toLowerCase()} was for…`
                    : `Notes about your ${getActivityMeta(selectedType).label.toLowerCase()} service…`
                }
                className="w-full p-3 bg-gray-50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors resize-none disabled:opacity-60 disabled:cursor-not-allowed" />
            </div>

            {/* ── Students Visited ── (nothing to record against a credit) */}
            <div className={isCreditActivity(selectedType) ? 'hidden' : ''}>
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-medium text-gray-700">Students Visited</label>
                <button type="button" onClick={addStudentEntry} disabled={saving}
                  className="text-sm text-blue-600 hover:text-blue-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center space-x-1 font-medium">
                  <Plus size={14} />
                  <span>Add Student</span>
                </button>
              </div>

              {loadingVisits ? (
                <div className="flex items-center justify-center space-x-2 py-4 text-gray-400">
                  <div className="w-4 h-4 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm">Loading visits…</span>
                </div>
              ) : studentEntries.length === 0 ? (
                <button type="button" onClick={addStudentEntry} disabled={saving}
                  className="w-full border-2 border-dashed border-gray-300 hover:border-blue-400 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl p-4 text-gray-400 hover:text-blue-600 transition-colors flex items-center justify-center space-x-2 text-sm">
                  <User size={16} />
                  <span>Tap to record a student visit</span>
                </button>
              ) : (
                <div className="space-y-3">
                  {studentEntries.map((entry, idx) => (
                    <div key={entry.entryId} className="bg-blue-50 border border-blue-100 rounded-xl p-4 space-y-3">
                      {/* Entry header */}
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-blue-800">
                          {entry.visitId && entry.studentId
                            ? (students.find(s => s.id === entry.studentId)?.name ?? `Student ${idx + 1}`)
                            : `Student ${idx + 1}`}
                        </span>
                        <button onClick={() => removeStudentEntry(entry.entryId)} disabled={saving}
                          className="p-1 text-blue-400 hover:text-red-500 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors">
                          <X size={16} />
                        </button>
                      </div>

                      {/* Student picker — hidden for existing visits (student identity is fixed) */}
                      {!entry.visitId && !entry.isNew ? (
                        <div className="space-y-2">
                          <select value={entry.studentId}
                            onChange={e => updateStudentEntry(entry.entryId, { studentId: e.target.value })}
                            disabled={saving}
                            className="w-full p-3 bg-white rounded-xl border border-blue-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm disabled:opacity-60 disabled:cursor-not-allowed">
                            <option value="">Select a student…</option>
                            {students.map(s => (
                              <option key={s.id} value={s.id}>{s.name} — {s.address}</option>
                            ))}
                          </select>
                          <button type="button"
                            onClick={() => updateStudentEntry(entry.entryId, { isNew: true, studentId: '' })}
                            disabled={saving}
                            className="text-xs text-blue-600 hover:text-blue-800 disabled:opacity-40 disabled:cursor-not-allowed flex items-center space-x-1">
                            <Plus size={12} />
                            <span>Create new student instead</span>
                          </button>
                        </div>
                      ) : !entry.visitId ? (
                        <div className="space-y-2">
                          <input type="text" value={entry.newName} placeholder="Student's name *"
                            onChange={e => updateStudentEntry(entry.entryId, { newName: e.target.value })}
                            disabled={saving}
                            className="w-full p-3 bg-white rounded-xl border border-blue-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm disabled:opacity-60 disabled:cursor-not-allowed" />
                          <textarea value={entry.newAddress} placeholder="Student's address *" rows={2}
                            onChange={e => updateStudentEntry(entry.entryId, { newAddress: e.target.value })}
                            disabled={saving}
                            className="w-full p-3 bg-white rounded-xl border border-blue-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm resize-none disabled:opacity-60 disabled:cursor-not-allowed" />
                          <button type="button"
                            onClick={() => updateStudentEntry(entry.entryId, { isNew: false, newName: '', newAddress: '' })}
                            disabled={saving}
                            className="text-xs text-blue-600 hover:text-blue-800 disabled:opacity-40 disabled:cursor-not-allowed flex items-center space-x-1">
                            <span>← Select existing student instead</span>
                          </button>
                        </div>
                      ) : null}

                      {/* Where we stopped */}
                      <div>
                        <label className="block text-xs font-medium text-blue-700 mb-1">Where we stopped</label>
                        <input type="text" value={entry.placeStopped}
                          onChange={e => updateStudentEntry(entry.entryId, { placeStopped: e.target.value })}
                          disabled={saving}
                          placeholder="e.g. Chapter 3, paragraph 12"
                          className="w-full p-2.5 bg-white rounded-xl border border-blue-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm disabled:opacity-60 disabled:cursor-not-allowed" />
                      </div>

                      {/* Visit notes */}
                      <div>
                        <label className="block text-xs font-medium text-blue-700 mb-1">Visit notes</label>
                        <textarea value={entry.notes} rows={2}
                          onChange={e => updateStudentEntry(entry.entryId, { notes: e.target.value })}
                          disabled={saving}
                          placeholder="How did the study go?"
                          className="w-full p-2.5 bg-white rounded-xl border border-blue-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm resize-none disabled:opacity-60 disabled:cursor-not-allowed" />
                      </div>
                    </div>
                  ))}

                  <button type="button" onClick={addStudentEntry} disabled={saving}
                    className="w-full border border-dashed border-blue-300 hover:border-blue-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl p-3 text-blue-500 hover:text-blue-700 transition-colors text-sm flex items-center justify-center space-x-2">
                    <Plus size={14} />
                    <span>Add Another Student</span>
                  </button>
                </div>
              )}
            </div>

            {/* Existing records summary */}
            {existingRecords.length > 0 && (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Already logged today:</h4>
                <div className="space-y-1">
                  {existingRecords.map(record => {
                    const meta = getActivityMeta(record.type);
                    const RecordIcon = meta.icon;
                    return (
                      <div key={record.id} className="flex items-center justify-between text-sm">
                        <span className="flex items-center space-x-2">
                          <RecordIcon size={14} className={meta.accentText} />
                          <span>{meta.label}</span>
                        </span>
                        <span className="font-medium">{record.hours}h {record.minutes}m</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex space-x-3 mt-6">
            {hasExistingRecord && onDelete && (
              <button onClick={handleDelete} disabled={saving}
                className="bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white py-3 px-4 rounded-xl font-medium transition-colors flex items-center space-x-2">
                <Trash2 size={16} />
                <span>Delete</span>
              </button>
            )}
            <button onClick={onClose} disabled={saving}
              className="flex-1 bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 text-gray-800 py-3 px-4 rounded-xl font-medium transition-colors">
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-3 px-4 rounded-xl font-medium transition-colors flex items-center justify-center space-x-2">
              {saving ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Edit size={16} /><span>{hasExistingRecord ? 'Update' : 'Save'}</span></>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const CalendarTab: React.FC<CalendarTabProps> = ({ records, settings, profile, onSaveRecord, onDeleteRecord }) => {
  // Volunteer credit is only part of this calendar for a user who does that work
  const activities = getAvailableActivities(profile);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  
  const daysInMonth = getDaysInMonth(year, month + 1);
  const firstDay = getFirstDayOfMonth(year, month + 1);
  const monthName = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  // ── Plan helpers ────────────────────────────────────────────────────────────

  const monthKey = `${year}-${(month + 1).toString().padStart(2, '0')}`;

  // The plan depends on the time of day as well as the data, so it is rebuilt when
  // the evening cutoff or midnight passes with the calendar still open
  const planPeriod = usePlanClock();

  // The same plan the home screen shows, so a day reads the same in both places
  const plannedHoursByDate = useMemo(() => {
    const plan = generateFieldServicePlan(records, settings, monthKey, profile);
    return new Map(plan.days.map(day => [day.date, day.plannedHours]));
    // planPeriod is not read inside, it is what invalidates the plan over time
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [records, settings, monthKey, profile, planPeriod]);

  /**
   * Format hours as a compact string for calendar cells, in 15-min slots.
   *
   * Rounded up, never to nearest: a plan asking for 7 minutes would otherwise read
   * "0m", and rounding each day down would leave the month short of its target.
   */
  const formatEstimate = (hours: number): string => {
    // The hundredth of a minute keeps float noise (2.0000001h) from spilling into an
    // extra slot - nothing in the plan is finer than a minute
    const totalMins = Math.max(15, Math.ceil((hours * 60 - 0.01) / 15) * 15);
    const h = Math.floor(totalMins / 60);
    const m = totalMins % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  };

  /**
   * How many hours the plan asks for on this day, or null when it asks nothing of
   * it - a day gone by, one already worked, one that was never a field day, or a
   * month whose target is already met.
   */
  const getPlannedHours = (day: number): number | null => {
    const dateStr = `${monthKey}-${day.toString().padStart(2, '0')}`;
    return plannedHoursByDate.get(dateStr) ?? null;
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    // Anchored on the 1st: setMonth on the 31st overflows a short month, so January
    // 31st + 1 month would land on March 3rd and skip February entirely
    setCurrentDate(prev =>
      new Date(prev.getFullYear(), prev.getMonth() + (direction === 'prev' ? -1 : 1), 1)
    );
  };

  const getRecordsForDate = (day: number): ServiceRecord[] => {
    const dateString = `${year}-${(month + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    return records.filter(record => record.date === dateString);
  };

  const getTotalTimeForDate = (day: number): { hours: number; minutes: number } => {
    const dayRecords = getRecordsForDate(day);
    const totalMinutes = dayRecords.reduce((total, record) => {
      return total + (record.hours * 60) + record.minutes;
    }, 0);
    
    return {
      hours: Math.floor(totalMinutes / 60),
      minutes: totalMinutes % 60
    };
  };

  /**
   * The dot under a day, coloured by what was logged on it.
   *
   * A day holding more than one kind gets a gradient across the first two, so the
   * common case - preaching plus a credit - still reads as two things at a glance
   * instead of collapsing to whichever was checked first.
   */
  const getServiceTypeColor = (records: ServiceRecord[]): string => {
    const present = activities.filter(activity =>
      records.some(record => record.type === activity.id)
    );

    if (present.length === 0) return 'bg-gray-500';
    if (present.length === 1) return present[0].dotColor;

    return `bg-gradient-to-r ${present[0].gradientFrom} ${present[1].gradientTo}`;
  };

  const isFutureDate = (day: number): boolean => {
    const today = new Date();
    const dayDate = new Date(year, month, day);
    return dayDate > today;
  };

  const handleDayClick = (day: number) => {
    // Prevent clicking on future dates
    if (isFutureDate(day)) {
      return;
    }

    const dateString = `${year}-${(month + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    setSelectedDate(dateString);
    setShowEntryModal(true);
  };

  const renderCalendarDay = (day: number) => {
    const date = new Date(year, month, day);
    const isFieldDay = isFieldServiceDay(date, settings.fieldServiceDays);
    const dayRecords = getRecordsForDate(day);
    const totalTime = getTotalTimeForDate(day);
    const hasRecords = dayRecords.length > 0;
    const isToday = new Date().toDateString() === date.toDateString();
    const isFuture = isFutureDate(day);
    const estimate = getPlannedHours(day);
    // A day the plan is asking for. Future cells are dimmed as a rule, but dimming
    // the one thing the calendar is trying to tell the user to do defeats it.
    const isPlanned = estimate !== null;

    return (
      <button
        key={day}
        onClick={() => handleDayClick(day)}
        disabled={isFuture}
        className={`relative h-20 p-1 w-full text-left transition-colors flex flex-col ${
          isToday
            ? 'bg-blue-100 hover:bg-blue-200'
            : isPlanned
              ? `bg-blue-50 ${isFuture ? 'cursor-not-allowed' : 'hover:bg-blue-100'}`
              : isFuture
                ? 'bg-gray-100 cursor-not-allowed opacity-50'
                : 'bg-white hover:bg-gray-100'
        }`}
      >
        {/* Date number at the top */}
        <div className={`text-sm font-medium mb-1 ${
          isToday ? 'text-blue-600' :
          isPlanned ? 'text-blue-600' :
          isFuture ? 'text-gray-400' :
          isFieldDay ? 'text-gray-800' : 'text-gray-400'
        }`}>
          {day}
        </div>

        {/* Past unlogged field day — small grey dot */}
        {isFieldDay && !hasRecords && !isFuture && !isPlanned && (
          <div className="w-2 h-2 bg-gray-300 rounded-full mb-1" />
        )}

        {/* A planned day, and how long to spend on it */}
        {isPlanned && (
          <div className="flex-1 flex items-center justify-center">
            <span className="text-xs font-medium text-blue-700 leading-tight text-center whitespace-nowrap">
              {formatEstimate(estimate)}
            </span>
          </div>
        )}

        {/* Service record entry */}
        {hasRecords && (
          <div className="flex-1 min-h-0">
            <div className={`${getServiceTypeColor(dayRecords)} rounded p-1 text-white text-xs h-full flex items-center justify-center`}>
              <div className="text-center">
                <div className="font-semibold text-sm">
                  {totalTime.hours}:{totalTime.minutes.toString().padStart(2, '0')}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Add icon for clickable indication - only for non-future dates */}
        {!isFuture && (
          <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {hasRecords ? (
              <Edit size={12} className="text-gray-400" />
            ) : (
              <Plus size={12} className="text-gray-400" />
            )}
          </div>
        )}
      </button>
    );
  };

  const renderEmptyDay = (index: number) => (
    <div key={`empty-${index}`} className="h-20 bg-gray-50" />
  );

  const monthlyTotal = records
    .filter(record => record.date.startsWith(`${year}-${(month + 1).toString().padStart(2, '0')}`))
    .reduce((total, record) => total + record.hours + record.minutes / 60, 0);

  const selectedDateRecords = selectedDate ? records.filter(r => r.date === selectedDate) : [];

  return (
    <div className="space-y-4 pb-6">
      {/* Header */}
      <div className="flex items-center justify-between bg-white rounded-xl p-6">
        <button
          onClick={() => navigateMonth('prev')}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <ChevronLeft size={20} />
        </button>
        
        <div className="text-center">
          <h2 className="text-xl font-bold text-gray-800">{monthName}</h2>
          <p className="text-sm text-gray-600">
            Total: {formatHoursMinutes(monthlyTotal)}
          </p>
        </div>
        
        <button
          onClick={() => navigateMonth('next')}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-2">
        <p className="text-blue-800 text-sm font-medium">
          💡 Click on any past or current day to record time.
        </p>
      </div>

      {/* Legend */}
      <div className="bg-white rounded-xl p-4">
        <h3 className="text-sm font-semibold text-gray-800 mb-3">Color codes</h3>
        <div className="grid grid-cols-2 gap-3 text-xs">
          {activities.map(activity => (
            <div key={activity.id} className="flex items-center space-x-2">
              <div className={`w-3 h-3 ${activity.dotColor} rounded`}></div>
              <span>{activity.label}</span>
            </div>
          ))}
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-gradient-to-r from-blue-500 to-purple-500 rounded"></div>
            <span>More than one</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-gray-300 rounded-full"></div>
            <span>Field service day</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-blue-50 border border-blue-200 rounded"></div>
            <span>Planned day &amp; hours</span>
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="bg-white rounded-xl overflow-hidden">
        {/* Days of Week Header */}
        <div className="grid grid-cols-7 bg-gray-50">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="p-3 text-center text-sm font-medium text-gray-600">
              {day}
            </div>
          ))}
        </div>
        
        {/* Calendar Days */}
        <div className="grid grid-cols-7 divide-x divide-y divide-gray-200 group">
          {/* Empty cells for days before month starts */}
          {Array.from({ length: firstDay }, (_, i) => renderEmptyDay(i))}
          
          {/* Days of the month */}
          {Array.from({ length: daysInMonth }, (_, i) => renderCalendarDay(i + 1))}
          
          {/* Empty cells to complete the grid */}
          {Array.from({ length: (7 - ((firstDay + daysInMonth) % 7)) % 7 }, (_, i) => 
            renderEmptyDay(firstDay + daysInMonth + i)
          )}
        </div>
      </div>

      {/* Entry Modal */}
      <EntryModal
        isOpen={showEntryModal}
        onClose={() => setShowEntryModal(false)}
        onSave={onSaveRecord}
        onDelete={onDeleteRecord}
        selectedDate={selectedDate}
        existingRecords={selectedDateRecords}
        activities={activities}
      />
    </div>
  );
};

export default CalendarTab;