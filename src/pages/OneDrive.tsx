import React, { useState, useEffect } from 'react';
import { useMsal } from "@azure/msal-react";
import { getGraphClient } from "../services/graph";
import { Download, ChevronDown, ChevronRight, Search } from 'lucide-react';

interface OneDriveUser {
  id: string;
  displayName: string;
  userPrincipalName: string;
  storage: number;
  lastActivity: string;
  externalShares: number;
  quota: {
    used: number;
    total: number;
  };
}

const OneDrive = () => {
  const { accounts } = useMsal();
  const [users, setUsers] = useState<OneDriveUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [totalStorage, setTotalStorage] = useState(0);
  const [inactiveUsers, setInactiveUsers] = useState(0);
  const [externalShares, setExternalShares] = useState(0);
  const [highStorage, setHighStorage] = useState(0);

  useEffect(() => {
    const fetchOneDriveData = async () => {
      if (accounts[0]) {
        try {
          setLoading(true);
          const client = getGraphClient();
          
          const response = await client.api('/users')
            .select('id,displayName,userPrincipalName')
            .get();

          const usersWithDrives = await Promise.all(
            response.value.map(async (user: any) => {
              try {
                const [driveResponse, sharingResponse] = await Promise.all([
                  client.api(`/users/${user.id}/drive`).get(),
                  client.api(`/users/${user.id}/drive/sharedWithMe`).get()
                ]);

                return {
                  ...user,
                  storage: driveResponse.quota.used || 0,
                  quota: {
                    used: driveResponse.quota.used || 0,
                    total: driveResponse.quota.total || 0
                  },
                  lastActivity: driveResponse.lastModifiedDateTime,
                  externalShares: sharingResponse.value.length
                };
              } catch (error) {
                console.error(`Error fetching OneDrive details for user ${user.id}:`, error);
                return {
                  ...user,
                  storage: 0,
                  quota: { used: 0, total: 0 },
                  lastActivity: '',
                  externalShares: 0
                };
              }
            })
          );

          setUsers(usersWithDrives);
          
          const totalStorageUsed = usersWithDrives.reduce((acc, user) => acc + user.storage, 0);
          setTotalStorage(Math.round(totalStorageUsed / (1024 * 1024 * 1024))); // Convert to GB
          
          const sixMonthsAgo = new Date();
          sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
          
          setInactiveUsers(usersWithDrives.filter(user => 
            !user.lastActivity || new Date(user.lastActivity) < sixMonthsAgo
          ).length);
          
          setExternalShares(usersWithDrives.filter(user => user.externalShares > 0).length);
          
          const storageThreshold = 20 * 1024 * 1024 * 1024; // 20 GB
          setHighStorage(usersWithDrives.filter(user => user.storage > storageThreshold).length);

        } catch (error) {
          console.error("Error fetching OneDrive data:", error);
        } finally {
          setLoading(false);
        }
      }
    };

    fetchOneDriveData();
  }, [accounts[0]]);

  const getFilteredUsers = () => {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const storageThreshold = 20 * 1024 * 1024 * 1024; // 20 GB

    switch (filter) {
      case 'inactive':
        return users.filter(user => !user.lastActivity || new Date(user.lastActivity) < sixMonthsAgo);
      case 'external':
        return users.filter(user => user.externalShares > 0);
      case 'storage':
        return users.filter(user => user.storage > storageThreshold);
      default:
        return users;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-xl">Chargement...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">Vue d'ensemble OneDrive</h2>
          <p className="text-base text-white">Analyse de l'utilisation des OneDrives</p>
        </div>
        <button
          onClick={() => {}}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors"
        >
          <Download size={18} />
          Exporter
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-gradient-radial from-[#1d2144] to-[#0F1225] p-6 rounded-2xl border border-[#2d3154]">
          <h3 className="text-lg font-medium text-white mb-2">Stockage Total</h3>
          <p className="text-4xl font-bold text-white">{totalStorage} GB</p>
          <p className="text-base text-white mt-2">Espace utilisé</p>
        </div>
        <div className="bg-gradient-radial from-[#1d2144] to-[#0F1225] p-6 rounded-2xl border border-[#2d3154]">
          <h3 className="text-lg font-medium text-white mb-2">OneDrives Inactifs</h3>
          <p className="text-4xl font-bold text-yellow-500">{inactiveUsers}</p>
          <p className="text-base text-white mt-2">+6 mois sans activité</p>
        </div>
        <div className="bg-gradient-radial from-[#1d2144] to-[#0F1225] p-6 rounded-2xl border border-[#2d3154]">
          <h3 className="text-lg font-medium text-white mb-2">Partages Externes</h3>
          <p className="text-4xl font-bold text-red-500">{externalShares}</p>
          <p className="text-base text-white mt-2">Fichiers partagés</p>
        </div>
        <div className="bg-gradient-radial from-[#1d2144] to-[#0F1225] p-6 rounded-2xl border border-[#2d3154]">
          <h3 className="text-lg font-medium text-white mb-2">Stockage Élevé</h3>
          <p className="text-4xl font-bold text-orange-500">{highStorage}</p>
          <p className="text-base text-white mt-2">Plus de 20 GB</p>
        </div>
      </div>

      <div className="bg-gradient-radial from-[#1d2144] to-[#0F1225] rounded-2xl border border-[#2d3154]">
        <div className="p-6 border-b border-[#2d3154] flex justify-between items-center">
          <div className="flex items-center gap-4">
            <h3 className="text-xl font-semibold text-white">Liste des OneDrives</h3>
            <span className="text-base text-white">
              {getFilteredUsers().length} OneDrive{getFilteredUsers().length > 1 ? 's' : ''} trouvé{getFilteredUsers().length > 1 ? 's' : ''}
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                filter === 'all' ? 'bg-indigo-600 text-white' : 'bg-[#374151] text-white hover:bg-[#4B5563]'
              }`}
            >
              Tous
            </button>
            <button
              onClick={() => setFilter('inactive')}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                filter === 'inactive' ? 'bg-yellow-600 text-white' : 'bg-[#374151] text-white hover:bg-[#4B5563]'
              }`}
            >
              Inactifs
            </button>
            <button
              onClick={() => setFilter('external')}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                filter === 'external' ? 'bg-red-600 text-white' : 'bg-[#374151] text-white hover:bg-[#4B5563]'
              }`}
            >
              Partages Externes
            </button>
            <button
              onClick={() => setFilter('storage')}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                filter === 'storage' ? 'bg-orange-600 text-white' : 'bg-[#374151] text-white hover:bg-[#4B5563]'
              }`}
            >
              Stockage Élevé
            </button>
          </div>
        </div>
        <div className="p-6 overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left border-b border-[#2d3154]">
                <th className="pb-3 text-white">Utilisateur</th>
                <th className="pb-3 text-white">Email</th>
                <th className="pb-3 text-white">Stockage Utilisé</th>
                <th className="pb-3 text-white">Quota</th>
                <th className="pb-3 text-white">Dernière Activité</th>
                <th className="pb-3 text-white">Partages Externes</th>
              </tr>
            </thead>
            <tbody>
              {getFilteredUsers().map((user) => (
                <tr key={user.id} className="border-b border-[#2d3154]">
                  <td className="py-4 text-white">{user.displayName}</td>
                  <td className="py-4 text-white">{user.userPrincipalName}</td>
                  <td className="py-4 text-white">{Math.round(user.storage / (1024 * 1024 * 1024))} GB</td>
                  <td className="py-4 text-white">
                    {Math.round((user.quota.used / user.quota.total) * 100)}%
                  </td>
                  <td className="py-4 text-white">
                    {user.lastActivity ? new Date(user.lastActivity).toLocaleDateString() : 'Jamais'}
                  </td>
                  <td className="py-4">
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      user.externalShares > 0 ? 'bg-red-500/20 text-red-500' : 'bg-green-500/20 text-green-500'
                    }`}>
                      {user.externalShares > 0 ? `${user.externalShares} partages` : 'Aucun'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default OneDrive;