// Entry for the single file IIFE build (dist/agents-views.iife.js): a script
// tag defines the three elements at once.
import { defineViews } from "./elements.js";

export * from "./index.js";
if (typeof customElements !== "undefined") defineViews();
