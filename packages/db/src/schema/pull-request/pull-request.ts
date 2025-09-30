import { relations } from 'drizzle-orm';
import { pgTable, text, timestamp, uuid, varchar, integer } from 'drizzle-orm/pg-core';
import { createInsertSchema, createUpdateSchema } from 'drizzle-zod';
import { z } from 'zod';
import { repositories } from '../repository';
import { users } from '../user';
import { projects } from '../project';

export const pullRequests = pgTable('pull_requests', {
    id: uuid('id').primaryKey().defaultRandom(),
    
    repositoryId: uuid('repository_id')
        .notNull()
        .references(() => repositories.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id')
        .references(() => projects.id, { onDelete: 'set null' }),
    createdBy: uuid('created_by')
        .notNull()
        .references(() => users.id, { onDelete: 'cascade' }),
    
    // PR identification
    prNumber: integer('pr_number').notNull(),
    prUrl: text('pr_url').notNull(),
    
    // Branch information
    sourceBranch: varchar('source_branch', { length: 255 }).notNull(),
    targetBranch: varchar('target_branch', { length: 255 }).notNull(),
    
    // PR details
    title: text('title').notNull(),
    description: text('description'),
    
    // Status: 'open', 'closed', 'merged', 'draft'
    status: varchar('status', { length: 20 }).notNull().default('open'),
    
    // GitHub metadata
    githubCreatedAt: timestamp('github_created_at', { withTimezone: true }),
    githubUpdatedAt: timestamp('github_updated_at', { withTimezone: true }),
    githubMergedAt: timestamp('github_merged_at', { withTimezone: true }),
    
    // Change summary
    filesChanged: integer('files_changed').default(0),
    additions: integer('additions').default(0),
    deletions: integer('deletions').default(0),
    
    // Metadata
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}).enableRLS();

export const pullRequestRelations = relations(pullRequests, ({ one }) => ({
    repository: one(repositories, {
        fields: [pullRequests.repositoryId],
        references: [repositories.id],
    }),
    project: one(projects, {
        fields: [pullRequests.projectId],
        references: [projects.id],
    }),
    createdByUser: one(users, {
        fields: [pullRequests.createdBy],
        references: [users.id],
    }),
}));

export const pullRequestInsertSchema = createInsertSchema(pullRequests);
export const pullRequestUpdateSchema = createUpdateSchema(pullRequests, {
    id: z.string().uuid(),
});

export type PullRequest = typeof pullRequests.$inferSelect;
export type NewPullRequest = typeof pullRequests.$inferInsert;
