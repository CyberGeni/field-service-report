import React from 'react';
import { Users } from 'lucide-react';

const StudentsTab: React.FC = () => {
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

      {/* Placeholder Content */}
      <div className="bg-white rounded-xl p-8 text-center">
        <div className="text-gray-400 mb-4">
          <Users size={64} className="mx-auto mb-4 opacity-50" />
        </div>
        <h3 className="text-lg font-semibold text-gray-600 mb-2">Coming Soon</h3>
        <p className="text-gray-500">Student management features will be added here.</p>
      </div>
    </div>
  );
};

export default StudentsTab;