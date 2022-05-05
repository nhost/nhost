<script>
	import { client } from './apollo';
	import { setClient } from 'svelte-apollo';
	import Articles, { preload as articlePreload } from './Articles.svelte';
	import Authors, { preload as authorPreload } from './Authors.svelte';
	import AddAuthor from './AddAuthor.svelte';
	import AddArticles from './AddArticles.svelte';

	// Approximate sapper preload
	const articlePreloading = articlePreload();
	const authorPreloading = authorPreload();

	setClient(client);
</script>

<style>
	h1 {
		color: purple;
	}
	h2 {
		color: lightgreen;
	}
	section{
		margin-left: 250px;
		max-width: 1000px;
	}
</style>

<section>
	<h1>Articles (simple query)</h1>

	{#await articlePreloading}
		<p>Preloading articles....</p>
	{:then preloaded}
		<Articles {...preloaded} />
		<h2>Add Article (mutation)</h2>
		<AddArticles {...preloaded} />
	{:catch error}
		<p>Error preloading articles: {error}</p>
	{/await}

	<h1>Authors (simple query with cache updates)</h1>

	{#await authorPreloading}
		<p>Preloading authors....</p>
	{:then preloaded}
		<Authors {...preloaded} />
		<h2>Add Author (mutation)</h2>
		<AddAuthor {...preloaded} />
	{:catch error}
		<p>Error preloading authors: {error}</p>
	{/await}

</section>
