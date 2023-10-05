<script>
	import Button from '$lib/components/Button.svelte'
	import Input from '$lib/components/Input.svelte'
</script>

<svelte:head>
	<title>Sign In</title>
</svelte:head>

<form method="post" enctype="multipart/form-data" class="flex flex-col max-w-xl mx-auto space-y-4">
  <Input id='title' name='title' label='title' required placeholder='what needs to be done' class='w-full' />
  
  <input name='file' type="file" class="w-full p-3 border" />
  <Button class='w-full' type="submit">Add</Button>
</form>