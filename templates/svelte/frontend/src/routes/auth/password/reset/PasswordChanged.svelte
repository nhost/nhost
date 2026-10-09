<script lang="ts">
import { Button } from '$lib/components/ui/button';
import * as Card from '$lib/components/ui/card';
import { passwordSignIn } from './resetView';
</script>

<Card.Root>
  <Card.Header>
    <Card.Title>Password changed</Card.Title>
    <Card.Description>
      Changing it signed you out everywhere, this browser included. Sign in
      again with the new password.
    </Card.Description>
  </Card.Header>
  <Card.Content>
    <Button href={passwordSignIn}>Sign in</Button>
  </Card.Content>
</Card.Root>
