# getting started

The packages under @hackbuild in this repository give a simulated animal, and the people round it, what they need to act in a browser sim: senses, drives and choice, movement, cameras, tuning, views of the brain and a way to replay a run. Each one does one job, installs from npm on its own, and ships its types. None of them loads a model, an asset or a weight file.

## install

Install the packages you use. A creature that chooses what to do and walks there needs two:

```sh
npm install @hackbuild/drives @hackbuild/mover
```

Every package is ESM only and MIT. three is an optional peer of @hackbuild/senses and @hackbuild/cameras, vue and @virgilvox/hackbuild-ui are peers of @hackbuild/agents-views, and puppeteer-core is a peer of @hackbuild/scenario. Each package README lists its peers and the versions it takes.

## your first program

This program runs a dog for thirty seconds of sim time. Its hunger and its wish to play grow, the chooser picks the act that would lower them most and says why, and the steerer walks the dog to where that act happens. It runs in Node or in a page, with no download.

<!-- example: examples/docs/first.ts -->

The code is [examples/docs/first.ts](../examples/docs/first.ts) in the repository. Every package README starts with a quick start like it, of 10 to 20 lines, taken from `examples/<package>/quick.ts` in the repository and typechecked in CI.

## where to go next

- [concepts](concepts.md): the ideas every package shares, read once.
- The examples: the demo pages of this site, each one a package at work with its source linked. The [dog simulator](https://hackbuild.github.io/dog-simulator/) runs senses, drives, cameras and tunables together.
- A package page: its README, then its API reference, generated from the TSDoc in the code.
- For a coding agent: [llms.txt](https://hackbuild.github.io/hackbuild-agents/llms.txt) lists every package's `llms.md`, a single file with its exports, examples and the mistakes to avoid.

## packages

<!-- packages -->
