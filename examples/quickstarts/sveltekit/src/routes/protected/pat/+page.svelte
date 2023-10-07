<script>
  import PatItem from '$lib/components/pat-item.svelte'

	/** @type {import('./$types').PageData} */
	export let data
	const { personalAccessTokens, count, page } = data
</script>

<svelte:head>
	<title>Personal Access Tokens</title>
</svelte:head>

<div class="flex items-center justify-between w-full mb-2">
  <h2 class="text-xl">Personal Access Tokens ({count})</h2>

  <a
    href=/protected/pat/new
    class="px-4 py-2 text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
  >
    Add a PAT
  </a>
</div>

<ul class="space-y-1">
  {#each personalAccessTokens as pat}
    <li>
      <PatItem pat={pat} />
    </li>
  {/each}
</ul>

{#if count > 10}
  <div class="flex justify-center space-x-2">
    {#if page > 0}
      <a
        href={`/protected/pat/${page - 1}`}
        class="px-4 py-2 text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
      >
        Previous
      </a>
    {/if}

    {#if page + 1 < Math.ceil(count / 10)}
      <a
        href={`/protected/pat/${page + 1}`}
        class="px-4 py-2 text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
      >
        Next
      </a>
    {/if}
  </div>
{/if}