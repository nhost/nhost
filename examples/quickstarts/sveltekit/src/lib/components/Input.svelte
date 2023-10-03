<script>
	export let value = '';

	/** @type {string} */
	export let id;

	/** @type {string} */
	export let label;

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
	<label for={id} class="block text-sm font-medium text-gray-700">
		{label}
	</label>
	<div class="mt-1">
		<input
			use:setType
			{name}
			{id}
			{required}
			bind:value
			bind:this={inputRef}
			class="block w-full p-3 border rounded-md border-slate-300 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
		/>
	</div>
</div>
