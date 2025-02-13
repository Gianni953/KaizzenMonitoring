import { create } from 'zustand';
import { AccountInfo } from '@azure/msal-browser';

interface Stats {
  users: {
    total: number;
    active: number;
    admins: number;
    guestAdmins: number;
  };
  teams: {
    total: number;
    inactive: number;
    noOwner: number;
  };
  oneDrive: {
    totalStorage: number;
  };
  security: {
    secureScore: number;
    maxScore: number;
    compliantDevices: number;
    nonCompliantDevices: number;
  };
}

interface AuthState {
  account: AccountInfo | null;
  stats: Stats;
  setAccount: (account: AccountInfo | null) => void;
  setStats: (stats: Partial<Stats>) => void;
}

const initialStats: Stats = {
  users: {
    total: 0,
    active: 0,
    admins: 0,
    guestAdmins: 0
  },
  teams: {
    total: 0,
    inactive: 0,
    noOwner: 0
  },
  oneDrive: {
    totalStorage: 0
  },
  security: {
    secureScore: 0,
    maxScore: 100,
    compliantDevices: 0,
    nonCompliantDevices: 0
  }
};

export const useAuthStore = create<AuthState>((set) => ({
  account: null,
  stats: initialStats,
  setAccount: (account) => set({ account }),
  setStats: (newStats) => set((state) => ({
    stats: {
      ...state.stats,
      ...newStats,
      users: { ...state.stats.users, ...newStats.users },
      teams: { ...state.stats.teams, ...newStats.teams },
      oneDrive: { ...state.stats.oneDrive, ...newStats.oneDrive },
      security: { ...state.stats.security, ...newStats.security }
    }
  }))
}));