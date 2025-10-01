# CodeSandbox Integration Guide

This document outlines how to ensure GitHub repository imports work seamlessly with CodeSandbox-style preview URLs (e.g., `https://<sandboxId>-3000.csb.app`).

## Overview

When users import GitHub repositories into GitUI, we automatically configure them to work with CodeSandbox's container environment and preview URL system.

## Implementation Checklist

### Step 1: Add sandbox.config.json to Repository Root

**File**: `sandbox.config.json`  
**Location**: Root of the user's repo (next to package.json)  
**Purpose**: Ensures CSB uses port 3000 and runs `npm run dev` by default

```json
{
  "container": {
    "port": 3000,
    "startScript": "dev"
  },
  "view": "browser"
}
```

- `container.port: 3000` ensures the container listens on port 3000 (so CSB's preview subdomain uses `-3000.csb.app`)
- `startScript: "dev"` means CSB will run `npm run dev` (or `yarn dev`) to start the project
- `view: "browser"` makes the browser window the primary view

### Step 2: Configure Dev Server for External Access

**Purpose**: Makes sure the server is reachable via the container's external interface

#### For Vite Projects

Update `vite.config.js` or `vite.config.ts`:

```javascript
import { defineConfig } from "vite";

export default defineConfig({
  server: {
    host: true,           // accepts 0.0.0.0
    port: Number(process.env.PORT) || 3000,
    strictPort: true      // fail if port 3000 is taken (so mapping stays consistent)
  }
});
```

- `host: true` lets the dev server accept connections from external addresses
- `strictPort: true` ensures it fails if 3000 is already in use instead of auto-incrementing

#### For Next.js Projects

Update the dev script in `package.json`:

```json
{
  "scripts": {
    "dev": "next dev -H 0.0.0.0 -p ${PORT:-3000}"
  }
}
```

Or use environment variable approach:

```json
{
  "scripts": {
    "dev": "PORT=${PORT:-3000} next dev -p ${PORT:-3000}"
  }
}
```

#### For Other Frameworks

Ensure your dev server:
1. Respects the `PORT` environment variable
2. Binds to `0.0.0.0` (not just `localhost`)
3. Uses port 3000 as default

### Step 3: Validation

After importing and running the sandbox:

1. ✅ The preview URL should be of the form `https://<id>-3000.csb.app`
2. ✅ The application should be accessible via the preview URL
3. ✅ Hot reload and development features should work normally

## Automatic Implementation

GitUI automatically:

1. **Detects project type** during import (Vite, Next.js, CRA, etc.)
2. **Adds sandbox.config.json** to the repository root
3. **Updates dev server configuration** based on project type
4. **Validates configuration** before completing the import

## Supported Project Types

- ✅ **Vite + React**: Auto-configures vite.config.js/ts
- ✅ **Next.js**: Updates package.json dev script
- ✅ **Create React App**: Works out of the box with PORT env var
- ✅ **Custom React**: Provides guidance for manual configuration

## Troubleshooting

### Preview URL shows different port
- Check that `sandbox.config.json` has `"port": 3000`
- Verify dev server is configured with `strictPort: true` (Vite) or equivalent

### Application not accessible
- Ensure dev server binds to `0.0.0.0` not `localhost`
- Check that PORT environment variable is respected

### Hot reload not working
- Verify WebSocket connections can reach the dev server
- Check that the dev server host configuration allows external connections

## Security Considerations

- The configuration only affects development environments
- Production builds are not impacted by these changes
- External host binding is safe in containerized environments

## CodeSandbox Compatibility

This configuration is compatible with:
- ✅ CodeSandbox VM Sandboxes
- ✅ CodeSandbox Container Sandboxes
- ✅ CodeSandbox's sandbox configuration schema

For newer CodeSandbox setups, verify that `sandbox.config.json` is still honored in your environment.
