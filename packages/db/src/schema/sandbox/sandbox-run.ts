import { relations } from 'drizzle-orm';
import { pgTable, text, timestamp, uuid, varchar, integer } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { sandboxes } from './sandbox';

export const sandboxRuns = pgTable('sandbox_runs', {
    id: uuid('id').primaryKey().defaultRandom(),
    
    sandboxId: uuid('sandbox_id')
        .notNull()
        .references(() => sandboxes.id, { onDelete: 'cascade' }),
    
    // Run details
    phase: varchar('phase', { length: 50 }).notNull(), // 'install', 'build', 'start', 'test'
    command: text('command'),
    
    // Status: 'running', 'success', 'error', 'cancelled'
    status: varchar('status', { length: 20 }).notNull().default('running'),
    
    // Output
    logs: text('logs'),
    logsUrl: text('logs_url'), // External logs URL if available
    exitCode: integer('exit_code'),
    
    // Timing
    startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    duration: integer('duration'), // in milliseconds
}).enableRLS();

export const sandboxRunRelations = relations(sandboxRuns, ({ one }) => ({
    sandbox: one(sandboxes, {
        fields: [sandboxRuns.sandboxId],
        references: [sandboxes.id],
    }),
}));

export const sandboxRunInsertSchema = createInsertSchema(sandboxRuns);

export type SandboxRun = typeof sandboxRuns.$inferSelect;
export type NewSandboxRun = typeof sandboxRuns.$inferInsert;
