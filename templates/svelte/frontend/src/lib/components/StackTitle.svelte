<!--
  @component
  The home page's title, with each mark centred over its own name and linking
  to its project.
-->
<script lang="ts">
  import NhostLogo from '#lib/components/NhostLogo.svelte';
  import SvelteLogo from '#lib/components/SvelteLogo.svelte';
  import { cn } from '#lib/utils.ts';

  const [backend, framework] = [
    { href: 'https://nhost.io', name: 'Nhost', Logo: NhostLogo },
    { href: 'https://svelte.dev', name: 'Svelte', Logo: SvelteLogo },
  ] as const;
</script>

{#snippet logoLink(logo: typeof backend | typeof framework, className: string)}
  <a
    href={logo.href}
    target="_blank"
    rel="noreferrer"
    class={cn(
      'justify-self-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring',
      className,
    )}
  >
    <logo.Logo class="size-16" />
    <span class="sr-only">{logo.name}</span>
  </a>
{/snippet}

<div
  class="grid w-fit grid-cols-[auto_auto_auto] items-end gap-x-3 gap-y-7"
>
  {@render logoLink(backend, 'col-start-1')}
  {@render logoLink(framework, 'col-start-3')}
  <h1
    class="col-span-3 row-start-2 grid grid-cols-subgrid font-semibold text-4xl tracking-tight"
  >
    <span>{backend.name}</span> <span>+</span> <span>{framework.name}</span>
  </h1>
</div>
