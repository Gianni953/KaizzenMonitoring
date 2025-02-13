import { Client } from "@microsoft/microsoft-graph-client";
import { AuthCodeMSALBrowserAuthenticationProvider } from "@microsoft/microsoft-graph-client/authProviders/authCodeMsalBrowser";
import { 
  InteractionType, 
  InteractionRequiredAuthError, 
  BrowserAuthError,
  AccountInfo
} from "@azure/msal-browser";
import { msalInstance } from "../main";
import { loginRequest } from "../config/auth";

let graphClient: Client | null = null;

// Vérifier si l'application est active sur le tenant
const checkApplicationRegistration = async (tenantId: string): Promise<boolean> => {
  try {
    const response = await fetch(
      `https://login.microsoftonline.com/${tenantId}/v2.0/.well-known/openid-configuration`
    );
    const data = await response.json();
    return !!data.token_endpoint;
  } catch (error) {
    console.error("Error checking application registration:", error);
    return false;
  }
};

// Nettoyer complètement le cache et la session
const clearAllCache = async () => {
  try {
    const accounts = msalInstance.getAllAccounts();
    for (const account of accounts) {
      await msalInstance.clearCache({
        account
      });
    }
    sessionStorage.clear();
    localStorage.removeItem('msal.interaction.status');
    graphClient = null;
  } catch (error) {
    console.error("Error clearing cache:", error);
  }
};

// Forcer une nouvelle connexion interactive
const forceInteractiveSignIn = async (account?: AccountInfo | null): Promise<void> => {
  try {
    await clearAllCache();
    
    const loginConfig = {
      ...loginRequest,
      prompt: "consent", // Forcer le consentement pour s'assurer que les permissions sont bien validées
      loginHint: account?.username
    };

    const response = await msalInstance.loginPopup(loginConfig);
    
    if (response?.account) {
      const isAppRegistered = await checkApplicationRegistration(response.account.tenantId);
      
      if (!isAppRegistered) {
        throw new Error("L'application n'est pas enregistrée ou active sur ce tenant");
      }

      msalInstance.setActiveAccount(response.account);
    }
  } catch (error: any) {
    console.error("Erreur d'authentification interactive:", error);
    throw error;
  }
};


// Rafraîchir le token silencieusement
const refreshTokenSilently = async (account: AccountInfo): Promise<void> => {
  try {
    await msalInstance.acquireTokenSilent({
      ...loginRequest,
      account
    });
  } catch (error) {
    if (error instanceof InteractionRequiredAuthError) {
      // Token expiré ou révoqué, forcer une nouvelle connexion
      await forceInteractiveSignIn(account);
    } else {
      throw error;
    }
  }
};

export const getGraphClient = () => {
  const accounts = msalInstance.getAllAccounts();
  const activeAccount = msalInstance.getActiveAccount() || accounts[0];
  
  if (!activeAccount) {
    throw new Error("Aucun compte actif. Veuillez vous connecter.");
  }

  if (!graphClient) {
    const authProvider = new AuthCodeMSALBrowserAuthenticationProvider(msalInstance, {
      account: activeAccount,
      scopes: loginRequest.scopes,
      interactionType: InteractionType.Popup,
    });

    graphClient = Client.initWithMiddleware({
      authProvider,
    });
  }

  return graphClient;
};

export const resetGraphClient = async () => {
  await clearAllCache();
};

// Wrapper pour les appels à l'API Graph
const executeGraphRequest = async <T>(operation: () => Promise<T>): Promise<T> => {
  try {
    const accounts = msalInstance.getAllAccounts();
    const activeAccount = msalInstance.getActiveAccount() || accounts[0];

    if (!activeAccount) {
      await forceInteractiveSignIn();
      return executeGraphRequest(operation);
    }

    // Vérifier et rafraîchir le token si nécessaire
    await refreshTokenSilently(activeAccount);

    try {
      return await operation();
    } catch (error: any) {
      // Gérer les erreurs d'authentification
      if (error.message?.includes('interaction_required') || 
          error.message?.includes('consent_required') ||
          error.message?.includes('invalid_grant') ||
          error.message?.includes('AADSTS160021')) {
        
        // Vérifier si l'application est enregistrée sur le tenant
        const isAppRegistered = await checkApplicationRegistration(activeAccount.tenantId);
        if (!isAppRegistered) {
          throw new Error("L'application n'est pas enregistrée ou active sur ce tenant");
        }

        // Forcer une nouvelle authentification avec consentement
        await forceInteractiveSignIn(activeAccount);
        return executeGraphRequest(operation);
      }
      throw error;
    }
  } catch (error: any) {
    console.error("Graph API Error:", error);
    throw new Error(error.message || "Une erreur est survenue lors de l'appel à l'API");
  }
};

// Reste du code inchangé...