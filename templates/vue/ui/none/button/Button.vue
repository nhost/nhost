<script lang="ts">
import type { ClassValue } from 'clsx';
import {
  cloneVNode,
  computed,
  defineComponent,
  h,
  type PropType,
  type VNode,
} from 'vue';
import { type ButtonSize, type ButtonVariant, buttonVariants } from '.';

/**
 * A button, or whatever element `as` names.
 *
 * Written as a render function rather than a template because of `asChild`:
 * that branch does not render an element of its own, it takes the single child
 * it was given and merges the button's look onto it, which is what lets a
 * `RouterLink` keep being a link while looking like a button. `cloneVNode` is
 * what does the merging, and it already combines `class` and `style` and keeps
 * both sides' event handlers, so this stands in for the reka-ui `Primitive`
 * the shadcn-vue version delegates to.
 *
 * `inheritAttrs: false` because the attributes are applied by hand below; left
 * on, Vue would also put them on the rendered element and they would land
 * twice.
 */
export default defineComponent({
  name: 'Button',
  inheritAttrs: false,
  props: {
    as: {
      type: [String, Object] as PropType<string | object>,
      default: 'button',
    },
    asChild: { type: Boolean, default: false },
    variant: { type: String as PropType<ButtonVariant | null>, default: null },
    size: { type: String as PropType<ButtonSize | null>, default: null },
    // Anything `cn` accepts, which is what the shadcn-vue version takes as
    // `HTMLAttributes['class']`. Declared as the three runtime types rather
    // than left open, so Vue does not read a bound array or object as an
    // attribute to pass straight through.
    class: {
      type: [String, Array, Object] as PropType<ClassValue>,
      default: undefined,
    },
  },
  setup(props, { slots, attrs }) {
    const classes = computed(() =>
      buttonVariants({
        variant: props.variant,
        size: props.size,
        class: props.class,
      }),
    );

    return () => {
      const children = slots.default?.() ?? [];

      if (!props.asChild) {
        return h(
          props.as,
          { ...attrs, 'data-slot': 'button', class: classes.value },
          children,
        );
      }

      // A fragment, a comment or whitespace can come through as its own vnode,
      // so the element is picked out rather than assumed to be first.
      const child = children.find(
        (node: VNode) => typeof node.type !== 'symbol',
      );

      if (!child) {
        return null;
      }

      return cloneVNode(child, {
        ...attrs,
        'data-slot': 'button',
        class: classes.value,
      });
    };
  },
});
</script>
