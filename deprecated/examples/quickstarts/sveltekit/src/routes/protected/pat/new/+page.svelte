<script>
  import Button from '$lib/components/Button.svelte'
  import Input from '$lib/components/Input.svelte'
</script>

<svelte:head>
	<title>Create Personal Access Token</title>
</svelte:head>

<div class="flex flex-col max-w-3xl mx-auto space-y-4">
  <h2 class="text-xl">New Personal Access Token</h2>
  <form class="space-y-4" action=/protected/pat/new method='post'>
    <Input id=name name=name label=Name required />
    <Input id=expiration name=expiration type=date required />
    <Button type=submit>Create PAT</Button>
  </form>
</div>