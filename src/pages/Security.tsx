import React, { useState, useEffect } from 'react';
import { useMsal } from "@azure/msal-react";
import { getGraphClient } from "../services/graph";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Shield, Monitor, AlertTriangle, Laptop, Smartphone, Tablet, ChevronDown, ChevronRight, ArrowUpRight } from 'lucide-react';

interface SecurityStats {
  secureScore?: {
    currentScore: number;
    maxScore: number;
    createdDateTime: string;
    controlScores: Array<{
      controlName: string;
      score: number;
      maxScore: number;
      implementationStatus: string;
      description: string;
    }>;
  };
  compliantDevices: number;
  nonCompliantDevices: number;
  totalDevices: number;
  osCounts: {
    windows: number;
    android: number;
    ios: number;
  };
}

interface Device {
  id: string;
  deviceName: string;
  osVersion: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  enrolledDateTime: string;
  lastSyncDateTime: string;
  operatingSystem: string;
  complianceState: string;
  userPrincipalName: string;
  nonComplianceDetails: Array<{
    setting: string;
    settingName: string;
    value: string;
    expectedValue: string;
    source: string;
  }>;
}

const Security: React.FC = () => {
  const { accounts } = useMsal();
  const [stats, setStats] = useState<SecurityStats>({
    compliantDevices: 0,
    nonCompliantDevices: 0,
    totalDevices: 0,
    osCounts: {
      windows: 0,
      android: 0,
      ios: 0
    }
  });
  const [devices, setDevices] = useState<Device[]>([]);
  const [expandedDevices, setExpandedDevices] = useState<Set<string>>(new Set());
  const [expandedPolicies, setExpandedPolicies] = useState<Set<string>>(new Set());
  const [selectedOS, setSelectedOS] = useState<string | null>(null);
  const [complianceFilter, setComplianceFilter] = useState<'all' | 'compliant' | 'noncompliant'>('all');

  const calculateSecureScorePercentage = () => {
    if (!stats.secureScore) return '0%';
    return `${Math.round((stats.secureScore.currentScore / stats.secureScore.maxScore) * 100)}%`;
  };

  const calculateComplianceRate = () => {
    if (stats.totalDevices === 0) return '0%';
    return `${Math.round((stats.compliantDevices / stats.totalDevices) * 100)}%`;
  };

  const toggleDeviceExpansion = (deviceId: string) => {
    const newExpanded = new Set(expandedDevices);
    if (newExpanded.has(deviceId)) {
      newExpanded.delete(deviceId);
    } else {
      newExpanded.add(deviceId);
    }
    setExpandedDevices(newExpanded);
  };

  const togglePolicyExpansion = (policyName: string) => {
    const newExpanded = new Set(expandedPolicies);
    if (newExpanded.has(policyName)) {
      newExpanded.delete(policyName);
    } else {
      newExpanded.add(policyName);
    }
    setExpandedPolicies(newExpanded);
  };

  const getDeviceIcon = (os: string) => {
    if (os.toLowerCase().includes('windows')) return Laptop;
    if (os.toLowerCase().includes('android')) return Smartphone;
    return Tablet;
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  useEffect(() => {
    const fetchSecurityData = async () => {
      if (!accounts || accounts.length === 0) return;
      try {
        const client = getGraphClient();

        // Fetch Secure Score
        const secureScoreResponse = await client.api('/security/secureScores')
          .top(1)
          .orderby('createdDateTime desc')
          .get();

        if (secureScoreResponse.value && secureScoreResponse.value.length > 0) {
          const scoreId = secureScoreResponse.value[0].id;
          const scoreDetails = await client.api(`/security/secureScores/${scoreId}`)
            .get();

          // Fetch device compliance
          const devicesResponse = await client.api('/deviceManagement/managedDevices')
            .select('id,deviceName,osVersion,manufacturer,model,serialNumber,enrolledDateTime,lastSyncDateTime,operatingSystem,complianceState,userPrincipalName')
            .get();

          // Fetch compliance policies and their states for each device
          const devicesWithPolicies = await Promise.all(
            devicesResponse.value.map(async (device: any) => {
              try {
                const policyStatesResponse = await client.api(`/deviceManagement/managedDevices/${device.id}/deviceCompliancePolicyStates`)
                  .get();

                const nonComplianceDetails = policyStatesResponse.value
                  .filter((policy: any) => policy.state !== 'compliant')
                  .map((policy: any) => ({
                    source: policy.displayName || 'Politique de conformité'
                  }));

                return {
                  ...device,
                  nonComplianceDetails
                };
              } catch (error) {
                console.error(`Error fetching policy states for device ${device.id}:`, error);
                return {
                  ...device,
                  nonComplianceDetails: []
                };
              }
            })
          );

          const compliantDevices = devicesWithPolicies.filter((device: any) =>
            device.complianceState === 'compliant'
          ).length;

          const osCounts = devicesWithPolicies.reduce((acc: any, device: any) => {
            const os = device.operatingSystem.toLowerCase();
            if (os.includes('windows')) acc.windows++;
            else if (os.includes('android')) acc.android++;
            else if (os.includes('ios') || os.includes('mac')) acc.ios++;
            return acc;
          }, { windows: 0, android: 0, ios: 0 });

          setDevices(devicesWithPolicies);
          setStats({
            secureScore: scoreDetails,
            compliantDevices,
            nonCompliantDevices: devicesWithPolicies.length - compliantDevices,
            totalDevices: devicesWithPolicies.length,
            osCounts
          });
        }
      } catch (error) {
        console.error('Error fetching security data:', error);
      }
    };

    fetchSecurityData();
  }, [accounts]);

  const filteredDevices = devices
    .filter(device => {
      if (selectedOS) {
        return device.operatingSystem.toLowerCase().includes(selectedOS.toLowerCase());
      }
      return true;
    })
    .filter(device => {
      switch (complianceFilter) {
        case 'compliant':
          return device.complianceState === 'compliant';
        case 'noncompliant':
          return device.complianceState !== 'compliant';
        default:
          return true;
      }
    });

  const policies = Array.from(new Set(devices.flatMap(device => device.nonComplianceDetails.map(detail => detail.source))));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-radial from-[#1d2144] to-[#0F1225] p-6 rounded-2xl border border-[#2d3154]">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-indigo-500/20 rounded-lg">
              <Shield className="h-6 w-6 text-indigo-500" />
            </div>
            <div>
              <h3 className="text-lg font-medium text-white">Secure Score</h3>
              <p className="text-sm text-gray-400">Score de sécurité global</p>
            </div>
          </div>
          <div className="relative pt-4">
            <div className="flex justify-between mb-2">
              <span className="text-4xl font-bold text-white">{calculateSecureScorePercentage()}</span>
            </div>
            <div className="w-full bg-[#374151] rounded-full h-2.5">
              <div
                className="bg-indigo-600 h-2.5 rounded-full transition-all duration-500"
                style={{
                  width: `${((stats?.secureScore?.currentScore || 0) / (stats?.secureScore?.maxScore || 100)) * 100}%`
                }}
              ></div>
            </div>
            <div className="mt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Score moyen du secteur</span>
                <span className="text-white">65%</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Score recommandé</span>
                <span className="text-white">80%</span>
              </div>
            </div>
            {stats?.secureScore?.createdDateTime && (
              <div className="mt-4 text-sm text-gray-400">
                Dernière mise à jour: {new Date(stats.secureScore.createdDateTime).toLocaleDateString()}
              </div>
            )}
          </div>
        </div>

        <div className="bg-gradient-radial from-[#1d2144] to-[#0F1225] p-6 rounded-2xl border border-[#2d3154]">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-green-500/20 rounded-lg">
              <Monitor className="h-6 w-6 text-green-500" />
            </div>
            <div>
              <h3 className="text-lg font-medium text-white">Appareils Conformes</h3>
              <p className="text-sm text-gray-400">État de conformité Intune</p>
            </div>
          </div>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[
                    { name: 'Conforme', value: stats?.compliantDevices || 0 },
                    { name: 'Non Conforme', value: stats?.nonCompliantDevices || 0 }
                  ]}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
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
                Conforme ({stats.compliantDevices || 0})
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-red-500"></div>
              <span className="text-base text-white">
                Non Conforme ({stats.nonCompliantDevices || 0})
              </span>
            </div>
          </div>
        </div>

        <div className="bg-gradient-radial from-[#1d2144] to-[#0F1225] p-6 rounded-2xl border border-[#2d3154]">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-yellow-500/20 rounded-lg">
              <AlertTriangle className="h-6 w-6 text-yellow-500" />
            </div>
            <div>
              <h3 className="text-lg font-medium text-white">Total Appareils</h3>
              <p className="text-sm text-gray-400">Appareils gérés par Intune</p>
            </div>
          </div>
          <p className="text-4xl font-bold text-white">{stats?.totalDevices || 'N/A'}</p>
          <div className="mt-4">
            <div className="flex justify-between text-base mb-2">
              <span className="text-white">Taux de conformité</span>
              <span className="text-white font-medium">{calculateComplianceRate()}</span>
            </div>
            <div className="w-full bg-[#374151] rounded-full h-2.5">
              <div
                className="bg-green-500 h-2.5 rounded-full transition-all duration-500"
                style={{
                  width: `${stats?.totalDevices
                    ? (stats.compliantDevices / stats.totalDevices) * 100
                    : 0}%`
                }}
              ></div>
            </div>
            <div className="mt-6 space-y-3">
              <div className="flex justify-between text-base">
                <span className="text-white">Windows</span>
                <span className="text-white font-medium">{stats?.osCounts.windows || 0}</span>
              </div>
              <div className="flex justify-between text-base">
                <span className="text-white">Android</span>
                <span className="text-white font-medium">{stats?.osCounts.android || 0}</span>
              </div>
              <div className="flex justify-between text-base">
                <span className="text-white">iOS/macOS</span>
                <span className="text-white font-medium">{stats?.osCounts.ios || 0}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gradient-radial from-[#1d2144] to-[#0F1225] p-6 rounded-2xl border border-[#2d3154]">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-medium text-white">Actions Recommandées</h3>
            <span className="text-sm text-white bg-indigo-500/20 px-3 py-1 rounded-full">
              Top 5 priorités
            </span>
          </div>
          <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
            {stats?.secureScore?.controlScores
              ?.filter(control => control.implementationStatus !== 'implemented')
              .sort((a, b) => (b.maxScore - b.score) - (a.maxScore - a.score))
              .slice(0, 5)
              .map((control, index) => {
                const impact = control.maxScore && control.score ?
                  (((control.maxScore - control.score) / control.maxScore) * 100).toFixed(2) : '0.00';
                return (
                  <div key={index} className="bg-[#2D3748] p-4 rounded-lg">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <h4 className="text-base font-medium text-white flex-1">{control.controlName}</h4>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-sm text-white bg-indigo-500/20 px-2 py-1 rounded-full">
                          Impact: {impact}%
                        </span>
                        <ArrowUpRight className="h-4 w-4 text-indigo-400" />
                      </div>
                    </div>
                    <p className="text-sm text-gray-400 line-clamp-3 hover:line-clamp-none transition-all duration-200">
                      {control.description}
                    </p>
                    <div className="mt-3">
                      <div className="flex justify-between text-xs text-gray-400 mb-1">
                        <span>Score actuel</span>
                        <span>{control.score}/{control.maxScore}</span>
                      </div>
                      <div className="w-full bg-[#374151] rounded-full h-2">
                        <div
                          className="bg-indigo-600 h-2 rounded-full transition-all duration-500"
                          style={{ width: `${(control.score / control.maxScore) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        <div className="bg-gradient-radial from-[#1d2144] to-[#0F1225] rounded-2xl border border-[#2d3154]">
          <div className="p-6 border-b border-[#2d3154]">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-white">Liste des Appareils</h3>
              <div className="flex gap-2">
                <div className="flex gap-2 mr-4">
                  <button
                    onClick={() => setComplianceFilter('all')}
                    className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                      complianceFilter === 'all' ? 'bg-indigo-600 text-white' : 'bg-[#374151] text-white hover:bg-[#4B5563]'
                    }`}
                  >
                    Tous
                  </button>
                  <button
                    onClick={() => setComplianceFilter('compliant')}
                    className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                      complianceFilter === 'compliant' ? 'bg-green-600 text-white' : 'bg-[#374151] text-white hover:bg-[#4B5563]'
                    }`}
                  >
                    Conformes
                  </button>
                  <button
                    onClick={() => setComplianceFilter('noncompliant')}
                    className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                      complianceFilter === 'noncompliant' ? 'bg-red-600 text-white' : 'bg-[#374151] text-white hover:bg-[#4B5563]'
                    }`}
                  >
                    Non Conformes
                  </button>
                </div>
                <button
                  onClick={() => setSelectedOS(null)}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    !selectedOS ? 'bg-indigo-600 text-white' : 'bg-[#374151] text-white hover:bg-[#4B5563]'
                  }`}
                >
                  Tous
                </button>
                <button
                  onClick={() => setSelectedOS('windows')}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    selectedOS === 'windows' ? 'bg-blue-600 text-white' : 'bg-[#374151] text-white hover:bg-[#4B5563]'
                  }`}
                >
                  Windows
                </button>
                <button
                  onClick={() => setSelectedOS('android')}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    selectedOS === 'android' ? 'bg-green-600 text-white' : 'bg-[#374151] text-white hover:bg-[#4B5563]'
                  }`}
                >
                  Android
                </button>
                <button
                  onClick={() => setSelectedOS('ios')}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    selectedOS === 'ios' ? 'bg-purple-600 text-white' : 'bg-[#374151] text-white hover:bg-[#4B5563]'
                  }`}
                >
                  iOS/macOS
                </button>
              </div>
            </div>
          </div>
          <div className="max-h-[400px] overflow-y-auto">
            <div className="divide-y divide-[#2d3154]">
              {filteredDevices.map((device) => (
                <div key={device.id} className="p-4 hover:bg-[#1d2144]">
                  <div
                    className="flex items-center justify-between cursor-pointer"
                    onClick={() => toggleDeviceExpansion(device.id)}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-lg ${
                        device.complianceState === 'compliant'
                          ? 'bg-green-500/20 text-green-500'
                          : 'bg-red-500/20 text-red-500'
                      }`}>
                        {React.createElement(getDeviceIcon(device.operatingSystem), { size: 20 })}
                      </div>
                      <div>
                        <h4 className="text-white font-medium">{device.deviceName}</h4>
                        <p className="text-sm text-gray-400">
                          {device.userPrincipalName}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        device.complianceState === 'compliant'
                          ? 'bg-green-500/20 text-green-500'
                          : 'bg-red-500/20 text-red-500'
                      }`}>
                        {device.complianceState === 'compliant' ? 'Conforme' : 'Non conforme'}
                      </span>
                      {expandedDevices.has(device.id) ? (
                        <ChevronDown className="h-5 w-5 text-gray-400" />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-gray-400" />
                      )}
                    </div>
                  </div>
                  {expandedDevices.has(device.id) && (
                    <div className="mt-4 pl-12 space-y-4">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-gray-400">Système d'exploitation</p>
                          <p className="text-white">{device.operatingSystem} {device.osVersion}</p>
                        </div>
                        <div>
                          <p className="text-gray-400">Fabricant</p>
                          <p className="text-white">{device.manufacturer}</p>
                        </div>
                        <div>
                          <p className="text-gray-400">Modèle</p>
                          <p className="text-white">{device.model}</p>
                        </div>
                        <div>
                          <p className="text-gray-400">Numéro de série</p>
                          <p className="text-white">{device.serialNumber}</p>
                        </div>
                        <div>
                          <p className="text-gray-400">Date d'inscription</p>
                          <p className="text-white">{formatDate(device.enrolledDateTime)}</p>
                        </div>
                        <div>
                          <p className="text-gray-400">Dernière synchronisation</p>
                          <p className="text-white">{formatDate(device.lastSyncDateTime)}</p>
                        </div>
                      </div>
                      {device.complianceState !== 'compliant' && device.nonComplianceDetails.length > 0 && (
                        <div className="mt-4">
                          <h5 className="text-white font-medium mb-2">Stratégies non conformes</h5>
                          <div className="space-y-2">
                            {Array.from(new Set(device.nonComplianceDetails.map(detail => detail.source))).map((policy, index) => (
                              <div key={index} className="bg-[#2D3748] p-3 rounded-lg">
                                <div className="flex justify-between items-center">
                                  <p className="text-white font-medium">{policy}</p>
                                  <span className="text-xs bg-red-500/20 text-red-500 px-2 py-1 rounded-full">
                                    Non conforme
                                  </span>
                                </div>
                                <div className="mt-2 space-y-1">
                                  {device.nonComplianceDetails
                                    .filter(detail => detail.source === policy)
                                    .map((detail, detailIndex) => (
                                      <div key={detailIndex} className="text-sm text-gray-400">
                                        <p><strong>{detail.settingName}</strong>: {detail.value} (Attendu: {detail.expectedValue})</p>
                                      </div>
                                    ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-gradient-radial from-[#1d2144] to-[#0F1225] rounded-2xl border border-[#2d3154]">
        <div className="p-6 border-b border-[#2d3154]">
          <h3 className="text-lg font-medium text-white">Liste des Stratégies Intune</h3>
        </div>
        <div className="divide-y divide-[#2d3154]">
          {policies.map((policy) => (
            <div key={policy} className="p-4 hover:bg-[#1d2144]">
              <div
                className="flex items-center justify-between cursor-pointer"
                onClick={() => togglePolicyExpansion(policy)}
              >
                <div className="flex items-center gap-4">
                  <div className="p-2 rounded-lg bg-red-500/20 text-red-500">
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-white font-medium">{policy}</h4>
                    <p className="text-sm text-gray-400">
                      {devices.filter(device => 
                        device.nonComplianceDetails.some(detail => detail.source === policy)
                      ).length} appareils non conformes
                    </p>
                  </div>
                </div>
                <button className="p-2 hover:bg-[#374151] rounded-lg transition-colors">
                  {expandedPolicies.has(policy) ? (
                    <ChevronDown className="h-5 w-5 text-gray-400" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-gray-400" />
                  )}
                </button>
              </div>
              {expandedPolicies.has(policy) && (
                <div className="mt-4 pl-12 space-y-4">
                  {devices
                    .filter(device => 
                      device.nonComplianceDetails.some(detail => detail.source === policy)
                    )
                    .map((device) => (
                      <div key={device.id} className="bg-[#2D3748] p-3 rounded-lg">
                        <div className="flex items-center gap-4">
                          <div className="p-2 rounded-lg bg-red-500/20 text-red-500">
                            {React.createElement(getDeviceIcon(device.operatingSystem), { size: 20 })}
                          </div>
                          <div>
                            <h5 className="text-white font-medium">{device.deviceName}</h5>
                            <p className="text-sm text-gray-400">{device.userPrincipalName}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Security;