# Git flow and CI/CD

```mermaid
gitGraph
  commit id: "master"
  branch uat
  branch prod
  checkout master
  branch feature/x
  commit id: "work"
  checkout uat
  merge feature/x id: "deploy UAT"
  checkout prod
  merge uat id: "deploy PROD (manual)"
  checkout master
  merge prod id: "release" tag: "v1.0.0"
```

| Branch | Created from | Merged into | Pipeline |
| --- | --- | --- | --- |
| `feature/<topic>` | `master` | `uat` (MR) | secret scan, lint, tests |
| `uat` | — | `prod` (MR) | + build images, **deploy UAT automatically** |
| `prod` | — | `master` (MR) | + build images, **deploy production (manual button)** |
| `master` | — | — | secret scan, lint, tests; tag releases here |

`master`, `uat` and `prod` are protected: nobody pushes directly, maintainers merge through merge requests, and a merge request needs a green pipeline.

## Day-to-day

1. `git switch master && git pull && git switch -c feature/my-change`
2. Push and open a merge request into `uat`. The pipeline runs scan, lint and tests.
3. Merge → UAT is deployed automatically to `https://uat.<domain>`.
4. When UAT is accepted, open a merge request `uat` → `prod`, merge, then press **deploy:production** in the pipeline.
5. Open a merge request `prod` → `master`, merge, and tag the release: `git tag v1.2.0 && git push origin v1.2.0`.

## Hotfix

1. `git switch -c feature/hotfix-<topic> prod`
2. Merge request into `prod`, merge, deploy production.
3. Merge `prod` → `master` and `prod` → `uat` (or cherry-pick) so the fix is not lost.

## Pipeline source

`.gitlab-ci.yml` only includes `templates/fullstack-compose.yml` from the `cicd-templates` project at a fixed tag. To change the pipeline, change the template project, tag a new version, then bump `ref` here in a feature branch.

Images go to this project's container registry as `backend` and `frontend`, tagged with the short commit SHA (what gets deployed) and the branch slug (build cache).
