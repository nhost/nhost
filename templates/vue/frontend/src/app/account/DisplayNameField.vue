<script setup lang="ts">
import { nextTick, ref, useId, useTemplateRef, watch } from 'vue';
import { updateDisplayName } from '@/app/account/actions';
import { useToast } from '@/components/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRefresh } from '@/components/useRefresh';
import { NETWORK_ERROR } from '@/lib/nhost/errors';

/** The display name as the profile shows it, editable in place. */
const props = defineProps<{ displayName: string }>();

const refresh = useRefresh();
const toast = useToast();
const nameId = useId();
const input = useTemplateRef<{ $el: HTMLInputElement }>('input');

const editing = ref(false);
const name = ref(props.displayName);
const error = ref<string>();
const isPending = ref(false);

watch(editing, async (isEditing) => {
  if (isEditing) {
    await nextTick();
    input.value?.$el.select();
  }
});

function stopEditing(): void {
  editing.value = false;
  error.value = undefined;
  // Back to what the page was given, so a cancelled edit leaves nothing
  // behind the next time this opens.
  name.value = props.displayName;
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && !isPending.value) {
    stopEditing();
  }
}

async function handleSubmit(): Promise<void> {
  error.value = undefined;
  isPending.value = true;
  try {
    const result = await updateDisplayName(name.value);
    if (result.error) {
      error.value = result.error;
      return;
    }

    editing.value = false;
    toast('Name saved');
    // The name shown here comes from the auth service, so the page is loaded
    // again rather than patched.
    refresh();
  } catch (err) {
    console.error('Error saving the display name:', err);
    error.value = NETWORK_ERROR;
  } finally {
    isPending.value = false;
  }
}
</script>

<template>
  <!-- Wraps rather than truncates: the name is what the card is for. -->
  <p
    v-if="!editing"
    class="min-w-0 font-semibold text-xl leading-tight [overflow-wrap:anywhere]"
  >
    {{ displayName }}
    <!-- Always shown rather than on hover: a phone has no hover, and a pencil
         is small enough not to crowd the name. -->
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label="Edit name"
      title="Edit name"
      class="-my-1 ml-1 size-7 align-middle text-muted-foreground hover:text-foreground"
      @click="editing = true"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="size-3.5"
      >
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
      </svg>
    </Button>
  </p>

  <form
    v-else
    class="flex flex-col gap-2"
    @submit.prevent="handleSubmit"
    @keydown="onKeydown"
  >
    <!-- The name is right here when the form is closed, so the label is for a
         screen reader rather than for the eye. -->
    <Label :for="nameId" class="sr-only">Display name</Label>
    <div class="flex items-center gap-2">
      <!-- h-8 to match the two small buttons beside it. -->
      <Input
        :id="nameId"
        ref="input"
        v-model="name"
        type="text"
        autocomplete="name"
        required
        :disabled="isPending"
        class="h-8 min-w-0 flex-1"
      />
      <Button type="submit" size="sm" :disabled="isPending">
        {{ isPending ? 'Saving…' : 'Save' }}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        :disabled="isPending"
        @click="stopEditing"
      >
        Cancel
      </Button>
    </div>

    <p v-if="error" role="alert" class="text-destructive text-sm">
      {{ error }}
    </p>
  </form>
</template>
