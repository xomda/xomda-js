# Security Policy

## Supported versions

xomda is in active development. Fixes are applied to the latest release on the `main` branch. Older versions are not
maintained.

## Reporting an issue

Please do **not** open a public GitHub issue for security-sensitive reports.

Instead, use GitHub's private reporting flow:

1. Go to the [Security tab](https://github.com/JorisAerts/modelman/security) of this repository.
2. Click **Report a vulnerability** and fill in the form.

Alternatively, email the maintainer at **3611758+JorisAerts@users.noreply.github.com** with:

- A description of the issue and its impact.
- Steps to reproduce, or a minimal proof of concept.
- The affected version or commit.

You can expect an initial response within **7 days**. We will keep you informed of progress towards a fix and
coordinate a disclosure date once a patch is ready.

## Scope

In-scope: the published `@xomda/*` packages and the application served by `pnpm start` from this repository.

Out of scope: third-party dependencies (please report those upstream), and example or demo code under `demo/`.

Thank you for helping keep xomda and its users safe.
