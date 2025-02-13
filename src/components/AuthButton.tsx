import React, { useState, useEffect } from 'react';
import { useMsal } from "@azure/msal-react";
import { loginRequest } from "../config/auth";
import { useAuthStore } from "../store/authStore";
import { resetGraphClient } from "../services/graph";

const AuthButton = () => {
  const { instance, accounts } = useMsal();
  const { setAccount } = useAuthStore();
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  useEffect(() => {
    const activeAccount = instance.getActiveAccount();
    if (accounts[0] && (!activeAccount || activeAccount.homeAccountId !== accounts[0].homeAccountId)) {
      instance.setActiveAccount(accounts[0]);
      setAccount(accounts[0]);
    }
  }, [instance, accounts, setAccount]);

  const handleLogin = async () => {
    if (isAuthenticating) return;
    
    try {
      setIsAuthenticating(true);
      const response = await instance.loginPopup({
        ...loginRequest,
        redirectUri: window.location.origin
      });
      
      if (response?.account) {
        setAccount(response.account);
        instance.setActiveAccount(response.account);
        // Force a page reload to ensure all components re-fetch data
        window.location.reload();
      }
    } catch (error: any) {
      if (error.errorCode !== 'user_cancelled') {
        console.error("Error during login:", error);
      }
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleLogout = async () => {
    if (isAuthenticating) return;
    
    try {
      setIsAuthenticating(true);
      setAccount(null);
      resetGraphClient();
      await instance.logoutPopup({
        postLogoutRedirectUri: window.location.origin
      });
      // Force a page reload to clear all data
      window.location.reload();
    } catch (error) {
      console.error("Error during logout:", error);
    } finally {
      setIsAuthenticating(false);
    }
  };

  return accounts[0] ? (
    <button
      onClick={handleLogout}
      disabled={isAuthenticating}
      className="px-4 py-2 bg-[#1d2144] text-white rounded-lg hover:bg-[#2d3154] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {isAuthenticating ? 'Déconnexion...' : 'Se déconnecter'}
    </button>
  ) : (
    <button
      onClick={handleLogin}
      disabled={isAuthenticating}
      className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {isAuthenticating ? 'Connexion...' : 'Se connecter'}
    </button>
  );
};

export default AuthButton;