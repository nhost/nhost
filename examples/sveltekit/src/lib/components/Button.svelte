<script>
	/** @type {("button" | "submit" | "reset" | null | undefined)} */
	export let type = 'button';
	export let disabled = false;
</script>

<button
	{disabled}
	{type}
	class="{disabled == true
		? 'bg-indigo-200 hover:bg-grey-700'
		: 'bg-indigo-600 hover:bg-indigo-700 focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'} inline-flex items-center px-4 py-2 border border-transparent text-base font-medium rounded-md shadow-sm text-white focus:outline-none"
>
	<slot />
</button>
