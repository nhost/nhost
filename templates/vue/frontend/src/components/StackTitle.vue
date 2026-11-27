<script setup lang="ts">
import NhostLogo from '@/components/NhostLogo.vue';
import VueLogo from '@/components/VueLogo.vue';
import { cn } from '@/lib/utils';

/**
 * The home page's title, with each mark centred over its own name and linking
 * to its project.
 */
const logos = [
  {
    href: 'https://nhost.io',
    name: 'Nhost',
    logo: NhostLogo,
    column: 'col-start-1',
  },
  {
    href: 'https://vuejs.org',
    name: 'Vue',
    logo: VueLogo,
    column: 'col-start-3',
  },
] as const;

const [backend, framework] = logos;
</script>

<template>
  <div class="grid w-fit grid-cols-[auto_auto_auto] items-end gap-x-3 gap-y-7">
    <a
      v-for="{ href, name, logo, column } in logos"
      :key="name"
      :href="href"
      target="_blank"
      rel="noreferrer"
      :class="
        cn(
          'justify-self-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring',
          column,
        )
      "
    >
      <component :is="logo" class="size-16" />
      <span class="sr-only">{{ name }}</span>
    </a>
    <!-- Spaced explicitly: grid lays the names out, but a screen reader and a
         copy read the text, and Vue drops the line breaks between them. -->
    <h1
      class="col-span-3 row-start-2 grid grid-cols-subgrid font-semibold text-4xl tracking-tight"
    >
      <span>{{ backend.name }}</span>{{ ' ' }}<span>+</span>{{ ' '
      }}<span>{{ framework.name }}</span>
    </h1>
  </div>
</template>
