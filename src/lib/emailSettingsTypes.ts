export type AgencyEmailSettings = {
  revision: string | null;
  fromName: string;
  fromEmail: string;
  smtpHost: "smtp.ionos.co.uk";
  smtpPort: 465 | 587;
  hasPassword: boolean;
  enabled: boolean;
  verifiedAt: string | null;
  platformSendingEnabled: boolean;
  connectionChecksEnabled: boolean;
  credentialStorageReady: boolean;
};
