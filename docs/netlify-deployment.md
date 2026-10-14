# Deploy the demo on Netlify

The live playground is at [uinotate.netlify.app](https://uinotate.netlify.app/examples/). The [minimal integration](https://uinotate.netlify.app/examples/minimal.html) uses an application callback and CSS overrides.

The deployment serves the examples and the two widget files over HTTPS. Netlify Functions provide `/api/demo-session` and `/api/feedback`, so feedback and PNG annotations exercise a real HTTP request. The service validates and acknowledges submissions, then discards them. It does not maintain a feedback inbox or store screenshots.

## Deploy your own copy with the button

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/skitsanos/uinotate&fullConfiguration=true)

1. Select the button, sign in to Netlify, and follow the prompts to copy the repository into your Git provider account and create your own site.
2. Generate a signing secret on your computer with `openssl rand -hex 32`, then paste the result into the required `UINOTATE_DEMO_SIGNING_SECRET` field. Use a unique value for your site and keep it out of repository files and shared URLs.
3. Deploy using the build settings supplied by `netlify.toml`. Open the resulting site to try feedback and screenshot annotations.

The `[template.environment]` entry declares a required setup field, following [Netlify's template configuration](https://docs.netlify.com/deploy/create-deploys/#file-based-template-configuration); its text is a field label, not a default secret. This setup does not copy the original site's credentials. The new demo also acknowledges and discards submissions.

## What gets deployed

`bun run build:site` rebuilds `lib.js` and copies an explicit list of eight public files into `dist/`. Project source, tests, dependencies, signing configuration, and function source remain outside that directory. Unexpected files or symlinks in `dist/` stop the build rather than being published or removed. During a Netlify cloud build, the script removes only the generated `dist/netlify.toml` that Netlify caches after a previous build; this makes repeated deployments work without including the resolved configuration in the public files.

`netlify.toml` defines the build, publish directory, function directory, root redirect, cache behavior, and browser security headers. The minimal example uses external JavaScript so `script-src 'self'` can be used. Inline styles and `data:` images are allowed for the widget's style configuration and DOM screenshot renderer.

Function files define custom routes and [Netlify rate limits](https://docs.netlify.com/manage/security/secure-access-to-sites/rate-limiting/): 10 session requests and 30 feedback requests per 60 seconds, grouped by IP and domain. These limits are enforced by Netlify, with asynchronous counting; the local emulator does not reproduce production enforcement.

## Run the Netlify runtime locally

Install Bun, Node.js, and the [Netlify CLI](https://docs.netlify.com/api-and-cli-guides/cli-guides/get-started-with-cli/), then run:

```sh
bun install --frozen-lockfile
bun run dev:netlify
```

Open `http://localhost:8888/examples/`. This serves the prepared static files through Netlify Dev, including redirects, headers, and functions. The development launcher supplies a temporary signing secret in the child process environment and runs offline; it does not read or modify the deployed secret.

The simpler `bun run dev` server remains available at `http://127.0.0.1:4173/examples/`. It uses the same request validation and session signing code, with a temporary key generated at startup.

## Initial setup for your own Netlify site

```sh
netlify login
netlify sites:create --name your-uinotate-demo --account-slug your-team
bun run netlify:secret
```

`netlify:secret` creates a random signing key and sets `UINOTATE_DEMO_SIGNING_SECRET` in production, deploy-preview, and branch-deploy contexts as a Netlify secret. It never prints the value or saves it in source files. Run this during initial site setup. Running it again replaces the key; redeploy afterward, and previously issued sessions will need to refresh.

Functions fail with `503` if the secret is missing or shorter than 32 characters. Configure it through Netlify's environment variable service, rather than `netlify.toml`: configuration-file environment variables are [not available to functions at runtime](https://docs.netlify.com/build/functions/environment-variables/).

For Git-based deployments, connect your fork through `netlify init` or Netlify's Git integration. Select `main` and use these settings:

| Setting | Value |
| --- | --- |
| Build command | `bun install --frozen-lockfile && bun run build:site` |
| Publish directory | `dist` |
| Functions directory | `netlify/functions` |

The configuration file supplies these values. Keep the `.netlify/` local site link and any `.env` files out of Git. Node and Bun build versions are declared in `netlify.toml`. This repository is connected to the `uinotate` site: pushes to `main` trigger production builds through a repository webhook and a read-only deploy key.

## Deploy from the CLI

```sh
bun run test
bun run check
netlify build --context production
netlify deploy --prod --context production --no-build --dir dist --functions netlify/functions
```

Use `netlify deploy --context deploy-preview` for a draft deployment. The browser token is bound to the origin that issued it, so a preview session cannot be reused on the production origin.

## Verify the deployed site

```sh
bun run smoke:site -- https://your-uinotate-demo.netlify.app
```

The smoke script checks public assets and headers, blocked source files, signed sessions, invalid Bearer rejection, successful feedback and PNG annotations, and the simulated failure path. It sends synthetic demo feedback and prints no token or payload. Also verify Quick feedback, Annotate, screenshot preview/retake/omission, and mobile layouts in a browser; HTTP tests alone do not prove the rendered experience.

## Use the same pattern for a production application

This demo's sessions are anonymous and publicly obtainable. Their signatures and expiry demonstrate Bearer transport; they do not identify a user or authorize access to private application data. Replace `/api/demo-session` with your application's authentication and authorization rules when protecting a real service.

In `netlify/lib/demo-api.js`, the successful handler returns `{ accepted: true, stored: false }`. Replace that acknowledgment with your chosen storage service and define who can read the resulting feedback. Keep PNG/body limits, validate submitted context, and avoid logging message or screenshot bodies. Hosting providers can still retain operational request metadata.

Production applications can host their own copies of `lib.js` and `uinotate.css` and configure `apiUrl` to their feedback function. If the API is hosted on a different origin, configure CORS for the embedding app as described in the main README. The demo service intentionally accepts only same-origin browser requests.
