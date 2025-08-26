<script>
	export let value = '';

	/** @type {string} */
	export let id;

	/** @type {string | null} */
	export let label = null;

	export let type = 'text';

	/** @type {string} */
	export let name;

	export let required = false;

	export let inputRef = null;

	/** @param {HTMLInputElement} node */
	function setType(node) {
		node.type = type;
	}
</script>

<div class={$$props.class}>
	{#if label}
		<label for={id} class="block text-sm font-medium text-gray-700">
			{label}
		</label>
	{/if}
	
	<div class="mt-1">
		<input
			use:setType
			{id}
			{name}
			{required}
			bind:value
			bind:this={inputRef}
			class="block w-full p-3 border rounded-md border-slate-300 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
		/>
	</div>
</div>
