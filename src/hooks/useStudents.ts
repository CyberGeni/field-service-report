import { useState, useEffect } from 'react';
import { Student, StudentVisit } from '../types';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import { useToast } from '../components/ui/toast';
import { readCache, writeCache } from '../utils/offlineCache';
import { getErrorMessage } from '../utils/errors';

const STUDENTS_CACHE = 'students';

// Three components mount this hook at once (the tab, its detail sheet, the calendar).
// Without a shared load they each hit the network - and each raised its own "failed to
// load" toast when the network was not there.
let inFlight: { userId: string; request: Promise<Student[]> } | null = null;

const fetchStudents = (userId: string): Promise<Student[]> => {
  if (inFlight?.userId === userId) return inFlight.request;

  // Wrapped in Promise.resolve: the Supabase builder is only a thenable, so its own
  // .then() stays a PromiseLike with no .finally() to chain off of.
  const request = Promise.resolve(
    supabase
      .from('students')
      .select('*')
      .eq('user_id', userId)
      .order('name', { ascending: true })
  )
    .then(({ data, error }) => {
      if (error) throw error;
      return (data || []) as Student[];
    })
    .finally(() => {
      if (inFlight?.userId === userId) inFlight = null;
    });

  inFlight = { userId, request };
  return request;
};

export const useStudents = () => {
  // Start from the device's copy so the list is there with no signal, before any fetch
  const { user } = useAuth();
  const [students, setStudents] = useState<Student[]>(
    () => (user ? readCache<Student[]>(STUDENTS_CACHE, user.id) : null) || []
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { addToast } = useToast();

  // Load students when user changes
  useEffect(() => {
    if (user) {
      loadStudents();
    } else {
      setStudents([]);
      setLoading(false);
    }
  }, [user]);

  const loadStudents = async () => {
    if (!user) return;

    const cached = readCache<Student[]>(STUDENTS_CACHE, user.id);
    if (cached) {
      setStudents(cached);
      setLoading(false);
    }

    try {
      setError(null);

      const studentsData = await fetchStudents(user.id);

      console.log('Loaded', studentsData.length, 'students');
      setStudents(studentsData);
      writeCache(STUDENTS_CACHE, user.id, studentsData);
    } catch (err: unknown) {
      console.error('Error loading students:', err);

      // Offline is a state, not a failure: the list on screen is the last one synced,
      // and shouting about it once per mounted component helps nobody.
      if (cached || !navigator.onLine) {
        setError(null);
        return;
      }

      setError(getErrorMessage(err));
      addToast({
        type: 'error',
        title: 'Load Failed',
        description: 'Failed to load students'
      });
    } finally {
      setLoading(false);
    }
  };

  const loadStudentVisits = async (studentId: string): Promise<StudentVisit[]> => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    try {
      console.log('Loading visits for student:', studentId);

      const { data: visitsData, error: visitsError } = await supabase
        .from('student_visits')
        .select('*')
        .eq('student_id', studentId)
        .eq('user_id', user.id)
        .order('visit_date', { ascending: false });

      if (visitsError) throw visitsError;

      console.log('Loaded', visitsData?.length || 0, 'visits for student');
      return visitsData || [];

    } catch (err: unknown) {
      console.error('Error loading student visits:', err);
      addToast({
        type: 'error',
        title: 'Load Failed',
        description: 'Failed to load student visits'
      });
      throw err;
    }
  };

  const saveStudent = async (student: Omit<Student, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
    if (!user) {
      setError('User not authenticated');
      return;
    }

    try {
      setError(null);

      const studentData = {
        user_id: user.id,
        name: student.name.trim(),
        address: student.address.trim(),
        publication_left: student.publication_left?.trim() || null,
        place_stopped: student.place_stopped?.trim() || null,
        date_met: student.date_met,
        last_visit_date: student.last_visit_date || null,
        last_study_notes: student.last_study_notes?.trim() || null
      };

      console.log('Saving student:', studentData);

      const { data, error } = await supabase
        .from('students')
        .insert(studentData)
        .select()
        .single();

      if (error) throw error;

      console.log('Student saved successfully:', data);

      // Update local state
      setStudents(prev => {
        const next = [...prev, data].sort((a, b) => a.name.localeCompare(b.name));
        if (user) writeCache(STUDENTS_CACHE, user.id, next);
        return next;
      });

      addToast({
        type: 'success',
        title: 'Student Added',
        description: `${student.name} has been added to your students list`
      });

      return data;

    } catch (err: unknown) {
      console.error('Error saving student:', err);
      setError(getErrorMessage(err));
      addToast({
        type: 'error',
        title: 'Save Failed',
        description: 'Failed to save student'
      });
      throw err;
    }
  };

  const updateStudent = async (id: string, updates: Partial<Omit<Student, 'id' | 'user_id' | 'created_at' | 'updated_at'>>) => {
    if (!user) {
      setError('User not authenticated');
      return;
    }

    try {
      setError(null);

      const updateData = {
        ...updates,
        name: updates.name?.trim(),
        address: updates.address?.trim(),
        publication_left: updates.publication_left?.trim() || null,
        place_stopped: updates.place_stopped?.trim() || null,
        last_study_notes: updates.last_study_notes?.trim() || null,
        // Convert empty strings to null for date fields
        date_met: updates.date_met === '' ? null : updates.date_met,
        last_visit_date: updates.last_visit_date === '' ? null : updates.last_visit_date
      };

      // Remove undefined values
      Object.keys(updateData).forEach(key => {
        if (updateData[key as keyof typeof updateData] === undefined) {
          delete updateData[key as keyof typeof updateData];
        }
      });

      console.log('Updating student:', id, updateData);

      const { data, error } = await supabase
        .from('students')
        .update(updateData)
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;

      console.log('Student updated successfully:', data);

      // Update local state
      setStudents(prev => {
        const next = prev
          .map(student => (student.id === id ? data : student))
          .sort((a, b) => a.name.localeCompare(b.name));
        if (user) writeCache(STUDENTS_CACHE, user.id, next);
        return next;
      });

      addToast({
        type: 'success',
        title: 'Student Updated',
        description: `${data.name}'s information has been updated`
      });

      return data;

    } catch (err: unknown) {
      console.error('Error updating student:', err);
      setError(getErrorMessage(err));
      addToast({
        type: 'error',
        title: 'Update Failed',
        description: 'Failed to update student'
      });
      throw err;
    }
  };

  const deleteStudent = async (id: string) => {
    if (!user) {
      setError('User not authenticated');
      return;
    }

    try {
      setError(null);

      const studentToDelete = students.find(s => s.id === id);
      if (!studentToDelete) {
        throw new Error('Student not found');
      }

      console.log('Deleting student:', id);

      const { error } = await supabase
        .from('students')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;

      console.log('Student deleted successfully');

      // Update local state
      setStudents(prev => {
        const next = prev.filter(student => student.id !== id);
        if (user) writeCache(STUDENTS_CACHE, user.id, next);
        return next;
      });

      addToast({
        type: 'success',
        title: 'Student Deleted',
        description: `${studentToDelete.name} has been removed from your students list`
      });

    } catch (err: unknown) {
      console.error('Error deleting student:', err);
      setError(getErrorMessage(err));
      addToast({
        type: 'error',
        title: 'Delete Failed',
        description: 'Failed to delete student'
      });
      throw err;
    }
  };

  const saveStudentVisit = async (visit: Omit<StudentVisit, 'id' | 'user_id' | 'created_at' | 'updated_at'>, options: { silent?: boolean } = {}) => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    try {
      const visitData = {
        user_id: user.id,
        student_id: visit.student_id,
        visit_date: visit.visit_date,
        place_stopped: visit.place_stopped?.trim() || null,
        notes: visit.notes?.trim() || null
      };

      console.log('Saving student visit:', visitData);

      const { data, error } = await supabase
        .from('student_visits')
        .insert(visitData)
        .select()
        .single();

      if (error) throw error;

      console.log('Student visit saved successfully:', data);

      // Update the student's last visit info
      await updateStudent(visit.student_id, {
        last_visit_date: visit.visit_date,
        last_study_notes: visit.notes,
        place_stopped: visit.place_stopped
      });

      if (!options.silent) {
        addToast({
          type: 'success',
          title: 'Visit Recorded',
          description: 'Student visit has been recorded successfully'
        });
      }

      return data;

    } catch (err: unknown) {
      console.error('Error saving student visit:', err);
      addToast({
        type: 'error',
        title: 'Save Failed',
        description: 'Failed to save student visit'
      });
      throw err;
    }
  };

  const loadVisitsByDate = async (date: string): Promise<StudentVisit[]> => {
    if (!user) return [];
    try {
      const { data, error } = await supabase
        .from('student_visits')
        .select('*')
        .eq('visit_date', date)
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    } catch (err: unknown) {
      console.error('Error loading visits by date:', err);
      return [];
    }
  };

  const updateStudentVisit = async (
    id: string,
    updates: Partial<Omit<StudentVisit, 'id' | 'user_id' | 'student_id' | 'created_at' | 'updated_at'>>,
    options: { silent?: boolean } = {}
  ) => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    try {
      const updateData = {
        ...updates,
        place_stopped: updates.place_stopped?.trim() || null,
        notes: updates.notes?.trim() || null
      };

      // Remove undefined values
      Object.keys(updateData).forEach(key => {
        if (updateData[key as keyof typeof updateData] === undefined) {
          delete updateData[key as keyof typeof updateData];
        }
      });

      console.log('Updating student visit:', id, updateData);

      const { data, error } = await supabase
        .from('student_visits')
        .update(updateData)
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;

      console.log('Student visit updated successfully:', data);

      if (!options.silent) {
        addToast({
          type: 'success',
          title: 'Visit Updated',
          description: 'Student visit has been updated successfully'
        });
      }

      return data;

    } catch (err: unknown) {
      console.error('Error updating student visit:', err);
      addToast({
        type: 'error',
        title: 'Update Failed',
        description: 'Failed to update student visit'
      });
      throw err;
    }
  };

  const deleteStudentVisit = async (id: string, options: { silent?: boolean } = {}) => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    try {
      console.log('Deleting student visit:', id);

      const { error } = await supabase
        .from('student_visits')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;

      console.log('Student visit deleted successfully');

      if (!options.silent) {
        addToast({
          type: 'success',
          title: 'Visit Deleted',
          description: 'Student visit has been deleted successfully'
        });
      }

    } catch (err: unknown) {
      console.error('Error deleting student visit:', err);
      addToast({
        type: 'error',
        title: 'Delete Failed',
        description: 'Failed to delete student visit'
      });
      throw err;
    }
  };

  return {
    students,
    loading,
    error,
    saveStudent,
    updateStudent,
    deleteStudent,
    loadStudentVisits,
    loadVisitsByDate,
    saveStudentVisit,
    updateStudentVisit,
    deleteStudentVisit,
    refetch: loadStudents
  };
};