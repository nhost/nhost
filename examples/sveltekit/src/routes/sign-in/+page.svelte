<script>
	import Input from '$lib/components/Input.svelte';
	import Button from '$lib/components/Button.svelte';
	import { goto, invalidate } from '$app/navigation';

	export let data;
	let { nhost } = data;

	/** @type {string}*/
	let email;

	/** @type {string}*/
	let password;

	/** @type {import('@nhost/nhost-js').AuthErrorPayload | null} */
	let error;

	const handleSignIn = async () => {
		const { error: signInError } = await nhost.auth.signIn({
			email,
			password
		});

		error = signInError;

		if (!error) {
			await invalidate('nhost:auth');
			await goto('/protected');
		}
	};
</script>

<svelte:head>
	<title>Sign In</title>
</svelte:head>

<h1 class="text-2xl font-semibold text-center">Sign In</h1>

{#if error}
	<p class="mt-3 font-semibold text-center text-red-500">{error.message}</p>
{/if}

<form class="space-y-5" on:submit={handleSignIn}>
	<Input label="Email" id="email" name="email" type="email" bind:value={email} required />

	<Input
		label="Password"
		id="password"
		name="password"
		type="password"
		bind:value={password}
		required
	/>

	<Button type="submit">Sign In</Button>
</form>
