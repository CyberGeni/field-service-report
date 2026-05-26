import { useState, useEffect } from 'react';
import { Student, StudentVisit } from '../types';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import { useToast } from '../components/ui/toast';

export const useStudents = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
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

    try {
      setLoading(true);
      setError(null);

      console.log('Loading students for user:', user.id);

      const { data: studentsData, error: studentsError } = await supabase
        .from('students')
        .select('*')
        .eq('user_id', user.id)
        .order('name', { ascending: true });

      if (studentsError) throw studentsError;

      console.log('Loaded', studentsData?.length || 0, 'students');
      setStudents(studentsData || []);

    } catch (err: any) {
      console.error('Error loading students:', err);
      setError(err.message);
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

    } catch (err: any) {
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
      setStudents(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));

      addToast({
        type: 'success',
        title: 'Student Added',
        description: `${student.name} has been added to your students list`
      });

      return data;

    } catch (err: any) {
      console.error('Error saving student:', err);
      setError(err.message);
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
      setStudents(prev => 
        prev.map(student => student.id === id ? data : student)
          .sort((a, b) => a.name.localeCompare(b.name))
      );

      addToast({
        type: 'success',
        title: 'Student Updated',
        description: `${data.name}'s information has been updated`
      });

      return data;

    } catch (err: any) {
      console.error('Error updating student:', err);
      setError(err.message);
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
      setStudents(prev => prev.filter(student => student.id !== id));

      addToast({
        type: 'success',
        title: 'Student Deleted',
        description: `${studentToDelete.name} has been removed from your students list`
      });

    } catch (err: any) {
      console.error('Error deleting student:', err);
      setError(err.message);
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

    } catch (err: any) {
      console.error('Error saving student visit:', err);
      addToast({
        type: 'error',
        title: 'Save Failed',
        description: 'Failed to save student visit'
      });
      throw err;
    }
  };

  const updateStudentVisit = async (id: string, updates: Partial<Omit<StudentVisit, 'id' | 'user_id' | 'student_id' | 'created_at' | 'updated_at'>>) => {
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

      addToast({
        type: 'success',
        title: 'Visit Updated',
        description: 'Student visit has been updated successfully'
      });

      return data;

    } catch (err: any) {
      console.error('Error updating student visit:', err);
      addToast({
        type: 'error',
        title: 'Update Failed',
        description: 'Failed to update student visit'
      });
      throw err;
    }
  };

  const deleteStudentVisit = async (id: string) => {
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

      addToast({
        type: 'success',
        title: 'Visit Deleted',
        description: 'Student visit has been deleted successfully'
      });

    } catch (err: any) {
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
    saveStudentVisit,
    updateStudentVisit,
    deleteStudentVisit,
    refetch: loadStudents
  };
};