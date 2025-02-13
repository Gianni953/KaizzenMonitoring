import { Configuration, LogLevel } from "@azure/msal-browser";

const baseUrl = window.location.origin;

export const msalConfig: Configuration = {
  auth: {
    clientId: "eb48e971-60d1-41c7-bfc9-9efc98b2ab09",
    authority: "https://login.microsoftonline.com/organizations",
    redirectUri: baseUrl,
    postLogoutRedirectUri: baseUrl,
    navigateToLoginRequestUrl: true,
    protocolMode: "AAD"
  },
  cache: {
    cacheLocation: "sessionStorage",
    storeAuthStateInCookie: false,
    secureCookies: false,
    claimsBasedCachingEnabled: true
  },
  system: {
    allowNativeBroker: false,
    windowHashTimeout: 60000,
    iframeHashTimeout: 6000,
    loadFrameTimeout: 0,
    tokenRenewalOffsetSeconds: 300,
    loggerOptions: {
      logLevel: LogLevel.Error,
      loggerCallback: (level, message, containsPii) => {
        if (!containsPii) {
          console[level.toLowerCase()](message);
        }
      },
    },
  },
};

export const loginRequest = {
  scopes: [
    "User.Read",
    "Directory.Read.All",
    "User.Read.All",
    "Group.Read.All",
    "Sites.Read.All",
    "Team.ReadBasic.All",
    "TeamSettings.Read.All",
    "Channel.ReadBasic.All",
    "SecurityEvents.Read.All",
    "DeviceManagementManagedDevices.Read.All",
    "DeviceManagementConfiguration.Read.All",
    "Reports.Read.All",
    "ChannelMessage.Read.All",
    "Sites.FullControl.All",
    "Sites.Manage.All",
    "Sites.ReadWrite.All",
    "SecurityEvents.ReadWrite.All",
    "DeviceManagementApps.Read.All",
    "DeviceManagementConfiguration.ReadWrite.All",
    "Policy.Read.All",
    "Policy.ReadWrite.ConditionalAccess",
    "SecurityActions.Read.All"
  ],
};