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

### Async Iteration Utilities

```ts
import { iterate, isIterable, HTMLString } from "@fullsnacklab/astro-flow";

if (isIterable(data)) {
  for await (const val of iterate(data, (x) => x * 2)) {
    console.log(val);
  }
}
```
