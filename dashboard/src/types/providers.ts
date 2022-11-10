export type Provider = {
  name: string;
  logo: string;
  active: boolean;
  docsLink: string;
};

export type Providers = {
  providers: Provider[];
};
