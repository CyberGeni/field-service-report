import React from 'react';
import { motion } from 'motion/react';
import { BarChart3, Clock, Home, Calendar, Settings, Users } from 'lucide-react';
import { spring } from '../lib/motion';

interface NavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  timerRunning?: boolean;
}

const TABS = [
  { id: 'calendar', label: 'Calendar', icon: Calendar },
  { id: 'log', label: 'Log', icon: Clock },
  { id: 'home', label: 'Home', icon: Home },
  { id: 'stats', label: 'Stats', icon: BarChart3 },
  { id: 'students', label: 'People', icon: Users },
  { id: 'settings', label: 'Settings', icon: Settings }
];

const Navigation: React.FC<NavigationProps> = ({ activeTab, onTabChange, timerRunning = false }) => (
  <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-2 safe-area-pb z-40">
    <div className="flex justify-between items-center max-w-md mx-auto">
      {TABS.map(({ id, label, icon: Icon }) => {
        const active = activeTab === id;
        return (
          <button
            key={id}
            onClick={() => onTabChange(id)}
            aria-current={active ? 'page' : undefined}
            className={`flex flex-col items-center py-2 px-1 rounded-lg flex-1 relative ${
              active ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {/* One highlight shared by every tab, so it slides to the new one rather
                than blinking out here and in over there */}
            {active && (
              <motion.span
                layoutId="nav-highlight"
                transition={spring}
                className="absolute inset-0 rounded-lg bg-blue-50"
                aria-hidden="true"
              />
            )}
            <span className="relative">
              <Icon size={20} className="mb-1" />
              {id === 'log' && timerRunning && (
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse" aria-label="Timer running">
                  <span className="absolute inset-0 bg-red-500 rounded-full animate-ping opacity-75" />
                </span>
              )}
            </span>
            <span className="relative text-xs font-medium">{label}</span>
          </button>
        );
      })}
    </div>
  </nav>
);

export default Navigation;
