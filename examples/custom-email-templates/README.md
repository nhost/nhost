# Custom email templates

Nhost plans to fully host custom email templates for email verification, password reset, email change confirmation, passwordless authentication...

In the meantime, it is possible to tell the Hasura-auth service to look for templates in an external public location through HTTP requests.
Here is a short example on how to proceed.

## Define where to find the custom templates

In the Nhost console, define the following **App Environment Variable:**:

- Variable name: `AUTH_EMAIL_TEMPLATE_FETCH_URL`
- Production value: `https://raw.githubusercontent.com/nhost/nhost/main/examples/custom-email-templates`
- Development value: `https://raw.githubusercontent.com/nhost/nhost/main/examples/custom-email-templates`

The above example will use the [templates located in the repository hosting this example](https://github.com/nhost/nhost/tree/main/examples/custom-email-templates). You can define another URL as long as it follows the same file structure. On every email creation, the server will use this URL to fetch its templates, depending on the locale, email type and field.

For instance, the template for english verification email body will the fetched in [https://raw.githubusercontent.com/nhost/nhost/custom-email-templates-example/examples/custom-email-templates/en/email-verify/body.html](https://raw.githubusercontent.com/nhost/nhost/custom-email-templates-example/examples/custom-email-templates/en/email-verify/body.html).
