<script setup lang="ts">
import { computed, ref, useId } from 'vue';
import DialogClose from '@/components/DialogClose.vue';
import DialogFooter from '@/components/DialogFooter.vue';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/** The answers to a dialog that asks before it acts. */
const props = withDefaults(
  defineProps<{
    confirm: string;
    pending: string;
    cancel?: string;
    destructive?: boolean;
    typeToConfirm?: string;
    /** Resolves to an error to show, or to nothing once it has acted. */
    onConfirm: () => Promise<string | undefined>;
  }>(),
  { cancel: 'Cancel', destructive: false },
);

const typedId = useId();
const typed = ref('');
const error = ref<string>();
const isPending = ref(false);

const confirmed = computed(
  () => !props.typeToConfirm || typed.value.trim() === props.typeToConfirm,
);

async function handleSubmit(): Promise<void> {
  if (!confirmed.value) {
    return;
  }

  error.value = undefined;
  isPending.value = true;
  try {
    error.value = await props.onConfirm();
  } finally {
    isPending.value = false;
  }
}
</script>

<template>
  <form class="flex flex-col gap-5" @submit.prevent="handleSubmit">
    <div v-if="typeToConfirm" class="flex flex-col gap-2">
      <!-- One span, so the label's flex gap does not space out the word. -->
      <Label :for="typedId" class="font-normal">
        <span>
          Type <span class="font-semibold">{{ typeToConfirm }}</span> to confirm
        </span>
      </Label>
      <Input
        :id="typedId"
        v-model="typed"
        autocomplete="off"
        :disabled="isPending"
      />
    </div>

    <p v-if="error" role="alert" class="text-destructive text-sm">
      {{ error }}
    </p>

    <DialogFooter>
      <DialogClose :disabled="isPending">{{ cancel }}</DialogClose>
      <Button
        type="submit"
        size="sm"
        :variant="destructive ? 'destructive' : 'default'"
        :disabled="isPending || !confirmed"
      >
        {{ isPending ? pending : confirm }}
      </Button>
    </DialogFooter>
  </form>
</template>
