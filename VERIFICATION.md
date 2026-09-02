# Verification

The skill-first release has three verification layers. The default suite is safe, local, and repeatable. Live Vercel and GitHub checks are explicit because they depend on external identity or mutate a pull request temporarily.

## Release gate

Run before every release:

```bash
pnpm verify
```

It proves:

- the skill remains a thin delegation layer around version-matched `agent-browser` instructions;
- `format.mjs` remains the only shipped script;
- formatter and marker replacement invariants pass their unit tests;
- the installed browser can capture screenshots and a recording;
- those generated files can be formatted into image and video PR blocks;
- attachment paths exactly match the local references in the generated Markdown.

## Protected Vercel preview

Use this repository's own Preview deployment as the normal live fixture. One project is sufficient for the skill-first release because Vercel authentication mechanics belong to the bundled `protected-vercel-deployments` skill, not this skill.

```bash
VERCEL_PREVIEW_URL=https://example.vercel.app \
VERCEL_PROJECT=before-and-after \
VERCEL_SCOPE=vercel \
pnpm verify:vercel
```

The probe mints a short-lived development OIDC token with Vercel CLI, opens the protected Preview with the header prescribed by the installed `agent-browser` skill, captures a screenshot, and rejects a Vercel login page. It never prints or persists the token.

Do not create separate applications for SSO, Passport, static bypass secrets, production mappings, or cross-team Trusted Sources in this release. Those are upstream protection modes. Add dedicated projects only when this skill starts owning protection behavior or when an upstream regression cannot be reproduced with the same-project Preview fixture.

## GitHub attachments

The GitHub probe posts a disposable comment to an existing pull request, verifies that GitHub rewrote the local image references to attachment URLs, then deletes the comment.

```bash
VERIFY_GITHUB_MUTATION=1 PR_NUMBER=5 pnpm verify:github
```

Use a disposable test PR when possible. The script refuses to mutate GitHub without the explicit opt-in variable and always attempts cleanup.

## Coverage boundary

| Concern | Owner | Verification |
|---|---|---|
| Browser navigation, state, screenshots, recording | `agent-browser` | Local smoke against repository fixtures |
| Same-project protected Preview access | `agent-browser` protected-deployment skill | Opt-in Vercel smoke |
| Formatting and marker replacement | This skill | Unit tests |
| `gh --attach` rewriting | GitHub CLI and this skill's markup | Opt-in disposable PR comment |
| Video tables | Future release | Separate two-step live suite |
| Choosing persuasive evidence | Future release | Scenario-based agent evaluations |

The suite should test the integration seams this skill owns. It should not duplicate the full compatibility matrix of `agent-browser`, Vercel Deployment Protection, or GitHub CLI.
