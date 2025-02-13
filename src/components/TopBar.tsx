import React from 'react';
import { Bell } from 'lucide-react';
import { useMsal } from "@azure/msal-react";
import { loginRequest } from "../config/auth";

const TopBar = () => {
  const { instance, accounts } = useMsal();
  const account = accounts[0];

  const handleLogin = async () => {
    try {
      await instance.loginPopup(loginRequest);
    } catch (error) {
      console.error("Error during login:", error);
    }
  };

  const handleLogout = async () => {
    try {
      await instance.logoutPopup();
    } catch (error) {
      console.error("Error during logout:", error);
    }
  };

  return (
    <div className="h-16 backdrop-blur-md bg-glass border-b border-glass-border px-6 flex items-center justify-between z-10">
      <div className="flex-1">
        <h1 className="text-xl font-semibold text-white">Kaizzen Monitoring</h1>
      </div>
      
      <div className="flex items-center space-x-4">
        <button className="p-2 text-white/40 hover:text-white rounded-xl hover:bg-glass transition-all">
          <Bell className="h-5 w-5" />
        </button>
        
        {account ? (
          <div className="flex items-center space-x-4">
            <div className="text-sm">
              <p className="text-white font-medium">{account.name}</p>
              <p className="text-white/40">{account.username}</p>
            </div>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm font-medium text-white bg-glass hover:bg-glass-hover rounded-xl transition-all shadow-glass-border"
            >
              Se déconnecter
            </button>
            <div className="h-10 w-10 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-400 font-medium shadow-neon border border-purple-500/20">
              {account.name?.split(' ').map(n => n[0]).join('')}
            </div>
          </div>
        ) : (
          <button
            onClick={handleLogin}
            className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary-hover rounded-xl transition-all shadow-neon"
          >
            Se connecter
          </button>
        )}
      </div>
    </div>
  );
};

export default TopBar;