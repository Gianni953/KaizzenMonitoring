import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { LayoutDashboard, Users, MessageSquare, FileText, HardDrive, Shield, AlertTriangle } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { useAuthStore } from "../store/authStore";
import { useMsal } from "@azure/msal-react";
import { getGraphClient } from "../services/graph";
import { getSecureScore } from "../services/securityService";

const Dashboard = () => {
  const { stats, setStats } = useAuthStore();
  const { accounts } = useMsal();

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!accounts || accounts.length === 0) return;

      try {
        const client = getGraphClient();

        // Fetch users data
        const usersResponse = await client.api('/users').get();
        const rolesResponse = await client.api('/directoryRoles').expand('members').get();

        const adminUsers = new Set();
        const guestAdmins = new Set();

        rolesResponse.value.forEach((role: any) => {
          role.members.forEach((member: any) => {
            adminUsers.add(member.id);
            if (member.userType === 'Guest') {
              guestAdmins.add(member.id);
            }
          });
        });

        // Fetch teams data
        const teamsResponse = await client.api('/groups')
          .filter('resourceProvisioningOptions/Any(x:x eq \'Team\')')
          .get();

        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        const teamsWithOwners = await Promise.all(
          teamsResponse.value.map(async (team: any) => {
            const ownersResponse = await client.api(`/groups/${team.id}/owners`).get();
            return {
              ...team,
              hasOwner: ownersResponse.value.length > 0
            };
          })
        );

        // Fetch OneDrive data
        const drivesResponse = await client.api('/drives').get();
        const totalStorage = drivesResponse.value.reduce((acc: number, drive: any) => {
          return acc + (drive.quota?.used || 0);
        }, 0);

        // Fetch security data
        const secureScore = await getSecureScore();
        const devicesResponse = await client.api('/deviceManagement/managedDevices').get();
        const compliantDevices = devicesResponse.value.filter((device: any) => 
          device.complianceState === 'compliant'
        ).length;

        // Update store
        setStats({
          users: {
            total: usersResponse.value.length,
            active: usersResponse.value.filter((u: any) => u.accountEnabled).length,
            admins: adminUsers.size,
            guestAdmins: guestAdmins.size
          },
          teams: {
            total: teamsResponse.value.length,
            inactive: teamsWithOwners.filter((t: any) => new Date(t.createdDateTime) < sixMonthsAgo).length,
            noOwner: teamsWithOwners.filter((t: any) => !t.hasOwner).length
          },
          oneDrive: {
            totalStorage: Math.round(totalStorage / (1024 * 1024 * 1024))
          },
          security: {
            secureScore: secureScore?.currentScore || 0,
            maxScore: secureScore?.maxScore || 100,
            compliantDevices,
            nonCompliantDevices: devicesResponse.value.length - compliantDevices
          }
        });
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      }
    };

    fetchDashboardData();
  }, [accounts, setStats]);

  const calculateSecureScorePercentage = () => {
    if (!stats.security.maxScore) return '0%';
    return `${Math.round((stats.security.secureScore / stats.security.maxScore) * 100)}%`;
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Link to="/users" className="bg-gradient-radial from-[#1d2144] to-[#0F1225] p-6 rounded-2xl border border-[#2d3154] hover:border-primary/50 transition-colors group">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/20 rounded-lg group-hover:bg-primary/30 transition-colors">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-lg font-medium text-white">Utilisateurs</h3>
          </div>
          <div className="mt-4 flex flex-col items-center">
            <p className="text-4xl font-bold text-white">{stats.users.total}</p>
            <div className="mt-2 flex justify-between gap-4 text-base">
              <span className="text-green-400">{stats.users.active} actifs</span>
              <span className="text-purple-400">{stats.users.admins} admins</span>
            </div>
          </div>
        </Link>

        <Link to="/teams" className="bg-gradient-radial from-[#1d2144] to-[#0F1225] p-6 rounded-2xl border border-[#2d3154] hover:border-primary/50 transition-colors group">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/20 rounded-lg group-hover:bg-primary/30 transition-colors">
              <MessageSquare className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-lg font-medium text-white">Teams</h3>
          </div>
          <div className="mt-4 flex flex-col items-center">
            <p className="text-4xl font-bold text-white">{stats.teams.total}</p>
            <div className="mt-2 flex justify-between gap-4 text-base">
              <span className="text-yellow-400">{stats.teams.inactive} inactifs</span>
              <span className="text-red-400">{stats.teams.noOwner} sans propriétaire</span>
            </div>
          </div>
        </Link>

        <Link to="/onedrive" className="bg-gradient-radial from-[#1d2144] to-[#0F1225] p-6 rounded-2xl border border-[#2d3154] hover:border-primary/50 transition-colors group">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/20 rounded-lg group-hover:bg-primary/30 transition-colors">
              <HardDrive className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-lg font-medium text-white">OneDrive</h3>
          </div>
          <div className="mt-4 flex flex-col items-center">
            <p className="text-4xl font-bold text-white">{stats.oneDrive.totalStorage} GB</p>
            <p className="mt-2 text-base text-white">Stockage total utilisé</p>
          </div>
        </Link>

        <Link to="/security" className="bg-gradient-radial from-[#1d2144] to-[#0F1225] p-6 rounded-2xl border border-[#2d3154] hover:border-primary/50 transition-colors group">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/20 rounded-lg group-hover:bg-primary/30 transition-colors">
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-lg font-medium text-white">Secure Score</h3>
          </div>
          <div className="mt-4 flex flex-col items-center">
            <p className="text-4xl font-bold text-white">{calculateSecureScorePercentage()}</p>
            <div className="w-full mt-2 bg-[#374151] rounded-full h-2">
              <div 
                className="bg-primary h-2 rounded-full transition-all duration-500" 
                style={{ width: `${(stats.security.secureScore / stats.security.maxScore) * 100}%` }}
              ></div>
            </div>
          </div>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-radial from-[#1d2144] to-[#0F1225] p-6 rounded-2xl border border-[#2d3154]">
          <h3 className="text-lg font-medium text-white mb-4">Appareils Conformes</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[
                    { name: 'Conforme', value: stats.security.compliantDevices },
                    { name: 'Non Conforme', value: stats.security.nonCompliantDevices }
                  ]}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={60}
                  paddingAngle={5}
                  dataKey="value"
                >
                  <Cell fill="#22C55E" />
                  <Cell fill="#EF4444" />
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
          <div className="flex justify-center gap-6 mt-4">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-green-500"></div>
              <span className="text-base text-white">
                Conformes ({stats.security.compliantDevices})
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-red-500"></div>
              <span className="text-base text-white">
                Non Conformes ({stats.security.nonCompliantDevices})
              </span>
            </div>
          </div>
        </div>

        <div className="md:col-span-2 bg-gradient-radial from-[#1d2144] to-[#0F1225] p-6 rounded-2xl border border-[#2d3154]">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 bg-yellow-500/20 rounded-lg">
              <AlertTriangle className="h-6 w-6 text-yellow-500" />
            </div>
            <h3 className="text-lg font-medium text-white">Points d'attention</h3>
          </div>
          <div className="space-y-4">
            {stats.users.guestAdmins > 0 && (
              <div className="flex items-center justify-between p-3 bg-red-500/10 rounded-lg">
                <span className="text-base text-red-400">{stats.users.guestAdmins} administrateurs invités</span>
                <Link to="/users?filter=guestAdmin" className="text-sm text-red-400 hover:text-red-300">
                  Voir →
                </Link>
              </div>
            )}
            {stats.users.admins > 5 && (
              <div className="flex items-center justify-between p-3 bg-orange-500/10 rounded-lg">
                <span className="text-base text-orange-400">{stats.users.admins} administrateurs (recommandé: max 5)</span>
                <Link to="/users?filter=admin" className="text-sm text-orange-400 hover:text-orange-300">
                  Voir →
                </Link>
              </div>
            )}
            {stats.teams.noOwner > 0 && (
              <div className="flex items-center justify-between p-3 bg-yellow-500/10 rounded-lg">
                <span className="text-base text-yellow-400">{stats.teams.noOwner} teams sans propriétaire</span>
                <Link to="/teams?filter=noOwner" className="text-sm text-yellow-400 hover:text-yellow-300">
                  Voir →
                </Link>
              </div>
            )}
            {stats.teams.inactive > 0 && (
              <div className="flex items-center justify-between p-3 bg-blue-500/10 rounded-lg">
                <span className="text-base text-blue-400">{stats.teams.inactive} teams inactives</span>
                <Link to="/teams?filter=inactive" className="text-sm text-blue-400 hover:text-blue-300">
                  Voir →
                </Link>
              </div>
            )}
            {stats.security.nonCompliantDevices > 0 && (
              <div className="flex items-center justify-between p-3 bg-purple-500/10 rounded-lg">
                <span className="text-base text-purple-400">{stats.security.nonCompliantDevices} appareils non conformes</span>
                <Link to="/security" className="text-sm text-purple-400 hover:text-purple-300">
                  Voir →
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;