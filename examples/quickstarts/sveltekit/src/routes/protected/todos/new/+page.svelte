<script>
	import Button from '$lib/components/Button.svelte'
	import Input from '$lib/components/Input.svelte'

  /** @type {import('./$types').Actions} */
	export let form;
</script>

<svelte:head>
	<title>Sign In</title>
</svelte:head>

{#if form?.error}
	<p class="mt-3 font-semibold text-center text-red-500">{form?.error}</p>
{/if}

<form method="post" enctype="multipart/form-data" class="flex flex-col max-w-xl mx-auto space-y-4">
  <Input id='title' name='title' label='title' required placeholder='what needs to be done' class='w-full' />
  <input name='file' type="file" class="w-full p-3 border" />
	
  <Button class='w-full' type="submit">Add</Button>
</form>