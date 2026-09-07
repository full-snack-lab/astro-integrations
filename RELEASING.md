# Releasing shared Astro packages

## Package boundaries

Publish each capability independently from this monorepo. Keep the repository root `private: true`; there is no umbrella npm package. Keep application authorization and route-selection policy in the consuming applications.

The initial M3 Changesets plan is:

| Package | Source version before versioning | Planned release |
| --- | --- | --- |
| `@fullsnacklab/astro-better-auth` | `0.1.0` | `0.2.0` |
| `@fullsnacklab/astro-security` | `0.1.0` | `0.2.0` |
| `@fullsnacklab/astro-flow` | `0.0.0` (unpublished) | `0.1.0` |
| `@fullsnacklab/astro-integration` | `0.0.0` (unpublished) | `0.1.0` |

The two new packages start at `0.0.0` solely so their minor Changesets produce the intended first `0.1.0` releases and changelogs. Do not publish the unversioned `0.0.0` manifests. Cloudflare, EmDash, and theme have no M3 changesets and should not receive new versions for this release.

## Versioning

Use Bun 1.4.0, matching the release workflow. Add a changeset for a consumer-visible change with `bun run changeset`. Inspect the pending release set with `bun run changeset status`.

`bun run version-packages` applies Changesets and refreshes `bun.lock` with `--lockfile-only --ignore-scripts`. This is version/lockfile preparation, not validation. Commit the resulting package versions, changelogs, and lockfile together. Do not hand-edit resolved lockfile entries or reuse sibling-checkout `node_modules` links to make consumers resolve unpublished exports.

## Verification gate

Release artifacts must be checked before publication. These procedures do not authorize agents to run tests, builds, codegen, packing, or publishing without the agreed verification budget.

- The workflow's select job runs the repository's existing tests, type checks, and build. Its separate pack job may build again through package lifecycle scripts.
- Package `prepack` scripts build packages; some `prepublishOnly` scripts also test and type-check. Even dry-run packing can execute lifecycle scripts.
- For source/lockfile preparation without lifecycle execution, use `bun install --ignore-scripts`, or add `--lockfile-only` when dependencies need not be installed.
- After an authorized build, inspect packed artifacts and exercise public exports from a clean temporary consumer. Check all runtime/declaration exports and all flow `.astro` exports. The `.astro` wrappers must use the packed public runtime, not excluded source helpers, and share the factory runtime's switch state.
- Retain provenance in package manifests. If a local first publication requires disabling provenance outside CI, do so only for that explicitly authorized bootstrap command, not as a permanent manifest change.

## GitHub Actions and npm

The pinned Changesets v2 workflow lives at `.github/workflows/release.yml`. It runs only for main, including manual dispatches. Its version job uses `bun run version-packages` so the version PR also carries the Bun lockfile update.

Enable **Allow GitHub Actions to create and approve pull requests** for this repository so the version job can create its PR. Keep default workflow permissions read-only. The workflow grants write access only to the version job; the publish job has `id-token: write` and does not create GitHub releases or push tags.

For each package being released, configure or verify its npm trusted publisher:

| Field | Value |
| --- | --- |
| Provider | GitHub Actions |
| Organization | `full-snack-lab` |
| Repository | `astro-integrations` |
| Workflow filename | `release.yml` |
| Environment | Blank; the current workflow declares none |
| Allowed actions | Allow `npm publish` for this direct-publication workflow |

The publisher uses GitHub-hosted runners and Node 24.20.0. The pinned Changesets publish action defaults to the GitHub-provided token for GitHub operations; npm authorization is via OIDC, not a stored npm publishing token. Check the publisher's runtime compatibility when upgrading Actions or Changesets.

For the two new package names, plan an authenticated first publication of the versioned, verified artifacts, then configure their npm trusted publishers. A maintainer may need to complete interactive login/2FA. Do not create placeholder packages or record credentials in source. npm staged publishing requires an existing package and cannot bootstrap these new names.

Do not activate the mainline workflow until the agreed CI verification budget and publisher setup are ready. Do not update the applications to unreleased auth/security versions and claim a clean installation works; their normal dependency and lockfile reconciliation follows successful publication.

References: [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/), [npm staged publishing](https://docs.npmjs.com/staged-publishing/), and [Changesets action](https://github.com/changesets/action/tree/8488615a623b1b9c987934bb89eae8af6a946ac1).
