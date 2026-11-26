// The custom elements, for a plain HTML page as the originals are. Classes
// are made inside defineViews, so importing this module touches no DOM.
import { type AssociationsHandle, type AssociationsState, associationsTable } from "./associations-table.js";
import { type DrivesBarsHandle, type DrivesBarsState, drivesBars } from "./drives-bars.js";
import { type EyeInsetHandle, type EyeInsetOptions, eyeInset } from "./eye-inset.js";

/** The tag names `defineViews` registers. */
export const ELEMENT_NAMES = { drivesBars: "hb-drives-bars", associationsTable: "hb-associations-table", eyeInset: "hb-eye-inset" } as const;

/** `<hb-drives-bars>`: set `.state` to a DrivesBarsState. */
export interface DrivesBarsElement extends HTMLElement {
  state: DrivesBarsState | null;
}
/** `<hb-associations-table>`: set `.state`; fires `reset` when reset learning is pressed. */
export interface AssociationsTableElement extends HTMLElement {
  state: AssociationsState | null;
}
/** `<hb-eye-inset>`: set `.options` (who and draw), then call `frame()` each frame; fires `who` with the id in `detail`. */
export interface EyeInsetElement extends HTMLElement {
  options: EyeInsetOptions | null;
  readonly view: EyeInsetHandle | null;
  frame(): void;
  mode(text: string): void;
}

/** Defines the three elements once; safe to call again. */
export function defineViews(registry: CustomElementRegistry = customElements): void {
  if (!registry.get(ELEMENT_NAMES.drivesBars)) {
    registry.define(
      ELEMENT_NAMES.drivesBars,
      class extends HTMLElement implements DrivesBarsElement {
        #view: DrivesBarsHandle | null = null;
        #state: DrivesBarsState | null = null;
        get state() {
          return this.#state;
        }
        set state(s) {
          this.#state = s;
          if (s) this.#view?.update(s);
        }
        connectedCallback() {
          const note = this.getAttribute("note");
          this.#view ??= drivesBars(this, note ? { note } : {});
          if (this.#state) this.#view.update(this.#state);
        }
      },
    );
  }
  if (!registry.get(ELEMENT_NAMES.associationsTable)) {
    registry.define(
      ELEMENT_NAMES.associationsTable,
      class extends HTMLElement implements AssociationsTableElement {
        #view: AssociationsHandle | null = null;
        #state: AssociationsState | null = null;
        get state() {
          return this.#state;
        }
        set state(s) {
          this.#state = s;
          if (s) this.#view?.update(s);
        }
        connectedCallback() {
          this.#view ??= associationsTable(this, { onReset: () => this.dispatchEvent(new CustomEvent("reset", { bubbles: true })) });
          if (this.#state) this.#view.update(this.#state);
        }
      },
    );
  }
  if (!registry.get(ELEMENT_NAMES.eyeInset)) {
    registry.define(
      ELEMENT_NAMES.eyeInset,
      class extends HTMLElement implements EyeInsetElement {
        #view: EyeInsetHandle | null = null;
        #options: EyeInsetOptions | null = null;
        get options() {
          return this.#options;
        }
        set options(o) {
          this.#options = o;
          this.#mount();
        }
        get view() {
          return this.#view;
        }
        connectedCallback() {
          this.#mount();
        }
        #mount() {
          if (!this.#options || !this.isConnected) return;
          this.#view?.dispose();
          const o = this.#options;
          this.#view = eyeInset(this, {
            ...o,
            onWho: (id) => {
              o.onWho?.(id);
              this.dispatchEvent(new CustomEvent("who", { detail: id, bubbles: true }));
            },
          });
        }
        frame() {
          this.#view?.frame();
        }
        mode(text: string) {
          this.#view?.mode(text);
        }
      },
    );
  }
}
