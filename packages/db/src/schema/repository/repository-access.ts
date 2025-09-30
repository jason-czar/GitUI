import { relations } from 'drizzle-orm';
import { pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { users } from '../user';
import { repositories } from './repository';

export const repositoryAccess = pgTable('repository_access', {
    id: uuid('id').primaryKey().defaultRandom(),
    
    userId: uuid('user_id')
        .notNull()
        .references(() => users.id, { onDelete: 'cascade' }),
    repositoryId: uuid('repository_id')
        .notNull()
        .references(() => repositories.id, { onDelete: 'cascade' }),
    
    // Access level: 'read', 'write', 'admin'
    accessLevel: varchar('access_level', { length: 20 }).notNull().default('read'),
    
    // Metadata
    grantedAt: timestamp('granted_at', { withTimezone: true }).defaultNow().notNull(),
    grantedBy: uuid('granted_by').references(() => users.id),
}).enableRLS();

export const repositoryAccessRelations = relations(repositoryAccess, ({ one }) => ({
    user: one(users, {
        fields: [repositoryAccess.userId],
        references: [users.id],
    }),
    repository: one(repositories, {
        fields: [repositoryAccess.repositoryId],
        references: [repositories.id],
    }),
    grantedByUser: one(users, {
        fields: [repositoryAccess.grantedBy],
        references: [users.id],
    }),
}));

export const repositoryAccessInsertSchema = createInsertSchema(repositoryAccess);

export type RepositoryAccess = typeof repositoryAccess.$inferSelect;
export type NewRepositoryAccess = typeof repositoryAccess.$inferInsert;
