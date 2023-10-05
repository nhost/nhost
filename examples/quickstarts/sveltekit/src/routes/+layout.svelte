<script>
	import Navigation from '$lib/components/Navigation.svelte'
	import './styles.css'

	export let data;
</script>

<div class="app">
	<Navigation user={data?.user} />

	<div class="container p-4 mx-auto mt-8 antialiased">
		<slot />
	</div>
</div>
