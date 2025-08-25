<script>
	/** @type {import('@nhost/nhost-js').User | undefined} */
	export let user;

	$: navigation = [
		{
			href: '/',
			name: 'Home'
		},
		{
			href: '/protected/todos',
			name: `${user ? '🔓' : '🔒'} Todos`
		},
		{
			href: '/protected/echo',
			name: `${user ? '🔓' : '🔒'} Echo`
		},
		{
			href: '/protected/pat',
			name: `${user ? '🔓' : '🔒'} PAT`
		}
	];
</script>

<header class="bg-indigo-600">
	<nav class="container mx-auto">
		<div class="flex items-center justify-between w-full py-4">
			<div class="flex items-center">
				<div class="ml-10 space-x-8">
					{#each navigation as link}
						<a href={link.href} class="text-lg font-medium text-white hover:text-indigo-50">
							{link.name}
						</a>
					{/each}
				</div>
			</div>
			<div class="ml-10 space-x-4">
				{#if user}
				<form action=/auth/sign-out method=post>
					<button
						type='submit'
						class="inline-block px-4 py-2 text-base font-medium text-white bg-indigo-500 border border-transparent rounded-md hover:bg-opacity-75"
					>
						Sign out
					</button>
				</form>
				{:else}
					<a
						href="/auth/sign-in"
						class="inline-block px-4 py-2 text-base font-medium text-white bg-indigo-500 border border-transparent rounded-md hover:bg-opacity-75"
					>
						Sign in
					</a>
					<a
						href="/auth/sign-up"
						class="inline-block px-4 py-2 text-base font-medium text-indigo-600 bg-white border border-transparent rounded-md hover:bg-indigo-50"
					>
						Sign up
					</a>
				{/if}
			</div>
		</div>
	</nav>
</header>
