<script>
	import Button from '$lib/components/Button.svelte'
	import Input from '$lib/components/Input.svelte'
	
	/** @type {import('./$types').Actions} */
	export let form;
</script>

<svelte:head>
	<title>Sign In</title>
</svelte:head>

<h1 class="text-2xl font-semibold text-center">Sign In</h1>

{#if form?.error}
	<p class="mt-3 font-semibold text-center text-red-500">{form?.error}</p>
{/if}

<form class="max-w-xl mx-auto space-y-5" method='POST'>
	<Input label="Email" id="email" name="email" type="email" required />

	<Input
		label="Password"
		id="password"
		name="password"
		type="password"
		required
	/>

	<Button class='w-full' type="submit">Sign In</Button>
</form>
