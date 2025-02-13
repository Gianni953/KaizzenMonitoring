import React, { useState, useEffect } from 'react';
import { useMsal } from "@azure/msal-react";
import { getGraphClient } from "../services/graph";
import { Download, ChevronDown, ChevronRight, ArrowUpRight } from 'lucide-react';

interface AdminRole {
  id: string;
  displayName: string;
  description: string;
}

interface User {
  id: string;
  displayName: string;
  userPrincipalName: string;
  accountEnabled: boolean;
  assignedLicenses: any[];
  userType: string;
  adminRoles?: AdminRole[];
  externalUserState?: string;
  mail?: string;
  companyName?: string;
}

const Users = () => {
  const { accounts } = useMsal();
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [activeUsers, setActiveUsers] = useState(0);
  const [noLicenseUsers, setNoLicenseUsers] = useState(0);
  const [adminUsers, setAdminUsers] = useState(0);
  const [guestUsers, setGuestUsers] = useState(0);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchUsers = async () => {
      if (!accounts || accounts.length === 0) {
        setError("Veuillez vous connecter pour voir les utilisateurs");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const client = getGraphClient();
        
        // Récupérer tous les utilisateurs avec leurs détails
        const usersResponse = await client.api('/users')
          .select('id,displayName,userPrincipalName,accountEnabled,assignedLicenses,userType,externalUserState,mail,companyName')
          .get();

        // Récupérer les rôles d'administrateur
        const rolesResponse = await client.api('/directoryRoles')
          .expand('members')
          .get();

        // Créer un mapping des rôles d'administrateur par utilisateur
        const userAdminRoles = new Map<string, AdminRole[]>();
        
        rolesResponse.value.forEach((role: any) => {
          role.members.forEach((member: any) => {
            const userRoles = userAdminRoles.get(member.id) || [];
            userRoles.push({
              id: role.id,
              displayName: role.displayName,
              description: role.description
            });
            userAdminRoles.set(member.id, userRoles);
          });
        });

        // Ajouter les rôles aux utilisateurs
        const usersWithRoles: User[] = usersResponse.value.map((user: any) => ({
          ...user,
          adminRoles: userAdminRoles.get(user.id) || []
        }));

        setUsers(usersWithRoles);
        setFilteredUsers(usersWithRoles);
        
        setTotalUsers(usersWithRoles.length);
        setActiveUsers(usersWithRoles.filter(user => user.accountEnabled).length);
        setNoLicenseUsers(usersWithRoles.filter(user => user.assignedLicenses.length === 0).length);
        setAdminUsers(Array.from(userAdminRoles.keys()).length);
        setGuestUsers(usersWithRoles.filter(user => user.userType === 'Guest').length);

      } catch (error: any) {
        console.error("Error fetching users:", error);
        setError(error.message || "Une erreur est survenue lors de la récupération des utilisateurs");
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, [accounts[0]]);

  useEffect(() => {
    let filtered = [...users];
    switch (filter) {
      case 'active':
        filtered = users.filter(user => user.accountEnabled);
        break;
      case 'inactive':
        filtered = users.filter(user => !user.accountEnabled);
        break;
      case 'noLicense':
        filtered = users.filter(user => user.assignedLicenses.length === 0);
        break;
      case 'admin':
        filtered = users.filter(user => user.adminRoles && user.adminRoles.length > 0);
        break;
      case 'guest':
        filtered = users.filter(user => user.userType === 'Guest');
        break;
      default:
        filtered = users;
    }
    setFilteredUsers(filtered);
  }, [filter, users]);

  const toggleUserExpansion = (userId: string) => {
    const newExpanded = new Set(expandedUsers);
    if (newExpanded.has(userId)) {
      newExpanded.delete(userId);
    } else {
      newExpanded.add(userId);
    }
    setExpandedUsers(newExpanded);
  };

  const exportToCSV = () => {
    const exportData = filteredUsers.map(user => ({
      'Nom': user.displayName,
      'Email': user.userPrincipalName,
      'Statut': user.accountEnabled ? 'Actif' : 'Inactif',
      'Licence': user.assignedLicenses.length > 0 ? 'Oui' : 'Non',
      'Type': user.userType === 'Guest' ? 'Invité' : user.adminRoles?.length ? 'Admin' : 'Standard',
      'Organisation': user.companyName || (user.userType === 'Guest' ? 'Externe' : 'Interne'),
      'Rôles Admin': user.adminRoles?.map(role => role.displayName).join(', ') || 'Aucun'
    }));

    const headers = Object.keys(exportData[0]).join(',') + '\n';
    const csv = headers + exportData.map(row => 
      Object.values(row).map(value => 
        typeof value === 'string' && value.includes(',') ? `"${value}"` : value
      ).join(',')
    ).join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `users_${filter}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-pulse flex space-x-4">
          <div className="h-6 w-24 bg-[#374151] rounded"></div>
          <div className="h-6 w-24 bg-[#374151] rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-red-500 bg-red-500/10 px-4 py-2 rounded-lg">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">Vue d'ensemble des Utilisateurs</h2>
          <p className="text-base text-white">Voici les détails analytiques de vos utilisateurs</p>
        </div>
        <div className="flex gap-4">
          <button
            onClick={exportToCSV}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors"
          >
            <Download size={18} />
            Exporter
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        <div className="bg-gradient-radial from-[#1d2144] to-[#0F1225] p-4 rounded-2xl border border-[#2d3154]">
          <h3 className="text-lg font-medium text-white mb-1">Total Utilisateurs</h3>
          <div className="flex flex-col items-center">
            <p className="text-4xl font-bold text-white">{totalUsers}</p>
            <p className="text-sm text-white mt-1">Tous les utilisateurs</p>
          </div>
        </div>
        <div className="bg-gradient-radial from-[#1d2144] to-[#0F1225] p-4 rounded-2xl border border-[#2d3154]">
          <h3 className="text-lg font-medium text-white mb-1">Utilisateurs Actifs</h3>
          <div className="flex flex-col items-center">
            <p className="text-4xl font-bold text-green-500">{activeUsers}</p>
            <p className="text-sm text-white mt-1">Comptes activés</p>
          </div>
        </div>
        <div className="bg-gradient-radial from-[#1d2144] to-[#0F1225] p-4 rounded-2xl border border-[#2d3154]">
          <h3 className="text-lg font-medium text-white mb-1">Sans Licence</h3>
          <div className="flex flex-col items-center">
            <p className="text-4xl font-bold text-red-500">{noLicenseUsers}</p>
            <p className="text-sm text-white mt-1">Aucune licence attribuée</p>
          </div>
        </div>
        <div className="bg-gradient-radial from-[#1d2144] to-[#0F1225] p-4 rounded-2xl border border-[#2d3154]">
          <h3 className="text-lg font-medium text-white mb-1">Administrateurs</h3>
          <div className="flex flex-col items-center">
            <p className="text-4xl font-bold text-yellow-500">{adminUsers}</p>
            <p className="text-sm text-white mt-1">Rôles admin</p>
          </div>
        </div>
        <div className="bg-gradient-radial from-[#1d2144] to-[#0F1225] p-4 rounded-2xl border border-[#2d3154]">
          <h3 className="text-lg font-medium text-white mb-1">Invités</h3>
          <div className="flex flex-col items-center">
            <p className="text-4xl font-bold text-purple-500">{guestUsers}</p>
            <p className="text-sm text-white mt-1">Utilisateurs externes</p>
          </div>
        </div>
      </div>

      <div className="bg-gradient-radial from-[#1d2144] to-[#0F1225] p-6 rounded-2xl border border-[#2d3154]">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-medium text-white">Actions Recommandées</h3>
          <span className="text-sm text-white bg-indigo-500/20 px-3 py-1 rounded-full">
            Priorités
          </span>
        </div>
        <div className="space-y-4">
          {adminUsers > 5 && (
            <div className="bg-[#2D3748] p-4 rounded-lg">
              <div className="flex items-start justify-between gap-4 mb-3">
                <h4 className="text-base font-medium text-white flex-1">Nombre élevé d'administrateurs</h4>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm text-white bg-indigo-500/20 px-2 py-1 rounded-full">
                    Impact: 15%
                  </span>
                  <ArrowUpRight className="h-4 w-4 text-indigo-400" />
                </div>
              </div>
              <p className="text-sm text-gray-400">
                {adminUsers} utilisateurs ont des droits d'administration. Il est recommandé de limiter ce nombre à 5 maximum.
              </p>
            </div>
          )}
          {noLicenseUsers > 0 && (
            <div className="bg-[#2D3748] p-4 rounded-lg">
              <div className="flex items-start justify-between gap-4 mb-3">
                <h4 className="text-base font-medium text-white flex-1">Utilisateurs sans licence</h4>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm text-white bg-indigo-500/20 px-2 py-1 rounded-full">
                    Impact: 10%
                  </span>
                  <ArrowUpRight className="h-4 w-4 text-indigo-400" />
                </div>
              </div>
              <p className="text-sm text-gray-400">
                {noLicenseUsers} utilisateurs n'ont aucune licence attribuée. Vérifiez s'ils en ont besoin.
              </p>
            </div>
          )}
          {guestUsers > 0 && (
            <div className="bg-[#2D3748] p-4 rounded-lg">
              <div className="flex items-start justify-between gap-4 mb-3">
                <h4 className="text-base font-medium text-white flex-1">Utilisateurs invités</h4>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm text-white bg-indigo-500/20 px-2 py-1 rounded-full">
                    Impact: 8%
                  </span>
                  <ArrowUpRight className="h-4 w-4 text-indigo-400" />
                </div>
              </div>
              <p className="text-sm text-gray-400">
                {guestUsers} utilisateurs externes ont accès à votre tenant. Vérifiez régulièrement leurs accès.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="bg-gradient-radial from-[#1d2144] to-[#0F1225] rounded-2xl border border-[#2d3154]">
        <div className="p-6 border-b border-[#2d3154]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h3 className="text-lg font-medium text-white">Liste des Utilisateurs</h3>
              <span className="text-base text-white">
                {filteredUsers.length} utilisateur{filteredUsers.length > 1 ? 's' : ''} affiché{filteredUsers.length > 1 ? 's' : ''}
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
                onClick={() => setFilter('active')}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  filter === 'active' ? 'bg-green-600 text-white' : 'bg-[#374151] text-white hover:bg-[#4B5563]'
                }`}
              >
                Actifs
              </button>
              <button
                onClick={() => setFilter('inactive')}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  filter === 'inactive' ? 'bg-red-600 text-white' : 'bg-[#374151] text-white hover:bg-[#4B5563]'
                }`}
              >
                Inactifs
              </button>
              <button
                onClick={() => setFilter('noLicense')}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  filter === 'noLicense' ? 'bg-yellow-600 text-white' : 'bg-[#374151] text-white hover:bg-[#4B5563]'
                }`}
              >
                Sans Licence
              </button>
              <button
                onClick={() => setFilter('admin')}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  filter === 'admin' ? 'bg-purple-600 text-white' : 'bg-[#374151] text-white hover:bg-[#4B5563]'
                }`}
              >
                Administrateurs
              </button>
              <button
                onClick={() => setFilter('guest')}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  filter === 'guest' ? 'bg-blue-600 text-white' : 'bg-[#374151] text-white hover:bg-[#4B5563]'
                }`}
              >
                Invités
              </button>
            </div>
          </div>
        </div>
        <div className="overflow-y-auto max-h-[600px]">
          <table className="w-full">
            <thead className="bg-[#374151] sticky top-0 z-10">
              <tr>
                <th className="w-8"></th>
                <th className="text-left text-sm font-medium text-white px-6 py-4">Nom</th>
                <th className="text-left text-sm font-medium text-white px-6 py-4">Email</th>
                <th className="text-left text-sm font-medium text-white px-6 py-4">Statut</th>
                <th className="text-left text-sm font-medium text-white px-6 py-4">Licence</th>
                <th className="text-left text-sm font-medium text-white px-6 py-4">Type</th>
                <th className="text-left text-sm font-medium text-white px-6 py-4">Organisation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2d3154]">
              {filteredUsers.map((user) => (
                <React.Fragment key={user.id}>
                  <tr 
                    className={`hover:bg-[#374151] transition-colors ${
                      user.adminRoles?.length ? 'cursor-pointer' : ''
                    }`}
                    onClick={() => user.adminRoles?.length && toggleUserExpansion(user.id)}
                  >
                    <td className="pl-4">
                      {user.adminRoles?.length > 0 && (
                        <button className="p-1 hover:bg-[#4B5563] rounded-lg transition-colors">
                          {expandedUsers.has(user.id) ? (
                            <ChevronDown className="h-4 w-4 text-gray-400" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-gray-400" />
                          )}
                        </button>
                      )}
                    </td>
                    <td className="px-6 py-4 text-white">{user.displayName}</td>
                    <td className="px-6 py-4 text-white">{user.userPrincipalName}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        user.accountEnabled ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                      }`}>
                        {user.accountEnabled ? 'Actif' : 'Inactif'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        user.assignedLicenses.length > 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                      }`}>
                        {user.assignedLicenses.length > 0 ? 'Oui' : 'Non'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        user.userType === 'Guest' 
                          ? 'bg-blue-500/20 text-blue-400'
                          : user.adminRoles?.length 
                            ? 'bg-purple-500/20 text-purple-400' 
                            : 'bg-gray-500/20 text-gray-400'
                      }`}>
                        {user.userType === 'Guest' ? 'Invité' : user.adminRoles?.length ? 'Admin' : 'Standard'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-white">
                      {user.companyName || (user.userType === 'Guest' ? 'Externe' : 'Interne')}
                    </td>
                  </tr>
                  {expandedUsers.has(user.id) && user.adminRoles && (
                    <tr className="bg-[#1A1F2B]">
                      <td colSpan={7} className="px-6 py-4">
                        <div className="pl-8 space-y-3">
                          <h4 className="text-sm font-medium text-gray-400 mb-2">Rôles d'administrateur :</h4>
                          {user.adminRoles.map((role) => (
                            <div key={role.id} className="bg-[#2D3748] p-3 rounded-lg">
                              <p className="text-sm font-medium text-white">{role.displayName}</p>
                              <p className="text-xs text-gray-400 mt-1">{role.description}</p>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Users;