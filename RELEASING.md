# Releasing shared Astro packages

## Package boundaries

Publish each capability independently from this monorepo. Keep the repository root and playground `private: true`; there is no umbrella npm package. The playground participates in workspace installation for fixture verification, not publication. Keep application authorization and route-selection policy in the consuming applications.

The coordinated release completed on 2026-09-07:

| Package | Published version | Publication path |
| --- | --- | --- |
| `@fullsnacklab/astro-better-auth` | `0.2.0` | GitHub trusted publisher with provenance |
| `@fullsnacklab/astro-security` | `0.2.0` | GitHub trusted publisher with provenance |
| `@fullsnacklab/astro-flow` | `0.1.0` | Approved first-publication bootstrap |
| `@fullsnacklab/astro-integration` | `0.1.0` | Approved first-publication bootstrap |

These versions are immutable and must not be republished. Cloudflare, EmDash, and theme did not receive new versions. Future releases follow Changesets rather than treating this historical table as a pending plan.

## Versioning

Use Bun 1.4.0, matching the release workflow. Add a changeset for a consumer-visible change with `bun run changeset`. Inspect the pending release set with `bun run changeset status`.

`bun run version-packages` applies Changesets, then uses `bun update --lockfile-only --ignore-scripts` with the explicit seven local package names to refresh workspace versions. Bun 1.4.0's plain `bun install --lockfile-only` can retain stale workspace versions after a version-only change ([upstream issue](https://github.com/oven-sh/bun/issues/18906)). Use explicit package names instead of a wildcard. The private root lists these packages as `workspace:*` development dependencies so the targeted update operates on existing local dependencies rather than adding packages or upgrading external registry dependencies. Add future shared packages to both this tooling dependency list and the version command; do not substitute registry-resolved dependencies or a blanket `bun update`.

Version PRs are maintainer-created. When pending changesets exist, create a release branch from main, run `bun run version-packages`, review the exact release set, and open a PR against main using the maintainer's GitHub account. Actions does not create or approve that PR. The published release's changesets have already been consumed; do not apply them again. `changeset version` is not an idempotent verification command.

This is version/lockfile preparation, not validation. Commit the resulting package versions, changelogs, and lockfile together. Do not hand-edit resolved lockfile entries or reuse sibling-checkout `node_modules` links to make consumers resolve unpublished exports. Ordinary intra-monorepo workspace links are separate from the historical cross-repository sandbox links.

## Bootstrap checkpoint

The verified `@fullsnacklab/astro-flow@0.1.0` and `@fullsnacklab/astro-integration@0.1.0` tarballs have been published and their public registry SHA-512 integrities confirmed. Flow includes the Jonathan Neal / astro-community attribution correction; only README/LICENSE changed from its runtime-verified candidate. Do not repeat these bootstrap commands or try to replace either immutable version.

The approved local bootstrap skipped scripts and disabled provenance only for those two commands; package manifests still enable provenance. Initial registry 404s cleared after propagation and did not require another publication attempt.

Trusted publishers are now configured for all four packages. Auth/security `0.2.0` were published by [release run 34129127784](https://github.com/full-snack-lab/astro-integrations/actions/runs/34129127784), with registry integrities and provenance statements matching the CI artifacts and source commit. Bootstrap and publisher setup are complete, not outstanding actions.

## Verification gate

Release artifacts must be checked before publication. These procedures do not authorize agents to run tests, builds, codegen, packing, or publishing without the agreed verification budget.

- The workflow installs all workspaces, including the private playground, and builds library exports before running fixture tests and type checks. Its separate pack job may build again through package lifecycle scripts.
- Package `prepack` scripts build packages; some `prepublishOnly` scripts also test and type-check. Even dry-run packing can execute lifecycle scripts.
- For source/lockfile preparation without lifecycle execution, use `bun install --ignore-scripts`, or add `--lockfile-only` when dependencies need not be installed.
- After an authorized build, inspect packed artifacts and exercise public exports from a clean temporary consumer. Check all runtime/declaration exports and all flow `.astro` exports. The `.astro` wrappers must use the packed public runtime, not excluded source helpers, and share the factory runtime's switch state.
- Retain provenance in package manifests. If a local first publication requires disabling provenance outside CI, do so only for that explicitly authorized bootstrap command, not as a permanent manifest change.

## GitHub Actions and npm

The pinned Changesets v2 workflow lives at `.github/workflows/release.yml`. It runs only for main, including manual dispatches. If Changesets selects `version`, the select job writes maintainer instructions to its summary and the pack/publish jobs are skipped. Once a maintainer merges prepared versions and Changesets selects `publish`, those jobs can run.

Keep organization permissions unchanged: the organization prohibits Actions-created or approved PRs. The workflow requests no repository-content or PR write permissions. Keep default workflow permissions read-only; the publish job alone has `id-token: write` and does not create GitHub releases or push tags.

For each package being released, configure or verify its npm trusted publisher:

| Field | Value |
| --- | --- |
| Provider | GitHub Actions |
| Organization | `full-snack-lab` |
| Repository | `astro-integrations` |
| Workflow filename | `release.yml` |
| Environment | Blank; the current workflow declares none |
| Allowed actions | Allow `npm publish` for this direct-publication workflow |

The publisher uses GitHub-hosted runners and Node 24.20.0. The pinned Changesets publish action runs on Node 24 and invokes the installed Changesets CLI with `node`. The locked CLI `3.0.2` selects its npm publisher for a Bun workspace and executes `npm publish`; this workflow does not depend on Bun's publishing/OIDC support. The action defaults to the GitHub-provided token for GitHub operations; npm authorization is via OIDC, not a stored npm publishing token. Check the publisher's runtime compatibility when upgrading Actions or Changesets.

For a genuinely new package name only, use an explicitly authorized authenticated first publication of its versioned, verified tarball, then configure its npm trusted publisher. Publish the existing tarball with `npm publish /absolute/path/to/package.tgz --access public --ignore-scripts --provenance=false` only for that approved local bootstrap. Do not rebuild or repack it, permanently disable manifest provenance, or substitute an unverified artifact. A maintainer may need to complete interactive login/2FA; keep credentials and OTPs out of source and conversation. npm staged publishing requires an existing package and cannot bootstrap a new name.

Before bootstrap, recheck the package/version's registry availability and match the tarball's integrity to the approved evidence. Stop on authentication failures or unexpected existing versions rather than retrying, changing access policy, or selecting an unapproved version. Existing auth/security packages remain on the intended OIDC/provenance publication path.

Pushes to main activate the workflow, so respect the agreed CI verification budget before pushing. Consumer dependency and lockfile reconciliation follows successful publication; do not claim unreleased exports work through normal registry installation.

References: [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/), [npm staged publishing](https://docs.npmjs.com/staged-publishing/), [pinned Changesets action](https://github.com/changesets/action/tree/8488615a623b1b9c987934bb89eae8af6a946ac1), and [CLI 3.0.2 publisher selection](https://github.com/changesets/changesets/blob/%40changesets/cli%403.0.2/packages/cli/src/commands/publish/getPublishTool.ts).
