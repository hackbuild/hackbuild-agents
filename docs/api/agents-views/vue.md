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
