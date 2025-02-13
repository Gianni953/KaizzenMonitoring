import React from 'react';
import { useTenantStore } from '../store/tenantStore';

const Tenants = () => {
  const { tenants } = useTenantStore();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Gestion des Tenants</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-radial from-[#1d2144] to-[#0F1225] p-6 rounded-2xl border border-[#2d3154]">
          <h3 className="text-gray-400 mb-2">Tenants Actifs</h3>
          <p className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
            {tenants.length}
          </p>
        </div>
        <div className="bg-gradient-radial from-[#1d2144] to-[#0F1225] p-6 rounded-2xl border border-[#2d3154]">
          <h3 className="text-gray-400 mb-2">Problèmes de synchronisation</h3>
          <p className="text-4xl font-bold text-red-500">0</p>
        </div>
      </div>

      <div className="bg-gradient-radial from-[#1d2144] to-[#0F1225] rounded-2xl border border-[#2d3154]">
        <div className="p-6">
          <h3 className="text-xl font-semibold mb-4">Liste des Tenants</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left border-b border-[#2d3154]">
                  <th className="pb-3 text-gray-400">Nom</th>
                  <th className="pb-3 text-gray-400">Domaine</th>
                  <th className="pb-3 text-gray-400">ID</th>
                </tr>
              </thead>
              <tbody>
                {tenants.map((tenant) => (
                  <tr key={tenant.id} className="border-b border-[#2d3154]">
                    <td className="py-4">{tenant.name}</td>
                    <td className="py-4">{tenant.domain}</td>
                    <td className="py-4">{tenant.id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Tenants;