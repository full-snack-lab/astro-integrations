# @fullsnacklab/astro-flow

Declarative control flow components and async iteration primitives for Astro.

## Installation

```bash
bun add @fullsnacklab/astro-flow
```

## Usage

### Declarative Components

```astro
---
import { Iterate, Switch, Case, When } from "@fullsnacklab/astro-flow";
---

<Switch of={status}>
  <Case of="loading">Loading...</Case>
  <Case of="success">Loaded successfully!</Case>
  <Case default>Fallback state</Case>
</Switch>

<When ready={isReady} loggedIn={isLoggedIn}>
  <p>Welcome!</p>
  <Fragment slot="else">
    <p>Please log in.</p>
  </Fragment>
</When>

<Iterate of={items}>
  {(item, index) => <li>{index}: {item}</li>}
</Iterate>
```

Function children receive `(value, index)` for iterables and `(value, key)` for records. Async sources and async function children render sequentially. Missing sources or default slots render nothing.

The factories bind raw Astro slots through their render context. They must not be invoked with mock objects that pretend raw slots already have `Astro.slots.render()` or `has()`. Source component wrappers share `renderIteration(source, Astro.slots)`, which uses the documented slot argument API rather than inspecting compiler expressions.

Astro owns escaping and child rendering. Already-marked slot strings retain their rendering instructions. The exported `HTMLString` preserves its legacy string tag and Astro's native trusted-HTML marker; only construct it from trusted HTML, never raw user input.

### Async Iteration Utilities

```ts
import { iterate, isIterable, HTMLString } from "@fullsnacklab/astro-flow";

if (isIterable(data)) {
  for await (const val of iterate(data, (x) => x * 2)) {
    console.log(val);
  }
}
```
