# Mojing open artifacts

This source workspace contains exactly the eight Mojing artifacts authorized by Decision 19 for public GitHub source publication. It excludes the private Mojing application and control plane, `@mojing/contracts`, credentials, authoritative data, and ComfyUI components.

The packages remain `private: true` because npm registry publication is not authorized. This export targets `https://github.com/brotecher/brotech` from the clean source commit recorded in `PUBLICATION.json`. Independent third-party validation is still required before scenarios 33 and 35 can pass.

## Verify

```sh
pnpm install --ignore-scripts
pnpm run build
pnpm test
pnpm run typecheck
```
