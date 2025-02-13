import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { PublicClientApplication } from "@azure/msal-browser";
import { MsalProvider } from "@azure/msal-react";
import { msalConfig } from "./config/auth";
import App from './App.tsx';
import './index.css';

// Clear session storage to remove any stale MSAL data
sessionStorage.clear();

// Create MSAL instance
export const msalInstance = new PublicClientApplication(msalConfig);

// Initialize MSAL
msalInstance.initialize().then(async () => {
  // Handle the response from auth redirects/popups
  await msalInstance.handleRedirectPromise();

  // Set active account if available
  const accounts = msalInstance.getAllAccounts();
  if (accounts.length > 0) {
    msalInstance.setActiveAccount(accounts[0]);
  }

  // Get root element
  const rootElement = document.getElementById('root');
  if (!rootElement) return;

  // Create root only once
  let root;
  if (!rootElement._reactRootContainer) {
    root = createRoot(rootElement);
    rootElement._reactRootContainer = root;
  } else {
    root = rootElement._reactRootContainer;
  }

  root.render(
    <StrictMode>
      <MsalProvider instance={msalInstance}>
        <App />
      </MsalProvider>
    </StrictMode>
  );
}).catch(error => {
  console.error("Error initializing MSAL:", error);
});