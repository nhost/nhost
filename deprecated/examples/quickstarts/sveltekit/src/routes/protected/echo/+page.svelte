<script>
  /** @type {import('./$types').PageData} */
	export let data;

  let functionResponse = data.res?.data
</script>

<svelte:head>
	<title>Echo</title>
</svelte:head>

<div>
  <pre class="overflow-auto">{JSON.stringify(functionResponse, null, 2)}</pre>
</div>
