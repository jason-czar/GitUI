import { registerOTel } from '@vercel/otel';
import { LangfuseExporter } from 'langfuse-vercel';

export function register() {
    // GitUI: Only initialize Langfuse if the secret key is provided
    if (process.env.LANGFUSE_SECRET_KEY) {
        registerOTel({ serviceName: 'GitUI Web', traceExporter: new LangfuseExporter() });
    } else {
        // Initialize basic OpenTelemetry without Langfuse
        registerOTel({ serviceName: 'GitUI Web' });
    }
}
