import { relations } from 'drizzle-orm';
import { pgTable, text, timestamp, uuid, varchar, integer } from 'drizzle-orm/pg-core';
import { createInsertSchema, createUpdateSchema } from 'drizzle-zod';
import { z } from 'zod';
import { projects } from '../project';
import { sandboxRuns } from './sandbox-run';

export const sandboxes = pgTable('sandboxes', {
    id: uuid('id').primaryKey().defaultRandom(),
    
    projectId: uuid('project_id')
        .notNull()
        .references(() => projects.id, { onDelete: 'cascade' }),
    
    // Sandbox identification
    provider: varchar('provider', { length: 50 }).notNull().default('codesandbox'),
    externalId: varchar('external_id', { length: 255 }), // Provider's sandbox ID
    
    // Sandbox configuration
    branch: varchar('branch', { length: 255 }).default('main'),
    commitSha: varchar('commit_sha', { length: 40 }),
    
    // Status: 'creating', 'running', 'stopped', 'error', 'deleted'
    status: varchar('status', { length: 20 }).notNull().default('creating'),
    
    // URLs
    previewUrl: text('preview_url'),
    editorUrl: text('editor_url'),
    
    // Resource usage
    cpuUsage: integer('cpu_usage').default(0), // in milliseconds
    memoryUsage: integer('memory_usage').default(0), // in MB
    
    // Metadata
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    stoppedAt: timestamp('stopped_at', { withTimezone: true }),
}).enableRLS();

export const sandboxRelations = relations(sandboxes, ({ one, many }) => ({
    project: one(projects, {
        fields: [sandboxes.projectId],
        references: [projects.id],
    }),
    runs: many(sandboxRuns),
}));

export const sandboxInsertSchema = createInsertSchema(sandboxes);
export const sandboxUpdateSchema = createUpdateSchema(sandboxes, {
    id: z.string().uuid(),
});

export type Sandbox = typeof sandboxes.$inferSelect;
export type NewSandbox = typeof sandboxes.$inferInsert;
