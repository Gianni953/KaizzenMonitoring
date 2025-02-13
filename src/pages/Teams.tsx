import React, { useState, useEffect } from 'react';
import { useMsal } from "@azure/msal-react";
import { getGraphClient } from "../services/graph";
import { Download, Filter, ArrowUpRight } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

interface Team {
  id: string;
  displayName: string;
  description: string;
  visibility: string;
  memberCount: number;
  guestCount: number;
  lastActivity?: string;
  hasOwner: boolean;
}

const Teams = () => {
  const { accounts } = useMsal();
  const [teams, setTeams] = useState<Team[]>([]);
  const [totalTeams, setTotalTeams] = useState(0);
  const [publicTeams, setPublicTeams] = useState(0);
  const [inactiveTeams, setInactiveTeams] = useState(0);
  const [noOwnerTeams, setNoOwnerTeams] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [filteredTeams, setFilteredTeams] = useState<Team[]>([]);

  useEffect(() => {
    const fetchTeams = async () => {
      if (accounts[0]) {
        try {
          setLoading(true);
          const client = getGraphClient();
          
          // Récupérer la liste des équipes avec les informations de base
          const response = await client.api('/groups')
            .filter('resourceProvisioningOptions/Any(x:x eq \'Team\')')
            .select('id,displayName,description,visibility')
            .get();

          // Pour chaque équipe, récupérer les informations supplémentaires
          const teamsWithDetails = await Promise.all(
            response.value.map(async (team: any) => {
              try {
                // Récupérer les membres et propriétaires en une seule requête
                const [membersResponse, ownersResponse] = await Promise.all([
                  client.api(`/groups/${team.id}/members`).get(),
                  client.api(`/groups/${team.id}/owners`).get()
                ]);

                // Compter les membres invités
                const guestCount = membersResponse.value.filter((member: any) => 
                  member.userType === 'Guest'
                ).length;

                // Récupérer les messages du canal général
                let lastActivity = null;
                try {
                  const messagesResponse = await client.api(`/teams/${team.id}/channels`)
                    .filter('displayName eq \'General\'')
                    .expand('messages')
                    .get();

                  if (messagesResponse.value.length > 0 && messagesResponse.value[0].messages) {
                    const messages = messagesResponse.value[0].messages;
                    if (messages.length > 0) {
                      lastActivity = messages[0].createdDateTime;
                    }
                  }
                } catch (error) {
                  console.log(`No messages found for team ${team.id}`);
                }

                return {
                  ...team,
                  memberCount: membersResponse.value.length,
                  guestCount,
                  hasOwner: ownersResponse.value.length > 0,
                  lastActivity
                };
              } catch (error) {
                console.log(`Error fetching details for team ${team.id}, using basic info`);
                return {
                  ...team,
                  memberCount: 0,
                  guestCount: 0,
                  hasOwner: false,
                  lastActivity: null
                };
              }
            })
          );

          setTeams(teamsWithDetails);
          setFilteredTeams(teamsWithDetails);
          setTotalTeams(teamsWithDetails.length);
          setPublicTeams(teamsWithDetails.filter(team => team.visibility.toLowerCase() === 'public').length);
          setNoOwnerTeams(teamsWithDetails.filter(team => !team.hasOwner).length);
          
          const sixMonthsAgo = new Date();
          sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
          setInactiveTeams(teamsWithDetails.filter(team => 
            !team.lastActivity || new Date(team.lastActivity) < sixMonthsAgo
          ).length);

        } catch (error) {
          console.error("Error fetching teams:", error);
        } finally {
          setLoading(false);
        }
      }
    };

    fetchTeams();
  }, [accounts[0]]);

  useEffect(() => {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    let filtered = [...teams];
    switch (filter) {
      case 'inactive':
        filtered = teams.filter(team => !team.lastActivity || new Date(team.lastActivity) < sixMonthsAgo);
        break;
      case 'public':
        filtered = teams.filter(team => team.visibility.toLowerCase() === 'public');
        break;
      case 'noOwner':
        filtered = teams.filter(team => !team.hasOwner);
        break;
      case 'withGuests':
        filtered = teams.filter(team => team.guestCount > 0);
        break;
      default:
        filtered = teams;
    }
    setFilteredTeams(filtered);
  }, [filter, teams]);

  const formatLastActivity = (lastActivity: string | null | undefined) => {
    if (!lastActivity) return 'Aucune activité';
    return new Date(lastActivity).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const exportToCSV = () => {
    const exportData = filteredTeams.map(team => ({
      'Nom': team.displayName,
      'Description': team.description || '-',
      'Membres': team.memberCount,
      'Invités': team.guestCount,
      'Dernière Activité': team.lastActivity ? formatLastActivity(team.lastActivity) : '-',
      'Visibilité': team.visibility,
      'Propriétaire': team.hasOwner ? 'Oui' : 'Non'
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
    link.download = `teams_${filter}_${new Date().toISOString().split('T')[0]}.csv`;
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

  const visibilityData = [
    { name: 'Public', value: publicTeams },
    { name: 'Privé', value: totalTeams - publicTeams }
  ];

  const COLORS = ['#22C55E', '#EAB308'];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">Vue d'ensemble Teams</h2>
          <p className="text-base text-white">Voici les détails analytiques de vos teams</p>
        </div>
        <div className="flex gap-4">
          <button
            onClick={() => {}}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1F2937] hover:bg-[#374151] text-white transition-colors"
          >
            <Filter size={18} />
            Filter
          </button>
          <button
            onClick={exportToCSV}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors"
          >
            <Download size={18} />
            Exporter
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-gradient-radial from-[#1d2144] to-[#0F1225] p-4 rounded-2xl border border-[#2d3154]">
          <h3 className="text-lg font-medium text-white mb-1">Total Teams</h3>
          <div className="flex flex-col items-center">
            <p className="text-4xl font-bold text-white">{totalTeams}</p>
            <p className="text-sm text-white mt-1">Toutes les équipes</p>
          </div>
        </div>
        <div className="bg-gradient-radial from-[#1d2144] to-[#0F1225] p-4 rounded-2xl border border-[#2d3154]">
          <h3 className="text-lg font-medium text-white mb-1">Teams Inactifs</h3>
          <div className="flex flex-col items-center">
            <p className="text-4xl font-bold text-yellow-500">{inactiveTeams}</p>
            <p className="text-sm text-white mt-1">+6 mois sans activité</p>
          </div>
        </div>
        <div className="bg-gradient-radial from-[#1d2144] to-[#0F1225] p-4 rounded-2xl border border-[#2d3154]">
          <h3 className="text-lg font-medium text-white mb-1">Visibilité Teams</h3>
          <div className="h-[100px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={visibilityData}
                  cx="50%"
                  cy="50%"
                  innerRadius={20}
                  outerRadius={35}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {visibilityData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1F2937',
                    border: '1px solid #374151',
                    borderRadius: '0.5rem'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-4 mt-1">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span className="text-xs text-white">Public ({publicTeams})</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
              <span className="text-xs text-white">Privé ({totalTeams - publicTeams})</span>
            </div>
          </div>
        </div>
        <div className="bg-gradient-radial from-[#1d2144] to-[#0F1225] p-4 rounded-2xl border border-[#2d3154]">
          <h3 className="text-lg font-medium text-white mb-1">Sans Propriétaire</h3>
          <div className="flex flex-col items-center">
            <p className="text-4xl font-bold text-orange-500">{noOwnerTeams}</p>
            <p className="text-sm text-white mt-1">Action requise</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gradient-radial from-[#1d2144] to-[#0F1225] p-6 rounded-2xl border border-[#2d3154]">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-medium text-white">Actions Recommandées</h3>
            <span className="text-sm text-white bg-indigo-500/20 px-3 py-1 rounded-full">
              Priorités
            </span>
          </div>
          <div className="space-y-4">
            {noOwnerTeams > 0 && (
              <div className="bg-[#2D3748] p-4 rounded-lg">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <h4 className="text-base font-medium text-white flex-1">Teams sans propriétaire</h4>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm text-white bg-indigo-500/20 px-2 py-1 rounded-full">
                      Impact: 25%
                    </span>
                    <ArrowUpRight className="h-4 w-4 text-indigo-400" />
                  </div>
                </div>
                <p className="text-sm text-gray-400">
                  {noOwnerTeams} équipes n'ont pas de propriétaire désigné. Cela représente un risque pour la gouvernance et la gestion des accès.
                </p>
              </div>
            )}
            {inactiveTeams > 0 && (
              <div className="bg-[#2D3748] p-4 rounded-lg">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <h4 className="text-base font-medium text-white flex-1">Teams inactifs</h4>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm text-white bg-indigo-500/20 px-2 py-1 rounded-full">
                      Impact: 15%
                    </span>
                    <ArrowUpRight className="h-4 w-4 text-indigo-400" />
                  </div>
                </div>
                <p className="text-sm text-gray-400">
                  {inactiveTeams} équipes n'ont pas eu d'activité depuis plus de 6 mois. Évaluez leur pertinence et envisagez leur archivage.
                </p>
              </div>
            )}
            {publicTeams > 0 && (
              <div className="bg-[#2D3748] p-4 rounded-lg">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <h4 className="text-base font-medium text-white flex-1">Teams publics</h4>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm text-white bg-indigo-500/20 px-2 py-1 rounded-full">
                      Impact: 10%
                    </span>
                    <ArrowUpRight className="h-4 w-4 text-indigo-400" />
                  </div>
                </div>
                <p className="text-sm text-gray-400">
                  {publicTeams} équipes sont en accès public. Vérifiez que cette configuration est intentionnelle et conforme à vos politiques.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-gradient-radial from-[#1d2144] to-[#0F1225] p-6 rounded-2xl border border-[#2d3154]">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-medium text-white">Bonnes Pratiques</h3>
            <span className="text-sm text-white bg-indigo-500/20 px-3 py-1 rounded-full">
              Recommandations
            </span>
          </div>
          <div className="space-y-4">
            <div className="bg-[#2D3748] p-4 rounded-lg">
              <h4 className="text-base font-medium text-white mb-2">Nommage des Teams</h4>
              <p className="text-sm text-gray-400">
                Établissez une convention de nommage claire pour faciliter l'organisation et la recherche des équipes.
              </p>
            </div>
            <div className="bg-[#2D3748] p-4 rounded-lg">
              <h4 className="text-base font-medium text-white mb-2">Gestion du cycle de vie</h4>
              <p className="text-sm text-gray-400">
                Définissez une politique de rétention et d'archivage pour les équipes inactives.
              </p>
            </div>
            <div className="bg-[#2D3748] p-4 rounded-lg">
              <h4 className="text-base font-medium text-white mb-2">Propriétaires multiples</h4>
              <p className="text-sm text-gray-400">
                Désignez toujours au moins deux propriétaires par équipe pour assurer la continuité.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-gradient-radial from-[#1d2144] to-[#0F1225] rounded-2xl border border-[#2d3154]">
        <div className="p-6 border-b border-[#2d3154]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h3 className="text-lg font-medium text-white">Liste des Teams</h3>
              <span className="text-base text-white">
                {filteredTeams.length} team{filteredTeams.length > 1 ? 's' : ''} trouvée{filteredTeams.length > 1 ? 's' : ''}
              </span>
            </div>
            <div className="flex gap-2">
              {['all', 'inactive', 'public', 'noOwner', 'withGuests'].map((filterType) => (
                <button
                  key={filterType}
                  onClick={() => setFilter(filterType)}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    filter === filterType 
                      ? 'bg-indigo-600 text-white' 
                      : 'bg-[#374151] text-white hover:bg-[#4B5563]'
                  }`}
                >
                  {filterType === 'all' && 'Tous'}
                  {filterType === 'inactive' && 'Inactifs'}
                  {filterType === 'public' && 'Publics'}
                  {filterType === 'noOwner' && 'Sans Propriétaire'}
                  {filterType === 'withGuests' && 'Avec Invités'}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#374151]">
              <tr>
                <th className="text-left text-sm font-medium text-white px-6 py-4">Nom</th>
                <th className="text-left text-sm font-medium text-white px-6 py-4">Description</th>
                <th className="text-left text-sm font-medium text-white px-6 py-4">Membres</th>
                <th className="text-left text-sm font-medium text-white px-6 py-4">Invités</th>
                <th className="text-left text-sm font-medium text-white px-6 py-4">Dernière Activité</th>
                <th className="text-left text-sm font-medium text-white px-6 py-4">Visibilité</th>
                <th className="text-left text-sm font-medium text-white px-6 py-4">Propriétaire</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2d3154]">
              {filteredTeams.map((team) => (
                <tr key={team.id} className="hover:bg-[#374151] transition-colors">
                  <td className="px-6 py-4 text-white">{team.displayName}</td>
                  <td className="px-6 py-4 text-white">{team.description || '-'}</td>
                  <td className="px-6 py-4 text-white">{team.memberCount}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      team.guestCount > 0 ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-500/20 text-gray-400'
                     }`}>
                      {team.guestCount > 0 ? `${team.guestCount} invités` : 'Aucun'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-white">
                    {formatLastActivity(team.lastActivity)}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      team.visibility.toLowerCase() === 'public' 
                        ? 'bg-green-500/20 text-green-400' 
                        : 'bg-yellow-500/20 text-yellow-400'
                    }`}>
                      {team.visibility}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      team.hasOwner 
                        ? 'bg-green-500/20 text-green-400' 
                        : 'bg-red-500/20 text-red-400'
                    }`}>
                      {team.hasOwner ? 'Oui' : 'Non'}
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

export default Teams;