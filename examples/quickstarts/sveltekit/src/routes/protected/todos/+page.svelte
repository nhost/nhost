<script>
	import TodoItem from '$lib/components/todo-item.svelte'

	/** @type {import('./$types').PageData} */
	export let data;

	const { todos, count, page } = data
</script>

<svelte:head>
	<title>Todos - Protected</title>
</svelte:head>

<div class="space-y-4">
	<div class="flex items-center justify-between w-full">
		<h2 class="text-xl">Todos ({count})</h2>

		<a
			href={`/protected/todos/new`}
			class="px-4 py-2 text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
		>
			Add Todo
		</a>
	</div>

	<ul class="space-y-1">
		{#each todos as todo}
			<li>
				<TodoItem todo={todo} />
			</li>
		{/each}
	</ul>

	{#if count > 10}
		<div class="flex justify-center space-x-2">
			{#if page > 0}
				<a
					href={`/protected/todos?page=${page - 1}`}
					data-sveltekit-reload
					class="px-4 py-2 text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
				>
					Previous
				</a>
			{/if}

			{#if page + 1 < Math.ceil(count / 10)}
				<a
					href={`/protected/todos?page=${page + 1}`}
					data-sveltekit-reload
					class="px-4 py-2 text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
				>
					Next
				</a>
			{/if}
		</div>
	{/if}
</div>
