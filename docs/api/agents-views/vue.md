# vue

## Variables

### AssociationsTable

```ts
const AssociationsTable: DefineComponent<ExtractPropTypes<{
  limit: {
     default: number;
     type: NumberConstructor;
  };
  state: {
     required: true;
     type: PropType<AssociationsState>;
  };
}>, () => VNode<RendererNode, RendererElement, {
[key: string]: any;
}>, {
}, {
}, {
}, ComponentOptionsMixin, ComponentOptionsMixin, "reset"[], "reset", PublicProps, ToResolvedProps<ExtractPropTypes<{
  limit: {
     default: number;
     type: NumberConstructor;
  };
  state: {
     required: true;
     type: PropType<AssociationsState>;
  };
}>, "reset"[]>, {
  limit: number;
}, {
}, {
}, {
}, string, ComponentProvideOptions, true, {
}, any>;
```

The cues by acts heat table with attention, the explanation and reset. Emits `reset`.

***

### DrivesBars

```ts
const DrivesBars: DefineComponent<ExtractPropTypes<{
  note: {
     default: undefined;
     type: StringConstructor;
  };
  state: {
     required: true;
     type: PropType<DrivesBarsState>;
  };
}>, () => VNode<RendererNode, RendererElement, {
[key: string]: any;
}>, {
}, {
}, {
}, ComponentOptionsMixin, ComponentOptionsMixin, {
}, string, PublicProps, ToResolvedProps<ExtractPropTypes<{
  note: {
     default: undefined;
     type: StringConstructor;
  };
  state: {
     required: true;
     type: PropType<DrivesBarsState>;
  };
}>, {
}>, {
  note: string;
}, {
}, {
}, {
}, string, ComponentProvideOptions, true, {
}, any>;
```

The behavior block, utility rows (current in pink) and drive rows.

***

### EyeInset

```ts
const EyeInset: DefineComponent<ExtractPropTypes<{
  draw: {
     required: true;
     type: PropType<(canvas, who) => string | void>;
  };
  height: {
     default: number;
     type: NumberConstructor;
  };
  selected: {
     default: undefined;
     type: StringConstructor;
  };
  who: {
     required: true;
     type: PropType<EyeWho[]>;
  };
  width: {
     default: number;
     type: NumberConstructor;
  };
}>, () => VNode<RendererNode, RendererElement, {
[key: string]: any;
}>, {
}, {
}, {
}, ComponentOptionsMixin, ComponentOptionsMixin, "update:selected"[], "update:selected", PublicProps, ToResolvedProps<ExtractPropTypes<{
  draw: {
     required: true;
     type: PropType<(canvas, who) => string | void>;
  };
  height: {
     default: number;
     type: NumberConstructor;
  };
  selected: {
     default: undefined;
     type: StringConstructor;
  };
  who: {
     required: true;
     type: PropType<EyeWho[]>;
  };
  width: {
     default: number;
     type: NumberConstructor;
  };
}>, "update:selected"[]>, {
  height: number;
  selected: string;
  width: number;
}, {
}, {
}, {
}, string, ComponentProvideOptions, true, {
}, any>;
```

The eye card. `draw` paints a frame of the selected who; call the exposed
`frame()` each frame (a template ref). v-model:who is the selected id.

***

### MapInset

```ts
const MapInset: DefineComponent<ExtractPropTypes<{
  map: {
     required: true;
     type: PropType<() => MapState>;
  };
  size: {
     default: number;
     type: NumberConstructor;
  };
}>, () => VNode<RendererNode, RendererElement, {
[key: string]: any;
}>, {
}, {
}, {
}, ComponentOptionsMixin, ComponentOptionsMixin, {
}, string, PublicProps, ToResolvedProps<ExtractPropTypes<{
  map: {
     required: true;
     type: PropType<() => MapState>;
  };
  size: {
     default: number;
     type: NumberConstructor;
  };
}>, {
}>, {
  size: number;
}, {
}, {
}, {
}, string, ComponentProvideOptions, true, {
}, any>;
```

The map card. `map` returns the map; call the exposed `frame()` to draw it (a template ref).

***

### PlanLog

```ts
const PlanLog: DefineComponent<ExtractPropTypes<{
  state: {
     required: true;
     type: PropType<PlanLogState>;
  };
  steps: {
     default: boolean;
     type: BooleanConstructor;
  };
}>, () => VNode<RendererNode, RendererElement, {
[key: string]: any;
}>, {
}, {
}, {
}, ComponentOptionsMixin, ComponentOptionsMixin, {
}, string, PublicProps, ToResolvedProps<ExtractPropTypes<{
  state: {
     required: true;
     type: PropType<PlanLogState>;
  };
  steps: {
     default: boolean;
     type: BooleanConstructor;
  };
}>, {
}>, {
  steps: boolean;
}, {
}, {
}, {
}, string, ComponentProvideOptions, true, {
}, any>;
```

The plan log: last plan, goals, thoughts and steps. `steps: false` leaves the step log out.

***

### StepLog

```ts
const StepLog: DefineComponent<ExtractPropTypes<{
  empty: {
     default: string;
     type: StringConstructor;
  };
  steps: {
     required: true;
     type: PropType<readonly StepLine[]>;
  };
}>, () => VNode<RendererNode, RendererElement, {
[key: string]: any;
}>, {
}, {
}, {
}, ComponentOptionsMixin, ComponentOptionsMixin, {
}, string, PublicProps, ToResolvedProps<ExtractPropTypes<{
  empty: {
     default: string;
     type: StringConstructor;
  };
  steps: {
     required: true;
     type: PropType<readonly StepLine[]>;
  };
}>, {
}>, {
  empty: string;
}, {
}, {
}, {
}, string, ComponentProvideOptions, true, {
}, any>;
```

The step log: one rack log row per tool call.
