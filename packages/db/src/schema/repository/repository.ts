import { relations } from 'drizzle-orm';
import { pgTable, text, timestamp, uuid, varchar, integer } from 'drizzle-orm/pg-core';
import { createInsertSchema, createUpdateSchema } from 'drizzle-zod';
import { z } from 'zod';
import { users } from '../user';
import { repositoryAccess } from './repository-access';

export const repositories = pgTable('repositories', {
    id: uuid('id').primaryKey().defaultRandom(),
    
    // Repository identification
    provider: varchar('provider', { length: 50 }).notNull().default('github'),
    owner: varchar('owner', { length: 255 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    fullName: varchar('full_name', { length: 511 }).notNull(), // owner/name
    
    // Repository metadata
    description: text('description'),
    defaultBranch: varchar('default_branch', { length: 255 }).default('main'),
    isPrivate: varchar('is_private', { length: 10 }).default('false'),
    
    // GitHub specific
    githubId: integer('github_id'),
    installationId: varchar('installation_id', { length: 255 }),
    
    // Access tokens (encrypted)
    accessToken: text('access_token'), // Encrypted GitHub token
    refreshToken: text('refresh_token'), // Encrypted refresh token if applicable
    
    // Metadata
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    lastSyncAt: timestamp('last_sync_at', { withTimezone: true }),
}).enableRLS();

export const repositoryRelations = relations(repositories, ({ many }) => ({
    repositoryAccess: many(repositoryAccess),
}));

export const repositoryInsertSchema = createInsertSchema(repositories);
export const repositoryUpdateSchema = createUpdateSchema(repositories, {
    id: z.string().uuid(),
});

export type Repository = typeof repositories.$inferSelect;
export type NewRepository = typeof repositories.$inferInsert;
