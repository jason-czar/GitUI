/**
 * CodeSandbox Configuration Utilities
 *
 * Utilities for automatically configuring imported GitHub repositories
 * to work seamlessly with CodeSandbox preview URLs.
 */

export interface SandboxConfig {
    container: {
        port: number;
        startScript: string;
    };
    view: string;
}

export interface ProjectType {
    type: 'vite' | 'nextjs' | 'cra' | 'custom';
    hasTypeScript: boolean;
    configFile?: string;
}

/**
 * Generate sandbox.config.json content
 */
export function generateSandboxConfig(): SandboxConfig {
    return {
        container: {
            port: 3000,
            startScript: 'dev',
        },
        view: 'browser',
    };
}

/**
 * Generate Vite configuration for CodeSandbox compatibility
 */
export function generateViteConfig(hasTypeScript: boolean): string {
    const extension = hasTypeScript ? 'ts' : 'js';

    return `import { defineConfig } from "vite";

export default defineConfig({
  server: {
    host: true,           // accepts 0.0.0.0
    port: Number(process.env.PORT) || 3000,
    strictPort: true      // fail if port 3000 is taken (so mapping stays consistent)
  }
});`;
}

/**
 * Generate Next.js dev script for CodeSandbox compatibility
 */
export function generateNextJsDevScript(): string {
    return 'next dev -H 0.0.0.0 -p ${PORT:-3000}';
}

/**
 * Detect project type from package.json
 */
export function detectProjectType(packageJson: any): ProjectType {
    const dependencies = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
    };

    const hasTypeScript = !!(
        dependencies.typescript ||
        dependencies['@types/react'] ||
        dependencies['@types/node']
    );

    // Check for Vite
    if (dependencies.vite) {
        return {
            type: 'vite',
            hasTypeScript,
            configFile: hasTypeScript ? 'vite.config.ts' : 'vite.config.js',
        };
    }

    // Check for Next.js
    if (dependencies.next) {
        return {
            type: 'nextjs',
            hasTypeScript,
        };
    }

    // Check for Create React App
    if (dependencies['react-scripts']) {
        return {
            type: 'cra',
            hasTypeScript,
        };
    }

    // Default to custom React project
    return {
        type: 'custom',
        hasTypeScript,
    };
}

/**
 * Generate configuration files for a project
 */
export function generateConfigFiles(projectType: ProjectType, packageJson: any) {
    const files: Record<string, string> = {};

    // Always add sandbox.config.json
    files['sandbox.config.json'] = JSON.stringify(generateSandboxConfig(), null, 2);

    switch (projectType.type) {
        case 'vite':
            if (projectType.configFile) {
                files[projectType.configFile] = generateViteConfig(projectType.hasTypeScript);
            }
            break;

        case 'nextjs':
            // Update package.json dev script
            const updatedPackageJson = {
                ...packageJson,
                scripts: {
                    ...packageJson.scripts,
                    dev: generateNextJsDevScript(),
                },
            };
            files['package.json'] = JSON.stringify(updatedPackageJson, null, 2);
            break;

        case 'cra':
            // CRA works out of the box with PORT env var
            break;

        case 'custom':
            // Provide guidance in a README
            files['CODESANDBOX_SETUP.md'] = `# CodeSandbox Setup

This project has been configured for CodeSandbox compatibility.

## Manual Configuration Required

Since this is a custom React project, you may need to manually configure your dev server:

1. Ensure your dev server respects the PORT environment variable
2. Configure your dev server to bind to 0.0.0.0 (not just localhost)
3. Use port 3000 as the default

Example for Express:
\`\`\`javascript
const port = process.env.PORT || 3000;
app.listen(port, '0.0.0.0', () => {
  console.log(\`Server running on port \${port}\`);
});
\`\`\`

The sandbox.config.json file has been added to ensure CodeSandbox uses the correct port and start script.
`;
            break;
    }

    return files;
}

/**
 * Validate that a project is properly configured for CodeSandbox
 */
export function validateCodeSandboxConfig(files: Record<string, string>): {
    isValid: boolean;
    issues: string[];
    suggestions: string[];
} {
    const issues: string[] = [];
    const suggestions: string[] = [];

    // Check for sandbox.config.json
    if (!files['sandbox.config.json']) {
        issues.push('Missing sandbox.config.json file');
    } else {
        try {
            const config = JSON.parse(files['sandbox.config.json']);
            if (config.container?.port !== 3000) {
                issues.push('sandbox.config.json should specify port 3000');
            }
            if (config.container?.startScript !== 'dev') {
                suggestions.push('Consider using "dev" as the start script for consistency');
            }
        } catch (e) {
            issues.push('Invalid JSON in sandbox.config.json');
        }
    }

    // Check package.json for dev script
    if (files['package.json']) {
        try {
            const packageJson = JSON.parse(files['package.json']);
            if (!packageJson.scripts?.dev) {
                issues.push('Missing "dev" script in package.json');
            }
        } catch (e) {
            issues.push('Invalid JSON in package.json');
        }
    }

    return {
        isValid: issues.length === 0,
        issues,
        suggestions,
    };
}

/**
 * Generate preview URL for a CodeSandbox
 */
export function generatePreviewUrl(sandboxId: string, port: number = 3000): string {
    return `https://${sandboxId}-${port}.csb.app`;
}
