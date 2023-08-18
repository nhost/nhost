<script>
	import Input from '$lib/components/Input.svelte';
	import Button from '$lib/components/Button.svelte';
	import { goto } from '$app/navigation';

	export let data;
	let { nhost } = data;

	/** @type {string}*/
	let firstName;

	/** @type {string}*/
	let lastName;

	/** @type {string}*/
	let email;

	/** @type {string}*/
	let password;

	/** @type {import('@nhost/nhost-js').AuthErrorPayload | null} */
	let error;

	const handleSignUp = async () => {
		const { error: signUpError } = await nhost.auth.signUp({
			email,
			password,
			options: {
				displayName: `${firstName} ${lastName}`
			}
		});

		error = signUpError;

		if (!error) {
			await goto('/sign-in');
		}
	};
</script>

<svelte:head>
	<title>Sign Up</title>
</svelte:head>

<h1 class="text-2xl font-semibold text-center">Sign Up</h1>

{#if error}
	<p class="mt-3 font-semibold text-center text-red-500">{error.message}</p>
{/if}

<form class="space-y-5" on:submit={handleSignUp}>
	<Input
		label="First Name"
		id="firstName"
		name="firstName"
		type="text"
		bind:value={firstName}
		required
	/>

	<Input
		label="Last Name"
		id="lastName"
		name="lastName"
		type="text"
		bind:value={lastName}
		required
	/>

	<Input label="Email" id="email" name="email" type="email" bind:value={email} required />

	<Input
		label="Password"
		id="password"
		name="password"
		type="password"
		bind:value={password}
		required
	/>

	<Button type="submit">Sign Up</Button>
</form>
