import React, { useState } from 'react';
import { Users, Search, Plus, Edit, Trash2, X, Calendar, MapPin, BookOpen, Clock, User } from 'lucide-react';
import { Student } from '../types';
import { useStudents } from '../hooks/useStudents';
import { useToast } from './ui/toast';

interface StudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (student: Omit<Student, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => Promise<void>;
  onUpdate?: (id: string, updates: Partial<Omit<Student, 'id' | 'user_id' | 'created_at' | 'updated_at'>>) => Promise<void>;
  student?: Student | null;
  mode: 'add' | 'edit';
}

const StudentModal: React.FC<StudentModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onUpdate,
  student,
  mode
}) => {
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    publication_left: '',
    date_met: '',
    last_visit_date: '',
    last_study_notes: ''
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const { addToast } = useToast();

  // Reset form when modal opens/closes or student changes
  React.useEffect(() => {
    if (isOpen) {
      if (mode === 'edit' && student) {
        setFormData({
          name: student.name,
          address: student.address,
          publication_left: student.publication_left || '',
          date_met: student.date_met,
          last_visit_date: student.last_visit_date || '',
          last_study_notes: student.last_study_notes || ''
        });
      } else {
        setFormData({
          name: '',
          address: '',
          publication_left: '',
          date_met: new Date().toISOString().split('T')[0],
          last_visit_date: '',
          last_study_notes: ''
        });
      }
      setError('');
    }
  }, [isOpen, mode, student]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      setError('Name is required');
      return;
    }

    if (!formData.address.trim()) {
      setError('Address is required');
      return;
    }

    if (!formData.date_met) {
      setError('Date met is required');
      return;
    }

    setSaving(true);
    setError('');

    try {
      if (mode === 'edit' && student && onUpdate) {
        await onUpdate(student.id, formData);
      } else {
        await onSave(formData);
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save student');
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-800">
              {mode === 'edit' ? 'Edit Student' : 'Add New Student'}
            </h3>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X size={20} className="text-gray-500" />
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="w-full p-3 bg-gray-50 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter student's name"
                disabled={saving}
                required
              />
            </div>

            {/* Address */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Address *
              </label>
              <textarea
                value={formData.address}
                onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                className="w-full p-3 bg-gray-50 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                rows={3}
                placeholder="Enter student's address"
                disabled={saving}
                required
              />
            </div>

            {/* Publication Left */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Publication Left
              </label>
              <input
                type="text"
                value={formData.publication_left}
                onChange={(e) => setFormData(prev => ({ ...prev, publication_left: e.target.value }))}
                className="w-full p-3 bg-gray-50 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., What Does the Bible Really Teach?"
                disabled={saving}
              />
            </div>

            {/* Date Met */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date Met *
              </label>
              <input
                type="date"
                value={formData.date_met}
                onChange={(e) => setFormData(prev => ({ ...prev, date_met: e.target.value }))}
                className="w-full p-3 bg-gray-50 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={saving}
                required
              />
            </div>

            {/* Last Visit Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Last Visit Date
              </label>
              <input
                type="date"
                value={formData.last_visit_date}
                onChange={(e) => setFormData(prev => ({ ...prev, last_visit_date: e.target.value }))}
                className="w-full p-3 bg-gray-50 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={saving}
              />
            </div>

            {/* Last Study Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notes from Last Study
              </label>
              <textarea
                value={formData.last_study_notes}
                onChange={(e) => setFormData(prev => ({ ...prev, last_study_notes: e.target.value }))}
                className="w-full p-3 bg-gray-50 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                rows={4}
                placeholder="Add notes about the last study session..."
                disabled={saving}
              />
            </div>

            {/* Actions */}
            <div className="flex space-x-3 mt-6">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="flex-1 bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 text-gray-800 py-3 px-4 rounded-xl font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || !formData.name.trim() || !formData.address.trim()}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-3 px-4 rounded-xl font-medium transition-colors flex items-center justify-center"
              >
                {saving ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  mode === 'edit' ? 'Update Student' : 'Add Student'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  studentName: string;
  deleting: boolean;
}

const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  studentName,
  deleting
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-sm w-full">
        <div className="p-6">
          <div className="flex items-center space-x-3 mb-4">
            <div className="bg-red-100 p-2 rounded-lg">
              <Trash2 size={20} className="text-red-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-800">Delete Student</h3>
          </div>
          
          <p className="text-gray-600 mb-6">
            Are you sure you want to delete <strong>{studentName}</strong> from your records? This action cannot be undone.
          </p>

          <div className="flex space-x-3">
            <button
              onClick={onClose}
              disabled={deleting}
              className="flex-1 bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 text-gray-800 py-3 px-4 rounded-xl font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={deleting}
              className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white py-3 px-4 rounded-xl font-medium transition-colors flex items-center justify-center"
            >
              {deleting ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                'Delete'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const StudentsTab: React.FC = () => {
  const { students, loading, saveStudent, updateStudent, deleteStudent } = useStudents();
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Filter students based on search query
  const filteredStudents = students.filter(student =>
    student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    student.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (student.publication_left && student.publication_left.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleAddStudent = () => {
    setModalMode('add');
    setSelectedStudent(null);
    setShowModal(true);
  };

  const handleEditStudent = (student: Student) => {
    setModalMode('edit');
    setSelectedStudent(student);
    setShowModal(true);
  };

  const handleDeleteStudent = (student: Student) => {
    setStudentToDelete(student);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!studentToDelete) return;

    setDeleting(true);
    try {
      await deleteStudent(studentToDelete.id);
      setShowDeleteModal(false);
      setStudentToDelete(null);
    } catch (error) {
      // Error is handled by the hook
    } finally {
      setDeleting(false);
    }
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'Never visited';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getTimeSinceLastVisit = (lastVisitDate: string | null | undefined) => {
    if (!lastVisitDate) return null;
    
    const lastVisit = new Date(lastVisitDate);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - lastVisit.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return '1 day ago';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 14) return '1 week ago';
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 60) return '1 month ago';
    return `${Math.floor(diffDays / 30)} months ago`;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="text-center py-8">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading students...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center py-4">
        <div className="flex items-center justify-center space-x-3 mb-2">
          <Users size={32} className="text-blue-500" />
          <h1 className="text-2xl font-bold text-gray-800">Students</h1>
        </div>
        <p className="text-gray-600">Manage your Bible students</p>
      </div>

      {/* Search and Add */}
      <div className="bg-white rounded-xl p-4">
        <div className="flex space-x-3 mb-4">
          <div className="flex-1 relative">
            <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search students by name, address, or publication..."
              className="w-full pl-10 pr-4 py-3 bg-gray-50 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <button
            onClick={handleAddStudent}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-xl font-medium transition-colors flex items-center space-x-2"
          >
            <Plus size={20} />
            <span>Add Student</span>
          </button>
        </div>

        {/* Results count */}
        {searchQuery && (
          <p className="text-sm text-gray-600 mb-4">
            {filteredStudents.length} student{filteredStudents.length !== 1 ? 's' : ''} found
          </p>
        )}
      </div>

      {/* Students List */}
      {filteredStudents.length > 0 ? (
        <div className="space-y-4">
          {filteredStudents.map((student) => {
            const timeSinceLastVisit = getTimeSinceLastVisit(student.last_visit_date);
            
            return (
              <div key={student.id} className="bg-white rounded-xl p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">{student.name}</h3>
                    
                    <div className="space-y-2">
                      <div className="flex items-start space-x-2">
                        <MapPin size={16} className="text-gray-400 mt-0.5 flex-shrink-0" />
                        <p className="text-gray-600 text-sm">{student.address}</p>
                      </div>
                      
                      {student.publication_left && (
                        <div className="flex items-center space-x-2">
                          <BookOpen size={16} className="text-gray-400 flex-shrink-0" />
                          <p className="text-gray-600 text-sm">{student.publication_left}</p>
                        </div>
                      )}
                      
                      <div className="flex items-center space-x-2">
                        <Calendar size={16} className="text-gray-400 flex-shrink-0" />
                        <p className="text-gray-600 text-sm">
                          Met on {formatDate(student.date_met)}
                        </p>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Clock size={16} className="text-gray-400 flex-shrink-0" />
                        <p className="text-gray-600 text-sm">
                          Last visit: {formatDate(student.last_visit_date)}
                          {timeSinceLastVisit && (
                            <span className="text-gray-500 ml-1">({timeSinceLastVisit})</span>
                          )}
                        </p>
                      </div>
                    </div>
                    
                    {student.last_study_notes && (
                      <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                        <p className="text-sm font-medium text-gray-700 mb-1">Last Study Notes:</p>
                        <p className="text-sm text-gray-600">{student.last_study_notes}</p>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex space-x-2 ml-4">
                    <button
                      onClick={() => handleEditStudent(student)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Edit student"
                    >
                      <Edit size={18} />
                    </button>
                    <button
                      onClick={() => handleDeleteStudent(student)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete student"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-xl p-8 text-center">
          <div className="text-gray-400 mb-4">
            <Users size={64} className="mx-auto mb-4 opacity-50" />
          </div>
          {searchQuery ? (
            <>
              <h3 className="text-lg font-semibold text-gray-600 mb-2">No students found</h3>
              <p className="text-gray-500 mb-4">
                No students match your search for "{searchQuery}"
              </p>
              <button
                onClick={() => setSearchQuery('')}
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                Clear search
              </button>
            </>
          ) : (
            <>
              <h3 className="text-lg font-semibold text-gray-600 mb-2">No students yet</h3>
              <p className="text-gray-500 mb-4">
                Start building your list of Bible students
              </p>
              <button
                onClick={handleAddStudent}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-medium transition-colors"
              >
                Add Your First Student
              </button>
            </>
          )}
        </div>
      )}

      {/* Student Modal */}
      <StudentModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSave={saveStudent}
        onUpdate={updateStudent}
        student={selectedStudent}
        mode={modalMode}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setStudentToDelete(null);
        }}
        onConfirm={confirmDelete}
        studentName={studentToDelete?.name || ''}
        deleting={deleting}
      />
    </div>
  );
};

export default StudentsTab;