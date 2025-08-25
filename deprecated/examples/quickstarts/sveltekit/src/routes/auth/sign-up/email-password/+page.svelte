<script>
	import Button from '$lib/components/Button.svelte'
	import Input from '$lib/components/Input.svelte'

	/** @type {import('./$types').Actions} */
	export let form;
</script>

<svelte:head>
	<title>Sign Up</title>
</svelte:head>

<h1 class="text-2xl font-semibold text-center">Sign Up</h1>

{#if form?.error}
	<p class="mt-3 font-semibold text-center text-red-500">{form?.error}</p>
{/if}

<div class='max-w-xl mx-auto'>
	<form class="space-y-5" method='POST'>
		<Input
			label="First Name"
			id="firstName"
			name="firstName"
			type="text"
			required
		/>
	
		<Input
			label="Last Name"
			id="lastName"
			name="lastName"
			type="text"
			required
		/>
	
		<Input label="Email" id="email" name="email" type="email" required />
	
		<Input
			label="Password"
			id="password"
			name="password"
			type="password"
			required
		/>
	
		<Button class='block w-full' type="submit">Sign Up</Button>
	</form>
</div>
