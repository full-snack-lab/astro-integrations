# @fullsnacklab/astro-flow

## 0.1.0

### Minor Changes

- Render function children through Astro's slot argument API in both factories and `.astro` wrappers. Preserve trusted HTML and slot rendering instructions without inspecting compiler expressions or treating raw slots as the high-level slot utility object.

- 73f6297: Add reusable `Iterate`, `Switch`, `Case`, and `When` control-flow factories and `.astro` component exports, including the `Astro`-prefixed aliases. Published components use the same public runtime entry point as the factories so consumers do not depend on unpublished source files or separate copies of switch state.
