// The Vue components: each mounts the vanilla view on its root element and
// follows its props, so the Vue and plain HTML forms draw the same markup.
import { defineComponent, h, onBeforeUnmount, onMounted, type PropType, ref, watch } from "vue";
import { type AssociationsHandle, type AssociationsState, associationsTable } from "./associations-table.js";
import { type DrivesBarsHandle, type DrivesBarsState, drivesBars } from "./drives-bars.js";
import { type EyeInsetHandle, type EyeWho, eyeInset } from "./eye-inset.js";

/** The behavior block, utility rows (current in pink) and drive rows. */
export const DrivesBars = defineComponent({
  name: "DrivesBars",
  props: {
    state: { type: Object as PropType<DrivesBarsState>, required: true },
    note: { type: String, default: undefined },
  },
  setup(props) {
    const root = ref<HTMLElement | null>(null);
    let view: DrivesBarsHandle | null = null;
    onMounted(() => {
      view = drivesBars(root.value as HTMLElement, props.note ? { note: props.note } : {});
      view.update(props.state);
    });
    watch(() => props.state, (s) => view?.update(s), { deep: true });
    onBeforeUnmount(() => view?.dispose());
    return () => h("div", { ref: root });
  },
});

/** The cues by acts heat table with attention, the explanation and reset. Emits `reset`. */
export const AssociationsTable = defineComponent({
  name: "AssociationsTable",
  props: {
    state: { type: Object as PropType<AssociationsState>, required: true },
    limit: { type: Number, default: 16 },
  },
  emits: ["reset"],
  setup(props, { emit }) {
    const root = ref<HTMLElement | null>(null);
    let view: AssociationsHandle | null = null;
    onMounted(() => {
      view = associationsTable(root.value as HTMLElement, { onReset: () => emit("reset"), limit: props.limit });
      view.update(props.state);
    });
    watch(() => props.state, (s) => view?.update(s), { deep: true });
    onBeforeUnmount(() => view?.dispose());
    return () => h("div", { ref: root });
  },
});

/**
 * The eye card. `draw` paints a frame of the selected who; call the exposed
 * `frame()` each frame (a template ref). v-model:who is the selected id.
 */
export const EyeInset = defineComponent({
  name: "EyeInset",
  props: {
    who: { type: Array as PropType<EyeWho[]>, required: true },
    draw: { type: Function as PropType<(canvas: HTMLCanvasElement, who: EyeWho) => string | void>, required: true },
    selected: { type: String, default: undefined },
    width: { type: Number, default: 320 },
    height: { type: Number, default: 160 },
  },
  emits: ["update:selected"],
  setup(props, { emit, expose }) {
    const root = ref<HTMLElement | null>(null);
    let view: EyeInsetHandle | null = null;
    onMounted(() => {
      view = eyeInset(root.value as HTMLElement, {
        who: props.who,
        draw: (c, w) => props.draw(c, w),
        width: props.width,
        height: props.height,
        ...(props.selected ? { selected: props.selected } : {}),
        onWho: (id) => emit("update:selected", id),
      });
    });
    watch(() => props.selected, (id) => id && view?.select(id));
    onBeforeUnmount(() => view?.dispose());
    expose({
      frame: () => view?.frame(),
      mode: (t: string) => view?.mode(t),
      canvas: () => view?.canvas ?? null,
    });
    return () => h("figure", { ref: root, style: "margin:0" });
  },
});
