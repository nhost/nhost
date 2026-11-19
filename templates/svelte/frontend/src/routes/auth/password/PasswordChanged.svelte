<script lang="ts">
  import { Button } from '#lib/components/ui/button/index.ts';
  import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
  } from '#lib/components/ui/card/index.ts';
  import { passwordSignIn } from './passwordSignIn.ts';
</script>

<div class="mx-auto max-w-sm">
  <Card>
    <CardHeader>
      <CardTitle>Password changed</CardTitle>
      <CardDescription>
        Changing it signed you out everywhere, this browser included. Sign in
        again with the new password.
      </CardDescription>
    </CardHeader>
    <CardContent>
      <Button href={passwordSignIn}>Sign in</Button>
    </CardContent>
  </Card>
</div>
