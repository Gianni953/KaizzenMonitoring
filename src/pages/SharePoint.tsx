import React, { useState, useEffect } from 'react';
import { useMsal } from "@azure/msal-react";
import { getGraphClient } from "../services/graph";
import { Download, ArrowUpRight } from 'lucide-react';

interface Site {
  id: string;
  displayName: string;
  webUrl: string;
  lastModifiedDateTime: string;
  storage: number;
  externalUsers: number;
  owner?: string;
  permissions: {
    roles: string[];
    displayName: string;
    email?: string;
  }[];
}

interface Stats {
  totalSites: number;
  inactiveSites: number;
  externalAccessSites: number;
  noOwnerSites: number;
  totalStorage: number;
}

const SharePoint = () => {
  const { accounts } = useMsal();
  const [sites, setSites] = useState<Site[]>([]);
  const [filteredSites, setFilteredSites] = useState<Site[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalSites: 0,
    inactiveSites: 0,
    externalAccessSites: 0,
    noOwnerSites: 0,
    totalStorage: 0
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    const fetchSites = async () => {
      if (!accounts || accounts.length === 0) {
        setError("Veuillez vous connecter pour voir les sites SharePoint");
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const client = getGraphClient();

        // Récupérer tous les sites SharePoint
        const sitesResponse = await client.api('/sites?search=*')
          .select('id,displayName,webUrl,lastModifiedDateTime')
          .top(999)
          .get();

        // Pour chaque site, récupérer les détails supplémentaires
        const sitesWithDetails = await Promise.all(
          sitesResponse.value.map(async (site: any) => {
            try {
              // Récupérer le stockage et les permissions en parallèle
              const [storageResponse, permissionsResponse, ownerResponse] = await Promise.all([
                client.api(`/sites/${site.id}/drive`).get(),
                client.api(`/sites/${site.id}/permissions`).get(),
                client.api(`/sites/${site.id}/owners`).get()
              ]);

              // Filtrer et formater les permissions externes
              const externalPermissions = permissionsResponse.value
                .filter((perm: any) => perm.grantedToIdentities?.some((identity: any) =>
                  identity.application || (identity.user && identity.user.userType === 'Guest')
                ))
                .map((perm: any) => ({
                  roles: perm.roles,
                  displayName: perm.grantedToIdentities?.[0]?.user?.displayName ||
                             perm.grantedToIdentities?.[0]?.application?.displayName ||
                             'Utilisateur externe',
                  email: perm.grantedToIdentities?.[0]?.user?.email
                }));

              return {
                ...site,
                storage: storageResponse.quota?.used || 0,
                externalUsers: externalPermissions.length,
                owner: ownerResponse.value?.[0]?.user?.displayName || undefined,
                permissions: externalPermissions,
                displayName: site.displayName || new URL(site.webUrl).pathname.split('/').pop()
              };
            } catch (error) {
              console.error(`Error fetching details for site ${site.id}:`, error);
              return {
                ...site,
                storage: 0,
                externalUsers: 0,
                owner: undefined,
                permissions: [],
                displayName: site.displayName || 'Site sans nom'
              };
            }
          })
        );

        // Filtrer les sites valides
        const validSites = sitesWithDetails.filter(site => site.displayName && site.webUrl);

        setSites(validSites);
        setFilteredSites(validSites);

        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        // Calculer les statistiques
        const totalStorage = validSites.reduce((acc, site) => acc + site.storage, 0);
        const inactiveSites = validSites.filter(site =>
          new Date(site.lastModifiedDateTime) < sixMonthsAgo
        ).length;
        const externalAccessSites = validSites.filter(site => site.externalUsers > 0).length;
        const noOwnerSites = validSites.filter(site => !site.owner).length;

        setStats({
          totalSites: validSites.length,
          inactiveSites,
          externalAccessSites,
          noOwnerSites,
          totalStorage: Math.round(totalStorage / (1024 * 1024 * 1024)) // Convertir en GB
        });

      } catch (error: any) {
        console.error("Error fetching SharePoint sites:", error);
        setError(error.message || "Une erreur est survenue lors de la récupération des sites");
      } finally {
        setLoading(false);
      }
    };

    fetchSites();
  }, [accounts]);

  useEffect(() => {
    let filtered = [...sites];
    switch (filter) {
      case 'inactive':
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        filtered = sites.filter(site => new Date(site.lastModifiedDateTime) < sixMonthsAgo);
        break;
      case 'external':
        filtered = sites.filter(site => site.externalUsers > 0);
        break;
      case 'noOwner':
        filtered = sites.filter(site => !site.owner);
        break;
      default:
        filtered = sites;
    }
    setFilteredSites(filtered);
  }, [filter, sites]);

  const formatBytes = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 GB';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${Math.round(bytes / Math.pow(1024, i))} ${sizes[i]}`;
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const exportToCSV = () => {
    const exportData = filteredSites.map(site => ({
      'Nom': site.displayName,
      'URL': site.webUrl,
      'Dernière Modification': formatDate(site.lastModifiedDateTime),
      'Stockage': formatBytes(site.storage),
      'Utilisateurs Externes': site.externalUsers,
      'Propriétaire': site.owner || 'Non défini'
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
    link.download = `sharepoint_sites_${filter}_${new Date().toISOString().split('T')[0]}.csv`;
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
          <h2 className="text-2xl font-bold text-white mb-1">Vue d'ensemble SharePoint</h2>
          <p className="text-base text-white">Analyse des sites SharePoint</p>
        </div>
        {sites.length > 0 && (
          <div className="flex gap-4">
            <button
              onClick={exportToCSV}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors"
            >
              <Download size={18} />
              Exporter
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-gradient-radial from-[#1d2144] to-[#0F1225] p-6 rounded-2xl border border-[#2d3154]">
          <h3 className="text-lg font-medium text-white mb-2">Total Sites</h3>
          <div className="flex flex-col items-center">
            <p className="text-4xl font-bold text-white">{stats.totalSites}</p>
            <p className="text-base text-white mt-2">Sites SharePoint</p>
          </div>
        </div>
        <div className="bg-gradient-radial from-[#1d2144] to-[#0F1225] p-6 rounded-2xl border border-[#2d3154]">
          <h3 className="text-lg font-medium text-white mb-2">Sites Inactifs</h3>
          <div className="flex flex-col items-center">
            <p className="text-4xl font-bold text-yellow-500">{stats.inactiveSites}</p>
            <p className="text-base text-white mt-2">+6 mois sans activité</p>
          </div>
        </div>
        <div className="bg-gradient-radial from-[#1d2144] to-[#0F1225] p-6 rounded-2xl border border-[#2d3154]">
          <h3 className="text-lg font-medium text-white mb-2">Accès Externes</h3>
          <div className="flex flex-col items-center">
            <p className="text-4xl font-bold text-red-500">{stats.externalAccessSites}</p>
            <p className="text-base text-white mt-2">Sites partagés</p>
          </div>
        </div>
        <div className="bg-gradient-radial from-[#1d2144] to-[#0F1225] p-6 rounded-2xl border border-[#2d3154]">
          <h3 className="text-lg font-medium text-white mb-2">Sans Propriétaire</h3>
          <div className="flex flex-col items-center">
            <p className="text-4xl font-bold text-orange-500">{stats.noOwnerSites}</p>
            <p className="text-base text-white mt-2">Action requise</p>
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
            {stats.noOwnerSites > 0 && (
              <div className="bg-[#2D3748] p-4 rounded-lg">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <h4 className="text-base font-medium text-white flex-1">Sites sans propriétaire</h4>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm text-white bg-indigo-500/20 px-2 py-1 rounded-full">
                      Impact: 20%
                    </span>
                    <ArrowUpRight className="h-4 w-4 text-indigo-400" />
                  </div>
                </div>
                <p className="text-sm text-gray-400">
                  {stats.noOwnerSites} sites n'ont pas de propriétaire désigné. Cela peut poser des problèmes de gouvernance et de maintenance.
                </p>
              </div>
            )}
            {stats.externalAccessSites > 0 && (
              <div className="bg-[#2D3748] p-4 rounded-lg">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <h4 className="text-base font-medium text-white flex-1">Partages externes</h4>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm text-white bg-indigo-500/20 px-2 py-1 rounded-full">
                      Impact: 15%
                    </span>
                    <ArrowUpRight className="h-4 w-4 text-indigo-400" />
                  </div>
                </div>
                <p className="text-sm text-gray-400">
                  {stats.externalAccessSites} sites ont des partages externes actifs. Vérifiez régulièrement ces accès pour la sécurité.
                </p>
              </div>
            )}
            {stats.inactiveSites > 0 && (
              <div className="bg-[#2D3748] p-4 rounded-lg">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <h4 className="text-base font-medium text-white flex-1">Sites inactifs</h4>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm text-white bg-indigo-500/20 px-2 py-1 rounded-full">
                      Impact: 10%
                    </span>
                    <ArrowUpRight className="h-4 w-4 text-indigo-400" />
                  </div>
                </div>
                <p className="text-sm text-gray-400">
                  {stats.inactiveSites} sites n'ont pas eu d'activité depuis plus de 6 mois. Envisagez de les archiver.
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
              <h4 className="text-base font-medium text-white mb-2">Gestion des propriétaires</h4>
              <p className="text-sm text-gray-400">
                Chaque site doit avoir au moins un propriétaire actif pour assurer une bonne gouvernance.
              </p>
            </div>
            <div className="bg-[#2D3748] p-4 rounded-lg">
              <h4 className="text-base font-medium text-white mb-2">Révision des accès externes</h4>
              <p className="text-sm text-gray-400">
                Effectuez une revue trimestrielle des accès externes pour maintenir la sécurité.
              </p>
            </div>
            <div className="bg-[#2D3748] p-4 rounded-lg">
              <h4 className="text-base font-medium text-white mb-2">Sites inactifs</h4>
              <p className="text-sm text-gray-400">
                Archivez ou supprimez les sites inactifs pour optimiser les ressources.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-gradient-radial from-[#1d2144] to-[#0F1225] rounded-2xl border border-[#2d3154]">
        <div className="p-6 border-b border-[#2d3154]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h3 className="text-lg font-medium text-white">Liste des Sites</h3>
              <span className="text-base text-white">
                {filteredSites.length} site{filteredSites.length > 1 ? 's' : ''} trouvé{filteredSites.length > 1 ? 's' : ''}
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
                Accès Externes
              </button>
              <button
                onClick={() => setFilter('noOwner')}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  filter === 'noOwner' ? 'bg-orange-600 text-white' : 'bg-[#374151] text-white hover:bg-[#4B5563]'
                }`}
              >
                Sans Propriétaire
              </button>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left border-b border-[#2d3154]">
                <th className="pb-3 px-6 py-4 text-white">Nom</th>
                <th className="pb-3 px-6 py-4 text-white">URL</th>
                <th className="pb-3 px-6 py-4 text-white">Dernière Modification</th>
                <th className="pb-3 px-6 py-4 text-white">Stockage</th>
                <th className="pb-3 px-6 py-4 text-white">Utilisateurs Externes</th>
                <th className="pb-3 px-6 py-4 text-white">Propriétaire</th>
              </tr>
            </thead>
            <tbody>
              {filteredSites.map((site) => (
                <tr key={site.id} className="border-b border-[#2d3154] hover:bg-[#1d2144] transition-colors">
                  <td className="px-6 py-6 text-white text-lg">{site.displayName}</td>
                  <td className="px-6 py-6">
                    <a
                      href={site.webUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-400 hover:text-indigo-300"
                    >
                      {site.webUrl}
                    </a>
                  </td>
                  <td className="px-6 py-6 text-white">{formatDate(site.lastModifiedDateTime)}</td>
                  <td className="px-6 py-6 text-white">{formatBytes(site.storage)}</td>
                  <td className="px-6 py-6">
                    <span className={`px-3 py-2 rounded-full text-sm ${
                      site.externalUsers > 0 ? 'bg-red-500/20 text-red-500' : 'bg-green-500/20 text-green-500'
                    }`}>
                      {site.externalUsers > 0 ? `${site.externalUsers} externes` : 'Aucun'}
                    </span>
                  </td>
                  <td className="px-6 py-6">
                    <span className={`px-3 py-2 rounded-full text-sm ${
                      site.owner ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'
                    }`}>
                      {site.owner || 'Non défini'}
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

export default SharePoint;