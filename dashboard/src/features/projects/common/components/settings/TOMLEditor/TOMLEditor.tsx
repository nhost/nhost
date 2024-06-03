import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { Text } from '@/components/ui/v2/Text';
import { toml } from '@codemirror/legacy-modes/mode/toml'
import { StreamLanguage } from '@codemirror/language';
import { useTheme } from '@mui/material';
import { githubDark, githubLight } from '@uiw/codemirror-theme-github';
import CodeMirror  from '@uiw/react-codemirror';
import { useCallback, useState } from 'react';

const initialTOMLCode = `# Example TOML
[global]

[hasura]
version = 'v2.25.1-ce'
adminSecret = '{{ secrets.HASURA_GRAPHQL_ADMIN_SECRET }}'
webhookSecret = '{{ secrets.NHOST_WEBHOOK_SECRET }}'

[[hasura.jwtSecrets]]
type = 'HS256'
key = '{{ secrets.HASURA_GRAPHQL_JWT_SECRET }}'

[hasura.settings]
corsDomain = ['*']
devMode = true
enableAllowList = false
enableConsole = true
enableRemoteSchemaPermissions = false
enabledAPIs = ['metadata', 'graphql', 'pgdump', 'config']

[hasura.logs]
level = 'warn'

[hasura.events]
httpPoolSize = 100

[functions]
[functions.node]
version = 18

[auth]
version = '0.20.2'

[auth.redirections]
clientUrl = 'http://localhost:3000'

[auth.signUp]
enabled = true

[auth.user]
[auth.user.roles]
default = 'user'
allowed = ['user', 'me']

[auth.user.locale]
default = 'en'
allowed = ['en']

[auth.user.gravatar]
enabled = true
default = 'blank'
rating = 'g'

[auth.user.email]

[auth.user.emailDomains]

[auth.session]
[auth.session.accessToken]
expiresIn = 900

[auth.session.refreshToken]
expiresIn = 43200

[auth.method]
[auth.method.anonymous]
enabled = false

[auth.method.emailPasswordless]
enabled = false

[auth.method.emailPassword]
hibpEnabled = false
emailVerificationRequired = true
passwordMinLength = 9

[auth.method.smsPasswordless]
enabled = false

[auth.method.oauth]
[auth.method.oauth.apple]
enabled = false

[auth.method.oauth.azuread]
tenant = 'common'
enabled = false

[auth.method.oauth.bitbucket]
enabled = false

[auth.method.oauth.discord]
enabled = false

[auth.method.oauth.facebook]
enabled = false

[auth.method.oauth.github]
enabled = false

[auth.method.oauth.gitlab]
enabled = false

[auth.method.oauth.google]
enabled = false

[auth.method.oauth.linkedin]
enabled = false

[auth.method.oauth.spotify]
enabled = false

[auth.method.oauth.strava]
enabled = false

[auth.method.oauth.twitch]
enabled = false

[auth.method.oauth.twitter]
enabled = false

[auth.method.oauth.windowslive]
enabled = false

[auth.method.oauth.workos]
enabled = false

[auth.method.webauthn]
enabled = false

[auth.method.webauthn.attestation]
timeout = 60000

[auth.totp]
enabled = false

[postgres]
version = '14.6-20230406-2'

[provider]

[storage]
version = '0.3.4'

[observability]
[observability.grafana]
adminPassword = '{{ secrets.GRAFANA_ADMIN_PASSWORD }}'
`

export default function TOMLEditor() {
  const theme = useTheme();

  const [tomlCode, setTOMLCode] = useState(initialTOMLCode);

  const onChange = useCallback((value: string) => setTOMLCode(value), []);

  return (
    <Box className="flex flex-1 flex-col justify-center overflow-hidden">
      <Box className="flex flex-col space-y-2 border-b p-4">
        <Text className="font-semibold">Raw TOML Settings</Text>
      </Box>

      <CodeMirror
        value={tomlCode}
        height="100%"
        className="min-h-[100px] max-h-[550px] flex-1 overflow-y-auto"
        theme={theme.palette.mode === 'light' ? githubLight : githubDark}
        extensions={[StreamLanguage.define(toml)]}
        onChange={onChange}
      />
        <Box className="grid w-full flex-shrink-0 snap-end grid-flow-col justify-between gap-3 place-self-end border-t-1 p-2">
          <Button
            variant="outlined"
            color="secondary"
          >
            Cancel
          </Button>

          <Button
            type="submit"
            className="justify-self-end"
          >
            Save
          </Button>
        </Box>
    </Box>
  );
}
