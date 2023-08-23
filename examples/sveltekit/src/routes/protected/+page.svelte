<script>
	export let data;
	let { session, nhost } = data;
	import { gql } from 'graphql-tag';

	const getFiles = async () => {
		const response = await nhost.graphql.request(gql`
			{
				files {
					id
					name
				}
			}
		`);

		return response.data.files;
	};
</script>

<svelte:head>
	<title>Protected Page</title>
	<meta name="description" content="About this app" />
</svelte:head>

<h1 class="text-2xl font-semibold text-center">
	Hi! You are registered with email: {session?.user.email}.
</h1>

<h2>Files</h2>
{#await getFiles()}
	<p>Loading...</p>
{:then files}
	<p>Showing {files.length} files</p>

	<ul>
		{#each files as file}
			<li>
				{file.name}
			</li>
		{/each}
	</ul>
{:catch error}
	<p>{error.message}</p>
{/await}
