import React from 'react';
import { CloudOff, RefreshCw } from 'lucide-react';

interface SyncStatusBannerProps {
  online: boolean;
  syncing: boolean;
  pendingChanges: number;
}

/**
 * Says out loud when work is only on the phone.
 *
 * Hours are the whole point of this app, so a user who logs time on a doorstep with
 * no signal needs to see that it was kept and that it has not gone up yet - silence
 * would read as either "lost" or "sent", and it is neither.
 */
const SyncStatusBanner: React.FC<SyncStatusBannerProps> = ({
  online,
  syncing,
  pendingChanges
}) => {
  if (online && pendingChanges === 0) return null;

  const waiting = pendingChanges === 1 ? '1 change' : `${pendingChanges} changes`;

  return (
    <div
      role="status"
      className={`flex items-center space-x-2 rounded-xl px-3 py-2.5 mb-4 text-sm ${
        online ? 'bg-blue-50 text-blue-800' : 'bg-amber-50 text-amber-900'
      }`}
    >
      {online ? (
        <RefreshCw size={16} className={`flex-shrink-0 ${syncing ? 'animate-spin' : ''}`} />
      ) : (
        <CloudOff size={16} className="flex-shrink-0" />
      )}
      <p>
        {online
          ? syncing
            ? `Syncing ${waiting}...`
            : `${waiting} waiting to sync`
          : pendingChanges > 0
            ? `Offline - ${waiting} saved on this device`
            : 'Offline - your records are saved on this device'}
      </p>
    </div>
  );
};

export default SyncStatusBanner;
