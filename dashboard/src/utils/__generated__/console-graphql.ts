import { gql } from '@apollo/client';
import * as Apollo from '@apollo/client';
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
const defaultOptions = {} as const;
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: string;
  String: string;
  Boolean: boolean;
  Int: number;
  Float: number;
  ConfigEmail: any;
  ConfigHasuraAPIs: any;
  ConfigLocale: any;
  ConfigPort: any;
  ConfigUint8: any;
  ConfigUint32: any;
  ConfigUrl: any;
  ConfigUserRole: any;
  Timestamp: any;
  bigint: any;
  bpchar: any;
  citext: any;
  float64: any;
  jsonb: any;
  timestamptz: any;
  uuid: any;
};

export type BackupPresignedUrl = {
  __typename?: 'BackupPresignedURL';
  expires_at: Scalars['Timestamp'];
  url: Scalars['String'];
};

export type BackupResult = {
  __typename?: 'BackupResult';
  backupID: Scalars['uuid'];
  size: Scalars['bigint'];
};

/** Boolean expression to compare columns of type "Boolean". All fields are combined with logical 'AND'. */
export type Boolean_Comparison_Exp = {
  _eq?: InputMaybe<Scalars['Boolean']>;
  _gt?: InputMaybe<Scalars['Boolean']>;
  _gte?: InputMaybe<Scalars['Boolean']>;
  _in?: InputMaybe<Array<Scalars['Boolean']>>;
  _is_null?: InputMaybe<Scalars['Boolean']>;
  _lt?: InputMaybe<Scalars['Boolean']>;
  _lte?: InputMaybe<Scalars['Boolean']>;
  _neq?: InputMaybe<Scalars['Boolean']>;
  _nin?: InputMaybe<Array<Scalars['Boolean']>>;
};

export type ConfigAuth = {
  __typename?: 'ConfigAuth';
  method?: Maybe<ConfigAuthMethod>;
  redirections?: Maybe<ConfigAuthRedirections>;
  resources?: Maybe<ConfigResources>;
  session?: Maybe<ConfigAuthSession>;
  signUp?: Maybe<ConfigAuthSignUp>;
  totp?: Maybe<ConfigAuthTotp>;
  user?: Maybe<ConfigAuthUser>;
  version?: Maybe<Scalars['String']>;
};

export type ConfigAuthMethod = {
  __typename?: 'ConfigAuthMethod';
  anonymous?: Maybe<ConfigAuthMethodAnonymous>;
  emailPassword?: Maybe<ConfigAuthMethodEmailPassword>;
  emailPasswordless?: Maybe<ConfigAuthMethodEmailPasswordless>;
  oauth?: Maybe<ConfigAuthMethodOauth>;
  smsPasswordless?: Maybe<ConfigAuthMethodSmsPasswordless>;
  webauthn?: Maybe<ConfigAuthMethodWebauthn>;
};

export type ConfigAuthMethodAnonymous = {
  __typename?: 'ConfigAuthMethodAnonymous';
  enabled?: Maybe<Scalars['Boolean']>;
};

export type ConfigAuthMethodAnonymousUpdateInput = {
  enabled?: InputMaybe<Scalars['Boolean']>;
};

export type ConfigAuthMethodEmailPassword = {
  __typename?: 'ConfigAuthMethodEmailPassword';
  emailVerificationRequired?: Maybe<Scalars['Boolean']>;
  hibpEnabled?: Maybe<Scalars['Boolean']>;
  passwordMinLength?: Maybe<Scalars['ConfigUint8']>;
};

export type ConfigAuthMethodEmailPasswordUpdateInput = {
  emailVerificationRequired?: InputMaybe<Scalars['Boolean']>;
  hibpEnabled?: InputMaybe<Scalars['Boolean']>;
  passwordMinLength?: InputMaybe<Scalars['ConfigUint8']>;
};

export type ConfigAuthMethodEmailPasswordless = {
  __typename?: 'ConfigAuthMethodEmailPasswordless';
  enabled?: Maybe<Scalars['Boolean']>;
};

export type ConfigAuthMethodEmailPasswordlessUpdateInput = {
  enabled?: InputMaybe<Scalars['Boolean']>;
};

export type ConfigAuthMethodOauth = {
  __typename?: 'ConfigAuthMethodOauth';
  apple?: Maybe<ConfigAuthMethodOauthApple>;
  azuread?: Maybe<ConfigAuthMethodOauthAzuread>;
  bitbucket?: Maybe<ConfigStandardOauthProvider>;
  discord?: Maybe<ConfigStandardOauthProviderWithScope>;
  facebook?: Maybe<ConfigStandardOauthProviderWithScope>;
  github?: Maybe<ConfigStandardOauthProviderWithScope>;
  gitlab?: Maybe<ConfigStandardOauthProviderWithScope>;
  google?: Maybe<ConfigStandardOauthProviderWithScope>;
  linkedin?: Maybe<ConfigStandardOauthProviderWithScope>;
  spotify?: Maybe<ConfigStandardOauthProviderWithScope>;
  strava?: Maybe<ConfigStandardOauthProviderWithScope>;
  twitch?: Maybe<ConfigStandardOauthProviderWithScope>;
  twitter?: Maybe<ConfigAuthMethodOauthTwitter>;
  windowslive?: Maybe<ConfigStandardOauthProviderWithScope>;
  workos?: Maybe<ConfigAuthMethodOauthWorkos>;
};

export type ConfigAuthMethodOauthApple = {
  __typename?: 'ConfigAuthMethodOauthApple';
  clientId?: Maybe<Scalars['String']>;
  enabled?: Maybe<Scalars['Boolean']>;
  keyId?: Maybe<Scalars['String']>;
  privateKey?: Maybe<Scalars['String']>;
  scope?: Maybe<Array<Scalars['String']>>;
  teamId?: Maybe<Scalars['String']>;
};

export type ConfigAuthMethodOauthAppleUpdateInput = {
  clientId?: InputMaybe<Scalars['String']>;
  enabled?: InputMaybe<Scalars['Boolean']>;
  keyId?: InputMaybe<Scalars['String']>;
  privateKey?: InputMaybe<Scalars['String']>;
  scope?: InputMaybe<Array<Scalars['String']>>;
  teamId?: InputMaybe<Scalars['String']>;
};

export type ConfigAuthMethodOauthAzuread = {
  __typename?: 'ConfigAuthMethodOauthAzuread';
  clientId?: Maybe<Scalars['String']>;
  clientSecret?: Maybe<Scalars['String']>;
  enabled?: Maybe<Scalars['Boolean']>;
  tenant?: Maybe<Scalars['String']>;
};

export type ConfigAuthMethodOauthAzureadUpdateInput = {
  clientId?: InputMaybe<Scalars['String']>;
  clientSecret?: InputMaybe<Scalars['String']>;
  enabled?: InputMaybe<Scalars['Boolean']>;
  tenant?: InputMaybe<Scalars['String']>;
};

export type ConfigAuthMethodOauthTwitter = {
  __typename?: 'ConfigAuthMethodOauthTwitter';
  consumerKey?: Maybe<Scalars['String']>;
  consumerSecret?: Maybe<Scalars['String']>;
  enabled?: Maybe<Scalars['Boolean']>;
};

export type ConfigAuthMethodOauthTwitterUpdateInput = {
  consumerKey?: InputMaybe<Scalars['String']>;
  consumerSecret?: InputMaybe<Scalars['String']>;
  enabled?: InputMaybe<Scalars['Boolean']>;
};

export type ConfigAuthMethodOauthUpdateInput = {
  apple?: InputMaybe<ConfigAuthMethodOauthAppleUpdateInput>;
  azuread?: InputMaybe<ConfigAuthMethodOauthAzureadUpdateInput>;
  bitbucket?: InputMaybe<ConfigStandardOauthProviderUpdateInput>;
  discord?: InputMaybe<ConfigStandardOauthProviderWithScopeUpdateInput>;
  facebook?: InputMaybe<ConfigStandardOauthProviderWithScopeUpdateInput>;
  github?: InputMaybe<ConfigStandardOauthProviderWithScopeUpdateInput>;
  gitlab?: InputMaybe<ConfigStandardOauthProviderWithScopeUpdateInput>;
  google?: InputMaybe<ConfigStandardOauthProviderWithScopeUpdateInput>;
  linkedin?: InputMaybe<ConfigStandardOauthProviderWithScopeUpdateInput>;
  spotify?: InputMaybe<ConfigStandardOauthProviderWithScopeUpdateInput>;
  strava?: InputMaybe<ConfigStandardOauthProviderWithScopeUpdateInput>;
  twitch?: InputMaybe<ConfigStandardOauthProviderWithScopeUpdateInput>;
  twitter?: InputMaybe<ConfigAuthMethodOauthTwitterUpdateInput>;
  windowslive?: InputMaybe<ConfigStandardOauthProviderWithScopeUpdateInput>;
  workos?: InputMaybe<ConfigAuthMethodOauthWorkosUpdateInput>;
};

export type ConfigAuthMethodOauthWorkos = {
  __typename?: 'ConfigAuthMethodOauthWorkos';
  clientId?: Maybe<Scalars['String']>;
  clientSecret?: Maybe<Scalars['String']>;
  connection?: Maybe<Scalars['String']>;
  enabled?: Maybe<Scalars['Boolean']>;
  organization?: Maybe<Scalars['String']>;
};

export type ConfigAuthMethodOauthWorkosUpdateInput = {
  clientId?: InputMaybe<Scalars['String']>;
  clientSecret?: InputMaybe<Scalars['String']>;
  connection?: InputMaybe<Scalars['String']>;
  enabled?: InputMaybe<Scalars['Boolean']>;
  organization?: InputMaybe<Scalars['String']>;
};

export type ConfigAuthMethodSmsPasswordless = {
  __typename?: 'ConfigAuthMethodSmsPasswordless';
  enabled?: Maybe<Scalars['Boolean']>;
};

export type ConfigAuthMethodSmsPasswordlessUpdateInput = {
  enabled?: InputMaybe<Scalars['Boolean']>;
};

export type ConfigAuthMethodUpdateInput = {
  anonymous?: InputMaybe<ConfigAuthMethodAnonymousUpdateInput>;
  emailPassword?: InputMaybe<ConfigAuthMethodEmailPasswordUpdateInput>;
  emailPasswordless?: InputMaybe<ConfigAuthMethodEmailPasswordlessUpdateInput>;
  oauth?: InputMaybe<ConfigAuthMethodOauthUpdateInput>;
  smsPasswordless?: InputMaybe<ConfigAuthMethodSmsPasswordlessUpdateInput>;
  webauthn?: InputMaybe<ConfigAuthMethodWebauthnUpdateInput>;
};

export type ConfigAuthMethodWebauthn = {
  __typename?: 'ConfigAuthMethodWebauthn';
  attestation?: Maybe<ConfigAuthMethodWebauthnAttestation>;
  enabled?: Maybe<Scalars['Boolean']>;
  relyingParty?: Maybe<ConfigAuthMethodWebauthnRelyingParty>;
};

export type ConfigAuthMethodWebauthnAttestation = {
  __typename?: 'ConfigAuthMethodWebauthnAttestation';
  timeout?: Maybe<Scalars['ConfigUint32']>;
};

export type ConfigAuthMethodWebauthnAttestationUpdateInput = {
  timeout?: InputMaybe<Scalars['ConfigUint32']>;
};

export type ConfigAuthMethodWebauthnRelyingParty = {
  __typename?: 'ConfigAuthMethodWebauthnRelyingParty';
  name?: Maybe<Scalars['String']>;
  origins?: Maybe<Array<Scalars['ConfigUrl']>>;
};

export type ConfigAuthMethodWebauthnRelyingPartyUpdateInput = {
  name?: InputMaybe<Scalars['String']>;
  origins?: InputMaybe<Array<Scalars['ConfigUrl']>>;
};

export type ConfigAuthMethodWebauthnUpdateInput = {
  attestation?: InputMaybe<ConfigAuthMethodWebauthnAttestationUpdateInput>;
  enabled?: InputMaybe<Scalars['Boolean']>;
  relyingParty?: InputMaybe<ConfigAuthMethodWebauthnRelyingPartyUpdateInput>;
};

export type ConfigAuthRedirections = {
  __typename?: 'ConfigAuthRedirections';
  allowedUrls?: Maybe<Array<Scalars['String']>>;
  clientUrl?: Maybe<Scalars['ConfigUrl']>;
};

export type ConfigAuthRedirectionsUpdateInput = {
  allowedUrls?: InputMaybe<Array<Scalars['String']>>;
  clientUrl?: InputMaybe<Scalars['ConfigUrl']>;
};

export type ConfigAuthSession = {
  __typename?: 'ConfigAuthSession';
  accessToken?: Maybe<ConfigAuthSessionAccessToken>;
  refreshToken?: Maybe<ConfigAuthSessionRefreshToken>;
};

export type ConfigAuthSessionAccessToken = {
  __typename?: 'ConfigAuthSessionAccessToken';
  customClaims?: Maybe<Array<ConfigAuthsessionaccessTokenCustomClaims>>;
  expiresIn?: Maybe<Scalars['ConfigUint32']>;
};

export type ConfigAuthSessionAccessTokenUpdateInput = {
  customClaims?: InputMaybe<Array<ConfigAuthsessionaccessTokenCustomClaimsUpdateInput>>;
  expiresIn?: InputMaybe<Scalars['ConfigUint32']>;
};

export type ConfigAuthSessionRefreshToken = {
  __typename?: 'ConfigAuthSessionRefreshToken';
  expiresIn?: Maybe<Scalars['ConfigUint32']>;
};

export type ConfigAuthSessionRefreshTokenUpdateInput = {
  expiresIn?: InputMaybe<Scalars['ConfigUint32']>;
};

export type ConfigAuthSessionUpdateInput = {
  accessToken?: InputMaybe<ConfigAuthSessionAccessTokenUpdateInput>;
  refreshToken?: InputMaybe<ConfigAuthSessionRefreshTokenUpdateInput>;
};

export type ConfigAuthSignUp = {
  __typename?: 'ConfigAuthSignUp';
  enabled?: Maybe<Scalars['Boolean']>;
};

export type ConfigAuthSignUpUpdateInput = {
  enabled?: InputMaybe<Scalars['Boolean']>;
};

export type ConfigAuthTotp = {
  __typename?: 'ConfigAuthTotp';
  enabled?: Maybe<Scalars['Boolean']>;
  issuer?: Maybe<Scalars['String']>;
};

export type ConfigAuthTotpUpdateInput = {
  enabled?: InputMaybe<Scalars['Boolean']>;
  issuer?: InputMaybe<Scalars['String']>;
};

export type ConfigAuthUpdateInput = {
  method?: InputMaybe<ConfigAuthMethodUpdateInput>;
  redirections?: InputMaybe<ConfigAuthRedirectionsUpdateInput>;
  resources?: InputMaybe<ConfigResourcesUpdateInput>;
  session?: InputMaybe<ConfigAuthSessionUpdateInput>;
  signUp?: InputMaybe<ConfigAuthSignUpUpdateInput>;
  totp?: InputMaybe<ConfigAuthTotpUpdateInput>;
  user?: InputMaybe<ConfigAuthUserUpdateInput>;
  version?: InputMaybe<Scalars['String']>;
};

export type ConfigAuthUser = {
  __typename?: 'ConfigAuthUser';
  email?: Maybe<ConfigAuthUserEmail>;
  emailDomains?: Maybe<ConfigAuthUserEmailDomains>;
  gravatar?: Maybe<ConfigAuthUserGravatar>;
  locale?: Maybe<ConfigAuthUserLocale>;
  roles?: Maybe<ConfigAuthUserRoles>;
};

export type ConfigAuthUserEmail = {
  __typename?: 'ConfigAuthUserEmail';
  allowed?: Maybe<Array<Scalars['ConfigEmail']>>;
  blocked?: Maybe<Array<Scalars['ConfigEmail']>>;
};

export type ConfigAuthUserEmailDomains = {
  __typename?: 'ConfigAuthUserEmailDomains';
  allowed?: Maybe<Array<Scalars['String']>>;
  blocked?: Maybe<Array<Scalars['String']>>;
};

export type ConfigAuthUserEmailDomainsUpdateInput = {
  allowed?: InputMaybe<Array<Scalars['String']>>;
  blocked?: InputMaybe<Array<Scalars['String']>>;
};

export type ConfigAuthUserEmailUpdateInput = {
  allowed?: InputMaybe<Array<Scalars['ConfigEmail']>>;
  blocked?: InputMaybe<Array<Scalars['ConfigEmail']>>;
};

export type ConfigAuthUserGravatar = {
  __typename?: 'ConfigAuthUserGravatar';
  default?: Maybe<Scalars['String']>;
  enabled?: Maybe<Scalars['Boolean']>;
  rating?: Maybe<Scalars['String']>;
};

export type ConfigAuthUserGravatarUpdateInput = {
  default?: InputMaybe<Scalars['String']>;
  enabled?: InputMaybe<Scalars['Boolean']>;
  rating?: InputMaybe<Scalars['String']>;
};

export type ConfigAuthUserLocale = {
  __typename?: 'ConfigAuthUserLocale';
  allowed?: Maybe<Array<Scalars['ConfigLocale']>>;
  default?: Maybe<Scalars['ConfigLocale']>;
};

export type ConfigAuthUserLocaleUpdateInput = {
  allowed?: InputMaybe<Array<Scalars['ConfigLocale']>>;
  default?: InputMaybe<Scalars['ConfigLocale']>;
};

export type ConfigAuthUserRoles = {
  __typename?: 'ConfigAuthUserRoles';
  allowed?: Maybe<Array<Scalars['ConfigUserRole']>>;
  default?: Maybe<Scalars['ConfigUserRole']>;
};

export type ConfigAuthUserRolesUpdateInput = {
  allowed?: InputMaybe<Array<Scalars['ConfigUserRole']>>;
  default?: InputMaybe<Scalars['ConfigUserRole']>;
};

export type ConfigAuthUserUpdateInput = {
  email?: InputMaybe<ConfigAuthUserEmailUpdateInput>;
  emailDomains?: InputMaybe<ConfigAuthUserEmailDomainsUpdateInput>;
  gravatar?: InputMaybe<ConfigAuthUserGravatarUpdateInput>;
  locale?: InputMaybe<ConfigAuthUserLocaleUpdateInput>;
  roles?: InputMaybe<ConfigAuthUserRolesUpdateInput>;
};

export type ConfigAuthsessionaccessTokenCustomClaims = {
  __typename?: 'ConfigAuthsessionaccessTokenCustomClaims';
  key: Scalars['String'];
  value: Scalars['String'];
};

export type ConfigAuthsessionaccessTokenCustomClaimsUpdateInput = {
  key?: InputMaybe<Scalars['String']>;
  value?: InputMaybe<Scalars['String']>;
};

export type ConfigClaimMap = {
  __typename?: 'ConfigClaimMap';
  claim: Scalars['String'];
  default?: Maybe<Scalars['String']>;
  path?: Maybe<Scalars['String']>;
  value?: Maybe<Scalars['String']>;
};

export type ConfigClaimMapUpdateInput = {
  claim?: InputMaybe<Scalars['String']>;
  default?: InputMaybe<Scalars['String']>;
  path?: InputMaybe<Scalars['String']>;
  value?: InputMaybe<Scalars['String']>;
};

export type ConfigConfig = {
  __typename?: 'ConfigConfig';
  auth?: Maybe<ConfigAuth>;
  functions?: Maybe<ConfigFunctions>;
  global?: Maybe<ConfigGlobal>;
  hasura: ConfigHasura;
  observability: ConfigObservability;
  postgres?: Maybe<ConfigPostgres>;
  provider?: Maybe<ConfigProvider>;
  storage?: Maybe<ConfigStorage>;
};

export type ConfigConfigUpdateInput = {
  auth?: InputMaybe<ConfigAuthUpdateInput>;
  functions?: InputMaybe<ConfigFunctionsUpdateInput>;
  global?: InputMaybe<ConfigGlobalUpdateInput>;
  hasura?: InputMaybe<ConfigHasuraUpdateInput>;
  observability?: InputMaybe<ConfigObservabilityUpdateInput>;
  postgres?: InputMaybe<ConfigPostgresUpdateInput>;
  provider?: InputMaybe<ConfigProviderUpdateInput>;
  storage?: InputMaybe<ConfigStorageUpdateInput>;
};

export type ConfigEnvironmentVariable = {
  __typename?: 'ConfigEnvironmentVariable';
  name: Scalars['String'];
  value: Scalars['String'];
};

export type ConfigEnvironmentVariableInsertInput = {
  name: Scalars['String'];
  value: Scalars['String'];
};

export type ConfigEnvironmentVariableUpdateInput = {
  name?: InputMaybe<Scalars['String']>;
  value?: InputMaybe<Scalars['String']>;
};

export type ConfigFunctions = {
  __typename?: 'ConfigFunctions';
  node?: Maybe<ConfigFunctionsNode>;
};

export type ConfigFunctionsNode = {
  __typename?: 'ConfigFunctionsNode';
  version?: Maybe<Scalars['Int']>;
};

export type ConfigFunctionsNodeUpdateInput = {
  version?: InputMaybe<Scalars['Int']>;
};

export type ConfigFunctionsUpdateInput = {
  node?: InputMaybe<ConfigFunctionsNodeUpdateInput>;
};

export type ConfigGlobal = {
  __typename?: 'ConfigGlobal';
  environment?: Maybe<Array<ConfigEnvironmentVariable>>;
};

export type ConfigGlobalUpdateInput = {
  environment?: InputMaybe<Array<ConfigEnvironmentVariableUpdateInput>>;
};

export type ConfigGrafana = {
  __typename?: 'ConfigGrafana';
  adminPassword: Scalars['String'];
};

export type ConfigGrafanaUpdateInput = {
  adminPassword?: InputMaybe<Scalars['String']>;
};

export type ConfigHasura = {
  __typename?: 'ConfigHasura';
  adminSecret: Scalars['String'];
  events?: Maybe<ConfigHasuraEvents>;
  jwtSecrets?: Maybe<Array<ConfigJwtSecret>>;
  logs?: Maybe<ConfigHasuraLogs>;
  resources?: Maybe<ConfigResources>;
  settings?: Maybe<ConfigHasuraSettings>;
  version?: Maybe<Scalars['String']>;
  webhookSecret: Scalars['String'];
};

export type ConfigHasuraEvents = {
  __typename?: 'ConfigHasuraEvents';
  httpPoolSize?: Maybe<Scalars['ConfigUint32']>;
};

export type ConfigHasuraEventsUpdateInput = {
  httpPoolSize?: InputMaybe<Scalars['ConfigUint32']>;
};

export type ConfigHasuraLogs = {
  __typename?: 'ConfigHasuraLogs';
  level?: Maybe<Scalars['String']>;
};

export type ConfigHasuraLogsUpdateInput = {
  level?: InputMaybe<Scalars['String']>;
};

export type ConfigHasuraSettings = {
  __typename?: 'ConfigHasuraSettings';
  corsDomain?: Maybe<Array<Scalars['ConfigUrl']>>;
  devMode?: Maybe<Scalars['Boolean']>;
  enableAllowList?: Maybe<Scalars['Boolean']>;
  enableConsole?: Maybe<Scalars['Boolean']>;
  enableRemoteSchemaPermissions?: Maybe<Scalars['Boolean']>;
  enabledAPIs?: Maybe<Array<Scalars['ConfigHasuraAPIs']>>;
};

export type ConfigHasuraSettingsUpdateInput = {
  corsDomain?: InputMaybe<Array<Scalars['ConfigUrl']>>;
  devMode?: InputMaybe<Scalars['Boolean']>;
  enableAllowList?: InputMaybe<Scalars['Boolean']>;
  enableConsole?: InputMaybe<Scalars['Boolean']>;
  enableRemoteSchemaPermissions?: InputMaybe<Scalars['Boolean']>;
  enabledAPIs?: InputMaybe<Array<Scalars['ConfigHasuraAPIs']>>;
};

export type ConfigHasuraUpdateInput = {
  adminSecret?: InputMaybe<Scalars['String']>;
  events?: InputMaybe<ConfigHasuraEventsUpdateInput>;
  jwtSecrets?: InputMaybe<Array<ConfigJwtSecretUpdateInput>>;
  logs?: InputMaybe<ConfigHasuraLogsUpdateInput>;
  resources?: InputMaybe<ConfigResourcesUpdateInput>;
  settings?: InputMaybe<ConfigHasuraSettingsUpdateInput>;
  version?: InputMaybe<Scalars['String']>;
  webhookSecret?: InputMaybe<Scalars['String']>;
};

export type ConfigJwtSecret = {
  __typename?: 'ConfigJWTSecret';
  allowed_skew?: Maybe<Scalars['ConfigUint32']>;
  audience?: Maybe<Scalars['String']>;
  claims_format?: Maybe<Scalars['String']>;
  claims_map?: Maybe<Array<ConfigClaimMap>>;
  claims_namespace?: Maybe<Scalars['String']>;
  claims_namespace_path?: Maybe<Scalars['String']>;
  header?: Maybe<Scalars['String']>;
  issuer?: Maybe<Scalars['String']>;
  jwk_url?: Maybe<Scalars['ConfigUrl']>;
  key?: Maybe<Scalars['String']>;
  type?: Maybe<Scalars['String']>;
};

export type ConfigJwtSecretUpdateInput = {
  allowed_skew?: InputMaybe<Scalars['ConfigUint32']>;
  audience?: InputMaybe<Scalars['String']>;
  claims_format?: InputMaybe<Scalars['String']>;
  claims_map?: InputMaybe<Array<ConfigClaimMapUpdateInput>>;
  claims_namespace?: InputMaybe<Scalars['String']>;
  claims_namespace_path?: InputMaybe<Scalars['String']>;
  header?: InputMaybe<Scalars['String']>;
  issuer?: InputMaybe<Scalars['String']>;
  jwk_url?: InputMaybe<Scalars['ConfigUrl']>;
  key?: InputMaybe<Scalars['String']>;
  type?: InputMaybe<Scalars['String']>;
};

export type ConfigObservability = {
  __typename?: 'ConfigObservability';
  grafana: ConfigGrafana;
};

export type ConfigObservabilityUpdateInput = {
  grafana?: InputMaybe<ConfigGrafanaUpdateInput>;
};

export type ConfigPostgres = {
  __typename?: 'ConfigPostgres';
  resources?: Maybe<ConfigResources>;
  version?: Maybe<Scalars['String']>;
};

export type ConfigPostgresUpdateInput = {
  resources?: InputMaybe<ConfigResourcesUpdateInput>;
  version?: InputMaybe<Scalars['String']>;
};

export type ConfigProvider = {
  __typename?: 'ConfigProvider';
  sms?: Maybe<ConfigSms>;
  smtp?: Maybe<ConfigSmtp>;
};

export type ConfigProviderUpdateInput = {
  sms?: InputMaybe<ConfigSmsUpdateInput>;
  smtp?: InputMaybe<ConfigSmtpUpdateInput>;
};

export type ConfigResources = {
  __typename?: 'ConfigResources';
  compute: ConfigResourcesCompute;
  replicas: Scalars['ConfigUint8'];
};

export type ConfigResourcesCompute = {
  __typename?: 'ConfigResourcesCompute';
  cpu: Scalars['ConfigUint32'];
  memory: Scalars['ConfigUint32'];
};

export type ConfigResourcesComputeUpdateInput = {
  cpu?: InputMaybe<Scalars['ConfigUint32']>;
  memory?: InputMaybe<Scalars['ConfigUint32']>;
};

export type ConfigResourcesUpdateInput = {
  compute?: InputMaybe<ConfigResourcesComputeUpdateInput>;
  replicas?: InputMaybe<Scalars['ConfigUint8']>;
};

export type ConfigRunServiceConfig = {
  __typename?: 'ConfigRunServiceConfig';
  command?: Maybe<Array<Scalars['String']>>;
  environment?: Maybe<Array<ConfigEnvironmentVariable>>;
  image: ConfigRunServiceImage;
  name: Scalars['String'];
  ports?: Maybe<Array<ConfigRunServicePort>>;
  resources: ConfigRunServiceResources;
};

export type ConfigRunServiceConfigInsertInput = {
  command?: InputMaybe<Array<Scalars['String']>>;
  environment?: InputMaybe<Array<ConfigEnvironmentVariableInsertInput>>;
  image: ConfigRunServiceImageInsertInput;
  name: Scalars['String'];
  ports?: InputMaybe<Array<ConfigRunServicePortInsertInput>>;
  resources: ConfigRunServiceResourcesInsertInput;
};

export type ConfigRunServiceConfigUpdateInput = {
  command?: InputMaybe<Array<Scalars['String']>>;
  environment?: InputMaybe<Array<ConfigEnvironmentVariableUpdateInput>>;
  image?: InputMaybe<ConfigRunServiceImageUpdateInput>;
  name?: InputMaybe<Scalars['String']>;
  ports?: InputMaybe<Array<ConfigRunServicePortUpdateInput>>;
  resources?: InputMaybe<ConfigRunServiceResourcesUpdateInput>;
};

export type ConfigRunServiceImage = {
  __typename?: 'ConfigRunServiceImage';
  image: Scalars['String'];
};

export type ConfigRunServiceImageInsertInput = {
  image: Scalars['String'];
};

export type ConfigRunServiceImageUpdateInput = {
  image?: InputMaybe<Scalars['String']>;
};

export type ConfigRunServicePort = {
  __typename?: 'ConfigRunServicePort';
  port: Scalars['ConfigPort'];
  publish?: Maybe<Scalars['Boolean']>;
  type: Scalars['String'];
};

export type ConfigRunServicePortInsertInput = {
  port: Scalars['ConfigPort'];
  publish?: InputMaybe<Scalars['Boolean']>;
  type: Scalars['String'];
};

export type ConfigRunServicePortUpdateInput = {
  port?: InputMaybe<Scalars['ConfigPort']>;
  publish?: InputMaybe<Scalars['Boolean']>;
  type?: InputMaybe<Scalars['String']>;
};

export type ConfigRunServiceResources = {
  __typename?: 'ConfigRunServiceResources';
  compute: ConfigRunServiceResourcesCompute;
  replicas: Scalars['ConfigUint8'];
  storage?: Maybe<Array<ConfigRunServiceResourcesStorage>>;
};

export type ConfigRunServiceResourcesCompute = {
  __typename?: 'ConfigRunServiceResourcesCompute';
  cpu: Scalars['ConfigUint32'];
  memory: Scalars['ConfigUint32'];
};

export type ConfigRunServiceResourcesComputeInsertInput = {
  cpu: Scalars['ConfigUint32'];
  memory: Scalars['ConfigUint32'];
};

export type ConfigRunServiceResourcesComputeUpdateInput = {
  cpu?: InputMaybe<Scalars['ConfigUint32']>;
  memory?: InputMaybe<Scalars['ConfigUint32']>;
};

export type ConfigRunServiceResourcesInsertInput = {
  compute: ConfigRunServiceResourcesComputeInsertInput;
  replicas: Scalars['ConfigUint8'];
  storage?: InputMaybe<Array<ConfigRunServiceResourcesStorageInsertInput>>;
};

export type ConfigRunServiceResourcesStorage = {
  __typename?: 'ConfigRunServiceResourcesStorage';
  capacity: Scalars['ConfigUint32'];
  name: Scalars['String'];
  path: Scalars['String'];
};

export type ConfigRunServiceResourcesStorageInsertInput = {
  capacity: Scalars['ConfigUint32'];
  name: Scalars['String'];
  path: Scalars['String'];
};

export type ConfigRunServiceResourcesStorageUpdateInput = {
  capacity?: InputMaybe<Scalars['ConfigUint32']>;
  name?: InputMaybe<Scalars['String']>;
  path?: InputMaybe<Scalars['String']>;
};

export type ConfigRunServiceResourcesUpdateInput = {
  compute?: InputMaybe<ConfigRunServiceResourcesComputeUpdateInput>;
  replicas?: InputMaybe<Scalars['ConfigUint8']>;
  storage?: InputMaybe<Array<ConfigRunServiceResourcesStorageUpdateInput>>;
};

export type ConfigSms = {
  __typename?: 'ConfigSms';
  accountSid: Scalars['String'];
  authToken: Scalars['String'];
  messagingServiceId: Scalars['String'];
  provider?: Maybe<Scalars['String']>;
};

export type ConfigSmsUpdateInput = {
  accountSid?: InputMaybe<Scalars['String']>;
  authToken?: InputMaybe<Scalars['String']>;
  messagingServiceId?: InputMaybe<Scalars['String']>;
  provider?: InputMaybe<Scalars['String']>;
};

export type ConfigSmtp = {
  __typename?: 'ConfigSmtp';
  host: Scalars['String'];
  method: Scalars['String'];
  password: Scalars['String'];
  port: Scalars['ConfigPort'];
  secure: Scalars['Boolean'];
  sender: Scalars['String'];
  user: Scalars['String'];
};

export type ConfigSmtpUpdateInput = {
  host?: InputMaybe<Scalars['String']>;
  method?: InputMaybe<Scalars['String']>;
  password?: InputMaybe<Scalars['String']>;
  port?: InputMaybe<Scalars['ConfigPort']>;
  secure?: InputMaybe<Scalars['Boolean']>;
  sender?: InputMaybe<Scalars['String']>;
  user?: InputMaybe<Scalars['String']>;
};

export type ConfigStandardOauthProvider = {
  __typename?: 'ConfigStandardOauthProvider';
  clientId?: Maybe<Scalars['String']>;
  clientSecret?: Maybe<Scalars['String']>;
  enabled?: Maybe<Scalars['Boolean']>;
};

export type ConfigStandardOauthProviderUpdateInput = {
  clientId?: InputMaybe<Scalars['String']>;
  clientSecret?: InputMaybe<Scalars['String']>;
  enabled?: InputMaybe<Scalars['Boolean']>;
};

export type ConfigStandardOauthProviderWithScope = {
  __typename?: 'ConfigStandardOauthProviderWithScope';
  clientId?: Maybe<Scalars['String']>;
  clientSecret?: Maybe<Scalars['String']>;
  enabled?: Maybe<Scalars['Boolean']>;
  scope?: Maybe<Array<Scalars['String']>>;
};

export type ConfigStandardOauthProviderWithScopeUpdateInput = {
  clientId?: InputMaybe<Scalars['String']>;
  clientSecret?: InputMaybe<Scalars['String']>;
  enabled?: InputMaybe<Scalars['Boolean']>;
  scope?: InputMaybe<Array<Scalars['String']>>;
};

export type ConfigStorage = {
  __typename?: 'ConfigStorage';
  resources?: Maybe<ConfigResources>;
  version?: Maybe<Scalars['String']>;
};

export type ConfigStorageUpdateInput = {
  resources?: InputMaybe<ConfigResourcesUpdateInput>;
  version?: InputMaybe<Scalars['String']>;
};

export type ConfigSystemConfig = {
  __typename?: 'ConfigSystemConfig';
  auth?: Maybe<ConfigSystemConfigAuth>;
  postgres: ConfigSystemConfigPostgres;
};

export type ConfigSystemConfigAuth = {
  __typename?: 'ConfigSystemConfigAuth';
  email?: Maybe<ConfigSystemConfigAuthEmail>;
};

export type ConfigSystemConfigAuthEmail = {
  __typename?: 'ConfigSystemConfigAuthEmail';
  templates?: Maybe<ConfigSystemConfigAuthEmailTemplates>;
};

export type ConfigSystemConfigAuthEmailTemplates = {
  __typename?: 'ConfigSystemConfigAuthEmailTemplates';
  s3Key?: Maybe<Scalars['String']>;
};

export type ConfigSystemConfigPostgres = {
  __typename?: 'ConfigSystemConfigPostgres';
  connectionString: ConfigSystemConfigPostgresConnectionString;
  database: Scalars['String'];
  enabled?: Maybe<Scalars['Boolean']>;
};

export type ConfigSystemConfigPostgresConnectionString = {
  __typename?: 'ConfigSystemConfigPostgresConnectionString';
  auth: Scalars['String'];
  backup: Scalars['String'];
  hasura: Scalars['String'];
  storage: Scalars['String'];
};

/** Boolean expression to compare columns of type "Int". All fields are combined with logical 'AND'. */
export type Int_Comparison_Exp = {
  _eq?: InputMaybe<Scalars['Int']>;
  _gt?: InputMaybe<Scalars['Int']>;
  _gte?: InputMaybe<Scalars['Int']>;
  _in?: InputMaybe<Array<Scalars['Int']>>;
  _is_null?: InputMaybe<Scalars['Boolean']>;
  _lt?: InputMaybe<Scalars['Int']>;
  _lte?: InputMaybe<Scalars['Int']>;
  _neq?: InputMaybe<Scalars['Int']>;
  _nin?: InputMaybe<Array<Scalars['Int']>>;
};

export type Log = {
  __typename?: 'Log';
  log: Scalars['String'];
  service: Scalars['String'];
  timestamp: Scalars['Timestamp'];
};

export type Metrics = {
  __typename?: 'Metrics';
  value: Scalars['float64'];
};

/** Boolean expression to compare columns of type "String". All fields are combined with logical 'AND'. */
export type String_Comparison_Exp = {
  _eq?: InputMaybe<Scalars['String']>;
  _gt?: InputMaybe<Scalars['String']>;
  _gte?: InputMaybe<Scalars['String']>;
  /** does the column match the given case-insensitive pattern */
  _ilike?: InputMaybe<Scalars['String']>;
  _in?: InputMaybe<Array<Scalars['String']>>;
  /** does the column match the given POSIX regular expression, case insensitive */
  _iregex?: InputMaybe<Scalars['String']>;
  _is_null?: InputMaybe<Scalars['Boolean']>;
  /** does the column match the given pattern */
  _like?: InputMaybe<Scalars['String']>;
  _lt?: InputMaybe<Scalars['String']>;
  _lte?: InputMaybe<Scalars['String']>;
  _neq?: InputMaybe<Scalars['String']>;
  /** does the column NOT match the given case-insensitive pattern */
  _nilike?: InputMaybe<Scalars['String']>;
  _nin?: InputMaybe<Array<Scalars['String']>>;
  /** does the column NOT match the given POSIX regular expression, case insensitive */
  _niregex?: InputMaybe<Scalars['String']>;
  /** does the column NOT match the given pattern */
  _nlike?: InputMaybe<Scalars['String']>;
  /** does the column NOT match the given POSIX regular expression, case sensitive */
  _nregex?: InputMaybe<Scalars['String']>;
  /** does the column NOT match the given SQL regular expression */
  _nsimilar?: InputMaybe<Scalars['String']>;
  /** does the column match the given POSIX regular expression, case sensitive */
  _regex?: InputMaybe<Scalars['String']>;
  /** does the column match the given SQL regular expression */
  _similar?: InputMaybe<Scalars['String']>;
};

/** columns and relationships of "app_state_history" */
export type AppStateHistory = {
  __typename?: 'appStateHistory';
  /** An object relationship */
  app: Apps;
  appId: Scalars['uuid'];
  createdAt: Scalars['timestamptz'];
  id: Scalars['uuid'];
  message?: Maybe<Scalars['String']>;
  stateId: Scalars['Int'];
};

/** order by aggregate values of table "app_state_history" */
export type AppStateHistory_Aggregate_Order_By = {
  avg?: InputMaybe<AppStateHistory_Avg_Order_By>;
  count?: InputMaybe<Order_By>;
  max?: InputMaybe<AppStateHistory_Max_Order_By>;
  min?: InputMaybe<AppStateHistory_Min_Order_By>;
  stddev?: InputMaybe<AppStateHistory_Stddev_Order_By>;
  stddev_pop?: InputMaybe<AppStateHistory_Stddev_Pop_Order_By>;
  stddev_samp?: InputMaybe<AppStateHistory_Stddev_Samp_Order_By>;
  sum?: InputMaybe<AppStateHistory_Sum_Order_By>;
  var_pop?: InputMaybe<AppStateHistory_Var_Pop_Order_By>;
  var_samp?: InputMaybe<AppStateHistory_Var_Samp_Order_By>;
  variance?: InputMaybe<AppStateHistory_Variance_Order_By>;
};

/** order by avg() on columns of table "app_state_history" */
export type AppStateHistory_Avg_Order_By = {
  stateId?: InputMaybe<Order_By>;
};

/** Boolean expression to filter rows from the table "app_state_history". All fields are combined with a logical 'AND'. */
export type AppStateHistory_Bool_Exp = {
  _and?: InputMaybe<Array<AppStateHistory_Bool_Exp>>;
  _not?: InputMaybe<AppStateHistory_Bool_Exp>;
  _or?: InputMaybe<Array<AppStateHistory_Bool_Exp>>;
  app?: InputMaybe<Apps_Bool_Exp>;
  appId?: InputMaybe<Uuid_Comparison_Exp>;
  createdAt?: InputMaybe<Timestamptz_Comparison_Exp>;
  id?: InputMaybe<Uuid_Comparison_Exp>;
  message?: InputMaybe<String_Comparison_Exp>;
  stateId?: InputMaybe<Int_Comparison_Exp>;
};

/** order by max() on columns of table "app_state_history" */
export type AppStateHistory_Max_Order_By = {
  appId?: InputMaybe<Order_By>;
  createdAt?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  message?: InputMaybe<Order_By>;
  stateId?: InputMaybe<Order_By>;
};

/** order by min() on columns of table "app_state_history" */
export type AppStateHistory_Min_Order_By = {
  appId?: InputMaybe<Order_By>;
  createdAt?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  message?: InputMaybe<Order_By>;
  stateId?: InputMaybe<Order_By>;
};

/** Ordering options when selecting data from "app_state_history". */
export type AppStateHistory_Order_By = {
  app?: InputMaybe<Apps_Order_By>;
  appId?: InputMaybe<Order_By>;
  createdAt?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  message?: InputMaybe<Order_By>;
  stateId?: InputMaybe<Order_By>;
};

/** select columns of table "app_state_history" */
export enum AppStateHistory_Select_Column {
  /** column name */
  AppId = 'appId',
  /** column name */
  CreatedAt = 'createdAt',
  /** column name */
  Id = 'id',
  /** column name */
  Message = 'message',
  /** column name */
  StateId = 'stateId'
}

/** order by stddev() on columns of table "app_state_history" */
export type AppStateHistory_Stddev_Order_By = {
  stateId?: InputMaybe<Order_By>;
};

/** order by stddev_pop() on columns of table "app_state_history" */
export type AppStateHistory_Stddev_Pop_Order_By = {
  stateId?: InputMaybe<Order_By>;
};

/** order by stddev_samp() on columns of table "app_state_history" */
export type AppStateHistory_Stddev_Samp_Order_By = {
  stateId?: InputMaybe<Order_By>;
};

/** Streaming cursor of the table "appStateHistory" */
export type AppStateHistory_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: AppStateHistory_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type AppStateHistory_Stream_Cursor_Value_Input = {
  appId?: InputMaybe<Scalars['uuid']>;
  createdAt?: InputMaybe<Scalars['timestamptz']>;
  id?: InputMaybe<Scalars['uuid']>;
  message?: InputMaybe<Scalars['String']>;
  stateId?: InputMaybe<Scalars['Int']>;
};

/** order by sum() on columns of table "app_state_history" */
export type AppStateHistory_Sum_Order_By = {
  stateId?: InputMaybe<Order_By>;
};

/** order by var_pop() on columns of table "app_state_history" */
export type AppStateHistory_Var_Pop_Order_By = {
  stateId?: InputMaybe<Order_By>;
};

/** order by var_samp() on columns of table "app_state_history" */
export type AppStateHistory_Var_Samp_Order_By = {
  stateId?: InputMaybe<Order_By>;
};

/** order by variance() on columns of table "app_state_history" */
export type AppStateHistory_Variance_Order_By = {
  stateId?: InputMaybe<Order_By>;
};

/** columns and relationships of "apps" */
export type Apps = {
  __typename?: 'apps';
  appSecrets: Array<ConfigEnvironmentVariable>;
  /** An array relationship */
  appStates: Array<AppStateHistory>;
  /** An array relationship */
  backups: Array<Backups>;
  config?: Maybe<ConfigConfig>;
  createdAt: Scalars['timestamptz'];
  /** An object relationship */
  creator?: Maybe<Users>;
  creatorUserId?: Maybe<Scalars['uuid']>;
  /** An array relationship */
  deployments: Array<Deployments>;
  desiredState: Scalars['Int'];
  /** An array relationship */
  featureFlags: Array<FeatureFlags>;
  /** An object relationship */
  githubRepository?: Maybe<GithubRepositories>;
  githubRepositoryId?: Maybe<Scalars['uuid']>;
  id: Scalars['uuid'];
  isProvisioned: Scalars['Boolean'];
  metadataFunctions: Scalars['jsonb'];
  name: Scalars['String'];
  nhostBaseFolder: Scalars['String'];
  /** An object relationship */
  plan: Plans;
  providersUpdated?: Maybe<Scalars['Boolean']>;
  /** An object relationship */
  region: Regions;
  repositoryProductionBranch: Scalars['String'];
  /** An array relationship */
  runServices: Array<Run_Service>;
  /** An aggregate relationship */
  runServices_aggregate: Run_Service_Aggregate;
  slug: Scalars['String'];
  subdomain: Scalars['String'];
  systemConfig?: Maybe<ConfigSystemConfig>;
  updatedAt: Scalars['timestamptz'];
  /** An object relationship */
  workspace: Workspaces;
  workspaceId: Scalars['uuid'];
};


/** columns and relationships of "apps" */
export type AppsAppStatesArgs = {
  distinct_on?: InputMaybe<Array<AppStateHistory_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<AppStateHistory_Order_By>>;
  where?: InputMaybe<AppStateHistory_Bool_Exp>;
};


/** columns and relationships of "apps" */
export type AppsBackupsArgs = {
  distinct_on?: InputMaybe<Array<Backups_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<Backups_Order_By>>;
  where?: InputMaybe<Backups_Bool_Exp>;
};


/** columns and relationships of "apps" */
export type AppsConfigArgs = {
  resolve: Scalars['Boolean'];
};


/** columns and relationships of "apps" */
export type AppsDeploymentsArgs = {
  distinct_on?: InputMaybe<Array<Deployments_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<Deployments_Order_By>>;
  where?: InputMaybe<Deployments_Bool_Exp>;
};


/** columns and relationships of "apps" */
export type AppsFeatureFlagsArgs = {
  distinct_on?: InputMaybe<Array<FeatureFlags_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<FeatureFlags_Order_By>>;
  where?: InputMaybe<FeatureFlags_Bool_Exp>;
};


/** columns and relationships of "apps" */
export type AppsMetadataFunctionsArgs = {
  path?: InputMaybe<Scalars['String']>;
};


/** columns and relationships of "apps" */
export type AppsRunServicesArgs = {
  distinct_on?: InputMaybe<Array<Run_Service_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<Run_Service_Order_By>>;
  where?: InputMaybe<Run_Service_Bool_Exp>;
};


/** columns and relationships of "apps" */
export type AppsRunServices_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Run_Service_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<Run_Service_Order_By>>;
  where?: InputMaybe<Run_Service_Bool_Exp>;
};

/** order by aggregate values of table "apps" */
export type Apps_Aggregate_Order_By = {
  avg?: InputMaybe<Apps_Avg_Order_By>;
  count?: InputMaybe<Order_By>;
  max?: InputMaybe<Apps_Max_Order_By>;
  min?: InputMaybe<Apps_Min_Order_By>;
  stddev?: InputMaybe<Apps_Stddev_Order_By>;
  stddev_pop?: InputMaybe<Apps_Stddev_Pop_Order_By>;
  stddev_samp?: InputMaybe<Apps_Stddev_Samp_Order_By>;
  sum?: InputMaybe<Apps_Sum_Order_By>;
  var_pop?: InputMaybe<Apps_Var_Pop_Order_By>;
  var_samp?: InputMaybe<Apps_Var_Samp_Order_By>;
  variance?: InputMaybe<Apps_Variance_Order_By>;
};

/** input type for inserting array relation for remote table "apps" */
export type Apps_Arr_Rel_Insert_Input = {
  data: Array<Apps_Insert_Input>;
  /** upsert condition */
  on_conflict?: InputMaybe<Apps_On_Conflict>;
};

/** order by avg() on columns of table "apps" */
export type Apps_Avg_Order_By = {
  desiredState?: InputMaybe<Order_By>;
};

/** Boolean expression to filter rows from the table "apps". All fields are combined with a logical 'AND'. */
export type Apps_Bool_Exp = {
  _and?: InputMaybe<Array<Apps_Bool_Exp>>;
  _not?: InputMaybe<Apps_Bool_Exp>;
  _or?: InputMaybe<Array<Apps_Bool_Exp>>;
  appStates?: InputMaybe<AppStateHistory_Bool_Exp>;
  backups?: InputMaybe<Backups_Bool_Exp>;
  createdAt?: InputMaybe<Timestamptz_Comparison_Exp>;
  creator?: InputMaybe<Users_Bool_Exp>;
  creatorUserId?: InputMaybe<Uuid_Comparison_Exp>;
  deployments?: InputMaybe<Deployments_Bool_Exp>;
  desiredState?: InputMaybe<Int_Comparison_Exp>;
  featureFlags?: InputMaybe<FeatureFlags_Bool_Exp>;
  githubRepository?: InputMaybe<GithubRepositories_Bool_Exp>;
  githubRepositoryId?: InputMaybe<Uuid_Comparison_Exp>;
  id?: InputMaybe<Uuid_Comparison_Exp>;
  isProvisioned?: InputMaybe<Boolean_Comparison_Exp>;
  metadataFunctions?: InputMaybe<Jsonb_Comparison_Exp>;
  name?: InputMaybe<String_Comparison_Exp>;
  nhostBaseFolder?: InputMaybe<String_Comparison_Exp>;
  plan?: InputMaybe<Plans_Bool_Exp>;
  providersUpdated?: InputMaybe<Boolean_Comparison_Exp>;
  region?: InputMaybe<Regions_Bool_Exp>;
  repositoryProductionBranch?: InputMaybe<String_Comparison_Exp>;
  runServices?: InputMaybe<Run_Service_Bool_Exp>;
  runServices_aggregate?: InputMaybe<Run_Service_Aggregate_Bool_Exp>;
  slug?: InputMaybe<String_Comparison_Exp>;
  subdomain?: InputMaybe<String_Comparison_Exp>;
  updatedAt?: InputMaybe<Timestamptz_Comparison_Exp>;
  workspace?: InputMaybe<Workspaces_Bool_Exp>;
  workspaceId?: InputMaybe<Uuid_Comparison_Exp>;
};

/** unique or primary key constraints on table "apps" */
export enum Apps_Constraint {
  /** unique or primary key constraint on columns "id" */
  AppsPkey = 'apps_pkey',
  /** unique or primary key constraint on columns "subdomain" */
  AppsSubdomainKey = 'apps_subdomain_key',
  /** unique or primary key constraint on columns "workspace_id", "slug" */
  AppsWorkspaceIdSlugKey = 'apps_workspace_id_slug_key'
}

/** input type for incrementing numeric columns in table "apps" */
export type Apps_Inc_Input = {
  desiredState?: InputMaybe<Scalars['Int']>;
};

/** input type for inserting data into table "apps" */
export type Apps_Insert_Input = {
  deployments?: InputMaybe<Deployments_Arr_Rel_Insert_Input>;
  featureFlags?: InputMaybe<FeatureFlags_Arr_Rel_Insert_Input>;
  name?: InputMaybe<Scalars['String']>;
  planId?: InputMaybe<Scalars['uuid']>;
  regionId?: InputMaybe<Scalars['uuid']>;
  runServices?: InputMaybe<Run_Service_Arr_Rel_Insert_Input>;
  slug?: InputMaybe<Scalars['String']>;
  workspace?: InputMaybe<Workspaces_Obj_Rel_Insert_Input>;
  workspaceId?: InputMaybe<Scalars['uuid']>;
};

/** order by max() on columns of table "apps" */
export type Apps_Max_Order_By = {
  createdAt?: InputMaybe<Order_By>;
  creatorUserId?: InputMaybe<Order_By>;
  desiredState?: InputMaybe<Order_By>;
  githubRepositoryId?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  name?: InputMaybe<Order_By>;
  nhostBaseFolder?: InputMaybe<Order_By>;
  repositoryProductionBranch?: InputMaybe<Order_By>;
  slug?: InputMaybe<Order_By>;
  subdomain?: InputMaybe<Order_By>;
  updatedAt?: InputMaybe<Order_By>;
  workspaceId?: InputMaybe<Order_By>;
};

/** order by min() on columns of table "apps" */
export type Apps_Min_Order_By = {
  createdAt?: InputMaybe<Order_By>;
  creatorUserId?: InputMaybe<Order_By>;
  desiredState?: InputMaybe<Order_By>;
  githubRepositoryId?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  name?: InputMaybe<Order_By>;
  nhostBaseFolder?: InputMaybe<Order_By>;
  repositoryProductionBranch?: InputMaybe<Order_By>;
  slug?: InputMaybe<Order_By>;
  subdomain?: InputMaybe<Order_By>;
  updatedAt?: InputMaybe<Order_By>;
  workspaceId?: InputMaybe<Order_By>;
};

/** response of any mutation on the table "apps" */
export type Apps_Mutation_Response = {
  __typename?: 'apps_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int'];
  /** data from the rows affected by the mutation */
  returning: Array<Apps>;
};

/** input type for inserting object relation for remote table "apps" */
export type Apps_Obj_Rel_Insert_Input = {
  data: Apps_Insert_Input;
  /** upsert condition */
  on_conflict?: InputMaybe<Apps_On_Conflict>;
};

/** on_conflict condition type for table "apps" */
export type Apps_On_Conflict = {
  constraint: Apps_Constraint;
  update_columns?: Array<Apps_Update_Column>;
  where?: InputMaybe<Apps_Bool_Exp>;
};

/** Ordering options when selecting data from "apps". */
export type Apps_Order_By = {
  appStates_aggregate?: InputMaybe<AppStateHistory_Aggregate_Order_By>;
  backups_aggregate?: InputMaybe<Backups_Aggregate_Order_By>;
  createdAt?: InputMaybe<Order_By>;
  creator?: InputMaybe<Users_Order_By>;
  creatorUserId?: InputMaybe<Order_By>;
  deployments_aggregate?: InputMaybe<Deployments_Aggregate_Order_By>;
  desiredState?: InputMaybe<Order_By>;
  featureFlags_aggregate?: InputMaybe<FeatureFlags_Aggregate_Order_By>;
  githubRepository?: InputMaybe<GithubRepositories_Order_By>;
  githubRepositoryId?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  isProvisioned?: InputMaybe<Order_By>;
  metadataFunctions?: InputMaybe<Order_By>;
  name?: InputMaybe<Order_By>;
  nhostBaseFolder?: InputMaybe<Order_By>;
  plan?: InputMaybe<Plans_Order_By>;
  providersUpdated?: InputMaybe<Order_By>;
  region?: InputMaybe<Regions_Order_By>;
  repositoryProductionBranch?: InputMaybe<Order_By>;
  runServices_aggregate?: InputMaybe<Run_Service_Aggregate_Order_By>;
  slug?: InputMaybe<Order_By>;
  subdomain?: InputMaybe<Order_By>;
  updatedAt?: InputMaybe<Order_By>;
  workspace?: InputMaybe<Workspaces_Order_By>;
  workspaceId?: InputMaybe<Order_By>;
};

/** primary key columns input for table: apps */
export type Apps_Pk_Columns_Input = {
  id: Scalars['uuid'];
};

/** select columns of table "apps" */
export enum Apps_Select_Column {
  /** column name */
  CreatedAt = 'createdAt',
  /** column name */
  CreatorUserId = 'creatorUserId',
  /** column name */
  DesiredState = 'desiredState',
  /** column name */
  GithubRepositoryId = 'githubRepositoryId',
  /** column name */
  Id = 'id',
  /** column name */
  IsProvisioned = 'isProvisioned',
  /** column name */
  MetadataFunctions = 'metadataFunctions',
  /** column name */
  Name = 'name',
  /** column name */
  NhostBaseFolder = 'nhostBaseFolder',
  /** column name */
  ProvidersUpdated = 'providersUpdated',
  /** column name */
  RepositoryProductionBranch = 'repositoryProductionBranch',
  /** column name */
  Slug = 'slug',
  /** column name */
  Subdomain = 'subdomain',
  /** column name */
  UpdatedAt = 'updatedAt',
  /** column name */
  WorkspaceId = 'workspaceId'
}

/** input type for updating data in table "apps" */
export type Apps_Set_Input = {
  desiredState?: InputMaybe<Scalars['Int']>;
  githubRepositoryId?: InputMaybe<Scalars['uuid']>;
  name?: InputMaybe<Scalars['String']>;
  nhostBaseFolder?: InputMaybe<Scalars['String']>;
  planId?: InputMaybe<Scalars['uuid']>;
  providersUpdated?: InputMaybe<Scalars['Boolean']>;
  repositoryProductionBranch?: InputMaybe<Scalars['String']>;
  slug?: InputMaybe<Scalars['String']>;
};

/** order by stddev() on columns of table "apps" */
export type Apps_Stddev_Order_By = {
  desiredState?: InputMaybe<Order_By>;
};

/** order by stddev_pop() on columns of table "apps" */
export type Apps_Stddev_Pop_Order_By = {
  desiredState?: InputMaybe<Order_By>;
};

/** order by stddev_samp() on columns of table "apps" */
export type Apps_Stddev_Samp_Order_By = {
  desiredState?: InputMaybe<Order_By>;
};

/** Streaming cursor of the table "apps" */
export type Apps_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: Apps_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type Apps_Stream_Cursor_Value_Input = {
  createdAt?: InputMaybe<Scalars['timestamptz']>;
  creatorUserId?: InputMaybe<Scalars['uuid']>;
  desiredState?: InputMaybe<Scalars['Int']>;
  githubRepositoryId?: InputMaybe<Scalars['uuid']>;
  id?: InputMaybe<Scalars['uuid']>;
  isProvisioned?: InputMaybe<Scalars['Boolean']>;
  metadataFunctions?: InputMaybe<Scalars['jsonb']>;
  name?: InputMaybe<Scalars['String']>;
  nhostBaseFolder?: InputMaybe<Scalars['String']>;
  providersUpdated?: InputMaybe<Scalars['Boolean']>;
  repositoryProductionBranch?: InputMaybe<Scalars['String']>;
  slug?: InputMaybe<Scalars['String']>;
  subdomain?: InputMaybe<Scalars['String']>;
  updatedAt?: InputMaybe<Scalars['timestamptz']>;
  workspaceId?: InputMaybe<Scalars['uuid']>;
};

/** order by sum() on columns of table "apps" */
export type Apps_Sum_Order_By = {
  desiredState?: InputMaybe<Order_By>;
};

/** update columns of table "apps" */
export enum Apps_Update_Column {
  /** column name */
  DesiredState = 'desiredState',
  /** column name */
  GithubRepositoryId = 'githubRepositoryId',
  /** column name */
  Name = 'name',
  /** column name */
  NhostBaseFolder = 'nhostBaseFolder',
  /** column name */
  PlanId = 'planId',
  /** column name */
  ProvidersUpdated = 'providersUpdated',
  /** column name */
  RepositoryProductionBranch = 'repositoryProductionBranch',
  /** column name */
  Slug = 'slug'
}

export type Apps_Updates = {
  /** increments the numeric columns with given value of the filtered values */
  _inc?: InputMaybe<Apps_Inc_Input>;
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<Apps_Set_Input>;
  /** filter the rows which have to be updated */
  where: Apps_Bool_Exp;
};

/** order by var_pop() on columns of table "apps" */
export type Apps_Var_Pop_Order_By = {
  desiredState?: InputMaybe<Order_By>;
};

/** order by var_samp() on columns of table "apps" */
export type Apps_Var_Samp_Order_By = {
  desiredState?: InputMaybe<Order_By>;
};

/** order by variance() on columns of table "apps" */
export type Apps_Variance_Order_By = {
  desiredState?: InputMaybe<Order_By>;
};

export enum AuthRefreshTokenTypes_Enum {
  /** Personal access token */
  Pat = 'pat',
  /** Regular refresh token */
  Regular = 'regular'
}

/** Boolean expression to compare columns of type "authRefreshTokenTypes_enum". All fields are combined with logical 'AND'. */
export type AuthRefreshTokenTypes_Enum_Comparison_Exp = {
  _eq?: InputMaybe<AuthRefreshTokenTypes_Enum>;
  _in?: InputMaybe<Array<AuthRefreshTokenTypes_Enum>>;
  _is_null?: InputMaybe<Scalars['Boolean']>;
  _neq?: InputMaybe<AuthRefreshTokenTypes_Enum>;
  _nin?: InputMaybe<Array<AuthRefreshTokenTypes_Enum>>;
};

/** User refresh tokens. Hasura auth uses them to rotate new access tokens as long as the refresh token is not expired. Don't modify its structure as Hasura Auth relies on it to function properly. */
export type AuthRefreshTokens = {
  __typename?: 'authRefreshTokens';
  createdAt: Scalars['timestamptz'];
  expiresAt: Scalars['timestamptz'];
  id: Scalars['uuid'];
  metadata?: Maybe<Scalars['jsonb']>;
  type: AuthRefreshTokenTypes_Enum;
  /** An object relationship */
  user: Users;
  userId: Scalars['uuid'];
};


/** User refresh tokens. Hasura auth uses them to rotate new access tokens as long as the refresh token is not expired. Don't modify its structure as Hasura Auth relies on it to function properly. */
export type AuthRefreshTokensMetadataArgs = {
  path?: InputMaybe<Scalars['String']>;
};

/** order by aggregate values of table "auth.refresh_tokens" */
export type AuthRefreshTokens_Aggregate_Order_By = {
  count?: InputMaybe<Order_By>;
  max?: InputMaybe<AuthRefreshTokens_Max_Order_By>;
  min?: InputMaybe<AuthRefreshTokens_Min_Order_By>;
};

/** Boolean expression to filter rows from the table "auth.refresh_tokens". All fields are combined with a logical 'AND'. */
export type AuthRefreshTokens_Bool_Exp = {
  _and?: InputMaybe<Array<AuthRefreshTokens_Bool_Exp>>;
  _not?: InputMaybe<AuthRefreshTokens_Bool_Exp>;
  _or?: InputMaybe<Array<AuthRefreshTokens_Bool_Exp>>;
  createdAt?: InputMaybe<Timestamptz_Comparison_Exp>;
  expiresAt?: InputMaybe<Timestamptz_Comparison_Exp>;
  id?: InputMaybe<Uuid_Comparison_Exp>;
  metadata?: InputMaybe<Jsonb_Comparison_Exp>;
  type?: InputMaybe<AuthRefreshTokenTypes_Enum_Comparison_Exp>;
  user?: InputMaybe<Users_Bool_Exp>;
  userId?: InputMaybe<Uuid_Comparison_Exp>;
};

/** order by max() on columns of table "auth.refresh_tokens" */
export type AuthRefreshTokens_Max_Order_By = {
  createdAt?: InputMaybe<Order_By>;
  expiresAt?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  userId?: InputMaybe<Order_By>;
};

/** order by min() on columns of table "auth.refresh_tokens" */
export type AuthRefreshTokens_Min_Order_By = {
  createdAt?: InputMaybe<Order_By>;
  expiresAt?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  userId?: InputMaybe<Order_By>;
};

/** response of any mutation on the table "auth.refresh_tokens" */
export type AuthRefreshTokens_Mutation_Response = {
  __typename?: 'authRefreshTokens_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int'];
  /** data from the rows affected by the mutation */
  returning: Array<AuthRefreshTokens>;
};

/** Ordering options when selecting data from "auth.refresh_tokens". */
export type AuthRefreshTokens_Order_By = {
  createdAt?: InputMaybe<Order_By>;
  expiresAt?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  metadata?: InputMaybe<Order_By>;
  type?: InputMaybe<Order_By>;
  user?: InputMaybe<Users_Order_By>;
  userId?: InputMaybe<Order_By>;
};

/** select columns of table "auth.refresh_tokens" */
export enum AuthRefreshTokens_Select_Column {
  /** column name */
  CreatedAt = 'createdAt',
  /** column name */
  ExpiresAt = 'expiresAt',
  /** column name */
  Id = 'id',
  /** column name */
  Metadata = 'metadata',
  /** column name */
  Type = 'type',
  /** column name */
  UserId = 'userId'
}

/** Streaming cursor of the table "authRefreshTokens" */
export type AuthRefreshTokens_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: AuthRefreshTokens_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type AuthRefreshTokens_Stream_Cursor_Value_Input = {
  createdAt?: InputMaybe<Scalars['timestamptz']>;
  expiresAt?: InputMaybe<Scalars['timestamptz']>;
  id?: InputMaybe<Scalars['uuid']>;
  metadata?: InputMaybe<Scalars['jsonb']>;
  type?: InputMaybe<AuthRefreshTokenTypes_Enum>;
  userId?: InputMaybe<Scalars['uuid']>;
};

/** columns and relationships of "backups" */
export type Backups = {
  __typename?: 'backups';
  /** An object relationship */
  app: Apps;
  appId: Scalars['uuid'];
  completedAt?: Maybe<Scalars['timestamptz']>;
  createdAt: Scalars['timestamptz'];
  id: Scalars['uuid'];
  size: Scalars['bigint'];
};

/** order by aggregate values of table "backups" */
export type Backups_Aggregate_Order_By = {
  avg?: InputMaybe<Backups_Avg_Order_By>;
  count?: InputMaybe<Order_By>;
  max?: InputMaybe<Backups_Max_Order_By>;
  min?: InputMaybe<Backups_Min_Order_By>;
  stddev?: InputMaybe<Backups_Stddev_Order_By>;
  stddev_pop?: InputMaybe<Backups_Stddev_Pop_Order_By>;
  stddev_samp?: InputMaybe<Backups_Stddev_Samp_Order_By>;
  sum?: InputMaybe<Backups_Sum_Order_By>;
  var_pop?: InputMaybe<Backups_Var_Pop_Order_By>;
  var_samp?: InputMaybe<Backups_Var_Samp_Order_By>;
  variance?: InputMaybe<Backups_Variance_Order_By>;
};

/** order by avg() on columns of table "backups" */
export type Backups_Avg_Order_By = {
  size?: InputMaybe<Order_By>;
};

/** Boolean expression to filter rows from the table "backups". All fields are combined with a logical 'AND'. */
export type Backups_Bool_Exp = {
  _and?: InputMaybe<Array<Backups_Bool_Exp>>;
  _not?: InputMaybe<Backups_Bool_Exp>;
  _or?: InputMaybe<Array<Backups_Bool_Exp>>;
  app?: InputMaybe<Apps_Bool_Exp>;
  appId?: InputMaybe<Uuid_Comparison_Exp>;
  completedAt?: InputMaybe<Timestamptz_Comparison_Exp>;
  createdAt?: InputMaybe<Timestamptz_Comparison_Exp>;
  id?: InputMaybe<Uuid_Comparison_Exp>;
  size?: InputMaybe<Bigint_Comparison_Exp>;
};

/** order by max() on columns of table "backups" */
export type Backups_Max_Order_By = {
  appId?: InputMaybe<Order_By>;
  completedAt?: InputMaybe<Order_By>;
  createdAt?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  size?: InputMaybe<Order_By>;
};

/** order by min() on columns of table "backups" */
export type Backups_Min_Order_By = {
  appId?: InputMaybe<Order_By>;
  completedAt?: InputMaybe<Order_By>;
  createdAt?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  size?: InputMaybe<Order_By>;
};

/** Ordering options when selecting data from "backups". */
export type Backups_Order_By = {
  app?: InputMaybe<Apps_Order_By>;
  appId?: InputMaybe<Order_By>;
  completedAt?: InputMaybe<Order_By>;
  createdAt?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  size?: InputMaybe<Order_By>;
};

/** select columns of table "backups" */
export enum Backups_Select_Column {
  /** column name */
  AppId = 'appId',
  /** column name */
  CompletedAt = 'completedAt',
  /** column name */
  CreatedAt = 'createdAt',
  /** column name */
  Id = 'id',
  /** column name */
  Size = 'size'
}

/** order by stddev() on columns of table "backups" */
export type Backups_Stddev_Order_By = {
  size?: InputMaybe<Order_By>;
};

/** order by stddev_pop() on columns of table "backups" */
export type Backups_Stddev_Pop_Order_By = {
  size?: InputMaybe<Order_By>;
};

/** order by stddev_samp() on columns of table "backups" */
export type Backups_Stddev_Samp_Order_By = {
  size?: InputMaybe<Order_By>;
};

/** Streaming cursor of the table "backups" */
export type Backups_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: Backups_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type Backups_Stream_Cursor_Value_Input = {
  appId?: InputMaybe<Scalars['uuid']>;
  completedAt?: InputMaybe<Scalars['timestamptz']>;
  createdAt?: InputMaybe<Scalars['timestamptz']>;
  id?: InputMaybe<Scalars['uuid']>;
  size?: InputMaybe<Scalars['bigint']>;
};

/** order by sum() on columns of table "backups" */
export type Backups_Sum_Order_By = {
  size?: InputMaybe<Order_By>;
};

/** order by var_pop() on columns of table "backups" */
export type Backups_Var_Pop_Order_By = {
  size?: InputMaybe<Order_By>;
};

/** order by var_samp() on columns of table "backups" */
export type Backups_Var_Samp_Order_By = {
  size?: InputMaybe<Order_By>;
};

/** order by variance() on columns of table "backups" */
export type Backups_Variance_Order_By = {
  size?: InputMaybe<Order_By>;
};

/** Boolean expression to compare columns of type "bigint". All fields are combined with logical 'AND'. */
export type Bigint_Comparison_Exp = {
  _eq?: InputMaybe<Scalars['bigint']>;
  _gt?: InputMaybe<Scalars['bigint']>;
  _gte?: InputMaybe<Scalars['bigint']>;
  _in?: InputMaybe<Array<Scalars['bigint']>>;
  _is_null?: InputMaybe<Scalars['Boolean']>;
  _lt?: InputMaybe<Scalars['bigint']>;
  _lte?: InputMaybe<Scalars['bigint']>;
  _neq?: InputMaybe<Scalars['bigint']>;
  _nin?: InputMaybe<Array<Scalars['bigint']>>;
};

/** Boolean expression to compare columns of type "bpchar". All fields are combined with logical 'AND'. */
export type Bpchar_Comparison_Exp = {
  _eq?: InputMaybe<Scalars['bpchar']>;
  _gt?: InputMaybe<Scalars['bpchar']>;
  _gte?: InputMaybe<Scalars['bpchar']>;
  /** does the column match the given case-insensitive pattern */
  _ilike?: InputMaybe<Scalars['bpchar']>;
  _in?: InputMaybe<Array<Scalars['bpchar']>>;
  /** does the column match the given POSIX regular expression, case insensitive */
  _iregex?: InputMaybe<Scalars['bpchar']>;
  _is_null?: InputMaybe<Scalars['Boolean']>;
  /** does the column match the given pattern */
  _like?: InputMaybe<Scalars['bpchar']>;
  _lt?: InputMaybe<Scalars['bpchar']>;
  _lte?: InputMaybe<Scalars['bpchar']>;
  _neq?: InputMaybe<Scalars['bpchar']>;
  /** does the column NOT match the given case-insensitive pattern */
  _nilike?: InputMaybe<Scalars['bpchar']>;
  _nin?: InputMaybe<Array<Scalars['bpchar']>>;
  /** does the column NOT match the given POSIX regular expression, case insensitive */
  _niregex?: InputMaybe<Scalars['bpchar']>;
  /** does the column NOT match the given pattern */
  _nlike?: InputMaybe<Scalars['bpchar']>;
  /** does the column NOT match the given POSIX regular expression, case sensitive */
  _nregex?: InputMaybe<Scalars['bpchar']>;
  /** does the column NOT match the given SQL regular expression */
  _nsimilar?: InputMaybe<Scalars['bpchar']>;
  /** does the column match the given POSIX regular expression, case sensitive */
  _regex?: InputMaybe<Scalars['bpchar']>;
  /** does the column match the given SQL regular expression */
  _similar?: InputMaybe<Scalars['bpchar']>;
};

/** Boolean expression to compare columns of type "citext". All fields are combined with logical 'AND'. */
export type Citext_Comparison_Exp = {
  _eq?: InputMaybe<Scalars['citext']>;
  _gt?: InputMaybe<Scalars['citext']>;
  _gte?: InputMaybe<Scalars['citext']>;
  /** does the column match the given case-insensitive pattern */
  _ilike?: InputMaybe<Scalars['citext']>;
  _in?: InputMaybe<Array<Scalars['citext']>>;
  /** does the column match the given POSIX regular expression, case insensitive */
  _iregex?: InputMaybe<Scalars['citext']>;
  _is_null?: InputMaybe<Scalars['Boolean']>;
  /** does the column match the given pattern */
  _like?: InputMaybe<Scalars['citext']>;
  _lt?: InputMaybe<Scalars['citext']>;
  _lte?: InputMaybe<Scalars['citext']>;
  _neq?: InputMaybe<Scalars['citext']>;
  /** does the column NOT match the given case-insensitive pattern */
  _nilike?: InputMaybe<Scalars['citext']>;
  _nin?: InputMaybe<Array<Scalars['citext']>>;
  /** does the column NOT match the given POSIX regular expression, case insensitive */
  _niregex?: InputMaybe<Scalars['citext']>;
  /** does the column NOT match the given pattern */
  _nlike?: InputMaybe<Scalars['citext']>;
  /** does the column NOT match the given POSIX regular expression, case sensitive */
  _nregex?: InputMaybe<Scalars['citext']>;
  /** does the column NOT match the given SQL regular expression */
  _nsimilar?: InputMaybe<Scalars['citext']>;
  /** does the column match the given POSIX regular expression, case sensitive */
  _regex?: InputMaybe<Scalars['citext']>;
  /** does the column match the given SQL regular expression */
  _similar?: InputMaybe<Scalars['citext']>;
};

/** columns and relationships of "cli_tokens" */
export type CliTokens = {
  __typename?: 'cliTokens';
  createdAt: Scalars['timestamptz'];
  id: Scalars['uuid'];
  updatedAt: Scalars['timestamptz'];
  /** An object relationship */
  user: Users;
};

/** order by aggregate values of table "cli_tokens" */
export type CliTokens_Aggregate_Order_By = {
  count?: InputMaybe<Order_By>;
  max?: InputMaybe<CliTokens_Max_Order_By>;
  min?: InputMaybe<CliTokens_Min_Order_By>;
};

/** Boolean expression to filter rows from the table "cli_tokens". All fields are combined with a logical 'AND'. */
export type CliTokens_Bool_Exp = {
  _and?: InputMaybe<Array<CliTokens_Bool_Exp>>;
  _not?: InputMaybe<CliTokens_Bool_Exp>;
  _or?: InputMaybe<Array<CliTokens_Bool_Exp>>;
  createdAt?: InputMaybe<Timestamptz_Comparison_Exp>;
  id?: InputMaybe<Uuid_Comparison_Exp>;
  updatedAt?: InputMaybe<Timestamptz_Comparison_Exp>;
  user?: InputMaybe<Users_Bool_Exp>;
};

/** order by max() on columns of table "cli_tokens" */
export type CliTokens_Max_Order_By = {
  createdAt?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  updatedAt?: InputMaybe<Order_By>;
};

/** order by min() on columns of table "cli_tokens" */
export type CliTokens_Min_Order_By = {
  createdAt?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  updatedAt?: InputMaybe<Order_By>;
};

/** response of any mutation on the table "cli_tokens" */
export type CliTokens_Mutation_Response = {
  __typename?: 'cliTokens_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int'];
  /** data from the rows affected by the mutation */
  returning: Array<CliTokens>;
};

/** Ordering options when selecting data from "cli_tokens". */
export type CliTokens_Order_By = {
  createdAt?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  updatedAt?: InputMaybe<Order_By>;
  user?: InputMaybe<Users_Order_By>;
};

/** select columns of table "cli_tokens" */
export enum CliTokens_Select_Column {
  /** column name */
  CreatedAt = 'createdAt',
  /** column name */
  Id = 'id',
  /** column name */
  UpdatedAt = 'updatedAt'
}

/** Streaming cursor of the table "cliTokens" */
export type CliTokens_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: CliTokens_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type CliTokens_Stream_Cursor_Value_Input = {
  createdAt?: InputMaybe<Scalars['timestamptz']>;
  id?: InputMaybe<Scalars['uuid']>;
  updatedAt?: InputMaybe<Scalars['timestamptz']>;
};

/** columns and relationships of "continents" */
export type Continents = {
  __typename?: 'continents';
  /** Continent code */
  code: Scalars['bpchar'];
  /** An array relationship */
  countries: Array<Countries>;
  /** Continent name */
  name?: Maybe<Scalars['String']>;
};


/** columns and relationships of "continents" */
export type ContinentsCountriesArgs = {
  distinct_on?: InputMaybe<Array<Countries_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<Countries_Order_By>>;
  where?: InputMaybe<Countries_Bool_Exp>;
};

/** Boolean expression to filter rows from the table "continents". All fields are combined with a logical 'AND'. */
export type Continents_Bool_Exp = {
  _and?: InputMaybe<Array<Continents_Bool_Exp>>;
  _not?: InputMaybe<Continents_Bool_Exp>;
  _or?: InputMaybe<Array<Continents_Bool_Exp>>;
  code?: InputMaybe<Bpchar_Comparison_Exp>;
  countries?: InputMaybe<Countries_Bool_Exp>;
  name?: InputMaybe<String_Comparison_Exp>;
};

/** Ordering options when selecting data from "continents". */
export type Continents_Order_By = {
  code?: InputMaybe<Order_By>;
  countries_aggregate?: InputMaybe<Countries_Aggregate_Order_By>;
  name?: InputMaybe<Order_By>;
};

/** select columns of table "continents" */
export enum Continents_Select_Column {
  /** column name */
  Code = 'code',
  /** column name */
  Name = 'name'
}

/** Streaming cursor of the table "continents" */
export type Continents_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: Continents_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type Continents_Stream_Cursor_Value_Input = {
  /** Continent code */
  code?: InputMaybe<Scalars['bpchar']>;
  /** Continent name */
  name?: InputMaybe<Scalars['String']>;
};

/** columns and relationships of "countries" */
export type Countries = {
  __typename?: 'countries';
  /** Two-letter country code (ISO 3166-1 alpha-2) */
  code: Scalars['bpchar'];
  /** An object relationship */
  continent: Continents;
  continentCode: Scalars['bpchar'];
  emojiFlag?: Maybe<Scalars['String']>;
  /** An array relationship */
  locations: Array<Regions>;
  /** English country name */
  name: Scalars['String'];
  /** An array relationship */
  workspaces: Array<Workspaces>;
};


/** columns and relationships of "countries" */
export type CountriesLocationsArgs = {
  distinct_on?: InputMaybe<Array<Regions_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<Regions_Order_By>>;
  where?: InputMaybe<Regions_Bool_Exp>;
};


/** columns and relationships of "countries" */
export type CountriesWorkspacesArgs = {
  distinct_on?: InputMaybe<Array<Workspaces_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<Workspaces_Order_By>>;
  where?: InputMaybe<Workspaces_Bool_Exp>;
};

/** order by aggregate values of table "countries" */
export type Countries_Aggregate_Order_By = {
  count?: InputMaybe<Order_By>;
  max?: InputMaybe<Countries_Max_Order_By>;
  min?: InputMaybe<Countries_Min_Order_By>;
};

/** Boolean expression to filter rows from the table "countries". All fields are combined with a logical 'AND'. */
export type Countries_Bool_Exp = {
  _and?: InputMaybe<Array<Countries_Bool_Exp>>;
  _not?: InputMaybe<Countries_Bool_Exp>;
  _or?: InputMaybe<Array<Countries_Bool_Exp>>;
  code?: InputMaybe<Bpchar_Comparison_Exp>;
  continent?: InputMaybe<Continents_Bool_Exp>;
  continentCode?: InputMaybe<Bpchar_Comparison_Exp>;
  emojiFlag?: InputMaybe<String_Comparison_Exp>;
  locations?: InputMaybe<Regions_Bool_Exp>;
  name?: InputMaybe<String_Comparison_Exp>;
  workspaces?: InputMaybe<Workspaces_Bool_Exp>;
};

/** order by max() on columns of table "countries" */
export type Countries_Max_Order_By = {
  /** Two-letter country code (ISO 3166-1 alpha-2) */
  code?: InputMaybe<Order_By>;
  continentCode?: InputMaybe<Order_By>;
  emojiFlag?: InputMaybe<Order_By>;
  /** English country name */
  name?: InputMaybe<Order_By>;
};

/** order by min() on columns of table "countries" */
export type Countries_Min_Order_By = {
  /** Two-letter country code (ISO 3166-1 alpha-2) */
  code?: InputMaybe<Order_By>;
  continentCode?: InputMaybe<Order_By>;
  emojiFlag?: InputMaybe<Order_By>;
  /** English country name */
  name?: InputMaybe<Order_By>;
};

/** Ordering options when selecting data from "countries". */
export type Countries_Order_By = {
  code?: InputMaybe<Order_By>;
  continent?: InputMaybe<Continents_Order_By>;
  continentCode?: InputMaybe<Order_By>;
  emojiFlag?: InputMaybe<Order_By>;
  locations_aggregate?: InputMaybe<Regions_Aggregate_Order_By>;
  name?: InputMaybe<Order_By>;
  workspaces_aggregate?: InputMaybe<Workspaces_Aggregate_Order_By>;
};

/** select columns of table "countries" */
export enum Countries_Select_Column {
  /** column name */
  Code = 'code',
  /** column name */
  ContinentCode = 'continentCode',
  /** column name */
  EmojiFlag = 'emojiFlag',
  /** column name */
  Name = 'name'
}

/** Streaming cursor of the table "countries" */
export type Countries_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: Countries_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type Countries_Stream_Cursor_Value_Input = {
  /** Two-letter country code (ISO 3166-1 alpha-2) */
  code?: InputMaybe<Scalars['bpchar']>;
  continentCode?: InputMaybe<Scalars['bpchar']>;
  emojiFlag?: InputMaybe<Scalars['String']>;
  /** English country name */
  name?: InputMaybe<Scalars['String']>;
};

/** ordering argument of a cursor */
export enum Cursor_Ordering {
  /** ascending ordering of the cursor */
  Asc = 'ASC',
  /** descending ordering of the cursor */
  Desc = 'DESC'
}

/** columns and relationships of "deployment_logs" */
export type DeploymentLogs = {
  __typename?: 'deploymentLogs';
  createdAt: Scalars['timestamptz'];
  /** An object relationship */
  deployment: Deployments;
  deploymentId: Scalars['uuid'];
  id: Scalars['uuid'];
  message: Scalars['String'];
};

/** order by aggregate values of table "deployment_logs" */
export type DeploymentLogs_Aggregate_Order_By = {
  count?: InputMaybe<Order_By>;
  max?: InputMaybe<DeploymentLogs_Max_Order_By>;
  min?: InputMaybe<DeploymentLogs_Min_Order_By>;
};

/** Boolean expression to filter rows from the table "deployment_logs". All fields are combined with a logical 'AND'. */
export type DeploymentLogs_Bool_Exp = {
  _and?: InputMaybe<Array<DeploymentLogs_Bool_Exp>>;
  _not?: InputMaybe<DeploymentLogs_Bool_Exp>;
  _or?: InputMaybe<Array<DeploymentLogs_Bool_Exp>>;
  createdAt?: InputMaybe<Timestamptz_Comparison_Exp>;
  deployment?: InputMaybe<Deployments_Bool_Exp>;
  deploymentId?: InputMaybe<Uuid_Comparison_Exp>;
  id?: InputMaybe<Uuid_Comparison_Exp>;
  message?: InputMaybe<String_Comparison_Exp>;
};

/** order by max() on columns of table "deployment_logs" */
export type DeploymentLogs_Max_Order_By = {
  createdAt?: InputMaybe<Order_By>;
  deploymentId?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  message?: InputMaybe<Order_By>;
};

/** order by min() on columns of table "deployment_logs" */
export type DeploymentLogs_Min_Order_By = {
  createdAt?: InputMaybe<Order_By>;
  deploymentId?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  message?: InputMaybe<Order_By>;
};

/** Ordering options when selecting data from "deployment_logs". */
export type DeploymentLogs_Order_By = {
  createdAt?: InputMaybe<Order_By>;
  deployment?: InputMaybe<Deployments_Order_By>;
  deploymentId?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  message?: InputMaybe<Order_By>;
};

/** select columns of table "deployment_logs" */
export enum DeploymentLogs_Select_Column {
  /** column name */
  CreatedAt = 'createdAt',
  /** column name */
  DeploymentId = 'deploymentId',
  /** column name */
  Id = 'id',
  /** column name */
  Message = 'message'
}

/** Streaming cursor of the table "deploymentLogs" */
export type DeploymentLogs_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: DeploymentLogs_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type DeploymentLogs_Stream_Cursor_Value_Input = {
  createdAt?: InputMaybe<Scalars['timestamptz']>;
  deploymentId?: InputMaybe<Scalars['uuid']>;
  id?: InputMaybe<Scalars['uuid']>;
  message?: InputMaybe<Scalars['String']>;
};

/** Table that keeps track of deployments done by watchtower */
export type Deployments = {
  __typename?: 'deployments';
  /** An object relationship */
  app: Apps;
  appId: Scalars['uuid'];
  commitMessage?: Maybe<Scalars['String']>;
  commitSHA: Scalars['String'];
  commitUserAvatarUrl?: Maybe<Scalars['String']>;
  commitUserName?: Maybe<Scalars['String']>;
  deploymentEndedAt?: Maybe<Scalars['timestamptz']>;
  /** An array relationship */
  deploymentLogs: Array<DeploymentLogs>;
  deploymentStartedAt?: Maybe<Scalars['timestamptz']>;
  deploymentStatus?: Maybe<Scalars['String']>;
  functionsEndedAt?: Maybe<Scalars['timestamptz']>;
  functionsStartedAt?: Maybe<Scalars['timestamptz']>;
  functionsStatus?: Maybe<Scalars['String']>;
  id: Scalars['uuid'];
  metadataEndedAt?: Maybe<Scalars['timestamptz']>;
  metadataStartedAt?: Maybe<Scalars['timestamptz']>;
  metadataStatus?: Maybe<Scalars['String']>;
  migrationsEndedAt?: Maybe<Scalars['timestamptz']>;
  migrationsStartedAt?: Maybe<Scalars['timestamptz']>;
  migrationsStatus?: Maybe<Scalars['String']>;
};


/** Table that keeps track of deployments done by watchtower */
export type DeploymentsDeploymentLogsArgs = {
  distinct_on?: InputMaybe<Array<DeploymentLogs_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<DeploymentLogs_Order_By>>;
  where?: InputMaybe<DeploymentLogs_Bool_Exp>;
};

/** order by aggregate values of table "deployments" */
export type Deployments_Aggregate_Order_By = {
  count?: InputMaybe<Order_By>;
  max?: InputMaybe<Deployments_Max_Order_By>;
  min?: InputMaybe<Deployments_Min_Order_By>;
};

/** input type for inserting array relation for remote table "deployments" */
export type Deployments_Arr_Rel_Insert_Input = {
  data: Array<Deployments_Insert_Input>;
  /** upsert condition */
  on_conflict?: InputMaybe<Deployments_On_Conflict>;
};

/** Boolean expression to filter rows from the table "deployments". All fields are combined with a logical 'AND'. */
export type Deployments_Bool_Exp = {
  _and?: InputMaybe<Array<Deployments_Bool_Exp>>;
  _not?: InputMaybe<Deployments_Bool_Exp>;
  _or?: InputMaybe<Array<Deployments_Bool_Exp>>;
  app?: InputMaybe<Apps_Bool_Exp>;
  appId?: InputMaybe<Uuid_Comparison_Exp>;
  commitMessage?: InputMaybe<String_Comparison_Exp>;
  commitSHA?: InputMaybe<String_Comparison_Exp>;
  commitUserAvatarUrl?: InputMaybe<String_Comparison_Exp>;
  commitUserName?: InputMaybe<String_Comparison_Exp>;
  deploymentEndedAt?: InputMaybe<Timestamptz_Comparison_Exp>;
  deploymentLogs?: InputMaybe<DeploymentLogs_Bool_Exp>;
  deploymentStartedAt?: InputMaybe<Timestamptz_Comparison_Exp>;
  deploymentStatus?: InputMaybe<String_Comparison_Exp>;
  functionsEndedAt?: InputMaybe<Timestamptz_Comparison_Exp>;
  functionsStartedAt?: InputMaybe<Timestamptz_Comparison_Exp>;
  functionsStatus?: InputMaybe<String_Comparison_Exp>;
  id?: InputMaybe<Uuid_Comparison_Exp>;
  metadataEndedAt?: InputMaybe<Timestamptz_Comparison_Exp>;
  metadataStartedAt?: InputMaybe<Timestamptz_Comparison_Exp>;
  metadataStatus?: InputMaybe<String_Comparison_Exp>;
  migrationsEndedAt?: InputMaybe<Timestamptz_Comparison_Exp>;
  migrationsStartedAt?: InputMaybe<Timestamptz_Comparison_Exp>;
  migrationsStatus?: InputMaybe<String_Comparison_Exp>;
};

/** unique or primary key constraints on table "deployments" */
export enum Deployments_Constraint {
  /** unique or primary key constraint on columns "id" */
  DeploymentsPkey = 'deployments_pkey'
}

/** input type for inserting data into table "deployments" */
export type Deployments_Insert_Input = {
  app?: InputMaybe<Apps_Obj_Rel_Insert_Input>;
  appId?: InputMaybe<Scalars['uuid']>;
  commitMessage?: InputMaybe<Scalars['String']>;
  commitSHA?: InputMaybe<Scalars['String']>;
  commitUserAvatarUrl?: InputMaybe<Scalars['String']>;
  commitUserName?: InputMaybe<Scalars['String']>;
  deploymentStatus?: InputMaybe<Scalars['String']>;
};

/** order by max() on columns of table "deployments" */
export type Deployments_Max_Order_By = {
  appId?: InputMaybe<Order_By>;
  commitMessage?: InputMaybe<Order_By>;
  commitSHA?: InputMaybe<Order_By>;
  commitUserAvatarUrl?: InputMaybe<Order_By>;
  commitUserName?: InputMaybe<Order_By>;
  deploymentEndedAt?: InputMaybe<Order_By>;
  deploymentStartedAt?: InputMaybe<Order_By>;
  deploymentStatus?: InputMaybe<Order_By>;
  functionsEndedAt?: InputMaybe<Order_By>;
  functionsStartedAt?: InputMaybe<Order_By>;
  functionsStatus?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  metadataEndedAt?: InputMaybe<Order_By>;
  metadataStartedAt?: InputMaybe<Order_By>;
  metadataStatus?: InputMaybe<Order_By>;
  migrationsEndedAt?: InputMaybe<Order_By>;
  migrationsStartedAt?: InputMaybe<Order_By>;
  migrationsStatus?: InputMaybe<Order_By>;
};

/** order by min() on columns of table "deployments" */
export type Deployments_Min_Order_By = {
  appId?: InputMaybe<Order_By>;
  commitMessage?: InputMaybe<Order_By>;
  commitSHA?: InputMaybe<Order_By>;
  commitUserAvatarUrl?: InputMaybe<Order_By>;
  commitUserName?: InputMaybe<Order_By>;
  deploymentEndedAt?: InputMaybe<Order_By>;
  deploymentStartedAt?: InputMaybe<Order_By>;
  deploymentStatus?: InputMaybe<Order_By>;
  functionsEndedAt?: InputMaybe<Order_By>;
  functionsStartedAt?: InputMaybe<Order_By>;
  functionsStatus?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  metadataEndedAt?: InputMaybe<Order_By>;
  metadataStartedAt?: InputMaybe<Order_By>;
  metadataStatus?: InputMaybe<Order_By>;
  migrationsEndedAt?: InputMaybe<Order_By>;
  migrationsStartedAt?: InputMaybe<Order_By>;
  migrationsStatus?: InputMaybe<Order_By>;
};

/** response of any mutation on the table "deployments" */
export type Deployments_Mutation_Response = {
  __typename?: 'deployments_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int'];
  /** data from the rows affected by the mutation */
  returning: Array<Deployments>;
};

/** on_conflict condition type for table "deployments" */
export type Deployments_On_Conflict = {
  constraint: Deployments_Constraint;
  update_columns?: Array<Deployments_Update_Column>;
  where?: InputMaybe<Deployments_Bool_Exp>;
};

/** Ordering options when selecting data from "deployments". */
export type Deployments_Order_By = {
  app?: InputMaybe<Apps_Order_By>;
  appId?: InputMaybe<Order_By>;
  commitMessage?: InputMaybe<Order_By>;
  commitSHA?: InputMaybe<Order_By>;
  commitUserAvatarUrl?: InputMaybe<Order_By>;
  commitUserName?: InputMaybe<Order_By>;
  deploymentEndedAt?: InputMaybe<Order_By>;
  deploymentLogs_aggregate?: InputMaybe<DeploymentLogs_Aggregate_Order_By>;
  deploymentStartedAt?: InputMaybe<Order_By>;
  deploymentStatus?: InputMaybe<Order_By>;
  functionsEndedAt?: InputMaybe<Order_By>;
  functionsStartedAt?: InputMaybe<Order_By>;
  functionsStatus?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  metadataEndedAt?: InputMaybe<Order_By>;
  metadataStartedAt?: InputMaybe<Order_By>;
  metadataStatus?: InputMaybe<Order_By>;
  migrationsEndedAt?: InputMaybe<Order_By>;
  migrationsStartedAt?: InputMaybe<Order_By>;
  migrationsStatus?: InputMaybe<Order_By>;
};

/** select columns of table "deployments" */
export enum Deployments_Select_Column {
  /** column name */
  AppId = 'appId',
  /** column name */
  CommitMessage = 'commitMessage',
  /** column name */
  CommitSha = 'commitSHA',
  /** column name */
  CommitUserAvatarUrl = 'commitUserAvatarUrl',
  /** column name */
  CommitUserName = 'commitUserName',
  /** column name */
  DeploymentEndedAt = 'deploymentEndedAt',
  /** column name */
  DeploymentStartedAt = 'deploymentStartedAt',
  /** column name */
  DeploymentStatus = 'deploymentStatus',
  /** column name */
  FunctionsEndedAt = 'functionsEndedAt',
  /** column name */
  FunctionsStartedAt = 'functionsStartedAt',
  /** column name */
  FunctionsStatus = 'functionsStatus',
  /** column name */
  Id = 'id',
  /** column name */
  MetadataEndedAt = 'metadataEndedAt',
  /** column name */
  MetadataStartedAt = 'metadataStartedAt',
  /** column name */
  MetadataStatus = 'metadataStatus',
  /** column name */
  MigrationsEndedAt = 'migrationsEndedAt',
  /** column name */
  MigrationsStartedAt = 'migrationsStartedAt',
  /** column name */
  MigrationsStatus = 'migrationsStatus'
}

/** Streaming cursor of the table "deployments" */
export type Deployments_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: Deployments_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type Deployments_Stream_Cursor_Value_Input = {
  appId?: InputMaybe<Scalars['uuid']>;
  commitMessage?: InputMaybe<Scalars['String']>;
  commitSHA?: InputMaybe<Scalars['String']>;
  commitUserAvatarUrl?: InputMaybe<Scalars['String']>;
  commitUserName?: InputMaybe<Scalars['String']>;
  deploymentEndedAt?: InputMaybe<Scalars['timestamptz']>;
  deploymentStartedAt?: InputMaybe<Scalars['timestamptz']>;
  deploymentStatus?: InputMaybe<Scalars['String']>;
  functionsEndedAt?: InputMaybe<Scalars['timestamptz']>;
  functionsStartedAt?: InputMaybe<Scalars['timestamptz']>;
  functionsStatus?: InputMaybe<Scalars['String']>;
  id?: InputMaybe<Scalars['uuid']>;
  metadataEndedAt?: InputMaybe<Scalars['timestamptz']>;
  metadataStartedAt?: InputMaybe<Scalars['timestamptz']>;
  metadataStatus?: InputMaybe<Scalars['String']>;
  migrationsEndedAt?: InputMaybe<Scalars['timestamptz']>;
  migrationsStartedAt?: InputMaybe<Scalars['timestamptz']>;
  migrationsStatus?: InputMaybe<Scalars['String']>;
};

/** placeholder for update columns of table "deployments" (current role has no relevant permissions) */
export enum Deployments_Update_Column {
  /** placeholder (do not use) */
  Placeholder = '_PLACEHOLDER'
}

/** columns and relationships of "feature_flags" */
export type FeatureFlags = {
  __typename?: 'featureFlags';
  /** An object relationship */
  app: Apps;
  appId: Scalars['uuid'];
  description: Scalars['String'];
  id: Scalars['uuid'];
  name: Scalars['String'];
  value: Scalars['String'];
};

/** order by aggregate values of table "feature_flags" */
export type FeatureFlags_Aggregate_Order_By = {
  count?: InputMaybe<Order_By>;
  max?: InputMaybe<FeatureFlags_Max_Order_By>;
  min?: InputMaybe<FeatureFlags_Min_Order_By>;
};

/** input type for inserting array relation for remote table "feature_flags" */
export type FeatureFlags_Arr_Rel_Insert_Input = {
  data: Array<FeatureFlags_Insert_Input>;
  /** upsert condition */
  on_conflict?: InputMaybe<FeatureFlags_On_Conflict>;
};

/** Boolean expression to filter rows from the table "feature_flags". All fields are combined with a logical 'AND'. */
export type FeatureFlags_Bool_Exp = {
  _and?: InputMaybe<Array<FeatureFlags_Bool_Exp>>;
  _not?: InputMaybe<FeatureFlags_Bool_Exp>;
  _or?: InputMaybe<Array<FeatureFlags_Bool_Exp>>;
  app?: InputMaybe<Apps_Bool_Exp>;
  appId?: InputMaybe<Uuid_Comparison_Exp>;
  description?: InputMaybe<String_Comparison_Exp>;
  id?: InputMaybe<Uuid_Comparison_Exp>;
  name?: InputMaybe<String_Comparison_Exp>;
  value?: InputMaybe<String_Comparison_Exp>;
};

/** unique or primary key constraints on table "feature_flags" */
export enum FeatureFlags_Constraint {
  /** unique or primary key constraint on columns "id" */
  FeatureFlagsPkey = 'feature_flags_pkey'
}

/** input type for inserting data into table "feature_flags" */
export type FeatureFlags_Insert_Input = {
  app?: InputMaybe<Apps_Obj_Rel_Insert_Input>;
  appId?: InputMaybe<Scalars['uuid']>;
  description?: InputMaybe<Scalars['String']>;
  name?: InputMaybe<Scalars['String']>;
  value?: InputMaybe<Scalars['String']>;
};

/** order by max() on columns of table "feature_flags" */
export type FeatureFlags_Max_Order_By = {
  appId?: InputMaybe<Order_By>;
  description?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  name?: InputMaybe<Order_By>;
  value?: InputMaybe<Order_By>;
};

/** order by min() on columns of table "feature_flags" */
export type FeatureFlags_Min_Order_By = {
  appId?: InputMaybe<Order_By>;
  description?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  name?: InputMaybe<Order_By>;
  value?: InputMaybe<Order_By>;
};

/** response of any mutation on the table "feature_flags" */
export type FeatureFlags_Mutation_Response = {
  __typename?: 'featureFlags_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int'];
  /** data from the rows affected by the mutation */
  returning: Array<FeatureFlags>;
};

/** on_conflict condition type for table "feature_flags" */
export type FeatureFlags_On_Conflict = {
  constraint: FeatureFlags_Constraint;
  update_columns?: Array<FeatureFlags_Update_Column>;
  where?: InputMaybe<FeatureFlags_Bool_Exp>;
};

/** Ordering options when selecting data from "feature_flags". */
export type FeatureFlags_Order_By = {
  app?: InputMaybe<Apps_Order_By>;
  appId?: InputMaybe<Order_By>;
  description?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  name?: InputMaybe<Order_By>;
  value?: InputMaybe<Order_By>;
};

/** select columns of table "feature_flags" */
export enum FeatureFlags_Select_Column {
  /** column name */
  AppId = 'appId',
  /** column name */
  Description = 'description',
  /** column name */
  Id = 'id',
  /** column name */
  Name = 'name',
  /** column name */
  Value = 'value'
}

/** Streaming cursor of the table "featureFlags" */
export type FeatureFlags_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: FeatureFlags_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type FeatureFlags_Stream_Cursor_Value_Input = {
  appId?: InputMaybe<Scalars['uuid']>;
  description?: InputMaybe<Scalars['String']>;
  id?: InputMaybe<Scalars['uuid']>;
  name?: InputMaybe<Scalars['String']>;
  value?: InputMaybe<Scalars['String']>;
};

/** placeholder for update columns of table "feature_flags" (current role has no relevant permissions) */
export enum FeatureFlags_Update_Column {
  /** placeholder (do not use) */
  Placeholder = '_PLACEHOLDER'
}

/** columns and relationships of "feedback" */
export type Feedback = {
  __typename?: 'feedback';
  id: Scalars['Int'];
  /** An object relationship */
  user: Users;
};

/** order by aggregate values of table "feedback" */
export type Feedback_Aggregate_Order_By = {
  avg?: InputMaybe<Feedback_Avg_Order_By>;
  count?: InputMaybe<Order_By>;
  max?: InputMaybe<Feedback_Max_Order_By>;
  min?: InputMaybe<Feedback_Min_Order_By>;
  stddev?: InputMaybe<Feedback_Stddev_Order_By>;
  stddev_pop?: InputMaybe<Feedback_Stddev_Pop_Order_By>;
  stddev_samp?: InputMaybe<Feedback_Stddev_Samp_Order_By>;
  sum?: InputMaybe<Feedback_Sum_Order_By>;
  var_pop?: InputMaybe<Feedback_Var_Pop_Order_By>;
  var_samp?: InputMaybe<Feedback_Var_Samp_Order_By>;
  variance?: InputMaybe<Feedback_Variance_Order_By>;
};

/** order by avg() on columns of table "feedback" */
export type Feedback_Avg_Order_By = {
  id?: InputMaybe<Order_By>;
};

/** Boolean expression to filter rows from the table "feedback". All fields are combined with a logical 'AND'. */
export type Feedback_Bool_Exp = {
  _and?: InputMaybe<Array<Feedback_Bool_Exp>>;
  _not?: InputMaybe<Feedback_Bool_Exp>;
  _or?: InputMaybe<Array<Feedback_Bool_Exp>>;
  id?: InputMaybe<Int_Comparison_Exp>;
  user?: InputMaybe<Users_Bool_Exp>;
};

/** unique or primary key constraints on table "feedback" */
export enum Feedback_Constraint {
  /** unique or primary key constraint on columns "id" */
  FeedbackPkey = 'feedback_pkey'
}

/** input type for inserting data into table "feedback" */
export type Feedback_Insert_Input = {
  feedback?: InputMaybe<Scalars['String']>;
};

/** order by max() on columns of table "feedback" */
export type Feedback_Max_Order_By = {
  id?: InputMaybe<Order_By>;
};

/** order by min() on columns of table "feedback" */
export type Feedback_Min_Order_By = {
  id?: InputMaybe<Order_By>;
};

/** response of any mutation on the table "feedback" */
export type Feedback_Mutation_Response = {
  __typename?: 'feedback_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int'];
  /** data from the rows affected by the mutation */
  returning: Array<Feedback>;
};

/** on_conflict condition type for table "feedback" */
export type Feedback_On_Conflict = {
  constraint: Feedback_Constraint;
  update_columns?: Array<Feedback_Update_Column>;
  where?: InputMaybe<Feedback_Bool_Exp>;
};

/** Ordering options when selecting data from "feedback". */
export type Feedback_Order_By = {
  id?: InputMaybe<Order_By>;
  user?: InputMaybe<Users_Order_By>;
};

/** select columns of table "feedback" */
export enum Feedback_Select_Column {
  /** column name */
  Id = 'id'
}

/** order by stddev() on columns of table "feedback" */
export type Feedback_Stddev_Order_By = {
  id?: InputMaybe<Order_By>;
};

/** order by stddev_pop() on columns of table "feedback" */
export type Feedback_Stddev_Pop_Order_By = {
  id?: InputMaybe<Order_By>;
};

/** order by stddev_samp() on columns of table "feedback" */
export type Feedback_Stddev_Samp_Order_By = {
  id?: InputMaybe<Order_By>;
};

/** Streaming cursor of the table "feedback" */
export type Feedback_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: Feedback_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type Feedback_Stream_Cursor_Value_Input = {
  id?: InputMaybe<Scalars['Int']>;
};

/** order by sum() on columns of table "feedback" */
export type Feedback_Sum_Order_By = {
  id?: InputMaybe<Order_By>;
};

/** placeholder for update columns of table "feedback" (current role has no relevant permissions) */
export enum Feedback_Update_Column {
  /** placeholder (do not use) */
  Placeholder = '_PLACEHOLDER'
}

/** order by var_pop() on columns of table "feedback" */
export type Feedback_Var_Pop_Order_By = {
  id?: InputMaybe<Order_By>;
};

/** order by var_samp() on columns of table "feedback" */
export type Feedback_Var_Samp_Order_By = {
  id?: InputMaybe<Order_By>;
};

/** order by variance() on columns of table "feedback" */
export type Feedback_Variance_Order_By = {
  id?: InputMaybe<Order_By>;
};

/** columns and relationships of "github_app_installations" */
export type GithubAppInstallations = {
  __typename?: 'githubAppInstallations';
  accountAvatarUrl?: Maybe<Scalars['String']>;
  accountLogin?: Maybe<Scalars['String']>;
  accountType?: Maybe<Scalars['String']>;
  createdAt: Scalars['timestamptz'];
  /** An array relationship */
  githubRepositories: Array<GithubRepositories>;
  id: Scalars['uuid'];
  updatedAt: Scalars['timestamptz'];
  /** An object relationship */
  user?: Maybe<Users>;
};


/** columns and relationships of "github_app_installations" */
export type GithubAppInstallationsGithubRepositoriesArgs = {
  distinct_on?: InputMaybe<Array<GithubRepositories_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<GithubRepositories_Order_By>>;
  where?: InputMaybe<GithubRepositories_Bool_Exp>;
};

/** order by aggregate values of table "github_app_installations" */
export type GithubAppInstallations_Aggregate_Order_By = {
  count?: InputMaybe<Order_By>;
  max?: InputMaybe<GithubAppInstallations_Max_Order_By>;
  min?: InputMaybe<GithubAppInstallations_Min_Order_By>;
};

/** Boolean expression to filter rows from the table "github_app_installations". All fields are combined with a logical 'AND'. */
export type GithubAppInstallations_Bool_Exp = {
  _and?: InputMaybe<Array<GithubAppInstallations_Bool_Exp>>;
  _not?: InputMaybe<GithubAppInstallations_Bool_Exp>;
  _or?: InputMaybe<Array<GithubAppInstallations_Bool_Exp>>;
  accountAvatarUrl?: InputMaybe<String_Comparison_Exp>;
  accountLogin?: InputMaybe<String_Comparison_Exp>;
  accountType?: InputMaybe<String_Comparison_Exp>;
  createdAt?: InputMaybe<Timestamptz_Comparison_Exp>;
  githubRepositories?: InputMaybe<GithubRepositories_Bool_Exp>;
  id?: InputMaybe<Uuid_Comparison_Exp>;
  updatedAt?: InputMaybe<Timestamptz_Comparison_Exp>;
  user?: InputMaybe<Users_Bool_Exp>;
};

/** unique or primary key constraints on table "github_app_installations" */
export enum GithubAppInstallations_Constraint {
  /** unique or primary key constraint on columns "external_github_app_installation_id" */
  GithubAppInstallationsExternalGithubAppInstallationIKey = 'github_app_installations_external_github_app_installation_i_key',
  /** unique or primary key constraint on columns "id" */
  GithubAppInstallationsPkey = 'github_app_installations_pkey'
}

/** input type for inserting data into table "github_app_installations" */
export type GithubAppInstallations_Insert_Input = {
  accountAvatarUrl?: InputMaybe<Scalars['String']>;
  accountLogin?: InputMaybe<Scalars['String']>;
  accountNodeId?: InputMaybe<Scalars['String']>;
  accountType?: InputMaybe<Scalars['String']>;
  externalGithubAppInstallationId?: InputMaybe<Scalars['Int']>;
  githubData?: InputMaybe<Scalars['jsonb']>;
  userId?: InputMaybe<Scalars['uuid']>;
};

/** order by max() on columns of table "github_app_installations" */
export type GithubAppInstallations_Max_Order_By = {
  accountAvatarUrl?: InputMaybe<Order_By>;
  accountLogin?: InputMaybe<Order_By>;
  accountType?: InputMaybe<Order_By>;
  createdAt?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  updatedAt?: InputMaybe<Order_By>;
};

/** order by min() on columns of table "github_app_installations" */
export type GithubAppInstallations_Min_Order_By = {
  accountAvatarUrl?: InputMaybe<Order_By>;
  accountLogin?: InputMaybe<Order_By>;
  accountType?: InputMaybe<Order_By>;
  createdAt?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  updatedAt?: InputMaybe<Order_By>;
};

/** response of any mutation on the table "github_app_installations" */
export type GithubAppInstallations_Mutation_Response = {
  __typename?: 'githubAppInstallations_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int'];
  /** data from the rows affected by the mutation */
  returning: Array<GithubAppInstallations>;
};

/** on_conflict condition type for table "github_app_installations" */
export type GithubAppInstallations_On_Conflict = {
  constraint: GithubAppInstallations_Constraint;
  update_columns?: Array<GithubAppInstallations_Update_Column>;
  where?: InputMaybe<GithubAppInstallations_Bool_Exp>;
};

/** Ordering options when selecting data from "github_app_installations". */
export type GithubAppInstallations_Order_By = {
  accountAvatarUrl?: InputMaybe<Order_By>;
  accountLogin?: InputMaybe<Order_By>;
  accountType?: InputMaybe<Order_By>;
  createdAt?: InputMaybe<Order_By>;
  githubRepositories_aggregate?: InputMaybe<GithubRepositories_Aggregate_Order_By>;
  id?: InputMaybe<Order_By>;
  updatedAt?: InputMaybe<Order_By>;
  user?: InputMaybe<Users_Order_By>;
};

/** primary key columns input for table: github_app_installations */
export type GithubAppInstallations_Pk_Columns_Input = {
  id: Scalars['uuid'];
};

/** select columns of table "github_app_installations" */
export enum GithubAppInstallations_Select_Column {
  /** column name */
  AccountAvatarUrl = 'accountAvatarUrl',
  /** column name */
  AccountLogin = 'accountLogin',
  /** column name */
  AccountType = 'accountType',
  /** column name */
  CreatedAt = 'createdAt',
  /** column name */
  Id = 'id',
  /** column name */
  UpdatedAt = 'updatedAt'
}

/** Streaming cursor of the table "githubAppInstallations" */
export type GithubAppInstallations_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: GithubAppInstallations_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type GithubAppInstallations_Stream_Cursor_Value_Input = {
  accountAvatarUrl?: InputMaybe<Scalars['String']>;
  accountLogin?: InputMaybe<Scalars['String']>;
  accountType?: InputMaybe<Scalars['String']>;
  createdAt?: InputMaybe<Scalars['timestamptz']>;
  id?: InputMaybe<Scalars['uuid']>;
  updatedAt?: InputMaybe<Scalars['timestamptz']>;
};

/** placeholder for update columns of table "github_app_installations" (current role has no relevant permissions) */
export enum GithubAppInstallations_Update_Column {
  /** placeholder (do not use) */
  Placeholder = '_PLACEHOLDER'
}

export type GithubAppInstallations_Updates = {
  /** filter the rows which have to be updated */
  where: GithubAppInstallations_Bool_Exp;
};

/** columns and relationships of "github_repositories" */
export type GithubRepositories = {
  __typename?: 'githubRepositories';
  /** An array relationship */
  apps: Array<Apps>;
  createdAt: Scalars['timestamptz'];
  fullName: Scalars['String'];
  /** An object relationship */
  githubAppInstallation: GithubAppInstallations;
  id: Scalars['uuid'];
  name: Scalars['String'];
  private: Scalars['Boolean'];
  updatedAt: Scalars['timestamptz'];
};


/** columns and relationships of "github_repositories" */
export type GithubRepositoriesAppsArgs = {
  distinct_on?: InputMaybe<Array<Apps_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<Apps_Order_By>>;
  where?: InputMaybe<Apps_Bool_Exp>;
};

/** order by aggregate values of table "github_repositories" */
export type GithubRepositories_Aggregate_Order_By = {
  count?: InputMaybe<Order_By>;
  max?: InputMaybe<GithubRepositories_Max_Order_By>;
  min?: InputMaybe<GithubRepositories_Min_Order_By>;
};

/** Boolean expression to filter rows from the table "github_repositories". All fields are combined with a logical 'AND'. */
export type GithubRepositories_Bool_Exp = {
  _and?: InputMaybe<Array<GithubRepositories_Bool_Exp>>;
  _not?: InputMaybe<GithubRepositories_Bool_Exp>;
  _or?: InputMaybe<Array<GithubRepositories_Bool_Exp>>;
  apps?: InputMaybe<Apps_Bool_Exp>;
  createdAt?: InputMaybe<Timestamptz_Comparison_Exp>;
  fullName?: InputMaybe<String_Comparison_Exp>;
  githubAppInstallation?: InputMaybe<GithubAppInstallations_Bool_Exp>;
  id?: InputMaybe<Uuid_Comparison_Exp>;
  name?: InputMaybe<String_Comparison_Exp>;
  private?: InputMaybe<Boolean_Comparison_Exp>;
  updatedAt?: InputMaybe<Timestamptz_Comparison_Exp>;
};

/** order by max() on columns of table "github_repositories" */
export type GithubRepositories_Max_Order_By = {
  createdAt?: InputMaybe<Order_By>;
  fullName?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  name?: InputMaybe<Order_By>;
  updatedAt?: InputMaybe<Order_By>;
};

/** order by min() on columns of table "github_repositories" */
export type GithubRepositories_Min_Order_By = {
  createdAt?: InputMaybe<Order_By>;
  fullName?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  name?: InputMaybe<Order_By>;
  updatedAt?: InputMaybe<Order_By>;
};

/** Ordering options when selecting data from "github_repositories". */
export type GithubRepositories_Order_By = {
  apps_aggregate?: InputMaybe<Apps_Aggregate_Order_By>;
  createdAt?: InputMaybe<Order_By>;
  fullName?: InputMaybe<Order_By>;
  githubAppInstallation?: InputMaybe<GithubAppInstallations_Order_By>;
  id?: InputMaybe<Order_By>;
  name?: InputMaybe<Order_By>;
  private?: InputMaybe<Order_By>;
  updatedAt?: InputMaybe<Order_By>;
};

/** select columns of table "github_repositories" */
export enum GithubRepositories_Select_Column {
  /** column name */
  CreatedAt = 'createdAt',
  /** column name */
  FullName = 'fullName',
  /** column name */
  Id = 'id',
  /** column name */
  Name = 'name',
  /** column name */
  Private = 'private',
  /** column name */
  UpdatedAt = 'updatedAt'
}

/** Streaming cursor of the table "githubRepositories" */
export type GithubRepositories_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: GithubRepositories_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type GithubRepositories_Stream_Cursor_Value_Input = {
  createdAt?: InputMaybe<Scalars['timestamptz']>;
  fullName?: InputMaybe<Scalars['String']>;
  id?: InputMaybe<Scalars['uuid']>;
  name?: InputMaybe<Scalars['String']>;
  private?: InputMaybe<Scalars['Boolean']>;
  updatedAt?: InputMaybe<Scalars['timestamptz']>;
};

export type Jsonb_Cast_Exp = {
  String?: InputMaybe<String_Comparison_Exp>;
};

/** Boolean expression to compare columns of type "jsonb". All fields are combined with logical 'AND'. */
export type Jsonb_Comparison_Exp = {
  _cast?: InputMaybe<Jsonb_Cast_Exp>;
  /** is the column contained in the given json value */
  _contained_in?: InputMaybe<Scalars['jsonb']>;
  /** does the column contain the given json value at the top level */
  _contains?: InputMaybe<Scalars['jsonb']>;
  _eq?: InputMaybe<Scalars['jsonb']>;
  _gt?: InputMaybe<Scalars['jsonb']>;
  _gte?: InputMaybe<Scalars['jsonb']>;
  /** does the string exist as a top-level key in the column */
  _has_key?: InputMaybe<Scalars['String']>;
  /** do all of these strings exist as top-level keys in the column */
  _has_keys_all?: InputMaybe<Array<Scalars['String']>>;
  /** do any of these strings exist as top-level keys in the column */
  _has_keys_any?: InputMaybe<Array<Scalars['String']>>;
  _in?: InputMaybe<Array<Scalars['jsonb']>>;
  _is_null?: InputMaybe<Scalars['Boolean']>;
  _lt?: InputMaybe<Scalars['jsonb']>;
  _lte?: InputMaybe<Scalars['jsonb']>;
  _neq?: InputMaybe<Scalars['jsonb']>;
  _nin?: InputMaybe<Array<Scalars['jsonb']>>;
};

/** mutation root */
export type Mutation_Root = {
  __typename?: 'mutation_root';
  backupApplicationDatabase: BackupResult;
  /** delete single row from the table: "apps" */
  deleteApp?: Maybe<Apps>;
  /** delete data from the table: "apps" */
  deleteApps?: Maybe<Apps_Mutation_Response>;
  /** delete single row from the table: "auth.refresh_tokens" */
  deleteAuthRefreshToken?: Maybe<AuthRefreshTokens>;
  /** delete data from the table: "auth.refresh_tokens" */
  deleteAuthRefreshTokens?: Maybe<AuthRefreshTokens_Mutation_Response>;
  /** delete single row from the table: "cli_tokens" */
  deleteCliToken?: Maybe<CliTokens>;
  /** delete data from the table: "cli_tokens" */
  deleteCliTokens?: Maybe<CliTokens_Mutation_Response>;
  /** delete single row from the table: "payment_methods" */
  deletePaymentMethod?: Maybe<PaymentMethods>;
  /** delete data from the table: "payment_methods" */
  deletePaymentMethods?: Maybe<PaymentMethods_Mutation_Response>;
  /** delete single row from the table: "run_service" */
  deleteRunService?: Maybe<Run_Service>;
  deleteRunServiceConfig?: Maybe<ConfigRunServiceConfig>;
  /** delete data from the table: "run_service" */
  deleteRunServices?: Maybe<Run_Service_Mutation_Response>;
  deleteSecret?: Maybe<ConfigEnvironmentVariable>;
  /** delete single row from the table: "workspaces" */
  deleteWorkspace?: Maybe<Workspaces>;
  /** delete single row from the table: "workspace_members" */
  deleteWorkspaceMember?: Maybe<WorkspaceMembers>;
  /** delete single row from the table: "workspace_member_invites" */
  deleteWorkspaceMemberInvite?: Maybe<WorkspaceMemberInvites>;
  /** delete data from the table: "workspace_member_invites" */
  deleteWorkspaceMemberInvites?: Maybe<WorkspaceMemberInvites_Mutation_Response>;
  /** delete data from the table: "workspace_members" */
  deleteWorkspaceMembers?: Maybe<WorkspaceMembers_Mutation_Response>;
  /** delete data from the table: "workspaces" */
  deleteWorkspaces?: Maybe<Workspaces_Mutation_Response>;
  /** insert a single row into the table: "apps" */
  insertApp?: Maybe<Apps>;
  /** insert data into the table: "apps" */
  insertApps?: Maybe<Apps_Mutation_Response>;
  /** insert a single row into the table: "deployments" */
  insertDeployment?: Maybe<Deployments>;
  /** insert data into the table: "deployments" */
  insertDeployments?: Maybe<Deployments_Mutation_Response>;
  /** insert a single row into the table: "feature_flags" */
  insertFeatureFlag?: Maybe<FeatureFlags>;
  /** insert data into the table: "feature_flags" */
  insertFeatureFlags?: Maybe<FeatureFlags_Mutation_Response>;
  /** insert data into the table: "feedback" */
  insertFeedback?: Maybe<Feedback_Mutation_Response>;
  /** insert a single row into the table: "feedback" */
  insertFeedbackOne?: Maybe<Feedback>;
  /** insert a single row into the table: "github_app_installations" */
  insertGithubAppInstallation?: Maybe<GithubAppInstallations>;
  /** insert data into the table: "github_app_installations" */
  insertGithubAppInstallations?: Maybe<GithubAppInstallations_Mutation_Response>;
  /** insert a single row into the table: "payment_methods" */
  insertPaymentMethod?: Maybe<PaymentMethods>;
  /** insert data into the table: "payment_methods" */
  insertPaymentMethods?: Maybe<PaymentMethods_Mutation_Response>;
  /** insert a single row into the table: "run_service" */
  insertRunService?: Maybe<Run_Service>;
  insertRunServiceConfig: ConfigRunServiceConfig;
  /** insert data into the table: "run_service" */
  insertRunServices?: Maybe<Run_Service_Mutation_Response>;
  insertSecret: ConfigEnvironmentVariable;
  /** insert a single row into the table: "workspaces" */
  insertWorkspace?: Maybe<Workspaces>;
  /** insert a single row into the table: "workspace_members" */
  insertWorkspaceMember?: Maybe<WorkspaceMembers>;
  /** insert a single row into the table: "workspace_member_invites" */
  insertWorkspaceMemberInvite?: Maybe<WorkspaceMemberInvites>;
  /** insert data into the table: "workspace_member_invites" */
  insertWorkspaceMemberInvites?: Maybe<WorkspaceMemberInvites_Mutation_Response>;
  /** insert data into the table: "workspace_members" */
  insertWorkspaceMembers?: Maybe<WorkspaceMembers_Mutation_Response>;
  /** insert data into the table: "workspaces" */
  insertWorkspaces?: Maybe<Workspaces_Mutation_Response>;
  replaceRunServiceConfig: ConfigRunServiceConfig;
  resetPostgresPassword: Scalars['Boolean'];
  restoreApplicationDatabase: Scalars['Boolean'];
  /** update single row of the table: "apps" */
  updateApp?: Maybe<Apps>;
  /** update data of the table: "apps" */
  updateApps?: Maybe<Apps_Mutation_Response>;
  updateConfig: ConfigConfig;
  /** update single row of the table: "github_app_installations" */
  updateGithubAppInstallation?: Maybe<GithubAppInstallations>;
  /** update data of the table: "github_app_installations" */
  updateGithubAppInstallations?: Maybe<GithubAppInstallations_Mutation_Response>;
  /** update single row of the table: "payment_methods" */
  updatePaymentMethod?: Maybe<PaymentMethods>;
  /** update data of the table: "payment_methods" */
  updatePaymentMethods?: Maybe<PaymentMethods_Mutation_Response>;
  updateRunServiceConfig: ConfigRunServiceConfig;
  updateSecret: ConfigEnvironmentVariable;
  /** update single row of the table: "workspaces" */
  updateWorkspace?: Maybe<Workspaces>;
  /** update single row of the table: "workspace_members" */
  updateWorkspaceMember?: Maybe<WorkspaceMembers>;
  /** update single row of the table: "workspace_member_invites" */
  updateWorkspaceMemberInvite?: Maybe<WorkspaceMemberInvites>;
  /** update data of the table: "workspace_member_invites" */
  updateWorkspaceMemberInvites?: Maybe<WorkspaceMemberInvites_Mutation_Response>;
  /** update data of the table: "workspace_members" */
  updateWorkspaceMembers?: Maybe<WorkspaceMembers_Mutation_Response>;
  /** update data of the table: "workspaces" */
  updateWorkspaces?: Maybe<Workspaces_Mutation_Response>;
  /** update multiples rows of table: "apps" */
  update_apps_many?: Maybe<Array<Maybe<Apps_Mutation_Response>>>;
  /** update multiples rows of table: "github_app_installations" */
  update_githubAppInstallations_many?: Maybe<Array<Maybe<GithubAppInstallations_Mutation_Response>>>;
  /** update multiples rows of table: "payment_methods" */
  update_paymentMethods_many?: Maybe<Array<Maybe<PaymentMethods_Mutation_Response>>>;
  /** update multiples rows of table: "workspace_member_invites" */
  update_workspaceMemberInvites_many?: Maybe<Array<Maybe<WorkspaceMemberInvites_Mutation_Response>>>;
  /** update multiples rows of table: "workspace_members" */
  update_workspaceMembers_many?: Maybe<Array<Maybe<WorkspaceMembers_Mutation_Response>>>;
  /** update multiples rows of table: "workspaces" */
  update_workspaces_many?: Maybe<Array<Maybe<Workspaces_Mutation_Response>>>;
};


/** mutation root */
export type Mutation_RootBackupApplicationDatabaseArgs = {
  appID: Scalars['String'];
  expireInDays?: InputMaybe<Scalars['Int']>;
};


/** mutation root */
export type Mutation_RootDeleteAppArgs = {
  id: Scalars['uuid'];
};


/** mutation root */
export type Mutation_RootDeleteAppsArgs = {
  where: Apps_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDeleteAuthRefreshTokenArgs = {
  id: Scalars['uuid'];
};


/** mutation root */
export type Mutation_RootDeleteAuthRefreshTokensArgs = {
  where: AuthRefreshTokens_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDeleteCliTokenArgs = {
  id: Scalars['uuid'];
};


/** mutation root */
export type Mutation_RootDeleteCliTokensArgs = {
  where: CliTokens_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDeletePaymentMethodArgs = {
  id: Scalars['uuid'];
};


/** mutation root */
export type Mutation_RootDeletePaymentMethodsArgs = {
  where: PaymentMethods_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDeleteRunServiceArgs = {
  id: Scalars['uuid'];
};


/** mutation root */
export type Mutation_RootDeleteRunServiceConfigArgs = {
  appID: Scalars['uuid'];
  serviceID: Scalars['uuid'];
};


/** mutation root */
export type Mutation_RootDeleteRunServicesArgs = {
  where: Run_Service_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDeleteSecretArgs = {
  appID: Scalars['uuid'];
  key: Scalars['String'];
};


/** mutation root */
export type Mutation_RootDeleteWorkspaceArgs = {
  id: Scalars['uuid'];
};


/** mutation root */
export type Mutation_RootDeleteWorkspaceMemberArgs = {
  id: Scalars['uuid'];
};


/** mutation root */
export type Mutation_RootDeleteWorkspaceMemberInviteArgs = {
  id: Scalars['uuid'];
};


/** mutation root */
export type Mutation_RootDeleteWorkspaceMemberInvitesArgs = {
  where: WorkspaceMemberInvites_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDeleteWorkspaceMembersArgs = {
  where: WorkspaceMembers_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDeleteWorkspacesArgs = {
  where: Workspaces_Bool_Exp;
};


/** mutation root */
export type Mutation_RootInsertAppArgs = {
  object: Apps_Insert_Input;
  on_conflict?: InputMaybe<Apps_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertAppsArgs = {
  objects: Array<Apps_Insert_Input>;
  on_conflict?: InputMaybe<Apps_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertDeploymentArgs = {
  object: Deployments_Insert_Input;
  on_conflict?: InputMaybe<Deployments_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertDeploymentsArgs = {
  objects: Array<Deployments_Insert_Input>;
  on_conflict?: InputMaybe<Deployments_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertFeatureFlagArgs = {
  object: FeatureFlags_Insert_Input;
  on_conflict?: InputMaybe<FeatureFlags_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertFeatureFlagsArgs = {
  objects: Array<FeatureFlags_Insert_Input>;
  on_conflict?: InputMaybe<FeatureFlags_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertFeedbackArgs = {
  objects: Array<Feedback_Insert_Input>;
  on_conflict?: InputMaybe<Feedback_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertFeedbackOneArgs = {
  object: Feedback_Insert_Input;
  on_conflict?: InputMaybe<Feedback_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertGithubAppInstallationArgs = {
  object: GithubAppInstallations_Insert_Input;
  on_conflict?: InputMaybe<GithubAppInstallations_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertGithubAppInstallationsArgs = {
  objects: Array<GithubAppInstallations_Insert_Input>;
  on_conflict?: InputMaybe<GithubAppInstallations_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertPaymentMethodArgs = {
  object: PaymentMethods_Insert_Input;
  on_conflict?: InputMaybe<PaymentMethods_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertPaymentMethodsArgs = {
  objects: Array<PaymentMethods_Insert_Input>;
  on_conflict?: InputMaybe<PaymentMethods_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertRunServiceArgs = {
  object: Run_Service_Insert_Input;
  on_conflict?: InputMaybe<Run_Service_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertRunServiceConfigArgs = {
  appID: Scalars['uuid'];
  config: ConfigRunServiceConfigInsertInput;
  serviceID: Scalars['uuid'];
};


/** mutation root */
export type Mutation_RootInsertRunServicesArgs = {
  objects: Array<Run_Service_Insert_Input>;
  on_conflict?: InputMaybe<Run_Service_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertSecretArgs = {
  appID: Scalars['uuid'];
  secret: ConfigEnvironmentVariableInsertInput;
};


/** mutation root */
export type Mutation_RootInsertWorkspaceArgs = {
  object: Workspaces_Insert_Input;
  on_conflict?: InputMaybe<Workspaces_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertWorkspaceMemberArgs = {
  object: WorkspaceMembers_Insert_Input;
  on_conflict?: InputMaybe<WorkspaceMembers_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertWorkspaceMemberInviteArgs = {
  object: WorkspaceMemberInvites_Insert_Input;
  on_conflict?: InputMaybe<WorkspaceMemberInvites_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertWorkspaceMemberInvitesArgs = {
  objects: Array<WorkspaceMemberInvites_Insert_Input>;
  on_conflict?: InputMaybe<WorkspaceMemberInvites_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertWorkspaceMembersArgs = {
  objects: Array<WorkspaceMembers_Insert_Input>;
  on_conflict?: InputMaybe<WorkspaceMembers_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertWorkspacesArgs = {
  objects: Array<Workspaces_Insert_Input>;
  on_conflict?: InputMaybe<Workspaces_On_Conflict>;
};


/** mutation root */
export type Mutation_RootReplaceRunServiceConfigArgs = {
  appID: Scalars['uuid'];
  config: ConfigRunServiceConfigInsertInput;
  serviceID: Scalars['uuid'];
};


/** mutation root */
export type Mutation_RootResetPostgresPasswordArgs = {
  appID: Scalars['String'];
  newPassword: Scalars['String'];
};


/** mutation root */
export type Mutation_RootRestoreApplicationDatabaseArgs = {
  appID: Scalars['String'];
  backupID: Scalars['String'];
};


/** mutation root */
export type Mutation_RootUpdateAppArgs = {
  _inc?: InputMaybe<Apps_Inc_Input>;
  _set?: InputMaybe<Apps_Set_Input>;
  pk_columns: Apps_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdateAppsArgs = {
  _inc?: InputMaybe<Apps_Inc_Input>;
  _set?: InputMaybe<Apps_Set_Input>;
  where: Apps_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdateConfigArgs = {
  appID: Scalars['uuid'];
  config: ConfigConfigUpdateInput;
};


/** mutation root */
export type Mutation_RootUpdateGithubAppInstallationArgs = {
  pk_columns: GithubAppInstallations_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdateGithubAppInstallationsArgs = {
  where: GithubAppInstallations_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdatePaymentMethodArgs = {
  _set?: InputMaybe<PaymentMethods_Set_Input>;
  pk_columns: PaymentMethods_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdatePaymentMethodsArgs = {
  _set?: InputMaybe<PaymentMethods_Set_Input>;
  where: PaymentMethods_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdateRunServiceConfigArgs = {
  appID: Scalars['uuid'];
  config: ConfigRunServiceConfigUpdateInput;
  serviceID: Scalars['uuid'];
};


/** mutation root */
export type Mutation_RootUpdateSecretArgs = {
  appID: Scalars['uuid'];
  secret: ConfigEnvironmentVariableInsertInput;
};


/** mutation root */
export type Mutation_RootUpdateWorkspaceArgs = {
  _set?: InputMaybe<Workspaces_Set_Input>;
  pk_columns: Workspaces_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdateWorkspaceMemberArgs = {
  _set?: InputMaybe<WorkspaceMembers_Set_Input>;
  pk_columns: WorkspaceMembers_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdateWorkspaceMemberInviteArgs = {
  _set?: InputMaybe<WorkspaceMemberInvites_Set_Input>;
  pk_columns: WorkspaceMemberInvites_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdateWorkspaceMemberInvitesArgs = {
  _set?: InputMaybe<WorkspaceMemberInvites_Set_Input>;
  where: WorkspaceMemberInvites_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdateWorkspaceMembersArgs = {
  _set?: InputMaybe<WorkspaceMembers_Set_Input>;
  where: WorkspaceMembers_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdateWorkspacesArgs = {
  _set?: InputMaybe<Workspaces_Set_Input>;
  where: Workspaces_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdate_Apps_ManyArgs = {
  updates: Array<Apps_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_GithubAppInstallations_ManyArgs = {
  updates: Array<GithubAppInstallations_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_PaymentMethods_ManyArgs = {
  updates: Array<PaymentMethods_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_WorkspaceMemberInvites_ManyArgs = {
  updates: Array<WorkspaceMemberInvites_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_WorkspaceMembers_ManyArgs = {
  updates: Array<WorkspaceMembers_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_Workspaces_ManyArgs = {
  updates: Array<Workspaces_Updates>;
};

/** column ordering options */
export enum Order_By {
  /** in ascending order, nulls last */
  Asc = 'asc',
  /** in ascending order, nulls first */
  AscNullsFirst = 'asc_nulls_first',
  /** in ascending order, nulls last */
  AscNullsLast = 'asc_nulls_last',
  /** in descending order, nulls first */
  Desc = 'desc',
  /** in descending order, nulls first */
  DescNullsFirst = 'desc_nulls_first',
  /** in descending order, nulls last */
  DescNullsLast = 'desc_nulls_last'
}

/** columns and relationships of "payment_methods" */
export type PaymentMethods = {
  __typename?: 'paymentMethods';
  addedByUserId: Scalars['uuid'];
  cardBrand: Scalars['String'];
  cardExpMonth: Scalars['Int'];
  cardExpYear: Scalars['Int'];
  cardLast4: Scalars['String'];
  createdAt: Scalars['timestamptz'];
  id: Scalars['uuid'];
  isDefault: Scalars['Boolean'];
  stripePaymentMethodId: Scalars['String'];
  /** An object relationship */
  user: Users;
  /** An object relationship */
  workspace: Workspaces;
  workspaceId: Scalars['uuid'];
};

/** order by aggregate values of table "payment_methods" */
export type PaymentMethods_Aggregate_Order_By = {
  avg?: InputMaybe<PaymentMethods_Avg_Order_By>;
  count?: InputMaybe<Order_By>;
  max?: InputMaybe<PaymentMethods_Max_Order_By>;
  min?: InputMaybe<PaymentMethods_Min_Order_By>;
  stddev?: InputMaybe<PaymentMethods_Stddev_Order_By>;
  stddev_pop?: InputMaybe<PaymentMethods_Stddev_Pop_Order_By>;
  stddev_samp?: InputMaybe<PaymentMethods_Stddev_Samp_Order_By>;
  sum?: InputMaybe<PaymentMethods_Sum_Order_By>;
  var_pop?: InputMaybe<PaymentMethods_Var_Pop_Order_By>;
  var_samp?: InputMaybe<PaymentMethods_Var_Samp_Order_By>;
  variance?: InputMaybe<PaymentMethods_Variance_Order_By>;
};

/** input type for inserting array relation for remote table "payment_methods" */
export type PaymentMethods_Arr_Rel_Insert_Input = {
  data: Array<PaymentMethods_Insert_Input>;
  /** upsert condition */
  on_conflict?: InputMaybe<PaymentMethods_On_Conflict>;
};

/** order by avg() on columns of table "payment_methods" */
export type PaymentMethods_Avg_Order_By = {
  cardExpMonth?: InputMaybe<Order_By>;
  cardExpYear?: InputMaybe<Order_By>;
};

/** Boolean expression to filter rows from the table "payment_methods". All fields are combined with a logical 'AND'. */
export type PaymentMethods_Bool_Exp = {
  _and?: InputMaybe<Array<PaymentMethods_Bool_Exp>>;
  _not?: InputMaybe<PaymentMethods_Bool_Exp>;
  _or?: InputMaybe<Array<PaymentMethods_Bool_Exp>>;
  addedByUserId?: InputMaybe<Uuid_Comparison_Exp>;
  cardBrand?: InputMaybe<String_Comparison_Exp>;
  cardExpMonth?: InputMaybe<Int_Comparison_Exp>;
  cardExpYear?: InputMaybe<Int_Comparison_Exp>;
  cardLast4?: InputMaybe<String_Comparison_Exp>;
  createdAt?: InputMaybe<Timestamptz_Comparison_Exp>;
  id?: InputMaybe<Uuid_Comparison_Exp>;
  isDefault?: InputMaybe<Boolean_Comparison_Exp>;
  stripePaymentMethodId?: InputMaybe<String_Comparison_Exp>;
  user?: InputMaybe<Users_Bool_Exp>;
  workspace?: InputMaybe<Workspaces_Bool_Exp>;
  workspaceId?: InputMaybe<Uuid_Comparison_Exp>;
};

/** unique or primary key constraints on table "payment_methods" */
export enum PaymentMethods_Constraint {
  /** unique or primary key constraint on columns "id" */
  PaymentMethodsPkey = 'payment_methods_pkey'
}

/** input type for inserting data into table "payment_methods" */
export type PaymentMethods_Insert_Input = {
  cardBrand?: InputMaybe<Scalars['String']>;
  cardExpMonth?: InputMaybe<Scalars['Int']>;
  cardExpYear?: InputMaybe<Scalars['Int']>;
  cardLast4?: InputMaybe<Scalars['String']>;
  isDefault?: InputMaybe<Scalars['Boolean']>;
  stripePaymentMethodId?: InputMaybe<Scalars['String']>;
  workspace?: InputMaybe<Workspaces_Obj_Rel_Insert_Input>;
  workspaceId?: InputMaybe<Scalars['uuid']>;
};

/** order by max() on columns of table "payment_methods" */
export type PaymentMethods_Max_Order_By = {
  addedByUserId?: InputMaybe<Order_By>;
  cardBrand?: InputMaybe<Order_By>;
  cardExpMonth?: InputMaybe<Order_By>;
  cardExpYear?: InputMaybe<Order_By>;
  cardLast4?: InputMaybe<Order_By>;
  createdAt?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  stripePaymentMethodId?: InputMaybe<Order_By>;
  workspaceId?: InputMaybe<Order_By>;
};

/** order by min() on columns of table "payment_methods" */
export type PaymentMethods_Min_Order_By = {
  addedByUserId?: InputMaybe<Order_By>;
  cardBrand?: InputMaybe<Order_By>;
  cardExpMonth?: InputMaybe<Order_By>;
  cardExpYear?: InputMaybe<Order_By>;
  cardLast4?: InputMaybe<Order_By>;
  createdAt?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  stripePaymentMethodId?: InputMaybe<Order_By>;
  workspaceId?: InputMaybe<Order_By>;
};

/** response of any mutation on the table "payment_methods" */
export type PaymentMethods_Mutation_Response = {
  __typename?: 'paymentMethods_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int'];
  /** data from the rows affected by the mutation */
  returning: Array<PaymentMethods>;
};

/** input type for inserting object relation for remote table "payment_methods" */
export type PaymentMethods_Obj_Rel_Insert_Input = {
  data: PaymentMethods_Insert_Input;
  /** upsert condition */
  on_conflict?: InputMaybe<PaymentMethods_On_Conflict>;
};

/** on_conflict condition type for table "payment_methods" */
export type PaymentMethods_On_Conflict = {
  constraint: PaymentMethods_Constraint;
  update_columns?: Array<PaymentMethods_Update_Column>;
  where?: InputMaybe<PaymentMethods_Bool_Exp>;
};

/** Ordering options when selecting data from "payment_methods". */
export type PaymentMethods_Order_By = {
  addedByUserId?: InputMaybe<Order_By>;
  cardBrand?: InputMaybe<Order_By>;
  cardExpMonth?: InputMaybe<Order_By>;
  cardExpYear?: InputMaybe<Order_By>;
  cardLast4?: InputMaybe<Order_By>;
  createdAt?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  isDefault?: InputMaybe<Order_By>;
  stripePaymentMethodId?: InputMaybe<Order_By>;
  user?: InputMaybe<Users_Order_By>;
  workspace?: InputMaybe<Workspaces_Order_By>;
  workspaceId?: InputMaybe<Order_By>;
};

/** primary key columns input for table: payment_methods */
export type PaymentMethods_Pk_Columns_Input = {
  id: Scalars['uuid'];
};

/** select columns of table "payment_methods" */
export enum PaymentMethods_Select_Column {
  /** column name */
  AddedByUserId = 'addedByUserId',
  /** column name */
  CardBrand = 'cardBrand',
  /** column name */
  CardExpMonth = 'cardExpMonth',
  /** column name */
  CardExpYear = 'cardExpYear',
  /** column name */
  CardLast4 = 'cardLast4',
  /** column name */
  CreatedAt = 'createdAt',
  /** column name */
  Id = 'id',
  /** column name */
  IsDefault = 'isDefault',
  /** column name */
  StripePaymentMethodId = 'stripePaymentMethodId',
  /** column name */
  WorkspaceId = 'workspaceId'
}

/** input type for updating data in table "payment_methods" */
export type PaymentMethods_Set_Input = {
  isDefault?: InputMaybe<Scalars['Boolean']>;
};

/** order by stddev() on columns of table "payment_methods" */
export type PaymentMethods_Stddev_Order_By = {
  cardExpMonth?: InputMaybe<Order_By>;
  cardExpYear?: InputMaybe<Order_By>;
};

/** order by stddev_pop() on columns of table "payment_methods" */
export type PaymentMethods_Stddev_Pop_Order_By = {
  cardExpMonth?: InputMaybe<Order_By>;
  cardExpYear?: InputMaybe<Order_By>;
};

/** order by stddev_samp() on columns of table "payment_methods" */
export type PaymentMethods_Stddev_Samp_Order_By = {
  cardExpMonth?: InputMaybe<Order_By>;
  cardExpYear?: InputMaybe<Order_By>;
};

/** Streaming cursor of the table "paymentMethods" */
export type PaymentMethods_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: PaymentMethods_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type PaymentMethods_Stream_Cursor_Value_Input = {
  addedByUserId?: InputMaybe<Scalars['uuid']>;
  cardBrand?: InputMaybe<Scalars['String']>;
  cardExpMonth?: InputMaybe<Scalars['Int']>;
  cardExpYear?: InputMaybe<Scalars['Int']>;
  cardLast4?: InputMaybe<Scalars['String']>;
  createdAt?: InputMaybe<Scalars['timestamptz']>;
  id?: InputMaybe<Scalars['uuid']>;
  isDefault?: InputMaybe<Scalars['Boolean']>;
  stripePaymentMethodId?: InputMaybe<Scalars['String']>;
  workspaceId?: InputMaybe<Scalars['uuid']>;
};

/** order by sum() on columns of table "payment_methods" */
export type PaymentMethods_Sum_Order_By = {
  cardExpMonth?: InputMaybe<Order_By>;
  cardExpYear?: InputMaybe<Order_By>;
};

/** update columns of table "payment_methods" */
export enum PaymentMethods_Update_Column {
  /** column name */
  IsDefault = 'isDefault'
}

export type PaymentMethods_Updates = {
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<PaymentMethods_Set_Input>;
  /** filter the rows which have to be updated */
  where: PaymentMethods_Bool_Exp;
};

/** order by var_pop() on columns of table "payment_methods" */
export type PaymentMethods_Var_Pop_Order_By = {
  cardExpMonth?: InputMaybe<Order_By>;
  cardExpYear?: InputMaybe<Order_By>;
};

/** order by var_samp() on columns of table "payment_methods" */
export type PaymentMethods_Var_Samp_Order_By = {
  cardExpMonth?: InputMaybe<Order_By>;
  cardExpYear?: InputMaybe<Order_By>;
};

/** order by variance() on columns of table "payment_methods" */
export type PaymentMethods_Variance_Order_By = {
  cardExpMonth?: InputMaybe<Order_By>;
  cardExpYear?: InputMaybe<Order_By>;
};

/** columns and relationships of "plans" */
export type Plans = {
  __typename?: 'plans';
  /** An array relationship */
  apps: Array<Apps>;
  createdAt: Scalars['timestamptz'];
  featureBackupEnabled: Scalars['Boolean'];
  featureCustomDomainsEnabled: Scalars['Boolean'];
  featureCustomEmailTemplatesEnabled: Scalars['Boolean'];
  featureMaxDbSize: Scalars['Int'];
  id: Scalars['uuid'];
  isDefault: Scalars['Boolean'];
  isFree: Scalars['Boolean'];
  name: Scalars['String'];
  price: Scalars['Int'];
  sort: Scalars['Int'];
  upatedAt: Scalars['timestamptz'];
};


/** columns and relationships of "plans" */
export type PlansAppsArgs = {
  distinct_on?: InputMaybe<Array<Apps_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<Apps_Order_By>>;
  where?: InputMaybe<Apps_Bool_Exp>;
};

/** Boolean expression to filter rows from the table "plans". All fields are combined with a logical 'AND'. */
export type Plans_Bool_Exp = {
  _and?: InputMaybe<Array<Plans_Bool_Exp>>;
  _not?: InputMaybe<Plans_Bool_Exp>;
  _or?: InputMaybe<Array<Plans_Bool_Exp>>;
  apps?: InputMaybe<Apps_Bool_Exp>;
  createdAt?: InputMaybe<Timestamptz_Comparison_Exp>;
  featureBackupEnabled?: InputMaybe<Boolean_Comparison_Exp>;
  featureCustomDomainsEnabled?: InputMaybe<Boolean_Comparison_Exp>;
  featureCustomEmailTemplatesEnabled?: InputMaybe<Boolean_Comparison_Exp>;
  featureMaxDbSize?: InputMaybe<Int_Comparison_Exp>;
  id?: InputMaybe<Uuid_Comparison_Exp>;
  isDefault?: InputMaybe<Boolean_Comparison_Exp>;
  isFree?: InputMaybe<Boolean_Comparison_Exp>;
  name?: InputMaybe<String_Comparison_Exp>;
  price?: InputMaybe<Int_Comparison_Exp>;
  sort?: InputMaybe<Int_Comparison_Exp>;
  upatedAt?: InputMaybe<Timestamptz_Comparison_Exp>;
};

/** Ordering options when selecting data from "plans". */
export type Plans_Order_By = {
  apps_aggregate?: InputMaybe<Apps_Aggregate_Order_By>;
  createdAt?: InputMaybe<Order_By>;
  featureBackupEnabled?: InputMaybe<Order_By>;
  featureCustomDomainsEnabled?: InputMaybe<Order_By>;
  featureCustomEmailTemplatesEnabled?: InputMaybe<Order_By>;
  featureMaxDbSize?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  isDefault?: InputMaybe<Order_By>;
  isFree?: InputMaybe<Order_By>;
  name?: InputMaybe<Order_By>;
  price?: InputMaybe<Order_By>;
  sort?: InputMaybe<Order_By>;
  upatedAt?: InputMaybe<Order_By>;
};

/** select columns of table "plans" */
export enum Plans_Select_Column {
  /** column name */
  CreatedAt = 'createdAt',
  /** column name */
  FeatureBackupEnabled = 'featureBackupEnabled',
  /** column name */
  FeatureCustomDomainsEnabled = 'featureCustomDomainsEnabled',
  /** column name */
  FeatureCustomEmailTemplatesEnabled = 'featureCustomEmailTemplatesEnabled',
  /** column name */
  FeatureMaxDbSize = 'featureMaxDbSize',
  /** column name */
  Id = 'id',
  /** column name */
  IsDefault = 'isDefault',
  /** column name */
  IsFree = 'isFree',
  /** column name */
  Name = 'name',
  /** column name */
  Price = 'price',
  /** column name */
  Sort = 'sort',
  /** column name */
  UpatedAt = 'upatedAt'
}

/** Streaming cursor of the table "plans" */
export type Plans_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: Plans_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type Plans_Stream_Cursor_Value_Input = {
  createdAt?: InputMaybe<Scalars['timestamptz']>;
  featureBackupEnabled?: InputMaybe<Scalars['Boolean']>;
  featureCustomDomainsEnabled?: InputMaybe<Scalars['Boolean']>;
  featureCustomEmailTemplatesEnabled?: InputMaybe<Scalars['Boolean']>;
  featureMaxDbSize?: InputMaybe<Scalars['Int']>;
  id?: InputMaybe<Scalars['uuid']>;
  isDefault?: InputMaybe<Scalars['Boolean']>;
  isFree?: InputMaybe<Scalars['Boolean']>;
  name?: InputMaybe<Scalars['String']>;
  price?: InputMaybe<Scalars['Int']>;
  sort?: InputMaybe<Scalars['Int']>;
  upatedAt?: InputMaybe<Scalars['timestamptz']>;
};

export type Query_Root = {
  __typename?: 'query_root';
  /** fetch data from the table: "apps" using primary key columns */
  app?: Maybe<Apps>;
  appSecrets: Array<ConfigEnvironmentVariable>;
  /** fetch data from the table: "app_state_history" */
  appStateHistories: Array<AppStateHistory>;
  /** fetch data from the table: "app_state_history" using primary key columns */
  appStateHistory?: Maybe<AppStateHistory>;
  /** An array relationship */
  apps: Array<Apps>;
  /** fetch data from the table: "auth.refresh_tokens" using primary key columns */
  authRefreshToken?: Maybe<AuthRefreshTokens>;
  /** fetch data from the table: "auth.refresh_tokens" */
  authRefreshTokens: Array<AuthRefreshTokens>;
  /** fetch data from the table: "backups" using primary key columns */
  backup?: Maybe<Backups>;
  /** An array relationship */
  backups: Array<Backups>;
  /** fetch data from the table: "cli_tokens" using primary key columns */
  cliToken?: Maybe<CliTokens>;
  /** An array relationship */
  cliTokens: Array<CliTokens>;
  config?: Maybe<ConfigConfig>;
  configRawJSON: Scalars['String'];
  /** fetch data from the table: "continents" */
  continents: Array<Continents>;
  /** fetch data from the table: "continents" using primary key columns */
  continents_by_pk?: Maybe<Continents>;
  /** An array relationship */
  countries: Array<Countries>;
  /** fetch data from the table: "countries" using primary key columns */
  countries_by_pk?: Maybe<Countries>;
  /** fetch data from the table: "deployments" using primary key columns */
  deployment?: Maybe<Deployments>;
  /** fetch data from the table: "deployment_logs" using primary key columns */
  deploymentLog?: Maybe<DeploymentLogs>;
  /** An array relationship */
  deploymentLogs: Array<DeploymentLogs>;
  /** An array relationship */
  deployments: Array<Deployments>;
  /** fetch data from the table: "feature_flags" using primary key columns */
  featureFlag?: Maybe<FeatureFlags>;
  /** An array relationship */
  featureFlags: Array<FeatureFlags>;
  /** fetch data from the table: "feedback" */
  feedback: Array<Feedback>;
  /** fetch data from the table: "feedback" using primary key columns */
  feedbackOne?: Maybe<Feedback>;
  getBackupPresignedURL: BackupPresignedUrl;
  getCPUSecondsUsage: Metrics;
  getEgressVolume: Metrics;
  getFunctionsInvocations: Metrics;
  getLogsVolume: Metrics;
  getPostgresVolumeCapacity: Metrics;
  getPostgresVolumeUsage: Metrics;
  getTotalRequests: Metrics;
  /** fetch data from the table: "github_app_installations" using primary key columns */
  githubAppInstallation?: Maybe<GithubAppInstallations>;
  /** fetch data from the table: "github_app_installations" */
  githubAppInstallations: Array<GithubAppInstallations>;
  /** An array relationship */
  githubRepositories: Array<GithubRepositories>;
  /** fetch data from the table: "github_repositories" using primary key columns */
  githubRepository?: Maybe<GithubRepositories>;
  logs: Array<Log>;
  /** fetch data from the table: "payment_methods" using primary key columns */
  paymentMethod?: Maybe<PaymentMethods>;
  /** An array relationship */
  paymentMethods: Array<PaymentMethods>;
  /** fetch data from the table: "plans" using primary key columns */
  plan?: Maybe<Plans>;
  /** fetch data from the table: "plans" */
  plans: Array<Plans>;
  /** fetch data from the table: "regions" */
  regions: Array<Regions>;
  /** fetch data from the table: "regions" using primary key columns */
  regions_by_pk?: Maybe<Regions>;
  /** fetch data from the table: "run_service" using primary key columns */
  runService?: Maybe<Run_Service>;
  runServiceConfig?: Maybe<ConfigRunServiceConfig>;
  runServiceConfigRawJSON: Scalars['String'];
  /** An array relationship */
  runServices: Array<Run_Service>;
  /** fetch aggregated fields from the table: "run_service" */
  runServicesAggregate: Run_Service_Aggregate;
  /** fetch data from the table: "regions_allowed_workspace" using primary key columns */
  selectRegionsAllowedWorkspace?: Maybe<Regions_Allowed_Workspace>;
  /** fetch data from the table: "regions_allowed_workspace" */
  selectRegionsAllowedWorkspaces: Array<Regions_Allowed_Workspace>;
  systemConfig?: Maybe<ConfigSystemConfig>;
  /** fetch data from the table: "auth.users" using primary key columns */
  user?: Maybe<Users>;
  /** fetch data from the table: "auth.users" */
  users: Array<Users>;
  /** fetch data from the table: "workspaces" using primary key columns */
  workspace?: Maybe<Workspaces>;
  /** fetch data from the table: "workspace_members" using primary key columns */
  workspaceMember?: Maybe<WorkspaceMembers>;
  /** fetch data from the table: "workspace_member_invites" using primary key columns */
  workspaceMemberInvite?: Maybe<WorkspaceMemberInvites>;
  /** An array relationship */
  workspaceMemberInvites: Array<WorkspaceMemberInvites>;
  /** An array relationship */
  workspaceMembers: Array<WorkspaceMembers>;
  /** An array relationship */
  workspaces: Array<Workspaces>;
};


export type Query_RootAppArgs = {
  id: Scalars['uuid'];
};


export type Query_RootAppSecretsArgs = {
  appID: Scalars['uuid'];
};


export type Query_RootAppStateHistoriesArgs = {
  distinct_on?: InputMaybe<Array<AppStateHistory_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<AppStateHistory_Order_By>>;
  where?: InputMaybe<AppStateHistory_Bool_Exp>;
};


export type Query_RootAppStateHistoryArgs = {
  id: Scalars['uuid'];
};


export type Query_RootAppsArgs = {
  distinct_on?: InputMaybe<Array<Apps_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<Apps_Order_By>>;
  where?: InputMaybe<Apps_Bool_Exp>;
};


export type Query_RootAuthRefreshTokenArgs = {
  id: Scalars['uuid'];
};


export type Query_RootAuthRefreshTokensArgs = {
  distinct_on?: InputMaybe<Array<AuthRefreshTokens_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<AuthRefreshTokens_Order_By>>;
  where?: InputMaybe<AuthRefreshTokens_Bool_Exp>;
};


export type Query_RootBackupArgs = {
  id: Scalars['uuid'];
};


export type Query_RootBackupsArgs = {
  distinct_on?: InputMaybe<Array<Backups_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<Backups_Order_By>>;
  where?: InputMaybe<Backups_Bool_Exp>;
};


export type Query_RootCliTokenArgs = {
  id: Scalars['uuid'];
};


export type Query_RootCliTokensArgs = {
  distinct_on?: InputMaybe<Array<CliTokens_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<CliTokens_Order_By>>;
  where?: InputMaybe<CliTokens_Bool_Exp>;
};


export type Query_RootConfigArgs = {
  appID: Scalars['uuid'];
  resolve: Scalars['Boolean'];
};


export type Query_RootConfigRawJsonArgs = {
  appID: Scalars['uuid'];
  resolve: Scalars['Boolean'];
};


export type Query_RootContinentsArgs = {
  distinct_on?: InputMaybe<Array<Continents_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<Continents_Order_By>>;
  where?: InputMaybe<Continents_Bool_Exp>;
};


export type Query_RootContinents_By_PkArgs = {
  code: Scalars['bpchar'];
};


export type Query_RootCountriesArgs = {
  distinct_on?: InputMaybe<Array<Countries_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<Countries_Order_By>>;
  where?: InputMaybe<Countries_Bool_Exp>;
};


export type Query_RootCountries_By_PkArgs = {
  code: Scalars['bpchar'];
};


export type Query_RootDeploymentArgs = {
  id: Scalars['uuid'];
};


export type Query_RootDeploymentLogArgs = {
  id: Scalars['uuid'];
};


export type Query_RootDeploymentLogsArgs = {
  distinct_on?: InputMaybe<Array<DeploymentLogs_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<DeploymentLogs_Order_By>>;
  where?: InputMaybe<DeploymentLogs_Bool_Exp>;
};


export type Query_RootDeploymentsArgs = {
  distinct_on?: InputMaybe<Array<Deployments_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<Deployments_Order_By>>;
  where?: InputMaybe<Deployments_Bool_Exp>;
};


export type Query_RootFeatureFlagArgs = {
  id: Scalars['uuid'];
};


export type Query_RootFeatureFlagsArgs = {
  distinct_on?: InputMaybe<Array<FeatureFlags_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<FeatureFlags_Order_By>>;
  where?: InputMaybe<FeatureFlags_Bool_Exp>;
};


export type Query_RootFeedbackArgs = {
  distinct_on?: InputMaybe<Array<Feedback_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<Feedback_Order_By>>;
  where?: InputMaybe<Feedback_Bool_Exp>;
};


export type Query_RootFeedbackOneArgs = {
  id: Scalars['Int'];
};


export type Query_RootGetBackupPresignedUrlArgs = {
  appID: Scalars['String'];
  backupID: Scalars['String'];
  expireInMinutes?: InputMaybe<Scalars['Int']>;
};


export type Query_RootGetCpuSecondsUsageArgs = {
  appID: Scalars['String'];
  from?: InputMaybe<Scalars['Timestamp']>;
  to?: InputMaybe<Scalars['Timestamp']>;
};


export type Query_RootGetEgressVolumeArgs = {
  appID: Scalars['String'];
  from?: InputMaybe<Scalars['Timestamp']>;
  subdomain: Scalars['String'];
  to?: InputMaybe<Scalars['Timestamp']>;
};


export type Query_RootGetFunctionsInvocationsArgs = {
  appID: Scalars['String'];
  from?: InputMaybe<Scalars['Timestamp']>;
  to?: InputMaybe<Scalars['Timestamp']>;
};


export type Query_RootGetLogsVolumeArgs = {
  appID: Scalars['String'];
  from?: InputMaybe<Scalars['Timestamp']>;
  to?: InputMaybe<Scalars['Timestamp']>;
};


export type Query_RootGetPostgresVolumeCapacityArgs = {
  appID: Scalars['String'];
  t?: InputMaybe<Scalars['Timestamp']>;
};


export type Query_RootGetPostgresVolumeUsageArgs = {
  appID: Scalars['String'];
  t?: InputMaybe<Scalars['Timestamp']>;
};


export type Query_RootGetTotalRequestsArgs = {
  appID: Scalars['String'];
  from?: InputMaybe<Scalars['Timestamp']>;
  to?: InputMaybe<Scalars['Timestamp']>;
};


export type Query_RootGithubAppInstallationArgs = {
  id: Scalars['uuid'];
};


export type Query_RootGithubAppInstallationsArgs = {
  distinct_on?: InputMaybe<Array<GithubAppInstallations_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<GithubAppInstallations_Order_By>>;
  where?: InputMaybe<GithubAppInstallations_Bool_Exp>;
};


export type Query_RootGithubRepositoriesArgs = {
  distinct_on?: InputMaybe<Array<GithubRepositories_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<GithubRepositories_Order_By>>;
  where?: InputMaybe<GithubRepositories_Bool_Exp>;
};


export type Query_RootGithubRepositoryArgs = {
  id: Scalars['uuid'];
};


export type Query_RootLogsArgs = {
  appID: Scalars['String'];
  from?: InputMaybe<Scalars['Timestamp']>;
  service?: InputMaybe<Scalars['String']>;
  to?: InputMaybe<Scalars['Timestamp']>;
};


export type Query_RootPaymentMethodArgs = {
  id: Scalars['uuid'];
};


export type Query_RootPaymentMethodsArgs = {
  distinct_on?: InputMaybe<Array<PaymentMethods_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<PaymentMethods_Order_By>>;
  where?: InputMaybe<PaymentMethods_Bool_Exp>;
};


export type Query_RootPlanArgs = {
  id: Scalars['uuid'];
};


export type Query_RootPlansArgs = {
  distinct_on?: InputMaybe<Array<Plans_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<Plans_Order_By>>;
  where?: InputMaybe<Plans_Bool_Exp>;
};


export type Query_RootRegionsArgs = {
  distinct_on?: InputMaybe<Array<Regions_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<Regions_Order_By>>;
  where?: InputMaybe<Regions_Bool_Exp>;
};


export type Query_RootRegions_By_PkArgs = {
  id: Scalars['uuid'];
};


export type Query_RootRunServiceArgs = {
  id: Scalars['uuid'];
};


export type Query_RootRunServiceConfigArgs = {
  appID: Scalars['uuid'];
  resolve: Scalars['Boolean'];
  serviceID: Scalars['uuid'];
};


export type Query_RootRunServiceConfigRawJsonArgs = {
  appID: Scalars['uuid'];
  resolve: Scalars['Boolean'];
  serviceID: Scalars['uuid'];
};


export type Query_RootRunServicesArgs = {
  distinct_on?: InputMaybe<Array<Run_Service_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<Run_Service_Order_By>>;
  where?: InputMaybe<Run_Service_Bool_Exp>;
};


export type Query_RootRunServicesAggregateArgs = {
  distinct_on?: InputMaybe<Array<Run_Service_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<Run_Service_Order_By>>;
  where?: InputMaybe<Run_Service_Bool_Exp>;
};


export type Query_RootSelectRegionsAllowedWorkspaceArgs = {
  id: Scalars['uuid'];
};


export type Query_RootSelectRegionsAllowedWorkspacesArgs = {
  distinct_on?: InputMaybe<Array<Regions_Allowed_Workspace_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<Regions_Allowed_Workspace_Order_By>>;
  where?: InputMaybe<Regions_Allowed_Workspace_Bool_Exp>;
};


export type Query_RootSystemConfigArgs = {
  appID: Scalars['uuid'];
};


export type Query_RootUserArgs = {
  id: Scalars['uuid'];
};


export type Query_RootUsersArgs = {
  distinct_on?: InputMaybe<Array<Users_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<Users_Order_By>>;
  where?: InputMaybe<Users_Bool_Exp>;
};


export type Query_RootWorkspaceArgs = {
  id: Scalars['uuid'];
};


export type Query_RootWorkspaceMemberArgs = {
  id: Scalars['uuid'];
};


export type Query_RootWorkspaceMemberInviteArgs = {
  id: Scalars['uuid'];
};


export type Query_RootWorkspaceMemberInvitesArgs = {
  distinct_on?: InputMaybe<Array<WorkspaceMemberInvites_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<WorkspaceMemberInvites_Order_By>>;
  where?: InputMaybe<WorkspaceMemberInvites_Bool_Exp>;
};


export type Query_RootWorkspaceMembersArgs = {
  distinct_on?: InputMaybe<Array<WorkspaceMembers_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<WorkspaceMembers_Order_By>>;
  where?: InputMaybe<WorkspaceMembers_Bool_Exp>;
};


export type Query_RootWorkspacesArgs = {
  distinct_on?: InputMaybe<Array<Workspaces_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<Workspaces_Order_By>>;
  where?: InputMaybe<Workspaces_Bool_Exp>;
};

export enum Region_Type_Enum {
  /** Private region available to selected workspaces */
  Private = 'private',
  /** Public region available to all Nhost projects */
  Public = 'public'
}

/** Boolean expression to compare columns of type "region_type_enum". All fields are combined with logical 'AND'. */
export type Region_Type_Enum_Comparison_Exp = {
  _eq?: InputMaybe<Region_Type_Enum>;
  _in?: InputMaybe<Array<Region_Type_Enum>>;
  _is_null?: InputMaybe<Scalars['Boolean']>;
  _neq?: InputMaybe<Region_Type_Enum>;
  _nin?: InputMaybe<Array<Region_Type_Enum>>;
};

/** columns and relationships of "regions" */
export type Regions = {
  __typename?: 'regions';
  active: Scalars['Boolean'];
  /** An object relationship */
  allowedWorkspaces?: Maybe<Regions_Allowed_Workspace>;
  /** An array relationship */
  apps: Array<Apps>;
  awsName: Scalars['String'];
  city: Scalars['String'];
  /** An object relationship */
  country: Countries;
  countryCode: Scalars['String'];
  description?: Maybe<Scalars['String']>;
  domain: Scalars['String'];
  id: Scalars['uuid'];
  isGdprCompliant: Scalars['Boolean'];
  /** An array relationship */
  regions_allowed_workspaces: Array<Regions_Allowed_Workspace>;
  type: Region_Type_Enum;
};


/** columns and relationships of "regions" */
export type RegionsAppsArgs = {
  distinct_on?: InputMaybe<Array<Apps_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<Apps_Order_By>>;
  where?: InputMaybe<Apps_Bool_Exp>;
};


/** columns and relationships of "regions" */
export type RegionsRegions_Allowed_WorkspacesArgs = {
  distinct_on?: InputMaybe<Array<Regions_Allowed_Workspace_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<Regions_Allowed_Workspace_Order_By>>;
  where?: InputMaybe<Regions_Allowed_Workspace_Bool_Exp>;
};

/** order by aggregate values of table "regions" */
export type Regions_Aggregate_Order_By = {
  count?: InputMaybe<Order_By>;
  max?: InputMaybe<Regions_Max_Order_By>;
  min?: InputMaybe<Regions_Min_Order_By>;
};

/** columns and relationships of "regions_allowed_workspace" */
export type Regions_Allowed_Workspace = {
  __typename?: 'regions_allowed_workspace';
  created_at: Scalars['timestamptz'];
  description: Scalars['String'];
  id: Scalars['uuid'];
  /** An object relationship */
  region?: Maybe<Regions>;
  region_id: Scalars['uuid'];
  updated_at: Scalars['timestamptz'];
  /** An object relationship */
  workspace?: Maybe<Workspaces>;
  workspace_id: Scalars['uuid'];
};

/** order by aggregate values of table "regions_allowed_workspace" */
export type Regions_Allowed_Workspace_Aggregate_Order_By = {
  count?: InputMaybe<Order_By>;
  max?: InputMaybe<Regions_Allowed_Workspace_Max_Order_By>;
  min?: InputMaybe<Regions_Allowed_Workspace_Min_Order_By>;
};

/** Boolean expression to filter rows from the table "regions_allowed_workspace". All fields are combined with a logical 'AND'. */
export type Regions_Allowed_Workspace_Bool_Exp = {
  _and?: InputMaybe<Array<Regions_Allowed_Workspace_Bool_Exp>>;
  _not?: InputMaybe<Regions_Allowed_Workspace_Bool_Exp>;
  _or?: InputMaybe<Array<Regions_Allowed_Workspace_Bool_Exp>>;
  created_at?: InputMaybe<Timestamptz_Comparison_Exp>;
  description?: InputMaybe<String_Comparison_Exp>;
  id?: InputMaybe<Uuid_Comparison_Exp>;
  region?: InputMaybe<Regions_Bool_Exp>;
  region_id?: InputMaybe<Uuid_Comparison_Exp>;
  updated_at?: InputMaybe<Timestamptz_Comparison_Exp>;
  workspace?: InputMaybe<Workspaces_Bool_Exp>;
  workspace_id?: InputMaybe<Uuid_Comparison_Exp>;
};

/** order by max() on columns of table "regions_allowed_workspace" */
export type Regions_Allowed_Workspace_Max_Order_By = {
  created_at?: InputMaybe<Order_By>;
  description?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  region_id?: InputMaybe<Order_By>;
  updated_at?: InputMaybe<Order_By>;
  workspace_id?: InputMaybe<Order_By>;
};

/** order by min() on columns of table "regions_allowed_workspace" */
export type Regions_Allowed_Workspace_Min_Order_By = {
  created_at?: InputMaybe<Order_By>;
  description?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  region_id?: InputMaybe<Order_By>;
  updated_at?: InputMaybe<Order_By>;
  workspace_id?: InputMaybe<Order_By>;
};

/** Ordering options when selecting data from "regions_allowed_workspace". */
export type Regions_Allowed_Workspace_Order_By = {
  created_at?: InputMaybe<Order_By>;
  description?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  region?: InputMaybe<Regions_Order_By>;
  region_id?: InputMaybe<Order_By>;
  updated_at?: InputMaybe<Order_By>;
  workspace?: InputMaybe<Workspaces_Order_By>;
  workspace_id?: InputMaybe<Order_By>;
};

/** select columns of table "regions_allowed_workspace" */
export enum Regions_Allowed_Workspace_Select_Column {
  /** column name */
  CreatedAt = 'created_at',
  /** column name */
  Description = 'description',
  /** column name */
  Id = 'id',
  /** column name */
  RegionId = 'region_id',
  /** column name */
  UpdatedAt = 'updated_at',
  /** column name */
  WorkspaceId = 'workspace_id'
}

/** Streaming cursor of the table "regions_allowed_workspace" */
export type Regions_Allowed_Workspace_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: Regions_Allowed_Workspace_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type Regions_Allowed_Workspace_Stream_Cursor_Value_Input = {
  created_at?: InputMaybe<Scalars['timestamptz']>;
  description?: InputMaybe<Scalars['String']>;
  id?: InputMaybe<Scalars['uuid']>;
  region_id?: InputMaybe<Scalars['uuid']>;
  updated_at?: InputMaybe<Scalars['timestamptz']>;
  workspace_id?: InputMaybe<Scalars['uuid']>;
};

/** Boolean expression to filter rows from the table "regions". All fields are combined with a logical 'AND'. */
export type Regions_Bool_Exp = {
  _and?: InputMaybe<Array<Regions_Bool_Exp>>;
  _not?: InputMaybe<Regions_Bool_Exp>;
  _or?: InputMaybe<Array<Regions_Bool_Exp>>;
  active?: InputMaybe<Boolean_Comparison_Exp>;
  allowedWorkspaces?: InputMaybe<Regions_Allowed_Workspace_Bool_Exp>;
  apps?: InputMaybe<Apps_Bool_Exp>;
  awsName?: InputMaybe<String_Comparison_Exp>;
  city?: InputMaybe<String_Comparison_Exp>;
  country?: InputMaybe<Countries_Bool_Exp>;
  countryCode?: InputMaybe<String_Comparison_Exp>;
  description?: InputMaybe<String_Comparison_Exp>;
  domain?: InputMaybe<String_Comparison_Exp>;
  id?: InputMaybe<Uuid_Comparison_Exp>;
  isGdprCompliant?: InputMaybe<Boolean_Comparison_Exp>;
  regions_allowed_workspaces?: InputMaybe<Regions_Allowed_Workspace_Bool_Exp>;
  type?: InputMaybe<Region_Type_Enum_Comparison_Exp>;
};

/** order by max() on columns of table "regions" */
export type Regions_Max_Order_By = {
  awsName?: InputMaybe<Order_By>;
  city?: InputMaybe<Order_By>;
  countryCode?: InputMaybe<Order_By>;
  description?: InputMaybe<Order_By>;
  domain?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
};

/** order by min() on columns of table "regions" */
export type Regions_Min_Order_By = {
  awsName?: InputMaybe<Order_By>;
  city?: InputMaybe<Order_By>;
  countryCode?: InputMaybe<Order_By>;
  description?: InputMaybe<Order_By>;
  domain?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
};

/** Ordering options when selecting data from "regions". */
export type Regions_Order_By = {
  active?: InputMaybe<Order_By>;
  allowedWorkspaces?: InputMaybe<Regions_Allowed_Workspace_Order_By>;
  apps_aggregate?: InputMaybe<Apps_Aggregate_Order_By>;
  awsName?: InputMaybe<Order_By>;
  city?: InputMaybe<Order_By>;
  country?: InputMaybe<Countries_Order_By>;
  countryCode?: InputMaybe<Order_By>;
  description?: InputMaybe<Order_By>;
  domain?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  isGdprCompliant?: InputMaybe<Order_By>;
  regions_allowed_workspaces_aggregate?: InputMaybe<Regions_Allowed_Workspace_Aggregate_Order_By>;
  type?: InputMaybe<Order_By>;
};

/** select columns of table "regions" */
export enum Regions_Select_Column {
  /** column name */
  Active = 'active',
  /** column name */
  AwsName = 'awsName',
  /** column name */
  City = 'city',
  /** column name */
  CountryCode = 'countryCode',
  /** column name */
  Description = 'description',
  /** column name */
  Domain = 'domain',
  /** column name */
  Id = 'id',
  /** column name */
  IsGdprCompliant = 'isGdprCompliant',
  /** column name */
  Type = 'type'
}

/** Streaming cursor of the table "regions" */
export type Regions_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: Regions_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type Regions_Stream_Cursor_Value_Input = {
  active?: InputMaybe<Scalars['Boolean']>;
  awsName?: InputMaybe<Scalars['String']>;
  city?: InputMaybe<Scalars['String']>;
  countryCode?: InputMaybe<Scalars['String']>;
  description?: InputMaybe<Scalars['String']>;
  domain?: InputMaybe<Scalars['String']>;
  id?: InputMaybe<Scalars['uuid']>;
  isGdprCompliant?: InputMaybe<Scalars['Boolean']>;
  type?: InputMaybe<Region_Type_Enum>;
};

/** columns and relationships of "run_service" */
export type Run_Service = {
  __typename?: 'run_service';
  /** An object relationship */
  app: Apps;
  appID: Scalars['uuid'];
  config?: Maybe<ConfigRunServiceConfig>;
  createdAt: Scalars['timestamptz'];
  /** An object relationship */
  creator: Users;
  creatorUserId: Scalars['uuid'];
  id: Scalars['uuid'];
  updatedAt: Scalars['timestamptz'];
};


/** columns and relationships of "run_service" */
export type Run_ServiceConfigArgs = {
  resolve: Scalars['Boolean'];
};

/** aggregated selection of "run_service" */
export type Run_Service_Aggregate = {
  __typename?: 'run_service_aggregate';
  aggregate?: Maybe<Run_Service_Aggregate_Fields>;
  nodes: Array<Run_Service>;
};

export type Run_Service_Aggregate_Bool_Exp = {
  count?: InputMaybe<Run_Service_Aggregate_Bool_Exp_Count>;
};

export type Run_Service_Aggregate_Bool_Exp_Count = {
  arguments?: InputMaybe<Array<Run_Service_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']>;
  filter?: InputMaybe<Run_Service_Bool_Exp>;
  predicate: Int_Comparison_Exp;
};

/** aggregate fields of "run_service" */
export type Run_Service_Aggregate_Fields = {
  __typename?: 'run_service_aggregate_fields';
  count: Scalars['Int'];
  max?: Maybe<Run_Service_Max_Fields>;
  min?: Maybe<Run_Service_Min_Fields>;
};


/** aggregate fields of "run_service" */
export type Run_Service_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<Run_Service_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']>;
};

/** order by aggregate values of table "run_service" */
export type Run_Service_Aggregate_Order_By = {
  count?: InputMaybe<Order_By>;
  max?: InputMaybe<Run_Service_Max_Order_By>;
  min?: InputMaybe<Run_Service_Min_Order_By>;
};

/** input type for inserting array relation for remote table "run_service" */
export type Run_Service_Arr_Rel_Insert_Input = {
  data: Array<Run_Service_Insert_Input>;
  /** upsert condition */
  on_conflict?: InputMaybe<Run_Service_On_Conflict>;
};

/** Boolean expression to filter rows from the table "run_service". All fields are combined with a logical 'AND'. */
export type Run_Service_Bool_Exp = {
  _and?: InputMaybe<Array<Run_Service_Bool_Exp>>;
  _not?: InputMaybe<Run_Service_Bool_Exp>;
  _or?: InputMaybe<Array<Run_Service_Bool_Exp>>;
  app?: InputMaybe<Apps_Bool_Exp>;
  appID?: InputMaybe<Uuid_Comparison_Exp>;
  createdAt?: InputMaybe<Timestamptz_Comparison_Exp>;
  creator?: InputMaybe<Users_Bool_Exp>;
  creatorUserId?: InputMaybe<Uuid_Comparison_Exp>;
  id?: InputMaybe<Uuid_Comparison_Exp>;
  updatedAt?: InputMaybe<Timestamptz_Comparison_Exp>;
};

/** unique or primary key constraints on table "run_service" */
export enum Run_Service_Constraint {
  /** unique or primary key constraint on columns "id" */
  RunServicePkey = 'run_service_pkey'
}

/** input type for inserting data into table "run_service" */
export type Run_Service_Insert_Input = {
  app?: InputMaybe<Apps_Obj_Rel_Insert_Input>;
  appID?: InputMaybe<Scalars['uuid']>;
};

/** aggregate max on columns */
export type Run_Service_Max_Fields = {
  __typename?: 'run_service_max_fields';
  appID?: Maybe<Scalars['uuid']>;
  createdAt?: Maybe<Scalars['timestamptz']>;
  creatorUserId?: Maybe<Scalars['uuid']>;
  id?: Maybe<Scalars['uuid']>;
  updatedAt?: Maybe<Scalars['timestamptz']>;
};

/** order by max() on columns of table "run_service" */
export type Run_Service_Max_Order_By = {
  appID?: InputMaybe<Order_By>;
  createdAt?: InputMaybe<Order_By>;
  creatorUserId?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  updatedAt?: InputMaybe<Order_By>;
};

/** aggregate min on columns */
export type Run_Service_Min_Fields = {
  __typename?: 'run_service_min_fields';
  appID?: Maybe<Scalars['uuid']>;
  createdAt?: Maybe<Scalars['timestamptz']>;
  creatorUserId?: Maybe<Scalars['uuid']>;
  id?: Maybe<Scalars['uuid']>;
  updatedAt?: Maybe<Scalars['timestamptz']>;
};

/** order by min() on columns of table "run_service" */
export type Run_Service_Min_Order_By = {
  appID?: InputMaybe<Order_By>;
  createdAt?: InputMaybe<Order_By>;
  creatorUserId?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  updatedAt?: InputMaybe<Order_By>;
};

/** response of any mutation on the table "run_service" */
export type Run_Service_Mutation_Response = {
  __typename?: 'run_service_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int'];
  /** data from the rows affected by the mutation */
  returning: Array<Run_Service>;
};

/** on_conflict condition type for table "run_service" */
export type Run_Service_On_Conflict = {
  constraint: Run_Service_Constraint;
  update_columns?: Array<Run_Service_Update_Column>;
  where?: InputMaybe<Run_Service_Bool_Exp>;
};

/** Ordering options when selecting data from "run_service". */
export type Run_Service_Order_By = {
  app?: InputMaybe<Apps_Order_By>;
  appID?: InputMaybe<Order_By>;
  createdAt?: InputMaybe<Order_By>;
  creator?: InputMaybe<Users_Order_By>;
  creatorUserId?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  updatedAt?: InputMaybe<Order_By>;
};

/** select columns of table "run_service" */
export enum Run_Service_Select_Column {
  /** column name */
  AppId = 'appID',
  /** column name */
  CreatedAt = 'createdAt',
  /** column name */
  CreatorUserId = 'creatorUserId',
  /** column name */
  Id = 'id',
  /** column name */
  UpdatedAt = 'updatedAt'
}

/** Streaming cursor of the table "run_service" */
export type Run_Service_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: Run_Service_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type Run_Service_Stream_Cursor_Value_Input = {
  appID?: InputMaybe<Scalars['uuid']>;
  createdAt?: InputMaybe<Scalars['timestamptz']>;
  creatorUserId?: InputMaybe<Scalars['uuid']>;
  id?: InputMaybe<Scalars['uuid']>;
  updatedAt?: InputMaybe<Scalars['timestamptz']>;
};

/** placeholder for update columns of table "run_service" (current role has no relevant permissions) */
export enum Run_Service_Update_Column {
  /** placeholder (do not use) */
  Placeholder = '_PLACEHOLDER'
}

export type Subscription_Root = {
  __typename?: 'subscription_root';
  /** fetch data from the table: "apps" using primary key columns */
  app?: Maybe<Apps>;
  /** fetch data from the table: "app_state_history" */
  appStateHistories: Array<AppStateHistory>;
  /** fetch data from the table: "app_state_history" using primary key columns */
  appStateHistory?: Maybe<AppStateHistory>;
  /** fetch data from the table in a streaming manner: "app_state_history" */
  appStateHistory_stream: Array<AppStateHistory>;
  /** An array relationship */
  apps: Array<Apps>;
  /** fetch data from the table in a streaming manner: "apps" */
  apps_stream: Array<Apps>;
  /** fetch data from the table: "auth.refresh_tokens" using primary key columns */
  authRefreshToken?: Maybe<AuthRefreshTokens>;
  /** fetch data from the table: "auth.refresh_tokens" */
  authRefreshTokens: Array<AuthRefreshTokens>;
  /** fetch data from the table in a streaming manner: "auth.refresh_tokens" */
  authRefreshTokens_stream: Array<AuthRefreshTokens>;
  /** fetch data from the table: "backups" using primary key columns */
  backup?: Maybe<Backups>;
  /** An array relationship */
  backups: Array<Backups>;
  /** fetch data from the table in a streaming manner: "backups" */
  backups_stream: Array<Backups>;
  /** fetch data from the table: "cli_tokens" using primary key columns */
  cliToken?: Maybe<CliTokens>;
  /** An array relationship */
  cliTokens: Array<CliTokens>;
  /** fetch data from the table in a streaming manner: "cli_tokens" */
  cliTokens_stream: Array<CliTokens>;
  /** fetch data from the table: "continents" */
  continents: Array<Continents>;
  /** fetch data from the table: "continents" using primary key columns */
  continents_by_pk?: Maybe<Continents>;
  /** fetch data from the table in a streaming manner: "continents" */
  continents_stream: Array<Continents>;
  /** An array relationship */
  countries: Array<Countries>;
  /** fetch data from the table: "countries" using primary key columns */
  countries_by_pk?: Maybe<Countries>;
  /** fetch data from the table in a streaming manner: "countries" */
  countries_stream: Array<Countries>;
  /** fetch data from the table: "deployments" using primary key columns */
  deployment?: Maybe<Deployments>;
  /** fetch data from the table: "deployment_logs" using primary key columns */
  deploymentLog?: Maybe<DeploymentLogs>;
  /** An array relationship */
  deploymentLogs: Array<DeploymentLogs>;
  /** fetch data from the table in a streaming manner: "deployment_logs" */
  deploymentLogs_stream: Array<DeploymentLogs>;
  /** An array relationship */
  deployments: Array<Deployments>;
  /** fetch data from the table in a streaming manner: "deployments" */
  deployments_stream: Array<Deployments>;
  /** fetch data from the table: "feature_flags" using primary key columns */
  featureFlag?: Maybe<FeatureFlags>;
  /** An array relationship */
  featureFlags: Array<FeatureFlags>;
  /** fetch data from the table in a streaming manner: "feature_flags" */
  featureFlags_stream: Array<FeatureFlags>;
  /** fetch data from the table: "feedback" */
  feedback: Array<Feedback>;
  /** fetch data from the table: "feedback" using primary key columns */
  feedbackOne?: Maybe<Feedback>;
  /** fetch data from the table in a streaming manner: "feedback" */
  feedback_stream: Array<Feedback>;
  /** fetch data from the table: "github_app_installations" using primary key columns */
  githubAppInstallation?: Maybe<GithubAppInstallations>;
  /** fetch data from the table: "github_app_installations" */
  githubAppInstallations: Array<GithubAppInstallations>;
  /** fetch data from the table in a streaming manner: "github_app_installations" */
  githubAppInstallations_stream: Array<GithubAppInstallations>;
  /** An array relationship */
  githubRepositories: Array<GithubRepositories>;
  /** fetch data from the table in a streaming manner: "github_repositories" */
  githubRepositories_stream: Array<GithubRepositories>;
  /** fetch data from the table: "github_repositories" using primary key columns */
  githubRepository?: Maybe<GithubRepositories>;
  /** fetch data from the table: "payment_methods" using primary key columns */
  paymentMethod?: Maybe<PaymentMethods>;
  /** An array relationship */
  paymentMethods: Array<PaymentMethods>;
  /** fetch data from the table in a streaming manner: "payment_methods" */
  paymentMethods_stream: Array<PaymentMethods>;
  /** fetch data from the table: "plans" using primary key columns */
  plan?: Maybe<Plans>;
  /** fetch data from the table: "plans" */
  plans: Array<Plans>;
  /** fetch data from the table in a streaming manner: "plans" */
  plans_stream: Array<Plans>;
  /** fetch data from the table: "regions" */
  regions: Array<Regions>;
  /** fetch data from the table in a streaming manner: "regions_allowed_workspace" */
  regions_allowed_workspace_stream: Array<Regions_Allowed_Workspace>;
  /** fetch data from the table: "regions" using primary key columns */
  regions_by_pk?: Maybe<Regions>;
  /** fetch data from the table in a streaming manner: "regions" */
  regions_stream: Array<Regions>;
  /** fetch data from the table: "run_service" using primary key columns */
  runService?: Maybe<Run_Service>;
  /** An array relationship */
  runServices: Array<Run_Service>;
  /** fetch aggregated fields from the table: "run_service" */
  runServicesAggregate: Run_Service_Aggregate;
  /** fetch data from the table in a streaming manner: "run_service" */
  run_service_stream: Array<Run_Service>;
  /** fetch data from the table: "regions_allowed_workspace" using primary key columns */
  selectRegionsAllowedWorkspace?: Maybe<Regions_Allowed_Workspace>;
  /** fetch data from the table: "regions_allowed_workspace" */
  selectRegionsAllowedWorkspaces: Array<Regions_Allowed_Workspace>;
  /** fetch data from the table: "auth.users" using primary key columns */
  user?: Maybe<Users>;
  /** fetch data from the table: "auth.users" */
  users: Array<Users>;
  /** fetch data from the table in a streaming manner: "auth.users" */
  users_stream: Array<Users>;
  /** fetch data from the table: "workspaces" using primary key columns */
  workspace?: Maybe<Workspaces>;
  /** fetch data from the table: "workspace_members" using primary key columns */
  workspaceMember?: Maybe<WorkspaceMembers>;
  /** fetch data from the table: "workspace_member_invites" using primary key columns */
  workspaceMemberInvite?: Maybe<WorkspaceMemberInvites>;
  /** An array relationship */
  workspaceMemberInvites: Array<WorkspaceMemberInvites>;
  /** fetch data from the table in a streaming manner: "workspace_member_invites" */
  workspaceMemberInvites_stream: Array<WorkspaceMemberInvites>;
  /** An array relationship */
  workspaceMembers: Array<WorkspaceMembers>;
  /** fetch data from the table in a streaming manner: "workspace_members" */
  workspaceMembers_stream: Array<WorkspaceMembers>;
  /** An array relationship */
  workspaces: Array<Workspaces>;
  /** fetch data from the table in a streaming manner: "workspaces" */
  workspaces_stream: Array<Workspaces>;
};


export type Subscription_RootAppArgs = {
  id: Scalars['uuid'];
};


export type Subscription_RootAppStateHistoriesArgs = {
  distinct_on?: InputMaybe<Array<AppStateHistory_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<AppStateHistory_Order_By>>;
  where?: InputMaybe<AppStateHistory_Bool_Exp>;
};


export type Subscription_RootAppStateHistoryArgs = {
  id: Scalars['uuid'];
};


export type Subscription_RootAppStateHistory_StreamArgs = {
  batch_size: Scalars['Int'];
  cursor: Array<InputMaybe<AppStateHistory_Stream_Cursor_Input>>;
  where?: InputMaybe<AppStateHistory_Bool_Exp>;
};


export type Subscription_RootAppsArgs = {
  distinct_on?: InputMaybe<Array<Apps_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<Apps_Order_By>>;
  where?: InputMaybe<Apps_Bool_Exp>;
};


export type Subscription_RootApps_StreamArgs = {
  batch_size: Scalars['Int'];
  cursor: Array<InputMaybe<Apps_Stream_Cursor_Input>>;
  where?: InputMaybe<Apps_Bool_Exp>;
};


export type Subscription_RootAuthRefreshTokenArgs = {
  id: Scalars['uuid'];
};


export type Subscription_RootAuthRefreshTokensArgs = {
  distinct_on?: InputMaybe<Array<AuthRefreshTokens_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<AuthRefreshTokens_Order_By>>;
  where?: InputMaybe<AuthRefreshTokens_Bool_Exp>;
};


export type Subscription_RootAuthRefreshTokens_StreamArgs = {
  batch_size: Scalars['Int'];
  cursor: Array<InputMaybe<AuthRefreshTokens_Stream_Cursor_Input>>;
  where?: InputMaybe<AuthRefreshTokens_Bool_Exp>;
};


export type Subscription_RootBackupArgs = {
  id: Scalars['uuid'];
};


export type Subscription_RootBackupsArgs = {
  distinct_on?: InputMaybe<Array<Backups_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<Backups_Order_By>>;
  where?: InputMaybe<Backups_Bool_Exp>;
};


export type Subscription_RootBackups_StreamArgs = {
  batch_size: Scalars['Int'];
  cursor: Array<InputMaybe<Backups_Stream_Cursor_Input>>;
  where?: InputMaybe<Backups_Bool_Exp>;
};


export type Subscription_RootCliTokenArgs = {
  id: Scalars['uuid'];
};


export type Subscription_RootCliTokensArgs = {
  distinct_on?: InputMaybe<Array<CliTokens_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<CliTokens_Order_By>>;
  where?: InputMaybe<CliTokens_Bool_Exp>;
};


export type Subscription_RootCliTokens_StreamArgs = {
  batch_size: Scalars['Int'];
  cursor: Array<InputMaybe<CliTokens_Stream_Cursor_Input>>;
  where?: InputMaybe<CliTokens_Bool_Exp>;
};


export type Subscription_RootContinentsArgs = {
  distinct_on?: InputMaybe<Array<Continents_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<Continents_Order_By>>;
  where?: InputMaybe<Continents_Bool_Exp>;
};


export type Subscription_RootContinents_By_PkArgs = {
  code: Scalars['bpchar'];
};


export type Subscription_RootContinents_StreamArgs = {
  batch_size: Scalars['Int'];
  cursor: Array<InputMaybe<Continents_Stream_Cursor_Input>>;
  where?: InputMaybe<Continents_Bool_Exp>;
};


export type Subscription_RootCountriesArgs = {
  distinct_on?: InputMaybe<Array<Countries_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<Countries_Order_By>>;
  where?: InputMaybe<Countries_Bool_Exp>;
};


export type Subscription_RootCountries_By_PkArgs = {
  code: Scalars['bpchar'];
};


export type Subscription_RootCountries_StreamArgs = {
  batch_size: Scalars['Int'];
  cursor: Array<InputMaybe<Countries_Stream_Cursor_Input>>;
  where?: InputMaybe<Countries_Bool_Exp>;
};


export type Subscription_RootDeploymentArgs = {
  id: Scalars['uuid'];
};


export type Subscription_RootDeploymentLogArgs = {
  id: Scalars['uuid'];
};


export type Subscription_RootDeploymentLogsArgs = {
  distinct_on?: InputMaybe<Array<DeploymentLogs_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<DeploymentLogs_Order_By>>;
  where?: InputMaybe<DeploymentLogs_Bool_Exp>;
};


export type Subscription_RootDeploymentLogs_StreamArgs = {
  batch_size: Scalars['Int'];
  cursor: Array<InputMaybe<DeploymentLogs_Stream_Cursor_Input>>;
  where?: InputMaybe<DeploymentLogs_Bool_Exp>;
};


export type Subscription_RootDeploymentsArgs = {
  distinct_on?: InputMaybe<Array<Deployments_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<Deployments_Order_By>>;
  where?: InputMaybe<Deployments_Bool_Exp>;
};


export type Subscription_RootDeployments_StreamArgs = {
  batch_size: Scalars['Int'];
  cursor: Array<InputMaybe<Deployments_Stream_Cursor_Input>>;
  where?: InputMaybe<Deployments_Bool_Exp>;
};


export type Subscription_RootFeatureFlagArgs = {
  id: Scalars['uuid'];
};


export type Subscription_RootFeatureFlagsArgs = {
  distinct_on?: InputMaybe<Array<FeatureFlags_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<FeatureFlags_Order_By>>;
  where?: InputMaybe<FeatureFlags_Bool_Exp>;
};


export type Subscription_RootFeatureFlags_StreamArgs = {
  batch_size: Scalars['Int'];
  cursor: Array<InputMaybe<FeatureFlags_Stream_Cursor_Input>>;
  where?: InputMaybe<FeatureFlags_Bool_Exp>;
};


export type Subscription_RootFeedbackArgs = {
  distinct_on?: InputMaybe<Array<Feedback_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<Feedback_Order_By>>;
  where?: InputMaybe<Feedback_Bool_Exp>;
};


export type Subscription_RootFeedbackOneArgs = {
  id: Scalars['Int'];
};


export type Subscription_RootFeedback_StreamArgs = {
  batch_size: Scalars['Int'];
  cursor: Array<InputMaybe<Feedback_Stream_Cursor_Input>>;
  where?: InputMaybe<Feedback_Bool_Exp>;
};


export type Subscription_RootGithubAppInstallationArgs = {
  id: Scalars['uuid'];
};


export type Subscription_RootGithubAppInstallationsArgs = {
  distinct_on?: InputMaybe<Array<GithubAppInstallations_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<GithubAppInstallations_Order_By>>;
  where?: InputMaybe<GithubAppInstallations_Bool_Exp>;
};


export type Subscription_RootGithubAppInstallations_StreamArgs = {
  batch_size: Scalars['Int'];
  cursor: Array<InputMaybe<GithubAppInstallations_Stream_Cursor_Input>>;
  where?: InputMaybe<GithubAppInstallations_Bool_Exp>;
};


export type Subscription_RootGithubRepositoriesArgs = {
  distinct_on?: InputMaybe<Array<GithubRepositories_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<GithubRepositories_Order_By>>;
  where?: InputMaybe<GithubRepositories_Bool_Exp>;
};


export type Subscription_RootGithubRepositories_StreamArgs = {
  batch_size: Scalars['Int'];
  cursor: Array<InputMaybe<GithubRepositories_Stream_Cursor_Input>>;
  where?: InputMaybe<GithubRepositories_Bool_Exp>;
};


export type Subscription_RootGithubRepositoryArgs = {
  id: Scalars['uuid'];
};


export type Subscription_RootPaymentMethodArgs = {
  id: Scalars['uuid'];
};


export type Subscription_RootPaymentMethodsArgs = {
  distinct_on?: InputMaybe<Array<PaymentMethods_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<PaymentMethods_Order_By>>;
  where?: InputMaybe<PaymentMethods_Bool_Exp>;
};


export type Subscription_RootPaymentMethods_StreamArgs = {
  batch_size: Scalars['Int'];
  cursor: Array<InputMaybe<PaymentMethods_Stream_Cursor_Input>>;
  where?: InputMaybe<PaymentMethods_Bool_Exp>;
};


export type Subscription_RootPlanArgs = {
  id: Scalars['uuid'];
};


export type Subscription_RootPlansArgs = {
  distinct_on?: InputMaybe<Array<Plans_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<Plans_Order_By>>;
  where?: InputMaybe<Plans_Bool_Exp>;
};


export type Subscription_RootPlans_StreamArgs = {
  batch_size: Scalars['Int'];
  cursor: Array<InputMaybe<Plans_Stream_Cursor_Input>>;
  where?: InputMaybe<Plans_Bool_Exp>;
};


export type Subscription_RootRegionsArgs = {
  distinct_on?: InputMaybe<Array<Regions_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<Regions_Order_By>>;
  where?: InputMaybe<Regions_Bool_Exp>;
};


export type Subscription_RootRegions_Allowed_Workspace_StreamArgs = {
  batch_size: Scalars['Int'];
  cursor: Array<InputMaybe<Regions_Allowed_Workspace_Stream_Cursor_Input>>;
  where?: InputMaybe<Regions_Allowed_Workspace_Bool_Exp>;
};


export type Subscription_RootRegions_By_PkArgs = {
  id: Scalars['uuid'];
};


export type Subscription_RootRegions_StreamArgs = {
  batch_size: Scalars['Int'];
  cursor: Array<InputMaybe<Regions_Stream_Cursor_Input>>;
  where?: InputMaybe<Regions_Bool_Exp>;
};


export type Subscription_RootRunServiceArgs = {
  id: Scalars['uuid'];
};


export type Subscription_RootRunServicesArgs = {
  distinct_on?: InputMaybe<Array<Run_Service_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<Run_Service_Order_By>>;
  where?: InputMaybe<Run_Service_Bool_Exp>;
};


export type Subscription_RootRunServicesAggregateArgs = {
  distinct_on?: InputMaybe<Array<Run_Service_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<Run_Service_Order_By>>;
  where?: InputMaybe<Run_Service_Bool_Exp>;
};


export type Subscription_RootRun_Service_StreamArgs = {
  batch_size: Scalars['Int'];
  cursor: Array<InputMaybe<Run_Service_Stream_Cursor_Input>>;
  where?: InputMaybe<Run_Service_Bool_Exp>;
};


export type Subscription_RootSelectRegionsAllowedWorkspaceArgs = {
  id: Scalars['uuid'];
};


export type Subscription_RootSelectRegionsAllowedWorkspacesArgs = {
  distinct_on?: InputMaybe<Array<Regions_Allowed_Workspace_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<Regions_Allowed_Workspace_Order_By>>;
  where?: InputMaybe<Regions_Allowed_Workspace_Bool_Exp>;
};


export type Subscription_RootUserArgs = {
  id: Scalars['uuid'];
};


export type Subscription_RootUsersArgs = {
  distinct_on?: InputMaybe<Array<Users_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<Users_Order_By>>;
  where?: InputMaybe<Users_Bool_Exp>;
};


export type Subscription_RootUsers_StreamArgs = {
  batch_size: Scalars['Int'];
  cursor: Array<InputMaybe<Users_Stream_Cursor_Input>>;
  where?: InputMaybe<Users_Bool_Exp>;
};


export type Subscription_RootWorkspaceArgs = {
  id: Scalars['uuid'];
};


export type Subscription_RootWorkspaceMemberArgs = {
  id: Scalars['uuid'];
};


export type Subscription_RootWorkspaceMemberInviteArgs = {
  id: Scalars['uuid'];
};


export type Subscription_RootWorkspaceMemberInvitesArgs = {
  distinct_on?: InputMaybe<Array<WorkspaceMemberInvites_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<WorkspaceMemberInvites_Order_By>>;
  where?: InputMaybe<WorkspaceMemberInvites_Bool_Exp>;
};


export type Subscription_RootWorkspaceMemberInvites_StreamArgs = {
  batch_size: Scalars['Int'];
  cursor: Array<InputMaybe<WorkspaceMemberInvites_Stream_Cursor_Input>>;
  where?: InputMaybe<WorkspaceMemberInvites_Bool_Exp>;
};


export type Subscription_RootWorkspaceMembersArgs = {
  distinct_on?: InputMaybe<Array<WorkspaceMembers_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<WorkspaceMembers_Order_By>>;
  where?: InputMaybe<WorkspaceMembers_Bool_Exp>;
};


export type Subscription_RootWorkspaceMembers_StreamArgs = {
  batch_size: Scalars['Int'];
  cursor: Array<InputMaybe<WorkspaceMembers_Stream_Cursor_Input>>;
  where?: InputMaybe<WorkspaceMembers_Bool_Exp>;
};


export type Subscription_RootWorkspacesArgs = {
  distinct_on?: InputMaybe<Array<Workspaces_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<Workspaces_Order_By>>;
  where?: InputMaybe<Workspaces_Bool_Exp>;
};


export type Subscription_RootWorkspaces_StreamArgs = {
  batch_size: Scalars['Int'];
  cursor: Array<InputMaybe<Workspaces_Stream_Cursor_Input>>;
  where?: InputMaybe<Workspaces_Bool_Exp>;
};

/** Boolean expression to compare columns of type "timestamptz". All fields are combined with logical 'AND'. */
export type Timestamptz_Comparison_Exp = {
  _eq?: InputMaybe<Scalars['timestamptz']>;
  _gt?: InputMaybe<Scalars['timestamptz']>;
  _gte?: InputMaybe<Scalars['timestamptz']>;
  _in?: InputMaybe<Array<Scalars['timestamptz']>>;
  _is_null?: InputMaybe<Scalars['Boolean']>;
  _lt?: InputMaybe<Scalars['timestamptz']>;
  _lte?: InputMaybe<Scalars['timestamptz']>;
  _neq?: InputMaybe<Scalars['timestamptz']>;
  _nin?: InputMaybe<Array<Scalars['timestamptz']>>;
};

/** User account information. Don't modify its structure as Hasura Auth relies on it to function properly. */
export type Users = {
  __typename?: 'users';
  /** An array relationship */
  apps: Array<Apps>;
  avatarUrl: Scalars['String'];
  /** An array relationship */
  cliTokens: Array<CliTokens>;
  /** An array relationship */
  creatorOfWorkspaces: Array<Workspaces>;
  displayName: Scalars['String'];
  email?: Maybe<Scalars['citext']>;
  /** An array relationship */
  feedbacks: Array<Feedback>;
  /** An array relationship */
  github_app_installations: Array<GithubAppInstallations>;
  id: Scalars['uuid'];
  /** An array relationship */
  payment_methods: Array<PaymentMethods>;
  /** An array relationship */
  refreshTokens: Array<AuthRefreshTokens>;
  /** An array relationship */
  runServices: Array<Run_Service>;
  /** An aggregate relationship */
  runServices_aggregate: Run_Service_Aggregate;
  /** An array relationship */
  workspaceMemberInvitesByInvitedByUserId: Array<WorkspaceMemberInvites>;
  /** An array relationship */
  workspaceMembers: Array<WorkspaceMembers>;
  /** An array relationship */
  workspace_member_invites: Array<WorkspaceMemberInvites>;
};


/** User account information. Don't modify its structure as Hasura Auth relies on it to function properly. */
export type UsersAppsArgs = {
  distinct_on?: InputMaybe<Array<Apps_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<Apps_Order_By>>;
  where?: InputMaybe<Apps_Bool_Exp>;
};


/** User account information. Don't modify its structure as Hasura Auth relies on it to function properly. */
export type UsersCliTokensArgs = {
  distinct_on?: InputMaybe<Array<CliTokens_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<CliTokens_Order_By>>;
  where?: InputMaybe<CliTokens_Bool_Exp>;
};


/** User account information. Don't modify its structure as Hasura Auth relies on it to function properly. */
export type UsersCreatorOfWorkspacesArgs = {
  distinct_on?: InputMaybe<Array<Workspaces_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<Workspaces_Order_By>>;
  where?: InputMaybe<Workspaces_Bool_Exp>;
};


/** User account information. Don't modify its structure as Hasura Auth relies on it to function properly. */
export type UsersFeedbacksArgs = {
  distinct_on?: InputMaybe<Array<Feedback_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<Feedback_Order_By>>;
  where?: InputMaybe<Feedback_Bool_Exp>;
};


/** User account information. Don't modify its structure as Hasura Auth relies on it to function properly. */
export type UsersGithub_App_InstallationsArgs = {
  distinct_on?: InputMaybe<Array<GithubAppInstallations_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<GithubAppInstallations_Order_By>>;
  where?: InputMaybe<GithubAppInstallations_Bool_Exp>;
};


/** User account information. Don't modify its structure as Hasura Auth relies on it to function properly. */
export type UsersPayment_MethodsArgs = {
  distinct_on?: InputMaybe<Array<PaymentMethods_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<PaymentMethods_Order_By>>;
  where?: InputMaybe<PaymentMethods_Bool_Exp>;
};


/** User account information. Don't modify its structure as Hasura Auth relies on it to function properly. */
export type UsersRefreshTokensArgs = {
  distinct_on?: InputMaybe<Array<AuthRefreshTokens_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<AuthRefreshTokens_Order_By>>;
  where?: InputMaybe<AuthRefreshTokens_Bool_Exp>;
};


/** User account information. Don't modify its structure as Hasura Auth relies on it to function properly. */
export type UsersRunServicesArgs = {
  distinct_on?: InputMaybe<Array<Run_Service_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<Run_Service_Order_By>>;
  where?: InputMaybe<Run_Service_Bool_Exp>;
};


/** User account information. Don't modify its structure as Hasura Auth relies on it to function properly. */
export type UsersRunServices_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Run_Service_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<Run_Service_Order_By>>;
  where?: InputMaybe<Run_Service_Bool_Exp>;
};


/** User account information. Don't modify its structure as Hasura Auth relies on it to function properly. */
export type UsersWorkspaceMemberInvitesByInvitedByUserIdArgs = {
  distinct_on?: InputMaybe<Array<WorkspaceMemberInvites_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<WorkspaceMemberInvites_Order_By>>;
  where?: InputMaybe<WorkspaceMemberInvites_Bool_Exp>;
};


/** User account information. Don't modify its structure as Hasura Auth relies on it to function properly. */
export type UsersWorkspaceMembersArgs = {
  distinct_on?: InputMaybe<Array<WorkspaceMembers_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<WorkspaceMembers_Order_By>>;
  where?: InputMaybe<WorkspaceMembers_Bool_Exp>;
};


/** User account information. Don't modify its structure as Hasura Auth relies on it to function properly. */
export type UsersWorkspace_Member_InvitesArgs = {
  distinct_on?: InputMaybe<Array<WorkspaceMemberInvites_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<WorkspaceMemberInvites_Order_By>>;
  where?: InputMaybe<WorkspaceMemberInvites_Bool_Exp>;
};

/** Boolean expression to filter rows from the table "auth.users". All fields are combined with a logical 'AND'. */
export type Users_Bool_Exp = {
  _and?: InputMaybe<Array<Users_Bool_Exp>>;
  _not?: InputMaybe<Users_Bool_Exp>;
  _or?: InputMaybe<Array<Users_Bool_Exp>>;
  apps?: InputMaybe<Apps_Bool_Exp>;
  avatarUrl?: InputMaybe<String_Comparison_Exp>;
  cliTokens?: InputMaybe<CliTokens_Bool_Exp>;
  creatorOfWorkspaces?: InputMaybe<Workspaces_Bool_Exp>;
  displayName?: InputMaybe<String_Comparison_Exp>;
  email?: InputMaybe<Citext_Comparison_Exp>;
  feedbacks?: InputMaybe<Feedback_Bool_Exp>;
  github_app_installations?: InputMaybe<GithubAppInstallations_Bool_Exp>;
  id?: InputMaybe<Uuid_Comparison_Exp>;
  payment_methods?: InputMaybe<PaymentMethods_Bool_Exp>;
  refreshTokens?: InputMaybe<AuthRefreshTokens_Bool_Exp>;
  runServices?: InputMaybe<Run_Service_Bool_Exp>;
  runServices_aggregate?: InputMaybe<Run_Service_Aggregate_Bool_Exp>;
  workspaceMemberInvitesByInvitedByUserId?: InputMaybe<WorkspaceMemberInvites_Bool_Exp>;
  workspaceMembers?: InputMaybe<WorkspaceMembers_Bool_Exp>;
  workspace_member_invites?: InputMaybe<WorkspaceMemberInvites_Bool_Exp>;
};

/** Ordering options when selecting data from "auth.users". */
export type Users_Order_By = {
  apps_aggregate?: InputMaybe<Apps_Aggregate_Order_By>;
  avatarUrl?: InputMaybe<Order_By>;
  cliTokens_aggregate?: InputMaybe<CliTokens_Aggregate_Order_By>;
  creatorOfWorkspaces_aggregate?: InputMaybe<Workspaces_Aggregate_Order_By>;
  displayName?: InputMaybe<Order_By>;
  email?: InputMaybe<Order_By>;
  feedbacks_aggregate?: InputMaybe<Feedback_Aggregate_Order_By>;
  github_app_installations_aggregate?: InputMaybe<GithubAppInstallations_Aggregate_Order_By>;
  id?: InputMaybe<Order_By>;
  payment_methods_aggregate?: InputMaybe<PaymentMethods_Aggregate_Order_By>;
  refreshTokens_aggregate?: InputMaybe<AuthRefreshTokens_Aggregate_Order_By>;
  runServices_aggregate?: InputMaybe<Run_Service_Aggregate_Order_By>;
  workspaceMemberInvitesByInvitedByUserId_aggregate?: InputMaybe<WorkspaceMemberInvites_Aggregate_Order_By>;
  workspaceMembers_aggregate?: InputMaybe<WorkspaceMembers_Aggregate_Order_By>;
  workspace_member_invites_aggregate?: InputMaybe<WorkspaceMemberInvites_Aggregate_Order_By>;
};

/** select columns of table "auth.users" */
export enum Users_Select_Column {
  /** column name */
  AvatarUrl = 'avatarUrl',
  /** column name */
  DisplayName = 'displayName',
  /** column name */
  Email = 'email',
  /** column name */
  Id = 'id'
}

/** Streaming cursor of the table "users" */
export type Users_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: Users_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type Users_Stream_Cursor_Value_Input = {
  avatarUrl?: InputMaybe<Scalars['String']>;
  displayName?: InputMaybe<Scalars['String']>;
  email?: InputMaybe<Scalars['citext']>;
  id?: InputMaybe<Scalars['uuid']>;
};

/** Boolean expression to compare columns of type "uuid". All fields are combined with logical 'AND'. */
export type Uuid_Comparison_Exp = {
  _eq?: InputMaybe<Scalars['uuid']>;
  _gt?: InputMaybe<Scalars['uuid']>;
  _gte?: InputMaybe<Scalars['uuid']>;
  _in?: InputMaybe<Array<Scalars['uuid']>>;
  _is_null?: InputMaybe<Scalars['Boolean']>;
  _lt?: InputMaybe<Scalars['uuid']>;
  _lte?: InputMaybe<Scalars['uuid']>;
  _neq?: InputMaybe<Scalars['uuid']>;
  _nin?: InputMaybe<Array<Scalars['uuid']>>;
};

/** columns and relationships of "workspace_member_invites" */
export type WorkspaceMemberInvites = {
  __typename?: 'workspaceMemberInvites';
  createdAt: Scalars['timestamptz'];
  email: Scalars['citext'];
  id: Scalars['uuid'];
  /** An object relationship */
  invitedByUser: Users;
  invitedByUserId: Scalars['uuid'];
  /** owner or member */
  memberType: Scalars['String'];
  updatedAt: Scalars['timestamptz'];
  /** An object relationship */
  userByEmail?: Maybe<Users>;
  /** An object relationship */
  workspace: Workspaces;
  workspaceId: Scalars['uuid'];
};

/** order by aggregate values of table "workspace_member_invites" */
export type WorkspaceMemberInvites_Aggregate_Order_By = {
  count?: InputMaybe<Order_By>;
  max?: InputMaybe<WorkspaceMemberInvites_Max_Order_By>;
  min?: InputMaybe<WorkspaceMemberInvites_Min_Order_By>;
};

/** input type for inserting array relation for remote table "workspace_member_invites" */
export type WorkspaceMemberInvites_Arr_Rel_Insert_Input = {
  data: Array<WorkspaceMemberInvites_Insert_Input>;
  /** upsert condition */
  on_conflict?: InputMaybe<WorkspaceMemberInvites_On_Conflict>;
};

/** Boolean expression to filter rows from the table "workspace_member_invites". All fields are combined with a logical 'AND'. */
export type WorkspaceMemberInvites_Bool_Exp = {
  _and?: InputMaybe<Array<WorkspaceMemberInvites_Bool_Exp>>;
  _not?: InputMaybe<WorkspaceMemberInvites_Bool_Exp>;
  _or?: InputMaybe<Array<WorkspaceMemberInvites_Bool_Exp>>;
  createdAt?: InputMaybe<Timestamptz_Comparison_Exp>;
  email?: InputMaybe<Citext_Comparison_Exp>;
  id?: InputMaybe<Uuid_Comparison_Exp>;
  invitedByUser?: InputMaybe<Users_Bool_Exp>;
  invitedByUserId?: InputMaybe<Uuid_Comparison_Exp>;
  memberType?: InputMaybe<String_Comparison_Exp>;
  updatedAt?: InputMaybe<Timestamptz_Comparison_Exp>;
  userByEmail?: InputMaybe<Users_Bool_Exp>;
  workspace?: InputMaybe<Workspaces_Bool_Exp>;
  workspaceId?: InputMaybe<Uuid_Comparison_Exp>;
};

/** unique or primary key constraints on table "workspace_member_invites" */
export enum WorkspaceMemberInvites_Constraint {
  /** unique or primary key constraint on columns "email", "workspace_id" */
  WorkspaceMemberInvitesEmailWorkspaceIdKey = 'workspace_member_invites_email_workspace_id_key',
  /** unique or primary key constraint on columns "id" */
  WorkspaceMemberInvitesPkey = 'workspace_member_invites_pkey'
}

/** input type for inserting data into table "workspace_member_invites" */
export type WorkspaceMemberInvites_Insert_Input = {
  email?: InputMaybe<Scalars['citext']>;
  /** owner or member */
  memberType?: InputMaybe<Scalars['String']>;
  workspace?: InputMaybe<Workspaces_Obj_Rel_Insert_Input>;
  workspaceId?: InputMaybe<Scalars['uuid']>;
};

/** order by max() on columns of table "workspace_member_invites" */
export type WorkspaceMemberInvites_Max_Order_By = {
  createdAt?: InputMaybe<Order_By>;
  email?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  invitedByUserId?: InputMaybe<Order_By>;
  /** owner or member */
  memberType?: InputMaybe<Order_By>;
  updatedAt?: InputMaybe<Order_By>;
  workspaceId?: InputMaybe<Order_By>;
};

/** order by min() on columns of table "workspace_member_invites" */
export type WorkspaceMemberInvites_Min_Order_By = {
  createdAt?: InputMaybe<Order_By>;
  email?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  invitedByUserId?: InputMaybe<Order_By>;
  /** owner or member */
  memberType?: InputMaybe<Order_By>;
  updatedAt?: InputMaybe<Order_By>;
  workspaceId?: InputMaybe<Order_By>;
};

/** response of any mutation on the table "workspace_member_invites" */
export type WorkspaceMemberInvites_Mutation_Response = {
  __typename?: 'workspaceMemberInvites_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int'];
  /** data from the rows affected by the mutation */
  returning: Array<WorkspaceMemberInvites>;
};

/** on_conflict condition type for table "workspace_member_invites" */
export type WorkspaceMemberInvites_On_Conflict = {
  constraint: WorkspaceMemberInvites_Constraint;
  update_columns?: Array<WorkspaceMemberInvites_Update_Column>;
  where?: InputMaybe<WorkspaceMemberInvites_Bool_Exp>;
};

/** Ordering options when selecting data from "workspace_member_invites". */
export type WorkspaceMemberInvites_Order_By = {
  createdAt?: InputMaybe<Order_By>;
  email?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  invitedByUser?: InputMaybe<Users_Order_By>;
  invitedByUserId?: InputMaybe<Order_By>;
  memberType?: InputMaybe<Order_By>;
  updatedAt?: InputMaybe<Order_By>;
  userByEmail?: InputMaybe<Users_Order_By>;
  workspace?: InputMaybe<Workspaces_Order_By>;
  workspaceId?: InputMaybe<Order_By>;
};

/** primary key columns input for table: workspace_member_invites */
export type WorkspaceMemberInvites_Pk_Columns_Input = {
  id: Scalars['uuid'];
};

/** select columns of table "workspace_member_invites" */
export enum WorkspaceMemberInvites_Select_Column {
  /** column name */
  CreatedAt = 'createdAt',
  /** column name */
  Email = 'email',
  /** column name */
  Id = 'id',
  /** column name */
  InvitedByUserId = 'invitedByUserId',
  /** column name */
  MemberType = 'memberType',
  /** column name */
  UpdatedAt = 'updatedAt',
  /** column name */
  WorkspaceId = 'workspaceId'
}

/** input type for updating data in table "workspace_member_invites" */
export type WorkspaceMemberInvites_Set_Input = {
  /** owner or member */
  memberType?: InputMaybe<Scalars['String']>;
};

/** Streaming cursor of the table "workspaceMemberInvites" */
export type WorkspaceMemberInvites_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: WorkspaceMemberInvites_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type WorkspaceMemberInvites_Stream_Cursor_Value_Input = {
  createdAt?: InputMaybe<Scalars['timestamptz']>;
  email?: InputMaybe<Scalars['citext']>;
  id?: InputMaybe<Scalars['uuid']>;
  invitedByUserId?: InputMaybe<Scalars['uuid']>;
  /** owner or member */
  memberType?: InputMaybe<Scalars['String']>;
  updatedAt?: InputMaybe<Scalars['timestamptz']>;
  workspaceId?: InputMaybe<Scalars['uuid']>;
};

/** update columns of table "workspace_member_invites" */
export enum WorkspaceMemberInvites_Update_Column {
  /** column name */
  MemberType = 'memberType'
}

export type WorkspaceMemberInvites_Updates = {
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<WorkspaceMemberInvites_Set_Input>;
  /** filter the rows which have to be updated */
  where: WorkspaceMemberInvites_Bool_Exp;
};

/** columns and relationships of "workspace_members" */
export type WorkspaceMembers = {
  __typename?: 'workspaceMembers';
  createdAt: Scalars['timestamptz'];
  id: Scalars['uuid'];
  /** owner or member */
  type: Scalars['String'];
  updatedAt: Scalars['timestamptz'];
  /** An object relationship */
  user: Users;
  userId: Scalars['uuid'];
  /** An object relationship */
  workspace: Workspaces;
  workspaceId: Scalars['uuid'];
};

/** order by aggregate values of table "workspace_members" */
export type WorkspaceMembers_Aggregate_Order_By = {
  count?: InputMaybe<Order_By>;
  max?: InputMaybe<WorkspaceMembers_Max_Order_By>;
  min?: InputMaybe<WorkspaceMembers_Min_Order_By>;
};

/** input type for inserting array relation for remote table "workspace_members" */
export type WorkspaceMembers_Arr_Rel_Insert_Input = {
  data: Array<WorkspaceMembers_Insert_Input>;
  /** upsert condition */
  on_conflict?: InputMaybe<WorkspaceMembers_On_Conflict>;
};

/** Boolean expression to filter rows from the table "workspace_members". All fields are combined with a logical 'AND'. */
export type WorkspaceMembers_Bool_Exp = {
  _and?: InputMaybe<Array<WorkspaceMembers_Bool_Exp>>;
  _not?: InputMaybe<WorkspaceMembers_Bool_Exp>;
  _or?: InputMaybe<Array<WorkspaceMembers_Bool_Exp>>;
  createdAt?: InputMaybe<Timestamptz_Comparison_Exp>;
  id?: InputMaybe<Uuid_Comparison_Exp>;
  type?: InputMaybe<String_Comparison_Exp>;
  updatedAt?: InputMaybe<Timestamptz_Comparison_Exp>;
  user?: InputMaybe<Users_Bool_Exp>;
  userId?: InputMaybe<Uuid_Comparison_Exp>;
  workspace?: InputMaybe<Workspaces_Bool_Exp>;
  workspaceId?: InputMaybe<Uuid_Comparison_Exp>;
};

/** unique or primary key constraints on table "workspace_members" */
export enum WorkspaceMembers_Constraint {
  /** unique or primary key constraint on columns "id" */
  WorkspaceMembersPkey = 'workspace_members_pkey',
  /** unique or primary key constraint on columns "workspace_id", "user_id" */
  WorkspaceMembersUserIdWorkspaceIdKey = 'workspace_members_user_id_workspace_id_key'
}

/** input type for inserting data into table "workspace_members" */
export type WorkspaceMembers_Insert_Input = {
  /** owner or member */
  type?: InputMaybe<Scalars['String']>;
  userId?: InputMaybe<Scalars['uuid']>;
  workspace?: InputMaybe<Workspaces_Obj_Rel_Insert_Input>;
};

/** order by max() on columns of table "workspace_members" */
export type WorkspaceMembers_Max_Order_By = {
  createdAt?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  /** owner or member */
  type?: InputMaybe<Order_By>;
  updatedAt?: InputMaybe<Order_By>;
  userId?: InputMaybe<Order_By>;
  workspaceId?: InputMaybe<Order_By>;
};

/** order by min() on columns of table "workspace_members" */
export type WorkspaceMembers_Min_Order_By = {
  createdAt?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  /** owner or member */
  type?: InputMaybe<Order_By>;
  updatedAt?: InputMaybe<Order_By>;
  userId?: InputMaybe<Order_By>;
  workspaceId?: InputMaybe<Order_By>;
};

/** response of any mutation on the table "workspace_members" */
export type WorkspaceMembers_Mutation_Response = {
  __typename?: 'workspaceMembers_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int'];
  /** data from the rows affected by the mutation */
  returning: Array<WorkspaceMembers>;
};

/** on_conflict condition type for table "workspace_members" */
export type WorkspaceMembers_On_Conflict = {
  constraint: WorkspaceMembers_Constraint;
  update_columns?: Array<WorkspaceMembers_Update_Column>;
  where?: InputMaybe<WorkspaceMembers_Bool_Exp>;
};

/** Ordering options when selecting data from "workspace_members". */
export type WorkspaceMembers_Order_By = {
  createdAt?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  type?: InputMaybe<Order_By>;
  updatedAt?: InputMaybe<Order_By>;
  user?: InputMaybe<Users_Order_By>;
  userId?: InputMaybe<Order_By>;
  workspace?: InputMaybe<Workspaces_Order_By>;
  workspaceId?: InputMaybe<Order_By>;
};

/** primary key columns input for table: workspace_members */
export type WorkspaceMembers_Pk_Columns_Input = {
  id: Scalars['uuid'];
};

/** select columns of table "workspace_members" */
export enum WorkspaceMembers_Select_Column {
  /** column name */
  CreatedAt = 'createdAt',
  /** column name */
  Id = 'id',
  /** column name */
  Type = 'type',
  /** column name */
  UpdatedAt = 'updatedAt',
  /** column name */
  UserId = 'userId',
  /** column name */
  WorkspaceId = 'workspaceId'
}

/** input type for updating data in table "workspace_members" */
export type WorkspaceMembers_Set_Input = {
  /** owner or member */
  type?: InputMaybe<Scalars['String']>;
};

/** Streaming cursor of the table "workspaceMembers" */
export type WorkspaceMembers_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: WorkspaceMembers_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type WorkspaceMembers_Stream_Cursor_Value_Input = {
  createdAt?: InputMaybe<Scalars['timestamptz']>;
  id?: InputMaybe<Scalars['uuid']>;
  /** owner or member */
  type?: InputMaybe<Scalars['String']>;
  updatedAt?: InputMaybe<Scalars['timestamptz']>;
  userId?: InputMaybe<Scalars['uuid']>;
  workspaceId?: InputMaybe<Scalars['uuid']>;
};

/** update columns of table "workspace_members" */
export enum WorkspaceMembers_Update_Column {
  /** column name */
  Type = 'type'
}

export type WorkspaceMembers_Updates = {
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<WorkspaceMembers_Set_Input>;
  /** filter the rows which have to be updated */
  where: WorkspaceMembers_Bool_Exp;
};

/** columns and relationships of "workspaces" */
export type Workspaces = {
  __typename?: 'workspaces';
  /** City, district, suburb, town, or village. */
  addressCity: Scalars['String'];
  /** An object relationship */
  addressCountry?: Maybe<Countries>;
  /** Two-letter country code (ISO 3166-1 alpha-2). */
  addressCountryCode?: Maybe<Scalars['String']>;
  /** Address line 1 (e.g., street, PO Box, or company name). */
  addressLine1: Scalars['String'];
  /** Address line 2 (e.g., apartment, suite, unit, or building). */
  addressLine2: Scalars['String'];
  /** ZIP or postal code. */
  addressPostalCode: Scalars['String'];
  /** State, county, province, or region. */
  addressState: Scalars['String'];
  /** An object relationship */
  allowedPrivateRegions?: Maybe<Regions_Allowed_Workspace>;
  /** An array relationship */
  apps: Array<Apps>;
  companyName: Scalars['String'];
  createdAt: Scalars['timestamptz'];
  /** An object relationship */
  creatorUser?: Maybe<Users>;
  creatorUserId?: Maybe<Scalars['uuid']>;
  email: Scalars['String'];
  id: Scalars['uuid'];
  name: Scalars['String'];
  /** An object relationship */
  paymentMethod?: Maybe<PaymentMethods>;
  /** An array relationship */
  paymentMethods: Array<PaymentMethods>;
  /** An array relationship */
  regions_allowed_workspaces: Array<Regions_Allowed_Workspace>;
  slug: Scalars['String'];
  taxIdType: Scalars['String'];
  taxIdValue: Scalars['String'];
  updatedAt: Scalars['timestamptz'];
  /** An array relationship */
  workspaceMemberInvites: Array<WorkspaceMemberInvites>;
  /** An array relationship */
  workspaceMembers: Array<WorkspaceMembers>;
};


/** columns and relationships of "workspaces" */
export type WorkspacesAppsArgs = {
  distinct_on?: InputMaybe<Array<Apps_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<Apps_Order_By>>;
  where?: InputMaybe<Apps_Bool_Exp>;
};


/** columns and relationships of "workspaces" */
export type WorkspacesPaymentMethodsArgs = {
  distinct_on?: InputMaybe<Array<PaymentMethods_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<PaymentMethods_Order_By>>;
  where?: InputMaybe<PaymentMethods_Bool_Exp>;
};


/** columns and relationships of "workspaces" */
export type WorkspacesRegions_Allowed_WorkspacesArgs = {
  distinct_on?: InputMaybe<Array<Regions_Allowed_Workspace_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<Regions_Allowed_Workspace_Order_By>>;
  where?: InputMaybe<Regions_Allowed_Workspace_Bool_Exp>;
};


/** columns and relationships of "workspaces" */
export type WorkspacesWorkspaceMemberInvitesArgs = {
  distinct_on?: InputMaybe<Array<WorkspaceMemberInvites_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<WorkspaceMemberInvites_Order_By>>;
  where?: InputMaybe<WorkspaceMemberInvites_Bool_Exp>;
};


/** columns and relationships of "workspaces" */
export type WorkspacesWorkspaceMembersArgs = {
  distinct_on?: InputMaybe<Array<WorkspaceMembers_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']>;
  offset?: InputMaybe<Scalars['Int']>;
  order_by?: InputMaybe<Array<WorkspaceMembers_Order_By>>;
  where?: InputMaybe<WorkspaceMembers_Bool_Exp>;
};

/** order by aggregate values of table "workspaces" */
export type Workspaces_Aggregate_Order_By = {
  count?: InputMaybe<Order_By>;
  max?: InputMaybe<Workspaces_Max_Order_By>;
  min?: InputMaybe<Workspaces_Min_Order_By>;
};

/** Boolean expression to filter rows from the table "workspaces". All fields are combined with a logical 'AND'. */
export type Workspaces_Bool_Exp = {
  _and?: InputMaybe<Array<Workspaces_Bool_Exp>>;
  _not?: InputMaybe<Workspaces_Bool_Exp>;
  _or?: InputMaybe<Array<Workspaces_Bool_Exp>>;
  addressCity?: InputMaybe<String_Comparison_Exp>;
  addressCountry?: InputMaybe<Countries_Bool_Exp>;
  addressCountryCode?: InputMaybe<String_Comparison_Exp>;
  addressLine1?: InputMaybe<String_Comparison_Exp>;
  addressLine2?: InputMaybe<String_Comparison_Exp>;
  addressPostalCode?: InputMaybe<String_Comparison_Exp>;
  addressState?: InputMaybe<String_Comparison_Exp>;
  allowedPrivateRegions?: InputMaybe<Regions_Allowed_Workspace_Bool_Exp>;
  apps?: InputMaybe<Apps_Bool_Exp>;
  companyName?: InputMaybe<String_Comparison_Exp>;
  createdAt?: InputMaybe<Timestamptz_Comparison_Exp>;
  creatorUser?: InputMaybe<Users_Bool_Exp>;
  creatorUserId?: InputMaybe<Uuid_Comparison_Exp>;
  email?: InputMaybe<String_Comparison_Exp>;
  id?: InputMaybe<Uuid_Comparison_Exp>;
  name?: InputMaybe<String_Comparison_Exp>;
  paymentMethod?: InputMaybe<PaymentMethods_Bool_Exp>;
  paymentMethods?: InputMaybe<PaymentMethods_Bool_Exp>;
  regions_allowed_workspaces?: InputMaybe<Regions_Allowed_Workspace_Bool_Exp>;
  slug?: InputMaybe<String_Comparison_Exp>;
  taxIdType?: InputMaybe<String_Comparison_Exp>;
  taxIdValue?: InputMaybe<String_Comparison_Exp>;
  updatedAt?: InputMaybe<Timestamptz_Comparison_Exp>;
  workspaceMemberInvites?: InputMaybe<WorkspaceMemberInvites_Bool_Exp>;
  workspaceMembers?: InputMaybe<WorkspaceMembers_Bool_Exp>;
};

/** unique or primary key constraints on table "workspaces" */
export enum Workspaces_Constraint {
  /** unique or primary key constraint on columns "id" */
  WorkspacesPkey = 'workspaces_pkey',
  /** unique or primary key constraint on columns "slug" */
  WorkspacesSlugKey = 'workspaces_slug_key'
}

/** input type for inserting data into table "workspaces" */
export type Workspaces_Insert_Input = {
  apps?: InputMaybe<Apps_Arr_Rel_Insert_Input>;
  companyName?: InputMaybe<Scalars['String']>;
  email?: InputMaybe<Scalars['String']>;
  id?: InputMaybe<Scalars['uuid']>;
  name?: InputMaybe<Scalars['String']>;
  paymentMethod?: InputMaybe<PaymentMethods_Obj_Rel_Insert_Input>;
  paymentMethods?: InputMaybe<PaymentMethods_Arr_Rel_Insert_Input>;
  slug?: InputMaybe<Scalars['String']>;
  workspaceMemberInvites?: InputMaybe<WorkspaceMemberInvites_Arr_Rel_Insert_Input>;
  workspaceMembers?: InputMaybe<WorkspaceMembers_Arr_Rel_Insert_Input>;
};

/** order by max() on columns of table "workspaces" */
export type Workspaces_Max_Order_By = {
  /** City, district, suburb, town, or village. */
  addressCity?: InputMaybe<Order_By>;
  /** Two-letter country code (ISO 3166-1 alpha-2). */
  addressCountryCode?: InputMaybe<Order_By>;
  /** Address line 1 (e.g., street, PO Box, or company name). */
  addressLine1?: InputMaybe<Order_By>;
  /** Address line 2 (e.g., apartment, suite, unit, or building). */
  addressLine2?: InputMaybe<Order_By>;
  /** ZIP or postal code. */
  addressPostalCode?: InputMaybe<Order_By>;
  /** State, county, province, or region. */
  addressState?: InputMaybe<Order_By>;
  companyName?: InputMaybe<Order_By>;
  createdAt?: InputMaybe<Order_By>;
  creatorUserId?: InputMaybe<Order_By>;
  email?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  name?: InputMaybe<Order_By>;
  slug?: InputMaybe<Order_By>;
  taxIdType?: InputMaybe<Order_By>;
  taxIdValue?: InputMaybe<Order_By>;
  updatedAt?: InputMaybe<Order_By>;
};

/** order by min() on columns of table "workspaces" */
export type Workspaces_Min_Order_By = {
  /** City, district, suburb, town, or village. */
  addressCity?: InputMaybe<Order_By>;
  /** Two-letter country code (ISO 3166-1 alpha-2). */
  addressCountryCode?: InputMaybe<Order_By>;
  /** Address line 1 (e.g., street, PO Box, or company name). */
  addressLine1?: InputMaybe<Order_By>;
  /** Address line 2 (e.g., apartment, suite, unit, or building). */
  addressLine2?: InputMaybe<Order_By>;
  /** ZIP or postal code. */
  addressPostalCode?: InputMaybe<Order_By>;
  /** State, county, province, or region. */
  addressState?: InputMaybe<Order_By>;
  companyName?: InputMaybe<Order_By>;
  createdAt?: InputMaybe<Order_By>;
  creatorUserId?: InputMaybe<Order_By>;
  email?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  name?: InputMaybe<Order_By>;
  slug?: InputMaybe<Order_By>;
  taxIdType?: InputMaybe<Order_By>;
  taxIdValue?: InputMaybe<Order_By>;
  updatedAt?: InputMaybe<Order_By>;
};

/** response of any mutation on the table "workspaces" */
export type Workspaces_Mutation_Response = {
  __typename?: 'workspaces_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int'];
  /** data from the rows affected by the mutation */
  returning: Array<Workspaces>;
};

/** input type for inserting object relation for remote table "workspaces" */
export type Workspaces_Obj_Rel_Insert_Input = {
  data: Workspaces_Insert_Input;
  /** upsert condition */
  on_conflict?: InputMaybe<Workspaces_On_Conflict>;
};

/** on_conflict condition type for table "workspaces" */
export type Workspaces_On_Conflict = {
  constraint: Workspaces_Constraint;
  update_columns?: Array<Workspaces_Update_Column>;
  where?: InputMaybe<Workspaces_Bool_Exp>;
};

/** Ordering options when selecting data from "workspaces". */
export type Workspaces_Order_By = {
  addressCity?: InputMaybe<Order_By>;
  addressCountry?: InputMaybe<Countries_Order_By>;
  addressCountryCode?: InputMaybe<Order_By>;
  addressLine1?: InputMaybe<Order_By>;
  addressLine2?: InputMaybe<Order_By>;
  addressPostalCode?: InputMaybe<Order_By>;
  addressState?: InputMaybe<Order_By>;
  allowedPrivateRegions?: InputMaybe<Regions_Allowed_Workspace_Order_By>;
  apps_aggregate?: InputMaybe<Apps_Aggregate_Order_By>;
  companyName?: InputMaybe<Order_By>;
  createdAt?: InputMaybe<Order_By>;
  creatorUser?: InputMaybe<Users_Order_By>;
  creatorUserId?: InputMaybe<Order_By>;
  email?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  name?: InputMaybe<Order_By>;
  paymentMethod?: InputMaybe<PaymentMethods_Order_By>;
  paymentMethods_aggregate?: InputMaybe<PaymentMethods_Aggregate_Order_By>;
  regions_allowed_workspaces_aggregate?: InputMaybe<Regions_Allowed_Workspace_Aggregate_Order_By>;
  slug?: InputMaybe<Order_By>;
  taxIdType?: InputMaybe<Order_By>;
  taxIdValue?: InputMaybe<Order_By>;
  updatedAt?: InputMaybe<Order_By>;
  workspaceMemberInvites_aggregate?: InputMaybe<WorkspaceMemberInvites_Aggregate_Order_By>;
  workspaceMembers_aggregate?: InputMaybe<WorkspaceMembers_Aggregate_Order_By>;
};

/** primary key columns input for table: workspaces */
export type Workspaces_Pk_Columns_Input = {
  id: Scalars['uuid'];
};

/** select columns of table "workspaces" */
export enum Workspaces_Select_Column {
  /** column name */
  AddressCity = 'addressCity',
  /** column name */
  AddressCountryCode = 'addressCountryCode',
  /** column name */
  AddressLine1 = 'addressLine1',
  /** column name */
  AddressLine2 = 'addressLine2',
  /** column name */
  AddressPostalCode = 'addressPostalCode',
  /** column name */
  AddressState = 'addressState',
  /** column name */
  CompanyName = 'companyName',
  /** column name */
  CreatedAt = 'createdAt',
  /** column name */
  CreatorUserId = 'creatorUserId',
  /** column name */
  Email = 'email',
  /** column name */
  Id = 'id',
  /** column name */
  Name = 'name',
  /** column name */
  Slug = 'slug',
  /** column name */
  TaxIdType = 'taxIdType',
  /** column name */
  TaxIdValue = 'taxIdValue',
  /** column name */
  UpdatedAt = 'updatedAt'
}

/** input type for updating data in table "workspaces" */
export type Workspaces_Set_Input = {
  /** City, district, suburb, town, or village. */
  addressCity?: InputMaybe<Scalars['String']>;
  /** Two-letter country code (ISO 3166-1 alpha-2). */
  addressCountryCode?: InputMaybe<Scalars['String']>;
  /** Address line 1 (e.g., street, PO Box, or company name). */
  addressLine1?: InputMaybe<Scalars['String']>;
  /** Address line 2 (e.g., apartment, suite, unit, or building). */
  addressLine2?: InputMaybe<Scalars['String']>;
  /** ZIP or postal code. */
  addressPostalCode?: InputMaybe<Scalars['String']>;
  /** State, county, province, or region. */
  addressState?: InputMaybe<Scalars['String']>;
  companyName?: InputMaybe<Scalars['String']>;
  email?: InputMaybe<Scalars['String']>;
  name?: InputMaybe<Scalars['String']>;
  slug?: InputMaybe<Scalars['String']>;
  taxIdType?: InputMaybe<Scalars['String']>;
  taxIdValue?: InputMaybe<Scalars['String']>;
};

/** Streaming cursor of the table "workspaces" */
export type Workspaces_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: Workspaces_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type Workspaces_Stream_Cursor_Value_Input = {
  /** City, district, suburb, town, or village. */
  addressCity?: InputMaybe<Scalars['String']>;
  /** Two-letter country code (ISO 3166-1 alpha-2). */
  addressCountryCode?: InputMaybe<Scalars['String']>;
  /** Address line 1 (e.g., street, PO Box, or company name). */
  addressLine1?: InputMaybe<Scalars['String']>;
  /** Address line 2 (e.g., apartment, suite, unit, or building). */
  addressLine2?: InputMaybe<Scalars['String']>;
  /** ZIP or postal code. */
  addressPostalCode?: InputMaybe<Scalars['String']>;
  /** State, county, province, or region. */
  addressState?: InputMaybe<Scalars['String']>;
  companyName?: InputMaybe<Scalars['String']>;
  createdAt?: InputMaybe<Scalars['timestamptz']>;
  creatorUserId?: InputMaybe<Scalars['uuid']>;
  email?: InputMaybe<Scalars['String']>;
  id?: InputMaybe<Scalars['uuid']>;
  name?: InputMaybe<Scalars['String']>;
  slug?: InputMaybe<Scalars['String']>;
  taxIdType?: InputMaybe<Scalars['String']>;
  taxIdValue?: InputMaybe<Scalars['String']>;
  updatedAt?: InputMaybe<Scalars['timestamptz']>;
};

/** update columns of table "workspaces" */
export enum Workspaces_Update_Column {
  /** column name */
  AddressCity = 'addressCity',
  /** column name */
  AddressCountryCode = 'addressCountryCode',
  /** column name */
  AddressLine1 = 'addressLine1',
  /** column name */
  AddressLine2 = 'addressLine2',
  /** column name */
  AddressPostalCode = 'addressPostalCode',
  /** column name */
  AddressState = 'addressState',
  /** column name */
  CompanyName = 'companyName',
  /** column name */
  Email = 'email',
  /** column name */
  Name = 'name',
  /** column name */
  Slug = 'slug',
  /** column name */
  TaxIdType = 'taxIdType',
  /** column name */
  TaxIdValue = 'taxIdValue'
}

export type Workspaces_Updates = {
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<Workspaces_Set_Input>;
  /** filter the rows which have to be updated */
  where: Workspaces_Bool_Exp;
};

export type DeleteApplicationMutationVariables = Exact<{
  appId: Scalars['uuid'];
}>;


export type DeleteApplicationMutation = { __typename?: 'mutation_root', deleteApp?: { __typename?: 'apps', id: any } | null };

export type GetAllWorkspacesAndProjectsQueryVariables = Exact<{ [key: string]: never; }>;


export type GetAllWorkspacesAndProjectsQuery = { __typename?: 'query_root', workspaces: Array<{ __typename?: 'workspaces', id: any, name: string, slug: string, creatorUserId?: any | null, workspaceMembers: Array<{ __typename?: 'workspaceMembers', id: any, type: string, user: { __typename?: 'users', id: any, email?: any | null, displayName: string } }>, projects: Array<{ __typename?: 'apps', id: any, slug: string, name: string, repositoryProductionBranch: string, subdomain: string, isProvisioned: boolean, createdAt: any, desiredState: number, nhostBaseFolder: string, providersUpdated?: boolean | null, config?: { __typename?: 'ConfigConfig', observability: { __typename?: 'ConfigObservability', grafana: { __typename?: 'ConfigGrafana', adminPassword: string } }, hasura: { __typename?: 'ConfigHasura', adminSecret: string, settings?: { __typename?: 'ConfigHasuraSettings', enableConsole?: boolean | null } | null } } | null, featureFlags: Array<{ __typename?: 'featureFlags', description: string, id: any, name: string, value: string }>, appStates: Array<{ __typename?: 'appStateHistory', id: any, appId: any, message?: string | null, stateId: number, createdAt: any }>, region: { __typename?: 'regions', id: any, countryCode: string, awsName: string, domain: string, city: string }, plan: { __typename?: 'plans', id: any, name: string, price: number, isFree: boolean }, githubRepository?: { __typename?: 'githubRepositories', fullName: string } | null, deployments: Array<{ __typename?: 'deployments', id: any, commitSHA: string, commitMessage?: string | null, commitUserName?: string | null, deploymentStartedAt?: any | null, deploymentEndedAt?: any | null, commitUserAvatarUrl?: string | null, deploymentStatus?: string | null }>, creator?: { __typename?: 'users', id: any, email?: any | null, displayName: string } | null }> }> };

export type GetAppPlanAndGlobalPlansAppFragment = { __typename?: 'apps', id: any, subdomain: string, workspace: { __typename?: 'workspaces', id: any, paymentMethods: Array<{ __typename?: 'paymentMethods', id: any }> }, plan: { __typename?: 'plans', id: any, name: string } };

export type GetAppPlanAndGlobalPlansPlanFragment = { __typename?: 'plans', id: any, name: string, isFree: boolean, price: number, featureMaxDbSize: number };

export type GetAppPlanAndGlobalPlansQueryVariables = Exact<{
  workspaceSlug: Scalars['String'];
  appSlug: Scalars['String'];
}>;


export type GetAppPlanAndGlobalPlansQuery = { __typename?: 'query_root', apps: Array<{ __typename?: 'apps', id: any, subdomain: string, workspace: { __typename?: 'workspaces', id: any, paymentMethods: Array<{ __typename?: 'paymentMethods', id: any }> }, plan: { __typename?: 'plans', id: any, name: string } }>, plans: Array<{ __typename?: 'plans', id: any, name: string, isFree: boolean, price: number, featureMaxDbSize: number }> };

export type GetApplicationPlanQueryVariables = Exact<{
  workspace: Scalars['String'];
  slug: Scalars['String'];
}>;


export type GetApplicationPlanQuery = { __typename?: 'query_root', apps: Array<{ __typename?: 'apps', id: any, subdomain: string, plan: { __typename?: 'plans', name: string, price: number, upatedAt: any, featureMaxDbSize: number } }> };

export type GetApplicationStateQueryVariables = Exact<{
  appId: Scalars['uuid'];
}>;


export type GetApplicationStateQuery = { __typename?: 'query_root', app?: { __typename?: 'apps', id: any, name: string, appStates: Array<{ __typename?: 'appStateHistory', id: any, appId: any, message?: string | null, stateId: number, createdAt: any }> } | null };

export type GetProjectMetricsQueryVariables = Exact<{
  appId: Scalars['String'];
  subdomain: Scalars['String'];
  from?: InputMaybe<Scalars['Timestamp']>;
  to?: InputMaybe<Scalars['Timestamp']>;
}>;


export type GetProjectMetricsQuery = { __typename?: 'query_root', logsVolume: { __typename?: 'Metrics', value: any }, cpuSecondsUsage: { __typename?: 'Metrics', value: any }, functionInvocations: { __typename?: 'Metrics', value: any }, postgresVolumeCapacity: { __typename?: 'Metrics', value: any }, postgresVolumeUsage: { __typename?: 'Metrics', value: any }, totalRequests: { __typename?: 'Metrics', value: any }, egressVolume: { __typename?: 'Metrics', value: any } };

export type GetWorkspaceAndProjectQueryVariables = Exact<{
  workspaceSlug: Scalars['String'];
  projectSlug?: InputMaybe<Scalars['String']>;
}>;


export type GetWorkspaceAndProjectQuery = { __typename?: 'query_root', workspaces: Array<{ __typename?: 'workspaces', id: any, name: string, slug: string, creatorUserId?: any | null, workspaceMembers: Array<{ __typename?: 'workspaceMembers', id: any, type: string, user: { __typename?: 'users', id: any, email?: any | null, displayName: string } }>, projects: Array<{ __typename?: 'apps', id: any, slug: string, name: string, repositoryProductionBranch: string, subdomain: string, isProvisioned: boolean, createdAt: any, desiredState: number, nhostBaseFolder: string, providersUpdated?: boolean | null, config?: { __typename?: 'ConfigConfig', observability: { __typename?: 'ConfigObservability', grafana: { __typename?: 'ConfigGrafana', adminPassword: string } }, hasura: { __typename?: 'ConfigHasura', adminSecret: string, settings?: { __typename?: 'ConfigHasuraSettings', enableConsole?: boolean | null } | null } } | null, featureFlags: Array<{ __typename?: 'featureFlags', description: string, id: any, name: string, value: string }>, appStates: Array<{ __typename?: 'appStateHistory', id: any, appId: any, message?: string | null, stateId: number, createdAt: any }>, region: { __typename?: 'regions', id: any, countryCode: string, awsName: string, domain: string, city: string }, plan: { __typename?: 'plans', id: any, name: string, price: number, isFree: boolean }, githubRepository?: { __typename?: 'githubRepositories', fullName: string } | null, deployments: Array<{ __typename?: 'deployments', id: any, commitSHA: string, commitMessage?: string | null, commitUserName?: string | null, deploymentStartedAt?: any | null, deploymentEndedAt?: any | null, commitUserAvatarUrl?: string | null, deploymentStatus?: string | null }>, creator?: { __typename?: 'users', id: any, email?: any | null, displayName: string } | null }> }> };

export type InsertApplicationMutationVariables = Exact<{
  app: Apps_Insert_Input;
}>;


export type InsertApplicationMutation = { __typename?: 'mutation_root', insertApp?: { __typename?: 'apps', id: any, name: string, slug: string, workspace: { __typename?: 'workspaces', id: any, name: string, slug: string } } | null };

export type PauseApplicationMutationVariables = Exact<{
  appId: Scalars['uuid'];
}>;


export type PauseApplicationMutation = { __typename?: 'mutation_root', updateApp?: { __typename?: 'apps', id: any } | null };

export type PrefetchNewAppRegionsFragment = { __typename?: 'regions', id: any, city: string, active: boolean, country: { __typename?: 'countries', code: any, name: string } };

export type PrefetchNewAppPlansFragment = { __typename?: 'plans', id: any, name: string, isDefault: boolean, isFree: boolean, price: number, featureBackupEnabled: boolean, featureCustomDomainsEnabled: boolean, featureMaxDbSize: number };

export type PrefetchNewAppWorkspaceFragment = { __typename?: 'workspaces', id: any, name: string, slug: string, paymentMethods: Array<{ __typename?: 'paymentMethods', id: any }> };

export type PrefetchNewAppQueryVariables = Exact<{ [key: string]: never; }>;


export type PrefetchNewAppQuery = { __typename?: 'query_root', regions: Array<{ __typename?: 'regions', id: any, city: string, active: boolean, country: { __typename?: 'countries', code: any, name: string } }>, plans: Array<{ __typename?: 'plans', id: any, name: string, isDefault: boolean, isFree: boolean, price: number, featureBackupEnabled: boolean, featureCustomDomainsEnabled: boolean, featureMaxDbSize: number }>, workspaces: Array<{ __typename?: 'workspaces', id: any, name: string, slug: string, paymentMethods: Array<{ __typename?: 'paymentMethods', id: any }> }> };

export type UnpauseApplicationMutationVariables = Exact<{
  appId: Scalars['uuid'];
}>;


export type UnpauseApplicationMutation = { __typename?: 'mutation_root', updateApp?: { __typename?: 'apps', id: any } | null };

export type UpdateApplicationMutationVariables = Exact<{
  appId: Scalars['uuid'];
  app: Apps_Set_Input;
}>;


export type UpdateApplicationMutation = { __typename?: 'mutation_root', updateApp?: { __typename?: 'apps', name: string, id: any, slug: string } | null };

export type BackupFragment = { __typename?: 'backups', id: any, size: any, createdAt: any, completedAt?: any | null };

export type GetApplicationBackupsQueryVariables = Exact<{
  appId: Scalars['uuid'];
}>;


export type GetApplicationBackupsQuery = { __typename?: 'query_root', app?: { __typename?: 'apps', backups: Array<{ __typename?: 'backups', id: any, size: any, createdAt: any, completedAt?: any | null }> } | null };

export type GetBackupPresignedUrlQueryVariables = Exact<{
  appId: Scalars['String'];
  backupId: Scalars['String'];
  expireInMinutes?: InputMaybe<Scalars['Int']>;
}>;


export type GetBackupPresignedUrlQuery = { __typename?: 'query_root', getBackupPresignedUrl: { __typename?: 'BackupPresignedURL', url: string, expiresAt: any } };

export type GetCountriesQueryVariables = Exact<{ [key: string]: never; }>;


export type GetCountriesQuery = { __typename?: 'query_root', countries: Array<{ __typename?: 'countries', code: any, name: string }> };

export type DeploymentRowFragment = { __typename?: 'deployments', id: any, commitSHA: string, deploymentStartedAt?: any | null, deploymentEndedAt?: any | null, deploymentStatus?: string | null, commitUserName?: string | null, commitUserAvatarUrl?: string | null, commitMessage?: string | null };

export type ScheduledOrPendingDeploymentsSubSubscriptionVariables = Exact<{
  appId: Scalars['uuid'];
}>;


export type ScheduledOrPendingDeploymentsSubSubscription = { __typename?: 'subscription_root', deployments: Array<{ __typename?: 'deployments', id: any, commitSHA: string, deploymentStartedAt?: any | null, deploymentEndedAt?: any | null, deploymentStatus?: string | null, commitUserName?: string | null, commitUserAvatarUrl?: string | null, commitMessage?: string | null }> };

export type LatestLiveDeploymentSubSubscriptionVariables = Exact<{
  appId: Scalars['uuid'];
}>;


export type LatestLiveDeploymentSubSubscription = { __typename?: 'subscription_root', deployments: Array<{ __typename?: 'deployments', id: any, commitSHA: string, deploymentStartedAt?: any | null, deploymentEndedAt?: any | null, deploymentStatus?: string | null, commitUserName?: string | null, commitUserAvatarUrl?: string | null, commitMessage?: string | null }> };

export type InsertDeploymentMutationVariables = Exact<{
  object: Deployments_Insert_Input;
}>;


export type InsertDeploymentMutation = { __typename?: 'mutation_root', insertDeployment?: { __typename?: 'deployments', id: any, commitSHA: string, deploymentStartedAt?: any | null, deploymentEndedAt?: any | null, deploymentStatus?: string | null, commitUserName?: string | null, commitUserAvatarUrl?: string | null, commitMessage?: string | null } | null };

export type GetDeploymentsSubSubscriptionVariables = Exact<{
  id: Scalars['uuid'];
  limit: Scalars['Int'];
  offset: Scalars['Int'];
}>;


export type GetDeploymentsSubSubscription = { __typename?: 'subscription_root', deployments: Array<{ __typename?: 'deployments', id: any, commitSHA: string, deploymentStartedAt?: any | null, deploymentEndedAt?: any | null, deploymentStatus?: string | null, commitUserName?: string | null, commitUserAvatarUrl?: string | null, commitMessage?: string | null }> };

export type DeploymentSubSubscriptionVariables = Exact<{
  id: Scalars['uuid'];
}>;


export type DeploymentSubSubscription = { __typename?: 'subscription_root', deployment?: { __typename?: 'deployments', id: any, commitMessage?: string | null, commitSHA: string, commitUserName?: string | null, commitUserAvatarUrl?: string | null, deploymentStartedAt?: any | null, deploymentEndedAt?: any | null, deploymentStatus?: string | null, metadataStartedAt?: any | null, metadataEndedAt?: any | null, metadataStatus?: string | null, migrationsStartedAt?: any | null, migrationsEndedAt?: any | null, migrationsStatus?: string | null, functionsStartedAt?: any | null, functionsEndedAt?: any | null, functionsStatus?: string | null, deploymentLogs: Array<{ __typename?: 'deploymentLogs', id: any, createdAt: any, message: string }> } | null };

export type AppStateHistoryFragment = { __typename?: 'appStateHistory', id: any, appId: any, message?: string | null, stateId: number, createdAt: any };

export type ProjectFragment = { __typename?: 'apps', id: any, slug: string, name: string, repositoryProductionBranch: string, subdomain: string, isProvisioned: boolean, createdAt: any, desiredState: number, nhostBaseFolder: string, providersUpdated?: boolean | null, config?: { __typename?: 'ConfigConfig', observability: { __typename?: 'ConfigObservability', grafana: { __typename?: 'ConfigGrafana', adminPassword: string } }, hasura: { __typename?: 'ConfigHasura', adminSecret: string, settings?: { __typename?: 'ConfigHasuraSettings', enableConsole?: boolean | null } | null } } | null, featureFlags: Array<{ __typename?: 'featureFlags', description: string, id: any, name: string, value: string }>, appStates: Array<{ __typename?: 'appStateHistory', id: any, appId: any, message?: string | null, stateId: number, createdAt: any }>, region: { __typename?: 'regions', id: any, countryCode: string, awsName: string, domain: string, city: string }, plan: { __typename?: 'plans', id: any, name: string, price: number, isFree: boolean }, githubRepository?: { __typename?: 'githubRepositories', fullName: string } | null, deployments: Array<{ __typename?: 'deployments', id: any, commitSHA: string, commitMessage?: string | null, commitUserName?: string | null, deploymentStartedAt?: any | null, deploymentEndedAt?: any | null, commitUserAvatarUrl?: string | null, deploymentStatus?: string | null }>, creator?: { __typename?: 'users', id: any, email?: any | null, displayName: string } | null };

export type WorkspaceFragment = { __typename?: 'workspaces', id: any, name: string, slug: string, creatorUserId?: any | null, workspaceMembers: Array<{ __typename?: 'workspaceMembers', id: any, type: string, user: { __typename?: 'users', id: any, email?: any | null, displayName: string } }>, projects: Array<{ __typename?: 'apps', id: any, slug: string, name: string, repositoryProductionBranch: string, subdomain: string, isProvisioned: boolean, createdAt: any, desiredState: number, nhostBaseFolder: string, providersUpdated?: boolean | null, config?: { __typename?: 'ConfigConfig', observability: { __typename?: 'ConfigObservability', grafana: { __typename?: 'ConfigGrafana', adminPassword: string } }, hasura: { __typename?: 'ConfigHasura', adminSecret: string, settings?: { __typename?: 'ConfigHasuraSettings', enableConsole?: boolean | null } | null } } | null, featureFlags: Array<{ __typename?: 'featureFlags', description: string, id: any, name: string, value: string }>, appStates: Array<{ __typename?: 'appStateHistory', id: any, appId: any, message?: string | null, stateId: number, createdAt: any }>, region: { __typename?: 'regions', id: any, countryCode: string, awsName: string, domain: string, city: string }, plan: { __typename?: 'plans', id: any, name: string, price: number, isFree: boolean }, githubRepository?: { __typename?: 'githubRepositories', fullName: string } | null, deployments: Array<{ __typename?: 'deployments', id: any, commitSHA: string, commitMessage?: string | null, commitUserName?: string | null, deploymentStartedAt?: any | null, deploymentEndedAt?: any | null, commitUserAvatarUrl?: string | null, deploymentStatus?: string | null }>, creator?: { __typename?: 'users', id: any, email?: any | null, displayName: string } | null }> };

export type GithubRepositoryFragment = { __typename?: 'githubRepositories', id: any, name: string, fullName: string, private: boolean, githubAppInstallation: { __typename?: 'githubAppInstallations', id: any, accountLogin?: string | null, accountType?: string | null, accountAvatarUrl?: string | null } };

export type GetGithubRepositoriesQueryVariables = Exact<{ [key: string]: never; }>;


export type GetGithubRepositoriesQuery = { __typename?: 'query_root', githubRepositories: Array<{ __typename?: 'githubRepositories', id: any, name: string, fullName: string, private: boolean, githubAppInstallation: { __typename?: 'githubAppInstallations', id: any, accountLogin?: string | null, accountType?: string | null, accountAvatarUrl?: string | null } }>, githubAppInstallations: Array<{ __typename?: 'githubAppInstallations', id: any, accountLogin?: string | null, accountType?: string | null, accountAvatarUrl?: string | null }> };

export type GetProjectLogsQueryVariables = Exact<{
  appID: Scalars['String'];
  service?: InputMaybe<Scalars['String']>;
  from?: InputMaybe<Scalars['Timestamp']>;
  to?: InputMaybe<Scalars['Timestamp']>;
}>;


export type GetProjectLogsQuery = { __typename?: 'query_root', logs: Array<{ __typename?: 'Log', log: string, service: string, timestamp: any }> };

export type DeletePaymentMethodMutationVariables = Exact<{
  paymentMethodId: Scalars['uuid'];
}>;


export type DeletePaymentMethodMutation = { __typename?: 'mutation_root', deletePaymentMethod?: { __typename?: 'paymentMethods', id: any } | null };

export type GetPaymentMethodsFragment = { __typename?: 'paymentMethods', id: any, createdAt: any, cardBrand: string, cardLast4: string, cardExpMonth: number, cardExpYear: number, isDefault: boolean, workspace: { __typename?: 'workspaces', id: any, apps: Array<{ __typename?: 'apps', id: any, plan: { __typename?: 'plans', isFree: boolean } }> } };

export type GetPaymentMethodsQueryVariables = Exact<{
  workspaceId: Scalars['uuid'];
}>;


export type GetPaymentMethodsQuery = { __typename?: 'query_root', paymentMethods: Array<{ __typename?: 'paymentMethods', id: any, createdAt: any, cardBrand: string, cardLast4: string, cardExpMonth: number, cardExpYear: number, isDefault: boolean, workspace: { __typename?: 'workspaces', id: any, apps: Array<{ __typename?: 'apps', id: any, plan: { __typename?: 'plans', isFree: boolean } }> } }> };

export type InsertNewPaymentMethodMutationVariables = Exact<{
  workspaceId: Scalars['uuid'];
  paymentMethod: PaymentMethods_Insert_Input;
}>;


export type InsertNewPaymentMethodMutation = { __typename?: 'mutation_root', updatePaymentMethods?: { __typename?: 'paymentMethods_mutation_response', affected_rows: number } | null, insertPaymentMethod?: { __typename?: 'paymentMethods', id: any } | null };

export type SetNewDefaultPaymentMethodMutationVariables = Exact<{
  workspaceId: Scalars['uuid'];
  paymentMethodId: Scalars['uuid'];
}>;


export type SetNewDefaultPaymentMethodMutation = { __typename?: 'mutation_root', setAllPaymentMethodToDefaultFalse?: { __typename?: 'paymentMethods_mutation_response', affected_rows: number } | null, updatePaymentMethods?: { __typename?: 'paymentMethods_mutation_response', affected_rows: number } | null };

export type GetPersonalAccessTokensQueryVariables = Exact<{ [key: string]: never; }>;


export type GetPersonalAccessTokensQuery = { __typename?: 'query_root', personalAccessTokens: Array<{ __typename?: 'authRefreshTokens', id: any, metadata?: any | null, createdAt: any, expiresAt: any }> };

export type DeletePersonalAccessTokenMutationVariables = Exact<{
  patId: Scalars['uuid'];
}>;


export type DeletePersonalAccessTokenMutation = { __typename?: 'mutation_root', deletePersonalAccessToken?: { __typename?: 'authRefreshTokens', id: any, metadata?: any | null } | null };

export type GetPlansQueryVariables = Exact<{
  where?: InputMaybe<Plans_Bool_Exp>;
}>;


export type GetPlansQuery = { __typename?: 'query_root', plans: Array<{ __typename?: 'plans', id: any, name: string, isFree: boolean, price: number }> };

export type RestoreApplicationDatabaseMutationVariables = Exact<{
  appId: Scalars['String'];
  backupId: Scalars['String'];
}>;


export type RestoreApplicationDatabaseMutation = { __typename?: 'mutation_root', restoreApplicationDatabase: boolean };

export type GetAppFunctionsMetadataQueryVariables = Exact<{
  id: Scalars['uuid'];
}>;


export type GetAppFunctionsMetadataQuery = { __typename?: 'query_root', app?: { __typename?: 'apps', id: any, metadataFunctions: any } | null };

export type DeleteSecretMutationVariables = Exact<{
  appId: Scalars['uuid'];
  name: Scalars['String'];
}>;


export type DeleteSecretMutation = { __typename?: 'mutation_root', deleteSecret?: { __typename?: 'ConfigEnvironmentVariable', name: string } | null };

export type SecretFragment = { __typename?: 'ConfigEnvironmentVariable', name: string };

export type GetSecretsQueryVariables = Exact<{
  appId: Scalars['uuid'];
}>;


export type GetSecretsQuery = { __typename?: 'query_root', appSecrets: Array<{ __typename?: 'ConfigEnvironmentVariable', name: string }> };

export type InsertSecretMutationVariables = Exact<{
  appId: Scalars['uuid'];
  secret: ConfigEnvironmentVariableInsertInput;
}>;


export type InsertSecretMutation = { __typename?: 'mutation_root', insertSecret: { __typename?: 'ConfigEnvironmentVariable', name: string } };

export type UpdateSecretMutationVariables = Exact<{
  appId: Scalars['uuid'];
  secret: ConfigEnvironmentVariableInsertInput;
}>;


export type UpdateSecretMutation = { __typename?: 'mutation_root', updateSecret: { __typename?: 'ConfigEnvironmentVariable', name: string } };

export type DeleteRunServiceMutationVariables = Exact<{
  serviceID: Scalars['uuid'];
}>;


export type DeleteRunServiceMutation = { __typename?: 'mutation_root', deleteRunService?: { __typename?: 'run_service', id: any } | null };

export type DeleteRunServiceConfigMutationVariables = Exact<{
  appID: Scalars['uuid'];
  serviceID: Scalars['uuid'];
}>;


export type DeleteRunServiceConfigMutation = { __typename?: 'mutation_root', deleteRunServiceConfig?: { __typename?: 'ConfigRunServiceConfig', name: string } | null };

export type GetRunServiceQueryVariables = Exact<{
  id: Scalars['uuid'];
  resolve: Scalars['Boolean'];
}>;


export type GetRunServiceQuery = { __typename?: 'query_root', runService?: { __typename?: 'run_service', id: any, config?: { __typename?: 'ConfigRunServiceConfig', name: string, command?: Array<string> | null, image: { __typename?: 'ConfigRunServiceImage', image: string }, resources: { __typename?: 'ConfigRunServiceResources', replicas: any, compute: { __typename?: 'ConfigRunServiceResourcesCompute', cpu: any, memory: any }, storage?: Array<{ __typename?: 'ConfigRunServiceResourcesStorage', name: string, path: string, capacity: any }> | null }, environment?: Array<{ __typename?: 'ConfigEnvironmentVariable', name: string, value: string }> | null, ports?: Array<{ __typename?: 'ConfigRunServicePort', port: any, type: string, publish?: boolean | null }> | null } | null } | null };

export type GetRunServicesQueryVariables = Exact<{
  appID: Scalars['uuid'];
  resolve: Scalars['Boolean'];
  limit: Scalars['Int'];
  offset: Scalars['Int'];
}>;


export type GetRunServicesQuery = { __typename?: 'query_root', app?: { __typename?: 'apps', runServices: Array<{ __typename?: 'run_service', id: any, createdAt: any, updatedAt: any, config?: { __typename?: 'ConfigRunServiceConfig', name: string, command?: Array<string> | null, image: { __typename?: 'ConfigRunServiceImage', image: string }, resources: { __typename?: 'ConfigRunServiceResources', replicas: any, compute: { __typename?: 'ConfigRunServiceResourcesCompute', cpu: any, memory: any }, storage?: Array<{ __typename?: 'ConfigRunServiceResourcesStorage', name: string, path: string, capacity: any }> | null }, environment?: Array<{ __typename?: 'ConfigEnvironmentVariable', name: string, value: string }> | null, ports?: Array<{ __typename?: 'ConfigRunServicePort', port: any, type: string, publish?: boolean | null }> | null } | null }>, runServices_aggregate: { __typename?: 'run_service_aggregate', aggregate?: { __typename?: 'run_service_aggregate_fields', count: number } | null } } | null };

export type InsertRunServiceMutationVariables = Exact<{
  object: Run_Service_Insert_Input;
}>;


export type InsertRunServiceMutation = { __typename?: 'mutation_root', insertRunService?: { __typename?: 'run_service', id: any, appID: any } | null };

export type InsertRunServiceConfigMutationVariables = Exact<{
  appID: Scalars['uuid'];
  serviceID: Scalars['uuid'];
  config: ConfigRunServiceConfigInsertInput;
}>;


export type InsertRunServiceConfigMutation = { __typename?: 'mutation_root', insertRunServiceConfig: { __typename?: 'ConfigRunServiceConfig', name: string } };

export type ReplaceRunServiceConfigMutationVariables = Exact<{
  appID: Scalars['uuid'];
  serviceID: Scalars['uuid'];
  config: ConfigRunServiceConfigInsertInput;
}>;


export type ReplaceRunServiceConfigMutation = { __typename?: 'mutation_root', replaceRunServiceConfig: { __typename: 'ConfigRunServiceConfig' } };

export type UpdateRunServiceConfigMutationVariables = Exact<{
  appID: Scalars['uuid'];
  serviceID: Scalars['uuid'];
  config: ConfigRunServiceConfigUpdateInput;
}>;


export type UpdateRunServiceConfigMutation = { __typename?: 'mutation_root', updateRunServiceConfig: { __typename?: 'ConfigRunServiceConfig', name: string } };

export type GetAuthenticationSettingsQueryVariables = Exact<{
  appId: Scalars['uuid'];
}>;


export type GetAuthenticationSettingsQuery = { __typename?: 'query_root', config?: { __typename: 'ConfigConfig', id: 'ConfigConfig', auth?: { __typename: 'ConfigAuth', version?: string | null, id: 'ConfigAuth', redirections?: { __typename?: 'ConfigAuthRedirections', clientUrl?: any | null, allowedUrls?: Array<string> | null } | null, totp?: { __typename?: 'ConfigAuthTotp', enabled?: boolean | null, issuer?: string | null } | null, signUp?: { __typename?: 'ConfigAuthSignUp', enabled?: boolean | null } | null, session?: { __typename?: 'ConfigAuthSession', accessToken?: { __typename?: 'ConfigAuthSessionAccessToken', expiresIn?: any | null } | null, refreshToken?: { __typename?: 'ConfigAuthSessionRefreshToken', expiresIn?: any | null } | null } | null, user?: { __typename?: 'ConfigAuthUser', email?: { __typename?: 'ConfigAuthUserEmail', allowed?: Array<any> | null, blocked?: Array<any> | null } | null, emailDomains?: { __typename?: 'ConfigAuthUserEmailDomains', allowed?: Array<string> | null, blocked?: Array<string> | null } | null, gravatar?: { __typename?: 'ConfigAuthUserGravatar', enabled?: boolean | null, default?: string | null, rating?: string | null } | null } | null } | null } | null };

export type EnvironmentVariableFragment = { __typename?: 'ConfigEnvironmentVariable', name: string, value: string, id: string };

export type JwtSecretFragment = { __typename?: 'ConfigJWTSecret', issuer?: string | null, key?: string | null, type?: string | null, jwk_url?: any | null, header?: string | null, claims_namespace_path?: string | null, claims_namespace?: string | null, claims_format?: string | null, audience?: string | null, allowed_skew?: any | null };

export type GetEnvironmentVariablesQueryVariables = Exact<{
  appId: Scalars['uuid'];
}>;


export type GetEnvironmentVariablesQuery = { __typename?: 'query_root', config?: { __typename: 'ConfigConfig', id: 'ConfigConfig', global?: { __typename?: 'ConfigGlobal', environment?: Array<{ __typename?: 'ConfigEnvironmentVariable', name: string, value: string, id: string }> | null } | null, hasura: { __typename?: 'ConfigHasura', adminSecret: string, webhookSecret: string, jwtSecrets?: Array<{ __typename?: 'ConfigJWTSecret', issuer?: string | null, key?: string | null, type?: string | null, jwk_url?: any | null, header?: string | null, claims_namespace_path?: string | null, claims_namespace?: string | null, claims_format?: string | null, audience?: string | null, allowed_skew?: any | null }> | null } } | null };

export type GetPostgresSettingsQueryVariables = Exact<{
  appId: Scalars['uuid'];
}>;


export type GetPostgresSettingsQuery = { __typename?: 'query_root', systemConfig?: { __typename?: 'ConfigSystemConfig', postgres: { __typename?: 'ConfigSystemConfigPostgres', database: string } } | null, config?: { __typename: 'ConfigConfig', id: 'ConfigConfig', postgres?: { __typename?: 'ConfigPostgres', version?: string | null } | null } | null };

export type ServiceResourcesFragment = { __typename?: 'ConfigConfig', auth?: { __typename?: 'ConfigAuth', resources?: { __typename?: 'ConfigResources', replicas: any, compute: { __typename?: 'ConfigResourcesCompute', cpu: any, memory: any } } | null } | null, hasura: { __typename?: 'ConfigHasura', resources?: { __typename?: 'ConfigResources', replicas: any, compute: { __typename?: 'ConfigResourcesCompute', cpu: any, memory: any } } | null }, postgres?: { __typename?: 'ConfigPostgres', resources?: { __typename?: 'ConfigResources', replicas: any, compute: { __typename?: 'ConfigResourcesCompute', cpu: any, memory: any } } | null } | null, storage?: { __typename?: 'ConfigStorage', resources?: { __typename?: 'ConfigResources', replicas: any, compute: { __typename?: 'ConfigResourcesCompute', cpu: any, memory: any } } | null } | null };

export type GetResourcesQueryVariables = Exact<{
  appId: Scalars['uuid'];
}>;


export type GetResourcesQuery = { __typename?: 'query_root', config?: { __typename?: 'ConfigConfig', auth?: { __typename?: 'ConfigAuth', resources?: { __typename?: 'ConfigResources', replicas: any, compute: { __typename?: 'ConfigResourcesCompute', cpu: any, memory: any } } | null } | null, hasura: { __typename?: 'ConfigHasura', resources?: { __typename?: 'ConfigResources', replicas: any, compute: { __typename?: 'ConfigResourcesCompute', cpu: any, memory: any } } | null }, postgres?: { __typename?: 'ConfigPostgres', resources?: { __typename?: 'ConfigResources', replicas: any, compute: { __typename?: 'ConfigResourcesCompute', cpu: any, memory: any } } | null } | null, storage?: { __typename?: 'ConfigStorage', resources?: { __typename?: 'ConfigResources', replicas: any, compute: { __typename?: 'ConfigResourcesCompute', cpu: any, memory: any } } | null } | null } | null };

export type GetStorageSettingsQueryVariables = Exact<{
  appId: Scalars['uuid'];
}>;


export type GetStorageSettingsQuery = { __typename?: 'query_root', config?: { __typename: 'ConfigConfig', id: 'ConfigConfig', storage?: { __typename?: 'ConfigStorage', version?: string | null } | null } | null };

export type GetHasuraSettingsQueryVariables = Exact<{
  appId: Scalars['uuid'];
}>;


export type GetHasuraSettingsQuery = { __typename?: 'query_root', config?: { __typename: 'ConfigConfig', id: 'ConfigConfig', hasura: { __typename?: 'ConfigHasura', version?: string | null, settings?: { __typename?: 'ConfigHasuraSettings', enableAllowList?: boolean | null, enableRemoteSchemaPermissions?: boolean | null, enableConsole?: boolean | null, devMode?: boolean | null, corsDomain?: Array<any> | null, enabledAPIs?: Array<any> | null } | null, logs?: { __typename?: 'ConfigHasuraLogs', level?: string | null } | null, events?: { __typename?: 'ConfigHasuraEvents', httpPoolSize?: any | null } | null } } | null };

export type ResetDatabasePasswordMutationVariables = Exact<{
  appId: Scalars['String'];
  newPassword: Scalars['String'];
}>;


export type ResetDatabasePasswordMutation = { __typename?: 'mutation_root', resetPostgresPassword: boolean };

export type PermissionVariableFragment = { __typename?: 'ConfigAuthsessionaccessTokenCustomClaims', key: string, value: string, id: string };

export type GetRolesPermissionsQueryVariables = Exact<{
  appId: Scalars['uuid'];
}>;


export type GetRolesPermissionsQuery = { __typename?: 'query_root', config?: { __typename: 'ConfigConfig', id: 'ConfigConfig', auth?: { __typename?: 'ConfigAuth', user?: { __typename?: 'ConfigAuthUser', roles?: { __typename?: 'ConfigAuthUserRoles', allowed?: Array<any> | null, default?: any | null } | null } | null, session?: { __typename?: 'ConfigAuthSession', accessToken?: { __typename?: 'ConfigAuthSessionAccessToken', customClaims?: Array<{ __typename?: 'ConfigAuthsessionaccessTokenCustomClaims', key: string, value: string, id: string }> | null } | null } | null } | null } | null };

export type GetSignInMethodsQueryVariables = Exact<{
  appId: Scalars['uuid'];
}>;


export type GetSignInMethodsQuery = { __typename?: 'query_root', config?: { __typename: 'ConfigConfig', id: 'ConfigConfig', provider?: { __typename: 'ConfigProvider', id: 'ConfigProvider', sms?: { __typename?: 'ConfigSms', accountSid: string, authToken: string, messagingServiceId: string, provider?: string | null } | null } | null, auth?: { __typename: 'ConfigAuth', id: 'ConfigAuth', method?: { __typename?: 'ConfigAuthMethod', emailPassword?: { __typename?: 'ConfigAuthMethodEmailPassword', emailVerificationRequired?: boolean | null, hibpEnabled?: boolean | null, passwordMinLength?: any | null } | null, emailPasswordless?: { __typename?: 'ConfigAuthMethodEmailPasswordless', enabled?: boolean | null } | null, smsPasswordless?: { __typename?: 'ConfigAuthMethodSmsPasswordless', enabled?: boolean | null } | null, anonymous?: { __typename?: 'ConfigAuthMethodAnonymous', enabled?: boolean | null } | null, webauthn?: { __typename?: 'ConfigAuthMethodWebauthn', enabled?: boolean | null } | null, oauth?: { __typename?: 'ConfigAuthMethodOauth', apple?: { __typename?: 'ConfigAuthMethodOauthApple', enabled?: boolean | null, clientId?: string | null, keyId?: string | null, teamId?: string | null, privateKey?: string | null } | null, bitbucket?: { __typename?: 'ConfigStandardOauthProvider', enabled?: boolean | null, clientId?: string | null, clientSecret?: string | null } | null, gitlab?: { __typename?: 'ConfigStandardOauthProviderWithScope', enabled?: boolean | null, clientId?: string | null, clientSecret?: string | null, scope?: Array<string> | null } | null, strava?: { __typename?: 'ConfigStandardOauthProviderWithScope', enabled?: boolean | null, clientId?: string | null, clientSecret?: string | null, scope?: Array<string> | null } | null, discord?: { __typename?: 'ConfigStandardOauthProviderWithScope', enabled?: boolean | null, clientId?: string | null, clientSecret?: string | null, scope?: Array<string> | null } | null, facebook?: { __typename?: 'ConfigStandardOauthProviderWithScope', enabled?: boolean | null, clientId?: string | null, clientSecret?: string | null, scope?: Array<string> | null } | null, github?: { __typename?: 'ConfigStandardOauthProviderWithScope', enabled?: boolean | null, clientId?: string | null, clientSecret?: string | null, scope?: Array<string> | null } | null, google?: { __typename?: 'ConfigStandardOauthProviderWithScope', enabled?: boolean | null, clientId?: string | null, clientSecret?: string | null, scope?: Array<string> | null } | null, linkedin?: { __typename?: 'ConfigStandardOauthProviderWithScope', enabled?: boolean | null, clientId?: string | null, clientSecret?: string | null, scope?: Array<string> | null } | null, spotify?: { __typename?: 'ConfigStandardOauthProviderWithScope', enabled?: boolean | null, clientId?: string | null, clientSecret?: string | null, scope?: Array<string> | null } | null, twitch?: { __typename?: 'ConfigStandardOauthProviderWithScope', enabled?: boolean | null, clientId?: string | null, clientSecret?: string | null, scope?: Array<string> | null } | null, twitter?: { __typename?: 'ConfigAuthMethodOauthTwitter', enabled?: boolean | null, consumerKey?: string | null, consumerSecret?: string | null } | null, windowslive?: { __typename?: 'ConfigStandardOauthProviderWithScope', enabled?: boolean | null, clientId?: string | null, clientSecret?: string | null, scope?: Array<string> | null } | null, workos?: { __typename?: 'ConfigAuthMethodOauthWorkos', enabled?: boolean | null, clientId?: string | null, clientSecret?: string | null, connection?: string | null, organization?: string | null } | null, azuread?: { __typename?: 'ConfigAuthMethodOauthAzuread', enabled?: boolean | null, clientId?: string | null, clientSecret?: string | null, tenant?: string | null } | null } | null } | null } | null } | null };

export type GetSmtpSettingsQueryVariables = Exact<{
  appId: Scalars['uuid'];
}>;


export type GetSmtpSettingsQuery = { __typename?: 'query_root', config?: { __typename: 'ConfigConfig', id: 'ConfigConfig', provider?: { __typename: 'ConfigProvider', id: 'ConfigProvider', smtp?: { __typename?: 'ConfigSmtp', host: string, method: string, port: any, secure: boolean, sender: string, user: string } | null } | null } | null };

export type UpdateConfigMutationVariables = Exact<{
  appId: Scalars['uuid'];
  config: ConfigConfigUpdateInput;
}>;


export type UpdateConfigMutation = { __typename?: 'mutation_root', updateConfig: { __typename?: 'ConfigConfig', id: 'ConfigConfig' } };

export type GetFreeAndActiveProjectsQueryVariables = Exact<{
  userId: Scalars['uuid'];
}>;


export type GetFreeAndActiveProjectsQuery = { __typename?: 'query_root', freeAndActiveProjects: Array<{ __typename?: 'apps', id: any }> };

export type InsertFeedbackOneMutationVariables = Exact<{
  feedback: Feedback_Insert_Input;
}>;


export type InsertFeedbackOneMutation = { __typename?: 'mutation_root', insertFeedbackOne?: { __typename?: 'feedback', id: number } | null };

export type DeleteWorkspaceMemberInvitesMutationVariables = Exact<{
  id: Scalars['uuid'];
}>;


export type DeleteWorkspaceMemberInvitesMutation = { __typename?: 'mutation_root', deleteWorkspaceMemberInvites?: { __typename?: 'workspaceMemberInvites_mutation_response', affected_rows: number } | null };

export type GetWorkspaceMemberInvitesToManageQueryVariables = Exact<{
  userId: Scalars['uuid'];
}>;


export type GetWorkspaceMemberInvitesToManageQuery = { __typename?: 'query_root', workspaceMemberInvites: Array<{ __typename?: 'workspaceMemberInvites', id: any, email: any, userByEmail?: { __typename?: 'users', id: any } | null, workspace: { __typename?: 'workspaces', id: any, name: string, slug: string } }> };

export type InsertWorkspaceMemberInviteMutationVariables = Exact<{
  workspaceMemberInvite: WorkspaceMemberInvites_Insert_Input;
}>;


export type InsertWorkspaceMemberInviteMutation = { __typename?: 'mutation_root', insertWorkspaceMemberInvite?: { __typename?: 'workspaceMemberInvites', id: any } | null };

export type UpdateWorkspaceMemberInviteMutationVariables = Exact<{
  id: Scalars['uuid'];
  workspaceMemberInvite: WorkspaceMemberInvites_Set_Input;
}>;


export type UpdateWorkspaceMemberInviteMutation = { __typename?: 'mutation_root', updateWorkspaceMemberInvites?: { __typename?: 'workspaceMemberInvites_mutation_response', affected_rows: number } | null };

export type DeleteWorkspaceMemberMutationVariables = Exact<{
  id: Scalars['uuid'];
}>;


export type DeleteWorkspaceMemberMutation = { __typename?: 'mutation_root', deleteWorkspaceMember?: { __typename?: 'workspaceMembers', id: any } | null };

export type GetWorkspaceMembersWorkspaceMemberFragment = { __typename?: 'workspaceMembers', id: any, type: string, user: { __typename?: 'users', id: any, displayName: string, avatarUrl: string, email?: any | null } };

export type GetWorkspaceMembersWorkspaceMemberInviteFragment = { __typename?: 'workspaceMemberInvites', id: any, email: any, memberType: string };

export type GetWorkspaceMembersQueryVariables = Exact<{
  workspaceId: Scalars['uuid'];
}>;


export type GetWorkspaceMembersQuery = { __typename?: 'query_root', workspace?: { __typename?: 'workspaces', id: any, creatorUser?: { __typename?: 'users', id: any } | null, workspaceMembers: Array<{ __typename?: 'workspaceMembers', id: any, type: string, user: { __typename?: 'users', id: any, displayName: string, avatarUrl: string, email?: any | null } }>, workspaceMemberInvites: Array<{ __typename?: 'workspaceMemberInvites', id: any, email: any, memberType: string }> } | null };

export type UpdateWorkspaceMemberMutationVariables = Exact<{
  id: Scalars['uuid'];
  workspaceMember: WorkspaceMembers_Set_Input;
}>;


export type UpdateWorkspaceMemberMutation = { __typename?: 'mutation_root', updateWorkspaceMember?: { __typename?: 'workspaceMembers', id: any } | null };

export type DeleteWorkspaceMutationVariables = Exact<{
  id: Scalars['uuid'];
}>;


export type DeleteWorkspaceMutation = { __typename?: 'mutation_root', deleteWorkspace?: { __typename?: 'workspaces', id: any } | null };

export type InsertWorkspaceMutationVariables = Exact<{
  workspace: Workspaces_Insert_Input;
}>;


export type InsertWorkspaceMutation = { __typename?: 'mutation_root', insertWorkspace?: { __typename?: 'workspaces', name: string, id: any } | null };

export type UpdateWorkspaceMutationVariables = Exact<{
  id: Scalars['uuid'];
  workspace: Workspaces_Set_Input;
}>;


export type UpdateWorkspaceMutation = { __typename?: 'mutation_root', updateWorkspace?: { __typename?: 'workspaces', id: any, name: string, email: string, companyName: string, addressLine1: string, addressLine2: string, addressPostalCode: string, addressCity: string, addressCountryCode?: string | null, slug: string, taxIdType: string, taxIdValue: string } | null };

export const GetAppPlanAndGlobalPlansAppFragmentDoc = gql`
    fragment getAppPlanAndGlobalPlansApp on apps {
  id
  subdomain
  workspace {
    id
    paymentMethods {
      id
    }
  }
  plan {
    id
    name
  }
}
    `;
export const GetAppPlanAndGlobalPlansPlanFragmentDoc = gql`
    fragment getAppPlanAndGlobalPlansPlan on plans {
  id
  name
  isFree
  price
  featureMaxDbSize
}
    `;
export const PrefetchNewAppRegionsFragmentDoc = gql`
    fragment PrefetchNewAppRegions on regions {
  id
  city
  active
  country {
    code
    name
  }
}
    `;
export const PrefetchNewAppPlansFragmentDoc = gql`
    fragment PrefetchNewAppPlans on plans {
  id
  name
  isDefault
  isFree
  price
  featureBackupEnabled
  featureCustomDomainsEnabled
  featureMaxDbSize
}
    `;
export const PrefetchNewAppWorkspaceFragmentDoc = gql`
    fragment PrefetchNewAppWorkspace on workspaces {
  id
  name
  slug
  paymentMethods {
    id
  }
}
    `;
export const BackupFragmentDoc = gql`
    fragment Backup on backups {
  id
  size
  createdAt
  completedAt
}
    `;
export const DeploymentRowFragmentDoc = gql`
    fragment DeploymentRow on deployments {
  id
  commitSHA
  deploymentStartedAt
  deploymentEndedAt
  deploymentStatus
  commitUserName
  commitUserAvatarUrl
  commitMessage
}
    `;
export const AppStateHistoryFragmentDoc = gql`
    fragment AppStateHistory on appStateHistory {
  id
  appId
  message
  stateId
  createdAt
}
    `;
export const ProjectFragmentDoc = gql`
    fragment Project on apps {
  id
  slug
  name
  repositoryProductionBranch
  subdomain
  isProvisioned
  createdAt
  desiredState
  nhostBaseFolder
  providersUpdated
  config(resolve: true) {
    observability {
      grafana {
        adminPassword
      }
    }
    hasura {
      adminSecret
      settings {
        enableConsole
      }
    }
  }
  featureFlags {
    description
    id
    name
    value
  }
  appStates(order_by: {createdAt: desc}, limit: 1) {
    id
    appId
    message
    stateId
    createdAt
  }
  region {
    id
    countryCode
    awsName
    domain
    city
  }
  plan {
    id
    name
    price
    isFree
  }
  githubRepository {
    fullName
  }
  deployments(limit: 4, order_by: {deploymentStartedAt: desc}) {
    id
    commitSHA
    commitMessage
    commitUserName
    deploymentStartedAt
    deploymentEndedAt
    commitUserAvatarUrl
    deploymentStatus
  }
  creator {
    id
    email
    displayName
  }
}
    `;
export const WorkspaceFragmentDoc = gql`
    fragment Workspace on workspaces {
  id
  name
  slug
  creatorUserId
  workspaceMembers {
    id
    user {
      id
      email
      displayName
    }
    type
  }
  projects: apps(order_by: {name: asc}) {
    ...Project
  }
}
    ${ProjectFragmentDoc}`;
export const GithubRepositoryFragmentDoc = gql`
    fragment GithubRepository on githubRepositories {
  id
  name
  fullName
  private
  githubAppInstallation {
    id
    accountLogin
    accountType
    accountAvatarUrl
  }
}
    `;
export const GetPaymentMethodsFragmentDoc = gql`
    fragment getPaymentMethods on paymentMethods {
  id
  createdAt
  cardBrand
  cardLast4
  cardExpMonth
  cardExpYear
  isDefault
  workspace {
    id
    apps {
      id
      plan {
        isFree
      }
    }
  }
}
    `;
export const SecretFragmentDoc = gql`
    fragment Secret on ConfigEnvironmentVariable {
  name
}
    `;
export const EnvironmentVariableFragmentDoc = gql`
    fragment EnvironmentVariable on ConfigEnvironmentVariable {
  id: name
  name
  value
}
    `;
export const JwtSecretFragmentDoc = gql`
    fragment JWTSecret on ConfigJWTSecret {
  issuer
  key
  type
  jwk_url
  header
  claims_namespace_path
  claims_namespace
  claims_format
  audience
  allowed_skew
}
    `;
export const ServiceResourcesFragmentDoc = gql`
    fragment ServiceResources on ConfigConfig {
  auth {
    resources {
      compute {
        cpu
        memory
      }
      replicas
    }
  }
  hasura {
    resources {
      compute {
        cpu
        memory
      }
      replicas
    }
  }
  postgres {
    resources {
      compute {
        cpu
        memory
      }
      replicas
    }
  }
  storage {
    resources {
      compute {
        cpu
        memory
      }
      replicas
    }
  }
}
    `;
export const PermissionVariableFragmentDoc = gql`
    fragment PermissionVariable on ConfigAuthsessionaccessTokenCustomClaims {
  id: key
  key
  value
}
    `;
export const GetWorkspaceMembersWorkspaceMemberFragmentDoc = gql`
    fragment getWorkspaceMembersWorkspaceMember on workspaceMembers {
  id
  type
  user {
    id
    displayName
    avatarUrl
    email
  }
}
    `;
export const GetWorkspaceMembersWorkspaceMemberInviteFragmentDoc = gql`
    fragment getWorkspaceMembersWorkspaceMemberInvite on workspaceMemberInvites {
  id
  email
  memberType
}
    `;
export const DeleteApplicationDocument = gql`
    mutation deleteApplication($appId: uuid!) {
  deleteApp(id: $appId) {
    id
  }
}
    `;
export type DeleteApplicationMutationFn = Apollo.MutationFunction<DeleteApplicationMutation, DeleteApplicationMutationVariables>;

/**
 * __useDeleteApplicationMutation__
 *
 * To run a mutation, you first call `useDeleteApplicationMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useDeleteApplicationMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [deleteApplicationMutation, { data, loading, error }] = useDeleteApplicationMutation({
 *   variables: {
 *      appId: // value for 'appId'
 *   },
 * });
 */
export function useDeleteApplicationMutation(baseOptions?: Apollo.MutationHookOptions<DeleteApplicationMutation, DeleteApplicationMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<DeleteApplicationMutation, DeleteApplicationMutationVariables>(DeleteApplicationDocument, options);
      }
export type DeleteApplicationMutationHookResult = ReturnType<typeof useDeleteApplicationMutation>;
export type DeleteApplicationMutationResult = Apollo.MutationResult<DeleteApplicationMutation>;
export type DeleteApplicationMutationOptions = Apollo.BaseMutationOptions<DeleteApplicationMutation, DeleteApplicationMutationVariables>;
export const GetAllWorkspacesAndProjectsDocument = gql`
    query GetAllWorkspacesAndProjects {
  workspaces(order_by: {name: asc}) {
    ...Workspace
  }
}
    ${WorkspaceFragmentDoc}`;

/**
 * __useGetAllWorkspacesAndProjectsQuery__
 *
 * To run a query within a React component, call `useGetAllWorkspacesAndProjectsQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetAllWorkspacesAndProjectsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetAllWorkspacesAndProjectsQuery({
 *   variables: {
 *   },
 * });
 */
export function useGetAllWorkspacesAndProjectsQuery(baseOptions?: Apollo.QueryHookOptions<GetAllWorkspacesAndProjectsQuery, GetAllWorkspacesAndProjectsQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetAllWorkspacesAndProjectsQuery, GetAllWorkspacesAndProjectsQueryVariables>(GetAllWorkspacesAndProjectsDocument, options);
      }
export function useGetAllWorkspacesAndProjectsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetAllWorkspacesAndProjectsQuery, GetAllWorkspacesAndProjectsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetAllWorkspacesAndProjectsQuery, GetAllWorkspacesAndProjectsQueryVariables>(GetAllWorkspacesAndProjectsDocument, options);
        }
export type GetAllWorkspacesAndProjectsQueryHookResult = ReturnType<typeof useGetAllWorkspacesAndProjectsQuery>;
export type GetAllWorkspacesAndProjectsLazyQueryHookResult = ReturnType<typeof useGetAllWorkspacesAndProjectsLazyQuery>;
export type GetAllWorkspacesAndProjectsQueryResult = Apollo.QueryResult<GetAllWorkspacesAndProjectsQuery, GetAllWorkspacesAndProjectsQueryVariables>;
export function refetchGetAllWorkspacesAndProjectsQuery(variables?: GetAllWorkspacesAndProjectsQueryVariables) {
      return { query: GetAllWorkspacesAndProjectsDocument, variables: variables }
    }
export const GetAppPlanAndGlobalPlansDocument = gql`
    query getAppPlanAndGlobalPlans($workspaceSlug: String!, $appSlug: String!) {
  apps(where: {workspace: {slug: {_eq: $workspaceSlug}}, slug: {_eq: $appSlug}}) {
    ...getAppPlanAndGlobalPlansApp
  }
  plans {
    ...getAppPlanAndGlobalPlansPlan
  }
}
    ${GetAppPlanAndGlobalPlansAppFragmentDoc}
${GetAppPlanAndGlobalPlansPlanFragmentDoc}`;

/**
 * __useGetAppPlanAndGlobalPlansQuery__
 *
 * To run a query within a React component, call `useGetAppPlanAndGlobalPlansQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetAppPlanAndGlobalPlansQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetAppPlanAndGlobalPlansQuery({
 *   variables: {
 *      workspaceSlug: // value for 'workspaceSlug'
 *      appSlug: // value for 'appSlug'
 *   },
 * });
 */
export function useGetAppPlanAndGlobalPlansQuery(baseOptions: Apollo.QueryHookOptions<GetAppPlanAndGlobalPlansQuery, GetAppPlanAndGlobalPlansQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetAppPlanAndGlobalPlansQuery, GetAppPlanAndGlobalPlansQueryVariables>(GetAppPlanAndGlobalPlansDocument, options);
      }
export function useGetAppPlanAndGlobalPlansLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetAppPlanAndGlobalPlansQuery, GetAppPlanAndGlobalPlansQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetAppPlanAndGlobalPlansQuery, GetAppPlanAndGlobalPlansQueryVariables>(GetAppPlanAndGlobalPlansDocument, options);
        }
export type GetAppPlanAndGlobalPlansQueryHookResult = ReturnType<typeof useGetAppPlanAndGlobalPlansQuery>;
export type GetAppPlanAndGlobalPlansLazyQueryHookResult = ReturnType<typeof useGetAppPlanAndGlobalPlansLazyQuery>;
export type GetAppPlanAndGlobalPlansQueryResult = Apollo.QueryResult<GetAppPlanAndGlobalPlansQuery, GetAppPlanAndGlobalPlansQueryVariables>;
export function refetchGetAppPlanAndGlobalPlansQuery(variables: GetAppPlanAndGlobalPlansQueryVariables) {
      return { query: GetAppPlanAndGlobalPlansDocument, variables: variables }
    }
export const GetApplicationPlanDocument = gql`
    query getApplicationPlan($workspace: String!, $slug: String!) {
  apps(where: {workspace: {slug: {_eq: $workspace}}, slug: {_eq: $slug}}) {
    id
    subdomain
    plan {
      name
      price
      upatedAt
      featureMaxDbSize
    }
  }
}
    `;

/**
 * __useGetApplicationPlanQuery__
 *
 * To run a query within a React component, call `useGetApplicationPlanQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetApplicationPlanQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetApplicationPlanQuery({
 *   variables: {
 *      workspace: // value for 'workspace'
 *      slug: // value for 'slug'
 *   },
 * });
 */
export function useGetApplicationPlanQuery(baseOptions: Apollo.QueryHookOptions<GetApplicationPlanQuery, GetApplicationPlanQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetApplicationPlanQuery, GetApplicationPlanQueryVariables>(GetApplicationPlanDocument, options);
      }
export function useGetApplicationPlanLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetApplicationPlanQuery, GetApplicationPlanQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetApplicationPlanQuery, GetApplicationPlanQueryVariables>(GetApplicationPlanDocument, options);
        }
export type GetApplicationPlanQueryHookResult = ReturnType<typeof useGetApplicationPlanQuery>;
export type GetApplicationPlanLazyQueryHookResult = ReturnType<typeof useGetApplicationPlanLazyQuery>;
export type GetApplicationPlanQueryResult = Apollo.QueryResult<GetApplicationPlanQuery, GetApplicationPlanQueryVariables>;
export function refetchGetApplicationPlanQuery(variables: GetApplicationPlanQueryVariables) {
      return { query: GetApplicationPlanDocument, variables: variables }
    }
export const GetApplicationStateDocument = gql`
    query getApplicationState($appId: uuid!) {
  app(id: $appId) {
    id
    name
    appStates(order_by: {createdAt: desc}, limit: 10) {
      ...AppStateHistory
    }
  }
}
    ${AppStateHistoryFragmentDoc}`;

/**
 * __useGetApplicationStateQuery__
 *
 * To run a query within a React component, call `useGetApplicationStateQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetApplicationStateQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetApplicationStateQuery({
 *   variables: {
 *      appId: // value for 'appId'
 *   },
 * });
 */
export function useGetApplicationStateQuery(baseOptions: Apollo.QueryHookOptions<GetApplicationStateQuery, GetApplicationStateQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetApplicationStateQuery, GetApplicationStateQueryVariables>(GetApplicationStateDocument, options);
      }
export function useGetApplicationStateLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetApplicationStateQuery, GetApplicationStateQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetApplicationStateQuery, GetApplicationStateQueryVariables>(GetApplicationStateDocument, options);
        }
export type GetApplicationStateQueryHookResult = ReturnType<typeof useGetApplicationStateQuery>;
export type GetApplicationStateLazyQueryHookResult = ReturnType<typeof useGetApplicationStateLazyQuery>;
export type GetApplicationStateQueryResult = Apollo.QueryResult<GetApplicationStateQuery, GetApplicationStateQueryVariables>;
export function refetchGetApplicationStateQuery(variables: GetApplicationStateQueryVariables) {
      return { query: GetApplicationStateDocument, variables: variables }
    }
export const GetProjectMetricsDocument = gql`
    query GetProjectMetrics($appId: String!, $subdomain: String!, $from: Timestamp, $to: Timestamp) {
  logsVolume: getLogsVolume(appID: $appId, from: $from, to: $to) {
    value
  }
  cpuSecondsUsage: getCPUSecondsUsage(appID: $appId, from: $from, to: $to) {
    value
  }
  functionInvocations: getFunctionsInvocations(
    appID: $appId
    from: $from
    to: $to
  ) {
    value
  }
  postgresVolumeCapacity: getPostgresVolumeCapacity(appID: $appId) {
    value
  }
  postgresVolumeUsage: getPostgresVolumeUsage(appID: $appId) {
    value
  }
  totalRequests: getTotalRequests(appID: $appId, from: $from, to: $to) {
    value
  }
  egressVolume: getEgressVolume(
    appID: $appId
    subdomain: $subdomain
    from: $from
    to: $to
  ) {
    value
  }
}
    `;

/**
 * __useGetProjectMetricsQuery__
 *
 * To run a query within a React component, call `useGetProjectMetricsQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetProjectMetricsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetProjectMetricsQuery({
 *   variables: {
 *      appId: // value for 'appId'
 *      subdomain: // value for 'subdomain'
 *      from: // value for 'from'
 *      to: // value for 'to'
 *   },
 * });
 */
export function useGetProjectMetricsQuery(baseOptions: Apollo.QueryHookOptions<GetProjectMetricsQuery, GetProjectMetricsQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetProjectMetricsQuery, GetProjectMetricsQueryVariables>(GetProjectMetricsDocument, options);
      }
export function useGetProjectMetricsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetProjectMetricsQuery, GetProjectMetricsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetProjectMetricsQuery, GetProjectMetricsQueryVariables>(GetProjectMetricsDocument, options);
        }
export type GetProjectMetricsQueryHookResult = ReturnType<typeof useGetProjectMetricsQuery>;
export type GetProjectMetricsLazyQueryHookResult = ReturnType<typeof useGetProjectMetricsLazyQuery>;
export type GetProjectMetricsQueryResult = Apollo.QueryResult<GetProjectMetricsQuery, GetProjectMetricsQueryVariables>;
export function refetchGetProjectMetricsQuery(variables: GetProjectMetricsQueryVariables) {
      return { query: GetProjectMetricsDocument, variables: variables }
    }
export const GetWorkspaceAndProjectDocument = gql`
    query GetWorkspaceAndProject($workspaceSlug: String!, $projectSlug: String) {
  workspaces(where: {slug: {_eq: $workspaceSlug}}) {
    ...Workspace
  }
}
    ${WorkspaceFragmentDoc}`;

/**
 * __useGetWorkspaceAndProjectQuery__
 *
 * To run a query within a React component, call `useGetWorkspaceAndProjectQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetWorkspaceAndProjectQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetWorkspaceAndProjectQuery({
 *   variables: {
 *      workspaceSlug: // value for 'workspaceSlug'
 *      projectSlug: // value for 'projectSlug'
 *   },
 * });
 */
export function useGetWorkspaceAndProjectQuery(baseOptions: Apollo.QueryHookOptions<GetWorkspaceAndProjectQuery, GetWorkspaceAndProjectQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetWorkspaceAndProjectQuery, GetWorkspaceAndProjectQueryVariables>(GetWorkspaceAndProjectDocument, options);
      }
export function useGetWorkspaceAndProjectLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetWorkspaceAndProjectQuery, GetWorkspaceAndProjectQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetWorkspaceAndProjectQuery, GetWorkspaceAndProjectQueryVariables>(GetWorkspaceAndProjectDocument, options);
        }
export type GetWorkspaceAndProjectQueryHookResult = ReturnType<typeof useGetWorkspaceAndProjectQuery>;
export type GetWorkspaceAndProjectLazyQueryHookResult = ReturnType<typeof useGetWorkspaceAndProjectLazyQuery>;
export type GetWorkspaceAndProjectQueryResult = Apollo.QueryResult<GetWorkspaceAndProjectQuery, GetWorkspaceAndProjectQueryVariables>;
export function refetchGetWorkspaceAndProjectQuery(variables: GetWorkspaceAndProjectQueryVariables) {
      return { query: GetWorkspaceAndProjectDocument, variables: variables }
    }
export const InsertApplicationDocument = gql`
    mutation insertApplication($app: apps_insert_input!) {
  insertApp(object: $app) {
    id
    name
    slug
    workspace {
      id
      name
      slug
    }
  }
}
    `;
export type InsertApplicationMutationFn = Apollo.MutationFunction<InsertApplicationMutation, InsertApplicationMutationVariables>;

/**
 * __useInsertApplicationMutation__
 *
 * To run a mutation, you first call `useInsertApplicationMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useInsertApplicationMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [insertApplicationMutation, { data, loading, error }] = useInsertApplicationMutation({
 *   variables: {
 *      app: // value for 'app'
 *   },
 * });
 */
export function useInsertApplicationMutation(baseOptions?: Apollo.MutationHookOptions<InsertApplicationMutation, InsertApplicationMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<InsertApplicationMutation, InsertApplicationMutationVariables>(InsertApplicationDocument, options);
      }
export type InsertApplicationMutationHookResult = ReturnType<typeof useInsertApplicationMutation>;
export type InsertApplicationMutationResult = Apollo.MutationResult<InsertApplicationMutation>;
export type InsertApplicationMutationOptions = Apollo.BaseMutationOptions<InsertApplicationMutation, InsertApplicationMutationVariables>;
export const PauseApplicationDocument = gql`
    mutation PauseApplication($appId: uuid!) {
  updateApp(pk_columns: {id: $appId}, _set: {desiredState: 6}) {
    id
  }
}
    `;
export type PauseApplicationMutationFn = Apollo.MutationFunction<PauseApplicationMutation, PauseApplicationMutationVariables>;

/**
 * __usePauseApplicationMutation__
 *
 * To run a mutation, you first call `usePauseApplicationMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `usePauseApplicationMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [pauseApplicationMutation, { data, loading, error }] = usePauseApplicationMutation({
 *   variables: {
 *      appId: // value for 'appId'
 *   },
 * });
 */
export function usePauseApplicationMutation(baseOptions?: Apollo.MutationHookOptions<PauseApplicationMutation, PauseApplicationMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<PauseApplicationMutation, PauseApplicationMutationVariables>(PauseApplicationDocument, options);
      }
export type PauseApplicationMutationHookResult = ReturnType<typeof usePauseApplicationMutation>;
export type PauseApplicationMutationResult = Apollo.MutationResult<PauseApplicationMutation>;
export type PauseApplicationMutationOptions = Apollo.BaseMutationOptions<PauseApplicationMutation, PauseApplicationMutationVariables>;
export const PrefetchNewAppDocument = gql`
    query PrefetchNewApp {
  regions(order_by: {city: asc}) {
    ...PrefetchNewAppRegions
  }
  plans(order_by: {sort: asc}) {
    ...PrefetchNewAppPlans
  }
  workspaces {
    ...PrefetchNewAppWorkspace
  }
}
    ${PrefetchNewAppRegionsFragmentDoc}
${PrefetchNewAppPlansFragmentDoc}
${PrefetchNewAppWorkspaceFragmentDoc}`;

/**
 * __usePrefetchNewAppQuery__
 *
 * To run a query within a React component, call `usePrefetchNewAppQuery` and pass it any options that fit your needs.
 * When your component renders, `usePrefetchNewAppQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = usePrefetchNewAppQuery({
 *   variables: {
 *   },
 * });
 */
export function usePrefetchNewAppQuery(baseOptions?: Apollo.QueryHookOptions<PrefetchNewAppQuery, PrefetchNewAppQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<PrefetchNewAppQuery, PrefetchNewAppQueryVariables>(PrefetchNewAppDocument, options);
      }
export function usePrefetchNewAppLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<PrefetchNewAppQuery, PrefetchNewAppQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<PrefetchNewAppQuery, PrefetchNewAppQueryVariables>(PrefetchNewAppDocument, options);
        }
export type PrefetchNewAppQueryHookResult = ReturnType<typeof usePrefetchNewAppQuery>;
export type PrefetchNewAppLazyQueryHookResult = ReturnType<typeof usePrefetchNewAppLazyQuery>;
export type PrefetchNewAppQueryResult = Apollo.QueryResult<PrefetchNewAppQuery, PrefetchNewAppQueryVariables>;
export function refetchPrefetchNewAppQuery(variables?: PrefetchNewAppQueryVariables) {
      return { query: PrefetchNewAppDocument, variables: variables }
    }
export const UnpauseApplicationDocument = gql`
    mutation UnpauseApplication($appId: uuid!) {
  updateApp(pk_columns: {id: $appId}, _set: {desiredState: 5}) {
    id
  }
}
    `;
export type UnpauseApplicationMutationFn = Apollo.MutationFunction<UnpauseApplicationMutation, UnpauseApplicationMutationVariables>;

/**
 * __useUnpauseApplicationMutation__
 *
 * To run a mutation, you first call `useUnpauseApplicationMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useUnpauseApplicationMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [unpauseApplicationMutation, { data, loading, error }] = useUnpauseApplicationMutation({
 *   variables: {
 *      appId: // value for 'appId'
 *   },
 * });
 */
export function useUnpauseApplicationMutation(baseOptions?: Apollo.MutationHookOptions<UnpauseApplicationMutation, UnpauseApplicationMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<UnpauseApplicationMutation, UnpauseApplicationMutationVariables>(UnpauseApplicationDocument, options);
      }
export type UnpauseApplicationMutationHookResult = ReturnType<typeof useUnpauseApplicationMutation>;
export type UnpauseApplicationMutationResult = Apollo.MutationResult<UnpauseApplicationMutation>;
export type UnpauseApplicationMutationOptions = Apollo.BaseMutationOptions<UnpauseApplicationMutation, UnpauseApplicationMutationVariables>;
export const UpdateApplicationDocument = gql`
    mutation updateApplication($appId: uuid!, $app: apps_set_input!) {
  updateApp(pk_columns: {id: $appId}, _set: $app) {
    name
    id
    slug
  }
}
    `;
export type UpdateApplicationMutationFn = Apollo.MutationFunction<UpdateApplicationMutation, UpdateApplicationMutationVariables>;

/**
 * __useUpdateApplicationMutation__
 *
 * To run a mutation, you first call `useUpdateApplicationMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useUpdateApplicationMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [updateApplicationMutation, { data, loading, error }] = useUpdateApplicationMutation({
 *   variables: {
 *      appId: // value for 'appId'
 *      app: // value for 'app'
 *   },
 * });
 */
export function useUpdateApplicationMutation(baseOptions?: Apollo.MutationHookOptions<UpdateApplicationMutation, UpdateApplicationMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<UpdateApplicationMutation, UpdateApplicationMutationVariables>(UpdateApplicationDocument, options);
      }
export type UpdateApplicationMutationHookResult = ReturnType<typeof useUpdateApplicationMutation>;
export type UpdateApplicationMutationResult = Apollo.MutationResult<UpdateApplicationMutation>;
export type UpdateApplicationMutationOptions = Apollo.BaseMutationOptions<UpdateApplicationMutation, UpdateApplicationMutationVariables>;
export const GetApplicationBackupsDocument = gql`
    query getApplicationBackups($appId: uuid!) {
  app(id: $appId) {
    backups(order_by: {createdAt: desc}) {
      ...Backup
    }
  }
}
    ${BackupFragmentDoc}`;

/**
 * __useGetApplicationBackupsQuery__
 *
 * To run a query within a React component, call `useGetApplicationBackupsQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetApplicationBackupsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetApplicationBackupsQuery({
 *   variables: {
 *      appId: // value for 'appId'
 *   },
 * });
 */
export function useGetApplicationBackupsQuery(baseOptions: Apollo.QueryHookOptions<GetApplicationBackupsQuery, GetApplicationBackupsQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetApplicationBackupsQuery, GetApplicationBackupsQueryVariables>(GetApplicationBackupsDocument, options);
      }
export function useGetApplicationBackupsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetApplicationBackupsQuery, GetApplicationBackupsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetApplicationBackupsQuery, GetApplicationBackupsQueryVariables>(GetApplicationBackupsDocument, options);
        }
export type GetApplicationBackupsQueryHookResult = ReturnType<typeof useGetApplicationBackupsQuery>;
export type GetApplicationBackupsLazyQueryHookResult = ReturnType<typeof useGetApplicationBackupsLazyQuery>;
export type GetApplicationBackupsQueryResult = Apollo.QueryResult<GetApplicationBackupsQuery, GetApplicationBackupsQueryVariables>;
export function refetchGetApplicationBackupsQuery(variables: GetApplicationBackupsQueryVariables) {
      return { query: GetApplicationBackupsDocument, variables: variables }
    }
export const GetBackupPresignedUrlDocument = gql`
    query GetBackupPresignedUrl($appId: String!, $backupId: String!, $expireInMinutes: Int) {
  getBackupPresignedUrl: getBackupPresignedURL(
    appID: $appId
    backupID: $backupId
    expireInMinutes: $expireInMinutes
  ) {
    url
    expiresAt: expires_at
  }
}
    `;

/**
 * __useGetBackupPresignedUrlQuery__
 *
 * To run a query within a React component, call `useGetBackupPresignedUrlQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetBackupPresignedUrlQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetBackupPresignedUrlQuery({
 *   variables: {
 *      appId: // value for 'appId'
 *      backupId: // value for 'backupId'
 *      expireInMinutes: // value for 'expireInMinutes'
 *   },
 * });
 */
export function useGetBackupPresignedUrlQuery(baseOptions: Apollo.QueryHookOptions<GetBackupPresignedUrlQuery, GetBackupPresignedUrlQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetBackupPresignedUrlQuery, GetBackupPresignedUrlQueryVariables>(GetBackupPresignedUrlDocument, options);
      }
export function useGetBackupPresignedUrlLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetBackupPresignedUrlQuery, GetBackupPresignedUrlQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetBackupPresignedUrlQuery, GetBackupPresignedUrlQueryVariables>(GetBackupPresignedUrlDocument, options);
        }
export type GetBackupPresignedUrlQueryHookResult = ReturnType<typeof useGetBackupPresignedUrlQuery>;
export type GetBackupPresignedUrlLazyQueryHookResult = ReturnType<typeof useGetBackupPresignedUrlLazyQuery>;
export type GetBackupPresignedUrlQueryResult = Apollo.QueryResult<GetBackupPresignedUrlQuery, GetBackupPresignedUrlQueryVariables>;
export function refetchGetBackupPresignedUrlQuery(variables: GetBackupPresignedUrlQueryVariables) {
      return { query: GetBackupPresignedUrlDocument, variables: variables }
    }
export const GetCountriesDocument = gql`
    query getCountries {
  countries(order_by: {name: asc}) {
    code
    name
  }
}
    `;

/**
 * __useGetCountriesQuery__
 *
 * To run a query within a React component, call `useGetCountriesQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetCountriesQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetCountriesQuery({
 *   variables: {
 *   },
 * });
 */
export function useGetCountriesQuery(baseOptions?: Apollo.QueryHookOptions<GetCountriesQuery, GetCountriesQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetCountriesQuery, GetCountriesQueryVariables>(GetCountriesDocument, options);
      }
export function useGetCountriesLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetCountriesQuery, GetCountriesQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetCountriesQuery, GetCountriesQueryVariables>(GetCountriesDocument, options);
        }
export type GetCountriesQueryHookResult = ReturnType<typeof useGetCountriesQuery>;
export type GetCountriesLazyQueryHookResult = ReturnType<typeof useGetCountriesLazyQuery>;
export type GetCountriesQueryResult = Apollo.QueryResult<GetCountriesQuery, GetCountriesQueryVariables>;
export function refetchGetCountriesQuery(variables?: GetCountriesQueryVariables) {
      return { query: GetCountriesDocument, variables: variables }
    }
export const ScheduledOrPendingDeploymentsSubDocument = gql`
    subscription ScheduledOrPendingDeploymentsSub($appId: uuid!) {
  deployments(
    where: {deploymentStatus: {_in: ["SCHEDULED"]}, appId: {_eq: $appId}}
  ) {
    ...DeploymentRow
  }
}
    ${DeploymentRowFragmentDoc}`;

/**
 * __useScheduledOrPendingDeploymentsSubSubscription__
 *
 * To run a query within a React component, call `useScheduledOrPendingDeploymentsSubSubscription` and pass it any options that fit your needs.
 * When your component renders, `useScheduledOrPendingDeploymentsSubSubscription` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the subscription, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useScheduledOrPendingDeploymentsSubSubscription({
 *   variables: {
 *      appId: // value for 'appId'
 *   },
 * });
 */
export function useScheduledOrPendingDeploymentsSubSubscription(baseOptions: Apollo.SubscriptionHookOptions<ScheduledOrPendingDeploymentsSubSubscription, ScheduledOrPendingDeploymentsSubSubscriptionVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useSubscription<ScheduledOrPendingDeploymentsSubSubscription, ScheduledOrPendingDeploymentsSubSubscriptionVariables>(ScheduledOrPendingDeploymentsSubDocument, options);
      }
export type ScheduledOrPendingDeploymentsSubSubscriptionHookResult = ReturnType<typeof useScheduledOrPendingDeploymentsSubSubscription>;
export type ScheduledOrPendingDeploymentsSubSubscriptionResult = Apollo.SubscriptionResult<ScheduledOrPendingDeploymentsSubSubscription>;
export const LatestLiveDeploymentSubDocument = gql`
    subscription LatestLiveDeploymentSub($appId: uuid!) {
  deployments(
    where: {deploymentStatus: {_eq: "DEPLOYED"}, appId: {_eq: $appId}}
    order_by: {deploymentStartedAt: desc}
    limit: 1
    offset: 0
  ) {
    ...DeploymentRow
  }
}
    ${DeploymentRowFragmentDoc}`;

/**
 * __useLatestLiveDeploymentSubSubscription__
 *
 * To run a query within a React component, call `useLatestLiveDeploymentSubSubscription` and pass it any options that fit your needs.
 * When your component renders, `useLatestLiveDeploymentSubSubscription` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the subscription, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useLatestLiveDeploymentSubSubscription({
 *   variables: {
 *      appId: // value for 'appId'
 *   },
 * });
 */
export function useLatestLiveDeploymentSubSubscription(baseOptions: Apollo.SubscriptionHookOptions<LatestLiveDeploymentSubSubscription, LatestLiveDeploymentSubSubscriptionVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useSubscription<LatestLiveDeploymentSubSubscription, LatestLiveDeploymentSubSubscriptionVariables>(LatestLiveDeploymentSubDocument, options);
      }
export type LatestLiveDeploymentSubSubscriptionHookResult = ReturnType<typeof useLatestLiveDeploymentSubSubscription>;
export type LatestLiveDeploymentSubSubscriptionResult = Apollo.SubscriptionResult<LatestLiveDeploymentSubSubscription>;
export const InsertDeploymentDocument = gql`
    mutation InsertDeployment($object: deployments_insert_input!) {
  insertDeployment(object: $object) {
    ...DeploymentRow
  }
}
    ${DeploymentRowFragmentDoc}`;
export type InsertDeploymentMutationFn = Apollo.MutationFunction<InsertDeploymentMutation, InsertDeploymentMutationVariables>;

/**
 * __useInsertDeploymentMutation__
 *
 * To run a mutation, you first call `useInsertDeploymentMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useInsertDeploymentMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [insertDeploymentMutation, { data, loading, error }] = useInsertDeploymentMutation({
 *   variables: {
 *      object: // value for 'object'
 *   },
 * });
 */
export function useInsertDeploymentMutation(baseOptions?: Apollo.MutationHookOptions<InsertDeploymentMutation, InsertDeploymentMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<InsertDeploymentMutation, InsertDeploymentMutationVariables>(InsertDeploymentDocument, options);
      }
export type InsertDeploymentMutationHookResult = ReturnType<typeof useInsertDeploymentMutation>;
export type InsertDeploymentMutationResult = Apollo.MutationResult<InsertDeploymentMutation>;
export type InsertDeploymentMutationOptions = Apollo.BaseMutationOptions<InsertDeploymentMutation, InsertDeploymentMutationVariables>;
export const GetDeploymentsSubDocument = gql`
    subscription getDeploymentsSub($id: uuid!, $limit: Int!, $offset: Int!) {
  deployments(
    where: {appId: {_eq: $id}}
    order_by: {deploymentStartedAt: desc}
    limit: $limit
    offset: $offset
  ) {
    ...DeploymentRow
  }
}
    ${DeploymentRowFragmentDoc}`;

/**
 * __useGetDeploymentsSubSubscription__
 *
 * To run a query within a React component, call `useGetDeploymentsSubSubscription` and pass it any options that fit your needs.
 * When your component renders, `useGetDeploymentsSubSubscription` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the subscription, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetDeploymentsSubSubscription({
 *   variables: {
 *      id: // value for 'id'
 *      limit: // value for 'limit'
 *      offset: // value for 'offset'
 *   },
 * });
 */
export function useGetDeploymentsSubSubscription(baseOptions: Apollo.SubscriptionHookOptions<GetDeploymentsSubSubscription, GetDeploymentsSubSubscriptionVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useSubscription<GetDeploymentsSubSubscription, GetDeploymentsSubSubscriptionVariables>(GetDeploymentsSubDocument, options);
      }
export type GetDeploymentsSubSubscriptionHookResult = ReturnType<typeof useGetDeploymentsSubSubscription>;
export type GetDeploymentsSubSubscriptionResult = Apollo.SubscriptionResult<GetDeploymentsSubSubscription>;
export const DeploymentSubDocument = gql`
    subscription deploymentSub($id: uuid!) {
  deployment(id: $id) {
    id
    commitMessage
    commitSHA
    commitUserName
    commitUserAvatarUrl
    deploymentStartedAt
    deploymentEndedAt
    deploymentStatus
    metadataStartedAt
    metadataEndedAt
    metadataStatus
    migrationsStartedAt
    migrationsEndedAt
    migrationsStatus
    functionsStartedAt
    functionsEndedAt
    functionsStatus
    deploymentLogs(order_by: {createdAt: asc}) {
      id
      createdAt
      message
    }
  }
}
    `;

/**
 * __useDeploymentSubSubscription__
 *
 * To run a query within a React component, call `useDeploymentSubSubscription` and pass it any options that fit your needs.
 * When your component renders, `useDeploymentSubSubscription` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the subscription, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useDeploymentSubSubscription({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useDeploymentSubSubscription(baseOptions: Apollo.SubscriptionHookOptions<DeploymentSubSubscription, DeploymentSubSubscriptionVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useSubscription<DeploymentSubSubscription, DeploymentSubSubscriptionVariables>(DeploymentSubDocument, options);
      }
export type DeploymentSubSubscriptionHookResult = ReturnType<typeof useDeploymentSubSubscription>;
export type DeploymentSubSubscriptionResult = Apollo.SubscriptionResult<DeploymentSubSubscription>;
export const GetGithubRepositoriesDocument = gql`
    query getGithubRepositories {
  githubRepositories {
    ...GithubRepository
  }
  githubAppInstallations {
    id
    accountLogin
    accountType
    accountAvatarUrl
  }
}
    ${GithubRepositoryFragmentDoc}`;

/**
 * __useGetGithubRepositoriesQuery__
 *
 * To run a query within a React component, call `useGetGithubRepositoriesQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetGithubRepositoriesQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetGithubRepositoriesQuery({
 *   variables: {
 *   },
 * });
 */
export function useGetGithubRepositoriesQuery(baseOptions?: Apollo.QueryHookOptions<GetGithubRepositoriesQuery, GetGithubRepositoriesQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetGithubRepositoriesQuery, GetGithubRepositoriesQueryVariables>(GetGithubRepositoriesDocument, options);
      }
export function useGetGithubRepositoriesLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetGithubRepositoriesQuery, GetGithubRepositoriesQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetGithubRepositoriesQuery, GetGithubRepositoriesQueryVariables>(GetGithubRepositoriesDocument, options);
        }
export type GetGithubRepositoriesQueryHookResult = ReturnType<typeof useGetGithubRepositoriesQuery>;
export type GetGithubRepositoriesLazyQueryHookResult = ReturnType<typeof useGetGithubRepositoriesLazyQuery>;
export type GetGithubRepositoriesQueryResult = Apollo.QueryResult<GetGithubRepositoriesQuery, GetGithubRepositoriesQueryVariables>;
export function refetchGetGithubRepositoriesQuery(variables?: GetGithubRepositoriesQueryVariables) {
      return { query: GetGithubRepositoriesDocument, variables: variables }
    }
export const GetProjectLogsDocument = gql`
    query getProjectLogs($appID: String!, $service: String, $from: Timestamp, $to: Timestamp) {
  logs(appID: $appID, service: $service, from: $from, to: $to) {
    log
    service
    timestamp
  }
}
    `;

/**
 * __useGetProjectLogsQuery__
 *
 * To run a query within a React component, call `useGetProjectLogsQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetProjectLogsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetProjectLogsQuery({
 *   variables: {
 *      appID: // value for 'appID'
 *      service: // value for 'service'
 *      from: // value for 'from'
 *      to: // value for 'to'
 *   },
 * });
 */
export function useGetProjectLogsQuery(baseOptions: Apollo.QueryHookOptions<GetProjectLogsQuery, GetProjectLogsQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetProjectLogsQuery, GetProjectLogsQueryVariables>(GetProjectLogsDocument, options);
      }
export function useGetProjectLogsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetProjectLogsQuery, GetProjectLogsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetProjectLogsQuery, GetProjectLogsQueryVariables>(GetProjectLogsDocument, options);
        }
export type GetProjectLogsQueryHookResult = ReturnType<typeof useGetProjectLogsQuery>;
export type GetProjectLogsLazyQueryHookResult = ReturnType<typeof useGetProjectLogsLazyQuery>;
export type GetProjectLogsQueryResult = Apollo.QueryResult<GetProjectLogsQuery, GetProjectLogsQueryVariables>;
export function refetchGetProjectLogsQuery(variables: GetProjectLogsQueryVariables) {
      return { query: GetProjectLogsDocument, variables: variables }
    }
export const DeletePaymentMethodDocument = gql`
    mutation deletePaymentMethod($paymentMethodId: uuid!) {
  deletePaymentMethod(id: $paymentMethodId) {
    id
  }
}
    `;
export type DeletePaymentMethodMutationFn = Apollo.MutationFunction<DeletePaymentMethodMutation, DeletePaymentMethodMutationVariables>;

/**
 * __useDeletePaymentMethodMutation__
 *
 * To run a mutation, you first call `useDeletePaymentMethodMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useDeletePaymentMethodMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [deletePaymentMethodMutation, { data, loading, error }] = useDeletePaymentMethodMutation({
 *   variables: {
 *      paymentMethodId: // value for 'paymentMethodId'
 *   },
 * });
 */
export function useDeletePaymentMethodMutation(baseOptions?: Apollo.MutationHookOptions<DeletePaymentMethodMutation, DeletePaymentMethodMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<DeletePaymentMethodMutation, DeletePaymentMethodMutationVariables>(DeletePaymentMethodDocument, options);
      }
export type DeletePaymentMethodMutationHookResult = ReturnType<typeof useDeletePaymentMethodMutation>;
export type DeletePaymentMethodMutationResult = Apollo.MutationResult<DeletePaymentMethodMutation>;
export type DeletePaymentMethodMutationOptions = Apollo.BaseMutationOptions<DeletePaymentMethodMutation, DeletePaymentMethodMutationVariables>;
export const GetPaymentMethodsDocument = gql`
    query getPaymentMethods($workspaceId: uuid!) {
  paymentMethods(
    where: {workspaceId: {_eq: $workspaceId}}
    order_by: {createdAt: desc}
  ) {
    ...getPaymentMethods
  }
}
    ${GetPaymentMethodsFragmentDoc}`;

/**
 * __useGetPaymentMethodsQuery__
 *
 * To run a query within a React component, call `useGetPaymentMethodsQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetPaymentMethodsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetPaymentMethodsQuery({
 *   variables: {
 *      workspaceId: // value for 'workspaceId'
 *   },
 * });
 */
export function useGetPaymentMethodsQuery(baseOptions: Apollo.QueryHookOptions<GetPaymentMethodsQuery, GetPaymentMethodsQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetPaymentMethodsQuery, GetPaymentMethodsQueryVariables>(GetPaymentMethodsDocument, options);
      }
export function useGetPaymentMethodsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetPaymentMethodsQuery, GetPaymentMethodsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetPaymentMethodsQuery, GetPaymentMethodsQueryVariables>(GetPaymentMethodsDocument, options);
        }
export type GetPaymentMethodsQueryHookResult = ReturnType<typeof useGetPaymentMethodsQuery>;
export type GetPaymentMethodsLazyQueryHookResult = ReturnType<typeof useGetPaymentMethodsLazyQuery>;
export type GetPaymentMethodsQueryResult = Apollo.QueryResult<GetPaymentMethodsQuery, GetPaymentMethodsQueryVariables>;
export function refetchGetPaymentMethodsQuery(variables: GetPaymentMethodsQueryVariables) {
      return { query: GetPaymentMethodsDocument, variables: variables }
    }
export const InsertNewPaymentMethodDocument = gql`
    mutation insertNewPaymentMethod($workspaceId: uuid!, $paymentMethod: paymentMethods_insert_input!) {
  updatePaymentMethods(
    where: {workspaceId: {_eq: $workspaceId}}
    _set: {isDefault: false}
  ) {
    affected_rows
  }
  insertPaymentMethod(object: $paymentMethod) {
    id
  }
}
    `;
export type InsertNewPaymentMethodMutationFn = Apollo.MutationFunction<InsertNewPaymentMethodMutation, InsertNewPaymentMethodMutationVariables>;

/**
 * __useInsertNewPaymentMethodMutation__
 *
 * To run a mutation, you first call `useInsertNewPaymentMethodMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useInsertNewPaymentMethodMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [insertNewPaymentMethodMutation, { data, loading, error }] = useInsertNewPaymentMethodMutation({
 *   variables: {
 *      workspaceId: // value for 'workspaceId'
 *      paymentMethod: // value for 'paymentMethod'
 *   },
 * });
 */
export function useInsertNewPaymentMethodMutation(baseOptions?: Apollo.MutationHookOptions<InsertNewPaymentMethodMutation, InsertNewPaymentMethodMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<InsertNewPaymentMethodMutation, InsertNewPaymentMethodMutationVariables>(InsertNewPaymentMethodDocument, options);
      }
export type InsertNewPaymentMethodMutationHookResult = ReturnType<typeof useInsertNewPaymentMethodMutation>;
export type InsertNewPaymentMethodMutationResult = Apollo.MutationResult<InsertNewPaymentMethodMutation>;
export type InsertNewPaymentMethodMutationOptions = Apollo.BaseMutationOptions<InsertNewPaymentMethodMutation, InsertNewPaymentMethodMutationVariables>;
export const SetNewDefaultPaymentMethodDocument = gql`
    mutation setNewDefaultPaymentMethod($workspaceId: uuid!, $paymentMethodId: uuid!) {
  setAllPaymentMethodToDefaultFalse: updatePaymentMethods(
    where: {workspaceId: {_eq: $workspaceId}}
    _set: {isDefault: false}
  ) {
    affected_rows
  }
  updatePaymentMethods(
    where: {id: {_eq: $paymentMethodId}}
    _set: {isDefault: true}
  ) {
    affected_rows
  }
}
    `;
export type SetNewDefaultPaymentMethodMutationFn = Apollo.MutationFunction<SetNewDefaultPaymentMethodMutation, SetNewDefaultPaymentMethodMutationVariables>;

/**
 * __useSetNewDefaultPaymentMethodMutation__
 *
 * To run a mutation, you first call `useSetNewDefaultPaymentMethodMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useSetNewDefaultPaymentMethodMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [setNewDefaultPaymentMethodMutation, { data, loading, error }] = useSetNewDefaultPaymentMethodMutation({
 *   variables: {
 *      workspaceId: // value for 'workspaceId'
 *      paymentMethodId: // value for 'paymentMethodId'
 *   },
 * });
 */
export function useSetNewDefaultPaymentMethodMutation(baseOptions?: Apollo.MutationHookOptions<SetNewDefaultPaymentMethodMutation, SetNewDefaultPaymentMethodMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<SetNewDefaultPaymentMethodMutation, SetNewDefaultPaymentMethodMutationVariables>(SetNewDefaultPaymentMethodDocument, options);
      }
export type SetNewDefaultPaymentMethodMutationHookResult = ReturnType<typeof useSetNewDefaultPaymentMethodMutation>;
export type SetNewDefaultPaymentMethodMutationResult = Apollo.MutationResult<SetNewDefaultPaymentMethodMutation>;
export type SetNewDefaultPaymentMethodMutationOptions = Apollo.BaseMutationOptions<SetNewDefaultPaymentMethodMutation, SetNewDefaultPaymentMethodMutationVariables>;
export const GetPersonalAccessTokensDocument = gql`
    query GetPersonalAccessTokens {
  personalAccessTokens: authRefreshTokens(
    where: {type: {_eq: pat}}
    order_by: {expiresAt: asc}
  ) {
    id
    metadata
    createdAt
    expiresAt
  }
}
    `;

/**
 * __useGetPersonalAccessTokensQuery__
 *
 * To run a query within a React component, call `useGetPersonalAccessTokensQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetPersonalAccessTokensQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetPersonalAccessTokensQuery({
 *   variables: {
 *   },
 * });
 */
export function useGetPersonalAccessTokensQuery(baseOptions?: Apollo.QueryHookOptions<GetPersonalAccessTokensQuery, GetPersonalAccessTokensQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetPersonalAccessTokensQuery, GetPersonalAccessTokensQueryVariables>(GetPersonalAccessTokensDocument, options);
      }
export function useGetPersonalAccessTokensLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetPersonalAccessTokensQuery, GetPersonalAccessTokensQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetPersonalAccessTokensQuery, GetPersonalAccessTokensQueryVariables>(GetPersonalAccessTokensDocument, options);
        }
export type GetPersonalAccessTokensQueryHookResult = ReturnType<typeof useGetPersonalAccessTokensQuery>;
export type GetPersonalAccessTokensLazyQueryHookResult = ReturnType<typeof useGetPersonalAccessTokensLazyQuery>;
export type GetPersonalAccessTokensQueryResult = Apollo.QueryResult<GetPersonalAccessTokensQuery, GetPersonalAccessTokensQueryVariables>;
export function refetchGetPersonalAccessTokensQuery(variables?: GetPersonalAccessTokensQueryVariables) {
      return { query: GetPersonalAccessTokensDocument, variables: variables }
    }
export const DeletePersonalAccessTokenDocument = gql`
    mutation DeletePersonalAccessToken($patId: uuid!) {
  deletePersonalAccessToken: deleteAuthRefreshToken(id: $patId) {
    id
    metadata
  }
}
    `;
export type DeletePersonalAccessTokenMutationFn = Apollo.MutationFunction<DeletePersonalAccessTokenMutation, DeletePersonalAccessTokenMutationVariables>;

/**
 * __useDeletePersonalAccessTokenMutation__
 *
 * To run a mutation, you first call `useDeletePersonalAccessTokenMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useDeletePersonalAccessTokenMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [deletePersonalAccessTokenMutation, { data, loading, error }] = useDeletePersonalAccessTokenMutation({
 *   variables: {
 *      patId: // value for 'patId'
 *   },
 * });
 */
export function useDeletePersonalAccessTokenMutation(baseOptions?: Apollo.MutationHookOptions<DeletePersonalAccessTokenMutation, DeletePersonalAccessTokenMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<DeletePersonalAccessTokenMutation, DeletePersonalAccessTokenMutationVariables>(DeletePersonalAccessTokenDocument, options);
      }
export type DeletePersonalAccessTokenMutationHookResult = ReturnType<typeof useDeletePersonalAccessTokenMutation>;
export type DeletePersonalAccessTokenMutationResult = Apollo.MutationResult<DeletePersonalAccessTokenMutation>;
export type DeletePersonalAccessTokenMutationOptions = Apollo.BaseMutationOptions<DeletePersonalAccessTokenMutation, DeletePersonalAccessTokenMutationVariables>;
export const GetPlansDocument = gql`
    query GetPlans($where: plans_bool_exp) {
  plans(where: $where) {
    id
    name
    isFree
    price
  }
}
    `;

/**
 * __useGetPlansQuery__
 *
 * To run a query within a React component, call `useGetPlansQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetPlansQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetPlansQuery({
 *   variables: {
 *      where: // value for 'where'
 *   },
 * });
 */
export function useGetPlansQuery(baseOptions?: Apollo.QueryHookOptions<GetPlansQuery, GetPlansQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetPlansQuery, GetPlansQueryVariables>(GetPlansDocument, options);
      }
export function useGetPlansLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetPlansQuery, GetPlansQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetPlansQuery, GetPlansQueryVariables>(GetPlansDocument, options);
        }
export type GetPlansQueryHookResult = ReturnType<typeof useGetPlansQuery>;
export type GetPlansLazyQueryHookResult = ReturnType<typeof useGetPlansLazyQuery>;
export type GetPlansQueryResult = Apollo.QueryResult<GetPlansQuery, GetPlansQueryVariables>;
export function refetchGetPlansQuery(variables?: GetPlansQueryVariables) {
      return { query: GetPlansDocument, variables: variables }
    }
export const RestoreApplicationDatabaseDocument = gql`
    mutation RestoreApplicationDatabase($appId: String!, $backupId: String!) {
  restoreApplicationDatabase(appID: $appId, backupID: $backupId)
}
    `;
export type RestoreApplicationDatabaseMutationFn = Apollo.MutationFunction<RestoreApplicationDatabaseMutation, RestoreApplicationDatabaseMutationVariables>;

/**
 * __useRestoreApplicationDatabaseMutation__
 *
 * To run a mutation, you first call `useRestoreApplicationDatabaseMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useRestoreApplicationDatabaseMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [restoreApplicationDatabaseMutation, { data, loading, error }] = useRestoreApplicationDatabaseMutation({
 *   variables: {
 *      appId: // value for 'appId'
 *      backupId: // value for 'backupId'
 *   },
 * });
 */
export function useRestoreApplicationDatabaseMutation(baseOptions?: Apollo.MutationHookOptions<RestoreApplicationDatabaseMutation, RestoreApplicationDatabaseMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<RestoreApplicationDatabaseMutation, RestoreApplicationDatabaseMutationVariables>(RestoreApplicationDatabaseDocument, options);
      }
export type RestoreApplicationDatabaseMutationHookResult = ReturnType<typeof useRestoreApplicationDatabaseMutation>;
export type RestoreApplicationDatabaseMutationResult = Apollo.MutationResult<RestoreApplicationDatabaseMutation>;
export type RestoreApplicationDatabaseMutationOptions = Apollo.BaseMutationOptions<RestoreApplicationDatabaseMutation, RestoreApplicationDatabaseMutationVariables>;
export const GetAppFunctionsMetadataDocument = gql`
    query getAppFunctionsMetadata($id: uuid!) {
  app(id: $id) {
    id
    metadataFunctions
  }
}
    `;

/**
 * __useGetAppFunctionsMetadataQuery__
 *
 * To run a query within a React component, call `useGetAppFunctionsMetadataQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetAppFunctionsMetadataQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetAppFunctionsMetadataQuery({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useGetAppFunctionsMetadataQuery(baseOptions: Apollo.QueryHookOptions<GetAppFunctionsMetadataQuery, GetAppFunctionsMetadataQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetAppFunctionsMetadataQuery, GetAppFunctionsMetadataQueryVariables>(GetAppFunctionsMetadataDocument, options);
      }
export function useGetAppFunctionsMetadataLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetAppFunctionsMetadataQuery, GetAppFunctionsMetadataQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetAppFunctionsMetadataQuery, GetAppFunctionsMetadataQueryVariables>(GetAppFunctionsMetadataDocument, options);
        }
export type GetAppFunctionsMetadataQueryHookResult = ReturnType<typeof useGetAppFunctionsMetadataQuery>;
export type GetAppFunctionsMetadataLazyQueryHookResult = ReturnType<typeof useGetAppFunctionsMetadataLazyQuery>;
export type GetAppFunctionsMetadataQueryResult = Apollo.QueryResult<GetAppFunctionsMetadataQuery, GetAppFunctionsMetadataQueryVariables>;
export function refetchGetAppFunctionsMetadataQuery(variables: GetAppFunctionsMetadataQueryVariables) {
      return { query: GetAppFunctionsMetadataDocument, variables: variables }
    }
export const DeleteSecretDocument = gql`
    mutation DeleteSecret($appId: uuid!, $name: String!) {
  deleteSecret(appID: $appId, key: $name) {
    name
  }
}
    `;
export type DeleteSecretMutationFn = Apollo.MutationFunction<DeleteSecretMutation, DeleteSecretMutationVariables>;

/**
 * __useDeleteSecretMutation__
 *
 * To run a mutation, you first call `useDeleteSecretMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useDeleteSecretMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [deleteSecretMutation, { data, loading, error }] = useDeleteSecretMutation({
 *   variables: {
 *      appId: // value for 'appId'
 *      name: // value for 'name'
 *   },
 * });
 */
export function useDeleteSecretMutation(baseOptions?: Apollo.MutationHookOptions<DeleteSecretMutation, DeleteSecretMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<DeleteSecretMutation, DeleteSecretMutationVariables>(DeleteSecretDocument, options);
      }
export type DeleteSecretMutationHookResult = ReturnType<typeof useDeleteSecretMutation>;
export type DeleteSecretMutationResult = Apollo.MutationResult<DeleteSecretMutation>;
export type DeleteSecretMutationOptions = Apollo.BaseMutationOptions<DeleteSecretMutation, DeleteSecretMutationVariables>;
export const GetSecretsDocument = gql`
    query GetSecrets($appId: uuid!) {
  appSecrets(appID: $appId) {
    ...Secret
  }
}
    ${SecretFragmentDoc}`;

/**
 * __useGetSecretsQuery__
 *
 * To run a query within a React component, call `useGetSecretsQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetSecretsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetSecretsQuery({
 *   variables: {
 *      appId: // value for 'appId'
 *   },
 * });
 */
export function useGetSecretsQuery(baseOptions: Apollo.QueryHookOptions<GetSecretsQuery, GetSecretsQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetSecretsQuery, GetSecretsQueryVariables>(GetSecretsDocument, options);
      }
export function useGetSecretsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetSecretsQuery, GetSecretsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetSecretsQuery, GetSecretsQueryVariables>(GetSecretsDocument, options);
        }
export type GetSecretsQueryHookResult = ReturnType<typeof useGetSecretsQuery>;
export type GetSecretsLazyQueryHookResult = ReturnType<typeof useGetSecretsLazyQuery>;
export type GetSecretsQueryResult = Apollo.QueryResult<GetSecretsQuery, GetSecretsQueryVariables>;
export function refetchGetSecretsQuery(variables: GetSecretsQueryVariables) {
      return { query: GetSecretsDocument, variables: variables }
    }
export const InsertSecretDocument = gql`
    mutation InsertSecret($appId: uuid!, $secret: ConfigEnvironmentVariableInsertInput!) {
  insertSecret(appID: $appId, secret: $secret) {
    name
  }
}
    `;
export type InsertSecretMutationFn = Apollo.MutationFunction<InsertSecretMutation, InsertSecretMutationVariables>;

/**
 * __useInsertSecretMutation__
 *
 * To run a mutation, you first call `useInsertSecretMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useInsertSecretMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [insertSecretMutation, { data, loading, error }] = useInsertSecretMutation({
 *   variables: {
 *      appId: // value for 'appId'
 *      secret: // value for 'secret'
 *   },
 * });
 */
export function useInsertSecretMutation(baseOptions?: Apollo.MutationHookOptions<InsertSecretMutation, InsertSecretMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<InsertSecretMutation, InsertSecretMutationVariables>(InsertSecretDocument, options);
      }
export type InsertSecretMutationHookResult = ReturnType<typeof useInsertSecretMutation>;
export type InsertSecretMutationResult = Apollo.MutationResult<InsertSecretMutation>;
export type InsertSecretMutationOptions = Apollo.BaseMutationOptions<InsertSecretMutation, InsertSecretMutationVariables>;
export const UpdateSecretDocument = gql`
    mutation UpdateSecret($appId: uuid!, $secret: ConfigEnvironmentVariableInsertInput!) {
  updateSecret(appID: $appId, secret: $secret) {
    name
  }
}
    `;
export type UpdateSecretMutationFn = Apollo.MutationFunction<UpdateSecretMutation, UpdateSecretMutationVariables>;

/**
 * __useUpdateSecretMutation__
 *
 * To run a mutation, you first call `useUpdateSecretMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useUpdateSecretMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [updateSecretMutation, { data, loading, error }] = useUpdateSecretMutation({
 *   variables: {
 *      appId: // value for 'appId'
 *      secret: // value for 'secret'
 *   },
 * });
 */
export function useUpdateSecretMutation(baseOptions?: Apollo.MutationHookOptions<UpdateSecretMutation, UpdateSecretMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<UpdateSecretMutation, UpdateSecretMutationVariables>(UpdateSecretDocument, options);
      }
export type UpdateSecretMutationHookResult = ReturnType<typeof useUpdateSecretMutation>;
export type UpdateSecretMutationResult = Apollo.MutationResult<UpdateSecretMutation>;
export type UpdateSecretMutationOptions = Apollo.BaseMutationOptions<UpdateSecretMutation, UpdateSecretMutationVariables>;
export const DeleteRunServiceDocument = gql`
    mutation deleteRunService($serviceID: uuid!) {
  deleteRunService(id: $serviceID) {
    id
  }
}
    `;
export type DeleteRunServiceMutationFn = Apollo.MutationFunction<DeleteRunServiceMutation, DeleteRunServiceMutationVariables>;

/**
 * __useDeleteRunServiceMutation__
 *
 * To run a mutation, you first call `useDeleteRunServiceMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useDeleteRunServiceMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [deleteRunServiceMutation, { data, loading, error }] = useDeleteRunServiceMutation({
 *   variables: {
 *      serviceID: // value for 'serviceID'
 *   },
 * });
 */
export function useDeleteRunServiceMutation(baseOptions?: Apollo.MutationHookOptions<DeleteRunServiceMutation, DeleteRunServiceMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<DeleteRunServiceMutation, DeleteRunServiceMutationVariables>(DeleteRunServiceDocument, options);
      }
export type DeleteRunServiceMutationHookResult = ReturnType<typeof useDeleteRunServiceMutation>;
export type DeleteRunServiceMutationResult = Apollo.MutationResult<DeleteRunServiceMutation>;
export type DeleteRunServiceMutationOptions = Apollo.BaseMutationOptions<DeleteRunServiceMutation, DeleteRunServiceMutationVariables>;
export const DeleteRunServiceConfigDocument = gql`
    mutation deleteRunServiceConfig($appID: uuid!, $serviceID: uuid!) {
  deleteRunServiceConfig(appID: $appID, serviceID: $serviceID) {
    name
  }
}
    `;
export type DeleteRunServiceConfigMutationFn = Apollo.MutationFunction<DeleteRunServiceConfigMutation, DeleteRunServiceConfigMutationVariables>;

/**
 * __useDeleteRunServiceConfigMutation__
 *
 * To run a mutation, you first call `useDeleteRunServiceConfigMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useDeleteRunServiceConfigMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [deleteRunServiceConfigMutation, { data, loading, error }] = useDeleteRunServiceConfigMutation({
 *   variables: {
 *      appID: // value for 'appID'
 *      serviceID: // value for 'serviceID'
 *   },
 * });
 */
export function useDeleteRunServiceConfigMutation(baseOptions?: Apollo.MutationHookOptions<DeleteRunServiceConfigMutation, DeleteRunServiceConfigMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<DeleteRunServiceConfigMutation, DeleteRunServiceConfigMutationVariables>(DeleteRunServiceConfigDocument, options);
      }
export type DeleteRunServiceConfigMutationHookResult = ReturnType<typeof useDeleteRunServiceConfigMutation>;
export type DeleteRunServiceConfigMutationResult = Apollo.MutationResult<DeleteRunServiceConfigMutation>;
export type DeleteRunServiceConfigMutationOptions = Apollo.BaseMutationOptions<DeleteRunServiceConfigMutation, DeleteRunServiceConfigMutationVariables>;
export const GetRunServiceDocument = gql`
    query getRunService($id: uuid!, $resolve: Boolean!) {
  runService(id: $id) {
    id
    config(resolve: $resolve) {
      name
      image {
        image
      }
      command
      resources {
        compute {
          cpu
          memory
        }
        storage {
          name
          path
          capacity
        }
        replicas
      }
      environment {
        name
        value
      }
      ports {
        port
        type
        publish
      }
    }
  }
}
    `;

/**
 * __useGetRunServiceQuery__
 *
 * To run a query within a React component, call `useGetRunServiceQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetRunServiceQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetRunServiceQuery({
 *   variables: {
 *      id: // value for 'id'
 *      resolve: // value for 'resolve'
 *   },
 * });
 */
export function useGetRunServiceQuery(baseOptions: Apollo.QueryHookOptions<GetRunServiceQuery, GetRunServiceQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetRunServiceQuery, GetRunServiceQueryVariables>(GetRunServiceDocument, options);
      }
export function useGetRunServiceLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetRunServiceQuery, GetRunServiceQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetRunServiceQuery, GetRunServiceQueryVariables>(GetRunServiceDocument, options);
        }
export type GetRunServiceQueryHookResult = ReturnType<typeof useGetRunServiceQuery>;
export type GetRunServiceLazyQueryHookResult = ReturnType<typeof useGetRunServiceLazyQuery>;
export type GetRunServiceQueryResult = Apollo.QueryResult<GetRunServiceQuery, GetRunServiceQueryVariables>;
export function refetchGetRunServiceQuery(variables: GetRunServiceQueryVariables) {
      return { query: GetRunServiceDocument, variables: variables }
    }
export const GetRunServicesDocument = gql`
    query getRunServices($appID: uuid!, $resolve: Boolean!, $limit: Int!, $offset: Int!) {
  app(id: $appID) {
    runServices(limit: $limit, offset: $offset) {
      id
      createdAt
      updatedAt
      config(resolve: $resolve) {
        name
        image {
          image
        }
        command
        resources {
          compute {
            cpu
            memory
          }
          storage {
            name
            path
            capacity
          }
          replicas
        }
        environment {
          name
          value
        }
        ports {
          port
          type
          publish
        }
      }
    }
    runServices_aggregate {
      aggregate {
        count
      }
    }
  }
}
    `;

/**
 * __useGetRunServicesQuery__
 *
 * To run a query within a React component, call `useGetRunServicesQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetRunServicesQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetRunServicesQuery({
 *   variables: {
 *      appID: // value for 'appID'
 *      resolve: // value for 'resolve'
 *      limit: // value for 'limit'
 *      offset: // value for 'offset'
 *   },
 * });
 */
export function useGetRunServicesQuery(baseOptions: Apollo.QueryHookOptions<GetRunServicesQuery, GetRunServicesQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetRunServicesQuery, GetRunServicesQueryVariables>(GetRunServicesDocument, options);
      }
export function useGetRunServicesLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetRunServicesQuery, GetRunServicesQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetRunServicesQuery, GetRunServicesQueryVariables>(GetRunServicesDocument, options);
        }
export type GetRunServicesQueryHookResult = ReturnType<typeof useGetRunServicesQuery>;
export type GetRunServicesLazyQueryHookResult = ReturnType<typeof useGetRunServicesLazyQuery>;
export type GetRunServicesQueryResult = Apollo.QueryResult<GetRunServicesQuery, GetRunServicesQueryVariables>;
export function refetchGetRunServicesQuery(variables: GetRunServicesQueryVariables) {
      return { query: GetRunServicesDocument, variables: variables }
    }
export const InsertRunServiceDocument = gql`
    mutation insertRunService($object: run_service_insert_input!) {
  insertRunService(object: $object) {
    id
    appID
  }
}
    `;
export type InsertRunServiceMutationFn = Apollo.MutationFunction<InsertRunServiceMutation, InsertRunServiceMutationVariables>;

/**
 * __useInsertRunServiceMutation__
 *
 * To run a mutation, you first call `useInsertRunServiceMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useInsertRunServiceMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [insertRunServiceMutation, { data, loading, error }] = useInsertRunServiceMutation({
 *   variables: {
 *      object: // value for 'object'
 *   },
 * });
 */
export function useInsertRunServiceMutation(baseOptions?: Apollo.MutationHookOptions<InsertRunServiceMutation, InsertRunServiceMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<InsertRunServiceMutation, InsertRunServiceMutationVariables>(InsertRunServiceDocument, options);
      }
export type InsertRunServiceMutationHookResult = ReturnType<typeof useInsertRunServiceMutation>;
export type InsertRunServiceMutationResult = Apollo.MutationResult<InsertRunServiceMutation>;
export type InsertRunServiceMutationOptions = Apollo.BaseMutationOptions<InsertRunServiceMutation, InsertRunServiceMutationVariables>;
export const InsertRunServiceConfigDocument = gql`
    mutation insertRunServiceConfig($appID: uuid!, $serviceID: uuid!, $config: ConfigRunServiceConfigInsertInput!) {
  insertRunServiceConfig(appID: $appID, serviceID: $serviceID, config: $config) {
    name
  }
}
    `;
export type InsertRunServiceConfigMutationFn = Apollo.MutationFunction<InsertRunServiceConfigMutation, InsertRunServiceConfigMutationVariables>;

/**
 * __useInsertRunServiceConfigMutation__
 *
 * To run a mutation, you first call `useInsertRunServiceConfigMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useInsertRunServiceConfigMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [insertRunServiceConfigMutation, { data, loading, error }] = useInsertRunServiceConfigMutation({
 *   variables: {
 *      appID: // value for 'appID'
 *      serviceID: // value for 'serviceID'
 *      config: // value for 'config'
 *   },
 * });
 */
export function useInsertRunServiceConfigMutation(baseOptions?: Apollo.MutationHookOptions<InsertRunServiceConfigMutation, InsertRunServiceConfigMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<InsertRunServiceConfigMutation, InsertRunServiceConfigMutationVariables>(InsertRunServiceConfigDocument, options);
      }
export type InsertRunServiceConfigMutationHookResult = ReturnType<typeof useInsertRunServiceConfigMutation>;
export type InsertRunServiceConfigMutationResult = Apollo.MutationResult<InsertRunServiceConfigMutation>;
export type InsertRunServiceConfigMutationOptions = Apollo.BaseMutationOptions<InsertRunServiceConfigMutation, InsertRunServiceConfigMutationVariables>;
export const ReplaceRunServiceConfigDocument = gql`
    mutation replaceRunServiceConfig($appID: uuid!, $serviceID: uuid!, $config: ConfigRunServiceConfigInsertInput!) {
  replaceRunServiceConfig(appID: $appID, serviceID: $serviceID, config: $config) {
    __typename
  }
}
    `;
export type ReplaceRunServiceConfigMutationFn = Apollo.MutationFunction<ReplaceRunServiceConfigMutation, ReplaceRunServiceConfigMutationVariables>;

/**
 * __useReplaceRunServiceConfigMutation__
 *
 * To run a mutation, you first call `useReplaceRunServiceConfigMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useReplaceRunServiceConfigMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [replaceRunServiceConfigMutation, { data, loading, error }] = useReplaceRunServiceConfigMutation({
 *   variables: {
 *      appID: // value for 'appID'
 *      serviceID: // value for 'serviceID'
 *      config: // value for 'config'
 *   },
 * });
 */
export function useReplaceRunServiceConfigMutation(baseOptions?: Apollo.MutationHookOptions<ReplaceRunServiceConfigMutation, ReplaceRunServiceConfigMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<ReplaceRunServiceConfigMutation, ReplaceRunServiceConfigMutationVariables>(ReplaceRunServiceConfigDocument, options);
      }
export type ReplaceRunServiceConfigMutationHookResult = ReturnType<typeof useReplaceRunServiceConfigMutation>;
export type ReplaceRunServiceConfigMutationResult = Apollo.MutationResult<ReplaceRunServiceConfigMutation>;
export type ReplaceRunServiceConfigMutationOptions = Apollo.BaseMutationOptions<ReplaceRunServiceConfigMutation, ReplaceRunServiceConfigMutationVariables>;
export const UpdateRunServiceConfigDocument = gql`
    mutation updateRunServiceConfig($appID: uuid!, $serviceID: uuid!, $config: ConfigRunServiceConfigUpdateInput!) {
  updateRunServiceConfig(appID: $appID, serviceID: $serviceID, config: $config) {
    name
  }
}
    `;
export type UpdateRunServiceConfigMutationFn = Apollo.MutationFunction<UpdateRunServiceConfigMutation, UpdateRunServiceConfigMutationVariables>;

/**
 * __useUpdateRunServiceConfigMutation__
 *
 * To run a mutation, you first call `useUpdateRunServiceConfigMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useUpdateRunServiceConfigMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [updateRunServiceConfigMutation, { data, loading, error }] = useUpdateRunServiceConfigMutation({
 *   variables: {
 *      appID: // value for 'appID'
 *      serviceID: // value for 'serviceID'
 *      config: // value for 'config'
 *   },
 * });
 */
export function useUpdateRunServiceConfigMutation(baseOptions?: Apollo.MutationHookOptions<UpdateRunServiceConfigMutation, UpdateRunServiceConfigMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<UpdateRunServiceConfigMutation, UpdateRunServiceConfigMutationVariables>(UpdateRunServiceConfigDocument, options);
      }
export type UpdateRunServiceConfigMutationHookResult = ReturnType<typeof useUpdateRunServiceConfigMutation>;
export type UpdateRunServiceConfigMutationResult = Apollo.MutationResult<UpdateRunServiceConfigMutation>;
export type UpdateRunServiceConfigMutationOptions = Apollo.BaseMutationOptions<UpdateRunServiceConfigMutation, UpdateRunServiceConfigMutationVariables>;
export const GetAuthenticationSettingsDocument = gql`
    query GetAuthenticationSettings($appId: uuid!) {
  config(appID: $appId, resolve: true) {
    id: __typename
    __typename
    auth {
      id: __typename
      __typename
      redirections {
        clientUrl
        allowedUrls
      }
      totp {
        enabled
        issuer
      }
      signUp {
        enabled
      }
      session {
        accessToken {
          expiresIn
        }
        refreshToken {
          expiresIn
        }
      }
      user {
        email {
          allowed
          blocked
        }
        emailDomains {
          allowed
          blocked
        }
        gravatar {
          enabled
          default
          rating
        }
      }
      version
    }
  }
}
    `;

/**
 * __useGetAuthenticationSettingsQuery__
 *
 * To run a query within a React component, call `useGetAuthenticationSettingsQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetAuthenticationSettingsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetAuthenticationSettingsQuery({
 *   variables: {
 *      appId: // value for 'appId'
 *   },
 * });
 */
export function useGetAuthenticationSettingsQuery(baseOptions: Apollo.QueryHookOptions<GetAuthenticationSettingsQuery, GetAuthenticationSettingsQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetAuthenticationSettingsQuery, GetAuthenticationSettingsQueryVariables>(GetAuthenticationSettingsDocument, options);
      }
export function useGetAuthenticationSettingsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetAuthenticationSettingsQuery, GetAuthenticationSettingsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetAuthenticationSettingsQuery, GetAuthenticationSettingsQueryVariables>(GetAuthenticationSettingsDocument, options);
        }
export type GetAuthenticationSettingsQueryHookResult = ReturnType<typeof useGetAuthenticationSettingsQuery>;
export type GetAuthenticationSettingsLazyQueryHookResult = ReturnType<typeof useGetAuthenticationSettingsLazyQuery>;
export type GetAuthenticationSettingsQueryResult = Apollo.QueryResult<GetAuthenticationSettingsQuery, GetAuthenticationSettingsQueryVariables>;
export function refetchGetAuthenticationSettingsQuery(variables: GetAuthenticationSettingsQueryVariables) {
      return { query: GetAuthenticationSettingsDocument, variables: variables }
    }
export const GetEnvironmentVariablesDocument = gql`
    query GetEnvironmentVariables($appId: uuid!) {
  config(appID: $appId, resolve: true) {
    id: __typename
    __typename
    global {
      environment {
        ...EnvironmentVariable
      }
    }
    hasura {
      adminSecret
      webhookSecret
      jwtSecrets {
        ...JWTSecret
      }
    }
  }
}
    ${EnvironmentVariableFragmentDoc}
${JwtSecretFragmentDoc}`;

/**
 * __useGetEnvironmentVariablesQuery__
 *
 * To run a query within a React component, call `useGetEnvironmentVariablesQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetEnvironmentVariablesQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetEnvironmentVariablesQuery({
 *   variables: {
 *      appId: // value for 'appId'
 *   },
 * });
 */
export function useGetEnvironmentVariablesQuery(baseOptions: Apollo.QueryHookOptions<GetEnvironmentVariablesQuery, GetEnvironmentVariablesQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetEnvironmentVariablesQuery, GetEnvironmentVariablesQueryVariables>(GetEnvironmentVariablesDocument, options);
      }
export function useGetEnvironmentVariablesLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetEnvironmentVariablesQuery, GetEnvironmentVariablesQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetEnvironmentVariablesQuery, GetEnvironmentVariablesQueryVariables>(GetEnvironmentVariablesDocument, options);
        }
export type GetEnvironmentVariablesQueryHookResult = ReturnType<typeof useGetEnvironmentVariablesQuery>;
export type GetEnvironmentVariablesLazyQueryHookResult = ReturnType<typeof useGetEnvironmentVariablesLazyQuery>;
export type GetEnvironmentVariablesQueryResult = Apollo.QueryResult<GetEnvironmentVariablesQuery, GetEnvironmentVariablesQueryVariables>;
export function refetchGetEnvironmentVariablesQuery(variables: GetEnvironmentVariablesQueryVariables) {
      return { query: GetEnvironmentVariablesDocument, variables: variables }
    }
export const GetPostgresSettingsDocument = gql`
    query GetPostgresSettings($appId: uuid!) {
  systemConfig(appID: $appId) {
    postgres {
      database
    }
  }
  config(appID: $appId, resolve: true) {
    id: __typename
    __typename
    postgres {
      version
    }
  }
}
    `;

/**
 * __useGetPostgresSettingsQuery__
 *
 * To run a query within a React component, call `useGetPostgresSettingsQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetPostgresSettingsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetPostgresSettingsQuery({
 *   variables: {
 *      appId: // value for 'appId'
 *   },
 * });
 */
export function useGetPostgresSettingsQuery(baseOptions: Apollo.QueryHookOptions<GetPostgresSettingsQuery, GetPostgresSettingsQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetPostgresSettingsQuery, GetPostgresSettingsQueryVariables>(GetPostgresSettingsDocument, options);
      }
export function useGetPostgresSettingsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetPostgresSettingsQuery, GetPostgresSettingsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetPostgresSettingsQuery, GetPostgresSettingsQueryVariables>(GetPostgresSettingsDocument, options);
        }
export type GetPostgresSettingsQueryHookResult = ReturnType<typeof useGetPostgresSettingsQuery>;
export type GetPostgresSettingsLazyQueryHookResult = ReturnType<typeof useGetPostgresSettingsLazyQuery>;
export type GetPostgresSettingsQueryResult = Apollo.QueryResult<GetPostgresSettingsQuery, GetPostgresSettingsQueryVariables>;
export function refetchGetPostgresSettingsQuery(variables: GetPostgresSettingsQueryVariables) {
      return { query: GetPostgresSettingsDocument, variables: variables }
    }
export const GetResourcesDocument = gql`
    query GetResources($appId: uuid!) {
  config(appID: $appId, resolve: true) {
    ...ServiceResources
  }
}
    ${ServiceResourcesFragmentDoc}`;

/**
 * __useGetResourcesQuery__
 *
 * To run a query within a React component, call `useGetResourcesQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetResourcesQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetResourcesQuery({
 *   variables: {
 *      appId: // value for 'appId'
 *   },
 * });
 */
export function useGetResourcesQuery(baseOptions: Apollo.QueryHookOptions<GetResourcesQuery, GetResourcesQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetResourcesQuery, GetResourcesQueryVariables>(GetResourcesDocument, options);
      }
export function useGetResourcesLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetResourcesQuery, GetResourcesQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetResourcesQuery, GetResourcesQueryVariables>(GetResourcesDocument, options);
        }
export type GetResourcesQueryHookResult = ReturnType<typeof useGetResourcesQuery>;
export type GetResourcesLazyQueryHookResult = ReturnType<typeof useGetResourcesLazyQuery>;
export type GetResourcesQueryResult = Apollo.QueryResult<GetResourcesQuery, GetResourcesQueryVariables>;
export function refetchGetResourcesQuery(variables: GetResourcesQueryVariables) {
      return { query: GetResourcesDocument, variables: variables }
    }
export const GetStorageSettingsDocument = gql`
    query GetStorageSettings($appId: uuid!) {
  config(appID: $appId, resolve: true) {
    id: __typename
    __typename
    storage {
      version
    }
  }
}
    `;

/**
 * __useGetStorageSettingsQuery__
 *
 * To run a query within a React component, call `useGetStorageSettingsQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetStorageSettingsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetStorageSettingsQuery({
 *   variables: {
 *      appId: // value for 'appId'
 *   },
 * });
 */
export function useGetStorageSettingsQuery(baseOptions: Apollo.QueryHookOptions<GetStorageSettingsQuery, GetStorageSettingsQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetStorageSettingsQuery, GetStorageSettingsQueryVariables>(GetStorageSettingsDocument, options);
      }
export function useGetStorageSettingsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetStorageSettingsQuery, GetStorageSettingsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetStorageSettingsQuery, GetStorageSettingsQueryVariables>(GetStorageSettingsDocument, options);
        }
export type GetStorageSettingsQueryHookResult = ReturnType<typeof useGetStorageSettingsQuery>;
export type GetStorageSettingsLazyQueryHookResult = ReturnType<typeof useGetStorageSettingsLazyQuery>;
export type GetStorageSettingsQueryResult = Apollo.QueryResult<GetStorageSettingsQuery, GetStorageSettingsQueryVariables>;
export function refetchGetStorageSettingsQuery(variables: GetStorageSettingsQueryVariables) {
      return { query: GetStorageSettingsDocument, variables: variables }
    }
export const GetHasuraSettingsDocument = gql`
    query GetHasuraSettings($appId: uuid!) {
  config(appID: $appId, resolve: true) {
    id: __typename
    __typename
    hasura {
      version
      settings {
        enableAllowList
        enableRemoteSchemaPermissions
        enableConsole
        devMode
        corsDomain
        enabledAPIs
      }
      logs {
        level
      }
      events {
        httpPoolSize
      }
    }
  }
}
    `;

/**
 * __useGetHasuraSettingsQuery__
 *
 * To run a query within a React component, call `useGetHasuraSettingsQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetHasuraSettingsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetHasuraSettingsQuery({
 *   variables: {
 *      appId: // value for 'appId'
 *   },
 * });
 */
export function useGetHasuraSettingsQuery(baseOptions: Apollo.QueryHookOptions<GetHasuraSettingsQuery, GetHasuraSettingsQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetHasuraSettingsQuery, GetHasuraSettingsQueryVariables>(GetHasuraSettingsDocument, options);
      }
export function useGetHasuraSettingsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetHasuraSettingsQuery, GetHasuraSettingsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetHasuraSettingsQuery, GetHasuraSettingsQueryVariables>(GetHasuraSettingsDocument, options);
        }
export type GetHasuraSettingsQueryHookResult = ReturnType<typeof useGetHasuraSettingsQuery>;
export type GetHasuraSettingsLazyQueryHookResult = ReturnType<typeof useGetHasuraSettingsLazyQuery>;
export type GetHasuraSettingsQueryResult = Apollo.QueryResult<GetHasuraSettingsQuery, GetHasuraSettingsQueryVariables>;
export function refetchGetHasuraSettingsQuery(variables: GetHasuraSettingsQueryVariables) {
      return { query: GetHasuraSettingsDocument, variables: variables }
    }
export const ResetDatabasePasswordDocument = gql`
    mutation ResetDatabasePassword($appId: String!, $newPassword: String!) {
  resetPostgresPassword(appID: $appId, newPassword: $newPassword)
}
    `;
export type ResetDatabasePasswordMutationFn = Apollo.MutationFunction<ResetDatabasePasswordMutation, ResetDatabasePasswordMutationVariables>;

/**
 * __useResetDatabasePasswordMutation__
 *
 * To run a mutation, you first call `useResetDatabasePasswordMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useResetDatabasePasswordMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [resetDatabasePasswordMutation, { data, loading, error }] = useResetDatabasePasswordMutation({
 *   variables: {
 *      appId: // value for 'appId'
 *      newPassword: // value for 'newPassword'
 *   },
 * });
 */
export function useResetDatabasePasswordMutation(baseOptions?: Apollo.MutationHookOptions<ResetDatabasePasswordMutation, ResetDatabasePasswordMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<ResetDatabasePasswordMutation, ResetDatabasePasswordMutationVariables>(ResetDatabasePasswordDocument, options);
      }
export type ResetDatabasePasswordMutationHookResult = ReturnType<typeof useResetDatabasePasswordMutation>;
export type ResetDatabasePasswordMutationResult = Apollo.MutationResult<ResetDatabasePasswordMutation>;
export type ResetDatabasePasswordMutationOptions = Apollo.BaseMutationOptions<ResetDatabasePasswordMutation, ResetDatabasePasswordMutationVariables>;
export const GetRolesPermissionsDocument = gql`
    query GetRolesPermissions($appId: uuid!) {
  config(appID: $appId, resolve: true) {
    id: __typename
    __typename
    auth {
      user {
        roles {
          allowed
          default
        }
      }
      session {
        accessToken {
          customClaims {
            ...PermissionVariable
          }
        }
      }
    }
  }
}
    ${PermissionVariableFragmentDoc}`;

/**
 * __useGetRolesPermissionsQuery__
 *
 * To run a query within a React component, call `useGetRolesPermissionsQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetRolesPermissionsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetRolesPermissionsQuery({
 *   variables: {
 *      appId: // value for 'appId'
 *   },
 * });
 */
export function useGetRolesPermissionsQuery(baseOptions: Apollo.QueryHookOptions<GetRolesPermissionsQuery, GetRolesPermissionsQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetRolesPermissionsQuery, GetRolesPermissionsQueryVariables>(GetRolesPermissionsDocument, options);
      }
export function useGetRolesPermissionsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetRolesPermissionsQuery, GetRolesPermissionsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetRolesPermissionsQuery, GetRolesPermissionsQueryVariables>(GetRolesPermissionsDocument, options);
        }
export type GetRolesPermissionsQueryHookResult = ReturnType<typeof useGetRolesPermissionsQuery>;
export type GetRolesPermissionsLazyQueryHookResult = ReturnType<typeof useGetRolesPermissionsLazyQuery>;
export type GetRolesPermissionsQueryResult = Apollo.QueryResult<GetRolesPermissionsQuery, GetRolesPermissionsQueryVariables>;
export function refetchGetRolesPermissionsQuery(variables: GetRolesPermissionsQueryVariables) {
      return { query: GetRolesPermissionsDocument, variables: variables }
    }
export const GetSignInMethodsDocument = gql`
    query GetSignInMethods($appId: uuid!) {
  config(appID: $appId, resolve: true) {
    id: __typename
    __typename
    provider {
      id: __typename
      __typename
      sms {
        accountSid
        authToken
        messagingServiceId
        provider
      }
    }
    auth {
      id: __typename
      __typename
      method {
        emailPassword {
          emailVerificationRequired
          hibpEnabled
          passwordMinLength
        }
        emailPasswordless {
          enabled
        }
        smsPasswordless {
          enabled
        }
        anonymous {
          enabled
        }
        webauthn {
          enabled
        }
        oauth {
          apple {
            enabled
            clientId
            keyId
            teamId
            privateKey
          }
          bitbucket {
            enabled
            clientId
            clientSecret
          }
          gitlab {
            enabled
            clientId
            clientSecret
            scope
          }
          strava {
            enabled
            clientId
            clientSecret
            scope
          }
          discord {
            enabled
            clientId
            clientSecret
            scope
          }
          facebook {
            enabled
            clientId
            clientSecret
            scope
          }
          github {
            enabled
            clientId
            clientSecret
            scope
          }
          google {
            enabled
            clientId
            clientSecret
            scope
          }
          linkedin {
            enabled
            clientId
            clientSecret
            scope
          }
          spotify {
            enabled
            clientId
            clientSecret
            scope
          }
          twitch {
            enabled
            clientId
            clientSecret
            scope
          }
          twitter {
            enabled
            consumerKey
            consumerSecret
          }
          windowslive {
            enabled
            clientId
            clientSecret
            scope
          }
          workos {
            enabled
            clientId
            clientSecret
            connection
            organization
          }
          azuread {
            enabled
            clientId
            clientSecret
            tenant
          }
        }
      }
    }
  }
}
    `;

/**
 * __useGetSignInMethodsQuery__
 *
 * To run a query within a React component, call `useGetSignInMethodsQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetSignInMethodsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetSignInMethodsQuery({
 *   variables: {
 *      appId: // value for 'appId'
 *   },
 * });
 */
export function useGetSignInMethodsQuery(baseOptions: Apollo.QueryHookOptions<GetSignInMethodsQuery, GetSignInMethodsQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetSignInMethodsQuery, GetSignInMethodsQueryVariables>(GetSignInMethodsDocument, options);
      }
export function useGetSignInMethodsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetSignInMethodsQuery, GetSignInMethodsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetSignInMethodsQuery, GetSignInMethodsQueryVariables>(GetSignInMethodsDocument, options);
        }
export type GetSignInMethodsQueryHookResult = ReturnType<typeof useGetSignInMethodsQuery>;
export type GetSignInMethodsLazyQueryHookResult = ReturnType<typeof useGetSignInMethodsLazyQuery>;
export type GetSignInMethodsQueryResult = Apollo.QueryResult<GetSignInMethodsQuery, GetSignInMethodsQueryVariables>;
export function refetchGetSignInMethodsQuery(variables: GetSignInMethodsQueryVariables) {
      return { query: GetSignInMethodsDocument, variables: variables }
    }
export const GetSmtpSettingsDocument = gql`
    query GetSmtpSettings($appId: uuid!) {
  config(appID: $appId, resolve: true) {
    id: __typename
    __typename
    provider {
      id: __typename
      __typename
      smtp {
        host
        method
        port
        secure
        sender
        user
      }
    }
  }
}
    `;

/**
 * __useGetSmtpSettingsQuery__
 *
 * To run a query within a React component, call `useGetSmtpSettingsQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetSmtpSettingsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetSmtpSettingsQuery({
 *   variables: {
 *      appId: // value for 'appId'
 *   },
 * });
 */
export function useGetSmtpSettingsQuery(baseOptions: Apollo.QueryHookOptions<GetSmtpSettingsQuery, GetSmtpSettingsQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetSmtpSettingsQuery, GetSmtpSettingsQueryVariables>(GetSmtpSettingsDocument, options);
      }
export function useGetSmtpSettingsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetSmtpSettingsQuery, GetSmtpSettingsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetSmtpSettingsQuery, GetSmtpSettingsQueryVariables>(GetSmtpSettingsDocument, options);
        }
export type GetSmtpSettingsQueryHookResult = ReturnType<typeof useGetSmtpSettingsQuery>;
export type GetSmtpSettingsLazyQueryHookResult = ReturnType<typeof useGetSmtpSettingsLazyQuery>;
export type GetSmtpSettingsQueryResult = Apollo.QueryResult<GetSmtpSettingsQuery, GetSmtpSettingsQueryVariables>;
export function refetchGetSmtpSettingsQuery(variables: GetSmtpSettingsQueryVariables) {
      return { query: GetSmtpSettingsDocument, variables: variables }
    }
export const UpdateConfigDocument = gql`
    mutation UpdateConfig($appId: uuid!, $config: ConfigConfigUpdateInput!) {
  updateConfig(appID: $appId, config: $config) {
    id: __typename
  }
}
    `;
export type UpdateConfigMutationFn = Apollo.MutationFunction<UpdateConfigMutation, UpdateConfigMutationVariables>;

/**
 * __useUpdateConfigMutation__
 *
 * To run a mutation, you first call `useUpdateConfigMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useUpdateConfigMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [updateConfigMutation, { data, loading, error }] = useUpdateConfigMutation({
 *   variables: {
 *      appId: // value for 'appId'
 *      config: // value for 'config'
 *   },
 * });
 */
export function useUpdateConfigMutation(baseOptions?: Apollo.MutationHookOptions<UpdateConfigMutation, UpdateConfigMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<UpdateConfigMutation, UpdateConfigMutationVariables>(UpdateConfigDocument, options);
      }
export type UpdateConfigMutationHookResult = ReturnType<typeof useUpdateConfigMutation>;
export type UpdateConfigMutationResult = Apollo.MutationResult<UpdateConfigMutation>;
export type UpdateConfigMutationOptions = Apollo.BaseMutationOptions<UpdateConfigMutation, UpdateConfigMutationVariables>;
export const GetFreeAndActiveProjectsDocument = gql`
    query GetFreeAndActiveProjects($userId: uuid!) {
  freeAndActiveProjects: apps(
    where: {creatorUserId: {_eq: $userId}, plan: {isFree: {_eq: true}}, desiredState: {_eq: 5}}
  ) {
    id
  }
}
    `;

/**
 * __useGetFreeAndActiveProjectsQuery__
 *
 * To run a query within a React component, call `useGetFreeAndActiveProjectsQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetFreeAndActiveProjectsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetFreeAndActiveProjectsQuery({
 *   variables: {
 *      userId: // value for 'userId'
 *   },
 * });
 */
export function useGetFreeAndActiveProjectsQuery(baseOptions: Apollo.QueryHookOptions<GetFreeAndActiveProjectsQuery, GetFreeAndActiveProjectsQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetFreeAndActiveProjectsQuery, GetFreeAndActiveProjectsQueryVariables>(GetFreeAndActiveProjectsDocument, options);
      }
export function useGetFreeAndActiveProjectsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetFreeAndActiveProjectsQuery, GetFreeAndActiveProjectsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetFreeAndActiveProjectsQuery, GetFreeAndActiveProjectsQueryVariables>(GetFreeAndActiveProjectsDocument, options);
        }
export type GetFreeAndActiveProjectsQueryHookResult = ReturnType<typeof useGetFreeAndActiveProjectsQuery>;
export type GetFreeAndActiveProjectsLazyQueryHookResult = ReturnType<typeof useGetFreeAndActiveProjectsLazyQuery>;
export type GetFreeAndActiveProjectsQueryResult = Apollo.QueryResult<GetFreeAndActiveProjectsQuery, GetFreeAndActiveProjectsQueryVariables>;
export function refetchGetFreeAndActiveProjectsQuery(variables: GetFreeAndActiveProjectsQueryVariables) {
      return { query: GetFreeAndActiveProjectsDocument, variables: variables }
    }
export const InsertFeedbackOneDocument = gql`
    mutation insertFeedbackOne($feedback: feedback_insert_input!) {
  insertFeedbackOne(object: $feedback) {
    id
  }
}
    `;
export type InsertFeedbackOneMutationFn = Apollo.MutationFunction<InsertFeedbackOneMutation, InsertFeedbackOneMutationVariables>;

/**
 * __useInsertFeedbackOneMutation__
 *
 * To run a mutation, you first call `useInsertFeedbackOneMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useInsertFeedbackOneMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [insertFeedbackOneMutation, { data, loading, error }] = useInsertFeedbackOneMutation({
 *   variables: {
 *      feedback: // value for 'feedback'
 *   },
 * });
 */
export function useInsertFeedbackOneMutation(baseOptions?: Apollo.MutationHookOptions<InsertFeedbackOneMutation, InsertFeedbackOneMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<InsertFeedbackOneMutation, InsertFeedbackOneMutationVariables>(InsertFeedbackOneDocument, options);
      }
export type InsertFeedbackOneMutationHookResult = ReturnType<typeof useInsertFeedbackOneMutation>;
export type InsertFeedbackOneMutationResult = Apollo.MutationResult<InsertFeedbackOneMutation>;
export type InsertFeedbackOneMutationOptions = Apollo.BaseMutationOptions<InsertFeedbackOneMutation, InsertFeedbackOneMutationVariables>;
export const DeleteWorkspaceMemberInvitesDocument = gql`
    mutation deleteWorkspaceMemberInvites($id: uuid!) {
  deleteWorkspaceMemberInvites(where: {id: {_eq: $id}}) {
    affected_rows
  }
}
    `;
export type DeleteWorkspaceMemberInvitesMutationFn = Apollo.MutationFunction<DeleteWorkspaceMemberInvitesMutation, DeleteWorkspaceMemberInvitesMutationVariables>;

/**
 * __useDeleteWorkspaceMemberInvitesMutation__
 *
 * To run a mutation, you first call `useDeleteWorkspaceMemberInvitesMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useDeleteWorkspaceMemberInvitesMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [deleteWorkspaceMemberInvitesMutation, { data, loading, error }] = useDeleteWorkspaceMemberInvitesMutation({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useDeleteWorkspaceMemberInvitesMutation(baseOptions?: Apollo.MutationHookOptions<DeleteWorkspaceMemberInvitesMutation, DeleteWorkspaceMemberInvitesMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<DeleteWorkspaceMemberInvitesMutation, DeleteWorkspaceMemberInvitesMutationVariables>(DeleteWorkspaceMemberInvitesDocument, options);
      }
export type DeleteWorkspaceMemberInvitesMutationHookResult = ReturnType<typeof useDeleteWorkspaceMemberInvitesMutation>;
export type DeleteWorkspaceMemberInvitesMutationResult = Apollo.MutationResult<DeleteWorkspaceMemberInvitesMutation>;
export type DeleteWorkspaceMemberInvitesMutationOptions = Apollo.BaseMutationOptions<DeleteWorkspaceMemberInvitesMutation, DeleteWorkspaceMemberInvitesMutationVariables>;
export const GetWorkspaceMemberInvitesToManageDocument = gql`
    query getWorkspaceMemberInvitesToManage($userId: uuid!) {
  workspaceMemberInvites(where: {userByEmail: {id: {_eq: $userId}}}) {
    id
    email
    userByEmail {
      id
    }
    workspace {
      id
      name
      slug
    }
  }
}
    `;

/**
 * __useGetWorkspaceMemberInvitesToManageQuery__
 *
 * To run a query within a React component, call `useGetWorkspaceMemberInvitesToManageQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetWorkspaceMemberInvitesToManageQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetWorkspaceMemberInvitesToManageQuery({
 *   variables: {
 *      userId: // value for 'userId'
 *   },
 * });
 */
export function useGetWorkspaceMemberInvitesToManageQuery(baseOptions: Apollo.QueryHookOptions<GetWorkspaceMemberInvitesToManageQuery, GetWorkspaceMemberInvitesToManageQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetWorkspaceMemberInvitesToManageQuery, GetWorkspaceMemberInvitesToManageQueryVariables>(GetWorkspaceMemberInvitesToManageDocument, options);
      }
export function useGetWorkspaceMemberInvitesToManageLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetWorkspaceMemberInvitesToManageQuery, GetWorkspaceMemberInvitesToManageQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetWorkspaceMemberInvitesToManageQuery, GetWorkspaceMemberInvitesToManageQueryVariables>(GetWorkspaceMemberInvitesToManageDocument, options);
        }
export type GetWorkspaceMemberInvitesToManageQueryHookResult = ReturnType<typeof useGetWorkspaceMemberInvitesToManageQuery>;
export type GetWorkspaceMemberInvitesToManageLazyQueryHookResult = ReturnType<typeof useGetWorkspaceMemberInvitesToManageLazyQuery>;
export type GetWorkspaceMemberInvitesToManageQueryResult = Apollo.QueryResult<GetWorkspaceMemberInvitesToManageQuery, GetWorkspaceMemberInvitesToManageQueryVariables>;
export function refetchGetWorkspaceMemberInvitesToManageQuery(variables: GetWorkspaceMemberInvitesToManageQueryVariables) {
      return { query: GetWorkspaceMemberInvitesToManageDocument, variables: variables }
    }
export const InsertWorkspaceMemberInviteDocument = gql`
    mutation insertWorkspaceMemberInvite($workspaceMemberInvite: workspaceMemberInvites_insert_input!) {
  insertWorkspaceMemberInvite(object: $workspaceMemberInvite) {
    id
  }
}
    `;
export type InsertWorkspaceMemberInviteMutationFn = Apollo.MutationFunction<InsertWorkspaceMemberInviteMutation, InsertWorkspaceMemberInviteMutationVariables>;

/**
 * __useInsertWorkspaceMemberInviteMutation__
 *
 * To run a mutation, you first call `useInsertWorkspaceMemberInviteMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useInsertWorkspaceMemberInviteMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [insertWorkspaceMemberInviteMutation, { data, loading, error }] = useInsertWorkspaceMemberInviteMutation({
 *   variables: {
 *      workspaceMemberInvite: // value for 'workspaceMemberInvite'
 *   },
 * });
 */
export function useInsertWorkspaceMemberInviteMutation(baseOptions?: Apollo.MutationHookOptions<InsertWorkspaceMemberInviteMutation, InsertWorkspaceMemberInviteMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<InsertWorkspaceMemberInviteMutation, InsertWorkspaceMemberInviteMutationVariables>(InsertWorkspaceMemberInviteDocument, options);
      }
export type InsertWorkspaceMemberInviteMutationHookResult = ReturnType<typeof useInsertWorkspaceMemberInviteMutation>;
export type InsertWorkspaceMemberInviteMutationResult = Apollo.MutationResult<InsertWorkspaceMemberInviteMutation>;
export type InsertWorkspaceMemberInviteMutationOptions = Apollo.BaseMutationOptions<InsertWorkspaceMemberInviteMutation, InsertWorkspaceMemberInviteMutationVariables>;
export const UpdateWorkspaceMemberInviteDocument = gql`
    mutation updateWorkspaceMemberInvite($id: uuid!, $workspaceMemberInvite: workspaceMemberInvites_set_input!) {
  updateWorkspaceMemberInvites(
    _set: $workspaceMemberInvite
    where: {id: {_eq: $id}}
  ) {
    affected_rows
  }
}
    `;
export type UpdateWorkspaceMemberInviteMutationFn = Apollo.MutationFunction<UpdateWorkspaceMemberInviteMutation, UpdateWorkspaceMemberInviteMutationVariables>;

/**
 * __useUpdateWorkspaceMemberInviteMutation__
 *
 * To run a mutation, you first call `useUpdateWorkspaceMemberInviteMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useUpdateWorkspaceMemberInviteMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [updateWorkspaceMemberInviteMutation, { data, loading, error }] = useUpdateWorkspaceMemberInviteMutation({
 *   variables: {
 *      id: // value for 'id'
 *      workspaceMemberInvite: // value for 'workspaceMemberInvite'
 *   },
 * });
 */
export function useUpdateWorkspaceMemberInviteMutation(baseOptions?: Apollo.MutationHookOptions<UpdateWorkspaceMemberInviteMutation, UpdateWorkspaceMemberInviteMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<UpdateWorkspaceMemberInviteMutation, UpdateWorkspaceMemberInviteMutationVariables>(UpdateWorkspaceMemberInviteDocument, options);
      }
export type UpdateWorkspaceMemberInviteMutationHookResult = ReturnType<typeof useUpdateWorkspaceMemberInviteMutation>;
export type UpdateWorkspaceMemberInviteMutationResult = Apollo.MutationResult<UpdateWorkspaceMemberInviteMutation>;
export type UpdateWorkspaceMemberInviteMutationOptions = Apollo.BaseMutationOptions<UpdateWorkspaceMemberInviteMutation, UpdateWorkspaceMemberInviteMutationVariables>;
export const DeleteWorkspaceMemberDocument = gql`
    mutation deleteWorkspaceMember($id: uuid!) {
  deleteWorkspaceMember(id: $id) {
    id
  }
}
    `;
export type DeleteWorkspaceMemberMutationFn = Apollo.MutationFunction<DeleteWorkspaceMemberMutation, DeleteWorkspaceMemberMutationVariables>;

/**
 * __useDeleteWorkspaceMemberMutation__
 *
 * To run a mutation, you first call `useDeleteWorkspaceMemberMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useDeleteWorkspaceMemberMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [deleteWorkspaceMemberMutation, { data, loading, error }] = useDeleteWorkspaceMemberMutation({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useDeleteWorkspaceMemberMutation(baseOptions?: Apollo.MutationHookOptions<DeleteWorkspaceMemberMutation, DeleteWorkspaceMemberMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<DeleteWorkspaceMemberMutation, DeleteWorkspaceMemberMutationVariables>(DeleteWorkspaceMemberDocument, options);
      }
export type DeleteWorkspaceMemberMutationHookResult = ReturnType<typeof useDeleteWorkspaceMemberMutation>;
export type DeleteWorkspaceMemberMutationResult = Apollo.MutationResult<DeleteWorkspaceMemberMutation>;
export type DeleteWorkspaceMemberMutationOptions = Apollo.BaseMutationOptions<DeleteWorkspaceMemberMutation, DeleteWorkspaceMemberMutationVariables>;
export const GetWorkspaceMembersDocument = gql`
    query getWorkspaceMembers($workspaceId: uuid!) {
  workspace(id: $workspaceId) {
    id
    creatorUser {
      id
    }
    workspaceMembers(order_by: {createdAt: asc}) {
      ...getWorkspaceMembersWorkspaceMember
    }
    workspaceMemberInvites(order_by: {createdAt: asc}) {
      ...getWorkspaceMembersWorkspaceMemberInvite
    }
  }
}
    ${GetWorkspaceMembersWorkspaceMemberFragmentDoc}
${GetWorkspaceMembersWorkspaceMemberInviteFragmentDoc}`;

/**
 * __useGetWorkspaceMembersQuery__
 *
 * To run a query within a React component, call `useGetWorkspaceMembersQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetWorkspaceMembersQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetWorkspaceMembersQuery({
 *   variables: {
 *      workspaceId: // value for 'workspaceId'
 *   },
 * });
 */
export function useGetWorkspaceMembersQuery(baseOptions: Apollo.QueryHookOptions<GetWorkspaceMembersQuery, GetWorkspaceMembersQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetWorkspaceMembersQuery, GetWorkspaceMembersQueryVariables>(GetWorkspaceMembersDocument, options);
      }
export function useGetWorkspaceMembersLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetWorkspaceMembersQuery, GetWorkspaceMembersQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetWorkspaceMembersQuery, GetWorkspaceMembersQueryVariables>(GetWorkspaceMembersDocument, options);
        }
export type GetWorkspaceMembersQueryHookResult = ReturnType<typeof useGetWorkspaceMembersQuery>;
export type GetWorkspaceMembersLazyQueryHookResult = ReturnType<typeof useGetWorkspaceMembersLazyQuery>;
export type GetWorkspaceMembersQueryResult = Apollo.QueryResult<GetWorkspaceMembersQuery, GetWorkspaceMembersQueryVariables>;
export function refetchGetWorkspaceMembersQuery(variables: GetWorkspaceMembersQueryVariables) {
      return { query: GetWorkspaceMembersDocument, variables: variables }
    }
export const UpdateWorkspaceMemberDocument = gql`
    mutation updateWorkspaceMember($id: uuid!, $workspaceMember: workspaceMembers_set_input!) {
  updateWorkspaceMember(_set: $workspaceMember, pk_columns: {id: $id}) {
    id
  }
}
    `;
export type UpdateWorkspaceMemberMutationFn = Apollo.MutationFunction<UpdateWorkspaceMemberMutation, UpdateWorkspaceMemberMutationVariables>;

/**
 * __useUpdateWorkspaceMemberMutation__
 *
 * To run a mutation, you first call `useUpdateWorkspaceMemberMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useUpdateWorkspaceMemberMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [updateWorkspaceMemberMutation, { data, loading, error }] = useUpdateWorkspaceMemberMutation({
 *   variables: {
 *      id: // value for 'id'
 *      workspaceMember: // value for 'workspaceMember'
 *   },
 * });
 */
export function useUpdateWorkspaceMemberMutation(baseOptions?: Apollo.MutationHookOptions<UpdateWorkspaceMemberMutation, UpdateWorkspaceMemberMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<UpdateWorkspaceMemberMutation, UpdateWorkspaceMemberMutationVariables>(UpdateWorkspaceMemberDocument, options);
      }
export type UpdateWorkspaceMemberMutationHookResult = ReturnType<typeof useUpdateWorkspaceMemberMutation>;
export type UpdateWorkspaceMemberMutationResult = Apollo.MutationResult<UpdateWorkspaceMemberMutation>;
export type UpdateWorkspaceMemberMutationOptions = Apollo.BaseMutationOptions<UpdateWorkspaceMemberMutation, UpdateWorkspaceMemberMutationVariables>;
export const DeleteWorkspaceDocument = gql`
    mutation deleteWorkspace($id: uuid!) {
  deleteWorkspace(id: $id) {
    id
  }
}
    `;
export type DeleteWorkspaceMutationFn = Apollo.MutationFunction<DeleteWorkspaceMutation, DeleteWorkspaceMutationVariables>;

/**
 * __useDeleteWorkspaceMutation__
 *
 * To run a mutation, you first call `useDeleteWorkspaceMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useDeleteWorkspaceMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [deleteWorkspaceMutation, { data, loading, error }] = useDeleteWorkspaceMutation({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useDeleteWorkspaceMutation(baseOptions?: Apollo.MutationHookOptions<DeleteWorkspaceMutation, DeleteWorkspaceMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<DeleteWorkspaceMutation, DeleteWorkspaceMutationVariables>(DeleteWorkspaceDocument, options);
      }
export type DeleteWorkspaceMutationHookResult = ReturnType<typeof useDeleteWorkspaceMutation>;
export type DeleteWorkspaceMutationResult = Apollo.MutationResult<DeleteWorkspaceMutation>;
export type DeleteWorkspaceMutationOptions = Apollo.BaseMutationOptions<DeleteWorkspaceMutation, DeleteWorkspaceMutationVariables>;
export const InsertWorkspaceDocument = gql`
    mutation insertWorkspace($workspace: workspaces_insert_input!) {
  insertWorkspace(object: $workspace) {
    name
    id
  }
}
    `;
export type InsertWorkspaceMutationFn = Apollo.MutationFunction<InsertWorkspaceMutation, InsertWorkspaceMutationVariables>;

/**
 * __useInsertWorkspaceMutation__
 *
 * To run a mutation, you first call `useInsertWorkspaceMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useInsertWorkspaceMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [insertWorkspaceMutation, { data, loading, error }] = useInsertWorkspaceMutation({
 *   variables: {
 *      workspace: // value for 'workspace'
 *   },
 * });
 */
export function useInsertWorkspaceMutation(baseOptions?: Apollo.MutationHookOptions<InsertWorkspaceMutation, InsertWorkspaceMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<InsertWorkspaceMutation, InsertWorkspaceMutationVariables>(InsertWorkspaceDocument, options);
      }
export type InsertWorkspaceMutationHookResult = ReturnType<typeof useInsertWorkspaceMutation>;
export type InsertWorkspaceMutationResult = Apollo.MutationResult<InsertWorkspaceMutation>;
export type InsertWorkspaceMutationOptions = Apollo.BaseMutationOptions<InsertWorkspaceMutation, InsertWorkspaceMutationVariables>;
export const UpdateWorkspaceDocument = gql`
    mutation updateWorkspace($id: uuid!, $workspace: workspaces_set_input!) {
  updateWorkspace(pk_columns: {id: $id}, _set: $workspace) {
    id
    name
    email
    companyName
    addressLine1
    addressLine2
    addressPostalCode
    addressCity
    addressCountryCode
    slug
    taxIdType
    taxIdValue
  }
}
    `;
export type UpdateWorkspaceMutationFn = Apollo.MutationFunction<UpdateWorkspaceMutation, UpdateWorkspaceMutationVariables>;

/**
 * __useUpdateWorkspaceMutation__
 *
 * To run a mutation, you first call `useUpdateWorkspaceMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useUpdateWorkspaceMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [updateWorkspaceMutation, { data, loading, error }] = useUpdateWorkspaceMutation({
 *   variables: {
 *      id: // value for 'id'
 *      workspace: // value for 'workspace'
 *   },
 * });
 */
export function useUpdateWorkspaceMutation(baseOptions?: Apollo.MutationHookOptions<UpdateWorkspaceMutation, UpdateWorkspaceMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useMutation<UpdateWorkspaceMutation, UpdateWorkspaceMutationVariables>(UpdateWorkspaceDocument, options);
      }
export type UpdateWorkspaceMutationHookResult = ReturnType<typeof useUpdateWorkspaceMutation>;
export type UpdateWorkspaceMutationResult = Apollo.MutationResult<UpdateWorkspaceMutation>;
export type UpdateWorkspaceMutationOptions = Apollo.BaseMutationOptions<UpdateWorkspaceMutation, UpdateWorkspaceMutationVariables>;