<script lang="ts">
import type { ClassValue } from 'clsx';
import {
  Comment,
  cloneVNode,
  computed,
  defineComponent,
  Fragment,
  h,
  mergeProps,
  type PropType,
  type VNode,
} from 'vue';
import { type ButtonVariants, buttonVariants } from '.';

/**
 * A slot's vnodes with every fragment opened up. `<slot />` forwarded from a
 * wrapper component arrives as a fragment, and the element `asChild` is after
 * is inside it, not the fragment itself.
 */
function flatten(nodes: VNode[]): VNode[] {
  return nodes.flatMap((node) =>
    node.type === Fragment ? flatten(node.children as VNode[]) : [node],
  );
}

/**
 * A button, or whatever element `as` names.
 *
 * Written as a render function rather than a template because of `asChild`:
 * that branch does not render an element of its own, it takes the first child
 * it was given and merges the button's look onto it, which is what lets a
 * `RouterLink` keep being a link while looking like a button. This stands in
 * for the reka-ui `Primitive` the shadcn-vue version delegates to, and merges
 * the way it does: attributes passed to the button win over its own, the
 * child's props win over both, and `class`, `style` and event handlers combine
 * rather than replace.
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
    variant: {
      type: String as PropType<ButtonVariants['variant']>,
      default: null,
    },
    size: { type: String as PropType<ButtonVariants['size']>, default: null },
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
      const own = mergeProps(
        {
          'data-slot': 'button',
          'data-variant': props.variant,
          'data-size': props.size,
          class: classes.value,
        },
        attrs,
      );

      if (!props.asChild) {
        return h(props.as, own, slots.default?.());
      }

      const children = flatten(slots.default?.() ?? []);
      const index = children.findIndex((node) => node.type !== Comment);
      const child = children[index];

      if (!child) {
        return children;
      }

      // The child's `ref` stays on the vnode it came from: merged in here it
      // would be bound to this component instead of the one that set it.
      const { ref: _ref, ...childProps } = child.props ?? {};
      children[index] = cloneVNode(
        { ...child, props: {} },
        mergeProps(own, childProps),
      );

      return children.length === 1 ? children[0] : children;
    };
  },
});
</script>
