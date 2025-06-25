import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useStorage } from '../hooks/useStorage';
import { Database, Eye, EyeOff, RefreshCw } from 'lucide-react';

const DebugSettings: React.FC = () => {
  const [showDebug, setShowDebug] = useState(false);
  const [dbData, setDbData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { refetch } = useStorage();

  const fetchDbData = async () => {
    if (!user) {
      setDbData({ error: 'No user authenticated' });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id);

      if (error) {
        console.error('Debug fetch error:', error);
        setDbData({ error: error.message });
      } else {
        setDbData(data);
      }
    } catch (err) {
      console.error('Debug fetch exception:', err);
      setDbData({ error: 'Unexpected error' });
    } finally {
      setLoading(false);
    }
  };

  const forceRefresh = async () => {
    if (!user) {
      console.log('❌ Cannot refresh: No user authenticated');
      return;
    }
    
    console.log('🔄 Force refreshing data...');
    await refetch();
    await fetchDbData();
  };

  if (!showDebug) {
    return (
      <button
        onClick={() => {
          setShowDebug(true);
          if (user) {
            fetchDbData();
          } else {
            setDbData({ error: 'No user authenticated' });
          }
        }}
        className="fixed bottom-20 right-4 bg-gray-800 text-white p-2 rounded-full shadow-lg z-50"
        title="Show debug info"
      >
        <Database size={20} />
      </button>
    );
  }

  return (
    <div className="fixed bottom-20 right-4 bg-white border border-gray-300 rounded-xl p-4 shadow-lg z-50 max-w-sm max-h-96 overflow-auto">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-800 flex items-center space-x-2">
          <Database size={16} />
          <span>Debug Info</span>
        </h3>
        <button
          onClick={() => setShowDebug(false)}
          className="text-gray-500 hover:text-gray-700"
        >
          <EyeOff size={16} />
        </button>
      </div>

      <div className="space-y-3">
        <div>
          <p className="text-sm font-medium text-gray-700">User ID:</p>
          <p className="text-xs text-gray-600 font-mono break-all">{user?.id || 'Not logged in'}</p>
        </div>

        <div className="flex space-x-2">
          <button
            onClick={fetchDbData}
            disabled={loading || !user}
            className="text-sm bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 disabled:bg-blue-300"
          >
            {loading ? 'Loading...' : 'Refresh DB'}
          </button>
          <button
            onClick={forceRefresh}
            disabled={loading || !user}
            className="text-sm bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600 disabled:bg-green-300 flex items-center space-x-1"
          >
            <RefreshCw size={12} />
            <span>Force Reload</span>
          </button>
        </div>

        {!user && (
          <div className="text-sm text-amber-600 bg-amber-50 p-2 rounded">
            Please log in to access debug features
          </div>
        )}

        {dbData && (
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Database Data:</p>
            <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto max-h-48">
              {JSON.stringify(dbData, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};

export default DebugSettings;