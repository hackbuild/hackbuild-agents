import { createRegistry } from "@hackbuild/tunables";
import { bindPanel } from "@hackbuild/tunables/dom";

// one master layer, one feature layer and one number with its range and source
const tune = createRegistry({ master: "L.organic", storage: localStorage, version: 1 });
tune.defineLayer("L.organic", "organic (off is the canned build)");
tune.defineLayer("L.plume", "sniffing in a turbulent plume");
tune.define({ key: "Se.fix", group: "senses", label: "fixation median", unit: "s", def: 0.83, min: 0.2, max: 2, step: 0.01, source: "measured" });
tune.restore();
tune.fromUrlHash(location.hash);

// a panel in a host with the hackbuild-ui hb-tunables class; the URL hash follows every change
const host = document.body.appendChild(document.createElement("div"));
host.className = "hb-tunables";
bindPanel(host, tune, { syncHash: true });

tune.onChange((key, value) => console.log(key, value, "layer on:", tune.layer("L.plume")));
tune.set("Se.fix", 5); // clamped to 2
