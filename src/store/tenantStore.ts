import { create } from 'zustand';

export interface Tenant {
  id: string;
  name: string;
  domain: string;
  defaultDomain?: string;
}

interface TenantState {
  tenants: Tenant[];
  addTenant: (tenant: Tenant) => void;
  removeTenant: (id: string) => void;
}

export const useTenantStore = create<TenantState>((set) => ({
  tenants: [],
  addTenant: (tenant) => 
    set((state) => ({
      tenants: [...state.tenants.filter(t => t.id !== tenant.id), tenant]
    })),
  removeTenant: (id) =>
    set((state) => ({
      tenants: state.tenants.filter((tenant) => tenant.id !== id)
    })),
}));