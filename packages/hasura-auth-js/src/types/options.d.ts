interface RegistrationOptions {
    /**
     * Locale of the user, in two digits
     * @example `'en'`
     */
    locale?: string;
    /**
     * Allowed roles of the user. Must be a subset of the default allowed roles defined in Hasura Auth.
     * @example `['user','me']`
     */
    allowedRoles?: string[];
    /**
     * Default role of the user. Must be part of the default allowed roles defined in Hasura Auth.
     * @example `'user'`
     */
    defaultRole?: string;
    /**
     * Display name of the user. If not provided, it will use the display name given by the social provider (Oauth) used on registration, or the email address otherwise.
     */
    displayName?: string;
    /**
     * Custom additional user information stored in the `metadata` column. Can be any JSON object.
     * @example `{ firstName: 'Bob', profession: 'builder' }`
     */
    metadata?: Record<string, unknown>;
}
export interface RedirectOption {
    /**
     * Redirection path in the client application that will be used in the link in the verification email.
     * For instance, if you want to redirect to `https://myapp.com/success`, the `redirectTo` value is `'/success'`.
     */
    redirectTo?: string;
}
export interface PasswordlessOptions extends RegistrationOptions, RedirectOption {
}
export interface SignUpOptions extends RegistrationOptions, RedirectOption {
}
export interface EmailOTPOptions extends RegistrationOptions, RedirectOption {
}
export interface SignUpSecurityKeyOptions extends SignUpOptions {
    /** Optional nickname for the security key */
    nickname?: string;
}
export interface ChangeEmailOptions extends RedirectOption {
}
export interface ResetPasswordOptions extends RedirectOption {
}
export interface SendVerificationEmailOptions extends RedirectOption {
}
export interface DeanonymizeOptions extends RegistrationOptions {
    email?: string;
    password?: string;
}
export interface CommonProviderOptions extends RegistrationOptions, RedirectOption {
    connect?: boolean;
}
export interface WorkOsOptions extends CommonProviderOptions {
    connection?: string;
    organization?: string;
    provider?: string;
}
export interface ProviderOptions extends CommonProviderOptions, WorkOsOptions {
}
export interface RequestOptions {
    headers?: Record<string, string>;
}
export {};
//# sourceMappingURL=options.d.ts.map