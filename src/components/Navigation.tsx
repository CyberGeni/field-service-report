import React from 'react';
import { Clock, Home, Calendar, Settings, Users } from 'lucide-react';

interface NavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  timerRunning?: boolean;
}

const Navigation: React.FC<NavigationProps> = ({ activeTab, onTabChange, timerRunning = false }) => {
  const tabs = [
    { id: 'calendar', label: 'Calendar', icon: Calendar },
    { id: 'log', label: 'Log', icon: Clock },
    { id: 'home', label: 'Home', icon: Home },
    { id: 'students', label: 'Students', icon: Users },
    { id: 'settings', label: 'Settings', icon: Settings }
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white px-4 py-2 safe-area-pb">
      <div className="flex justify-between items-center max-w-md mx-auto">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => onTabChange(id)}
            className={`flex flex-col items-center py-2 px-3 rounded-lg transition-all duration-200 flex-1 relative ${
              activeTab === id
                ? 'text-blue-600 bg-blue-50'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="relative">
              <Icon size={20} className="mb-1" />
              {/* Timer indicator for Log tab */}
              {id === 'log' && timerRunning && (
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse">
                  <div className="absolute inset-0 bg-red-500 rounded-full animate-ping opacity-75"></div>
                </div>
              )}
            </div>
            <span className="text-xs font-medium">{label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
};

export default Navigation;