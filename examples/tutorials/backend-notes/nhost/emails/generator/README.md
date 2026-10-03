# How to generate emails for a new locale

The emails are made using (`react.email`)[https://react.email/] and they can be edited and previewd running the
following command at the root of the repo:

```sh
pnpm dev:email
```

To generate email templates for a new locale, use the following command:

```sh
pnpm generate:emails <locale>
```

Once the script finishes, a new folder will be created under the email-templates directory, named according
to the new locale. You can then edit the email text to match the specific locale’s language.

For example to generate emails for the German locale (de) you run:

```sh
pnpm generate:emails de
```