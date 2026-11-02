// Loads the built package and renders through it, so the bytes we ship are
// run on the engines floor. Run by CI and the publish gate under Node 20.19.
import { createEngine, sprigHash, sprigStrings } from "../dist/index.js";

const engine = createEngine({
  fromString: (s) => s,
  funcs: { ...sprigStrings(), ...sprigHash() },
});
const out = engine
  .parse("{{ .name | upper }} {{ sha256sum .name }}")
  .evaluate({ name: "ada" })
  .join("");
const want = "ADA fdee430d40bd57deeac186cd9790033d0f06f909a8806e7ce6e717ab7c7d5029";
if (out !== want) {
  console.error(`got  ${out}\nwant ${want}`);
  process.exit(1);
}
console.log(`${process.version}: ${out}`);
