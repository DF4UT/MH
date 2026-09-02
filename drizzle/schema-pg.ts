/**
 * Postgres 数据模型（可选方言）
 * 与 schema-sqlite.ts 保持结构一致：
 * - id 使用 serial（数字自增）
 * - 时间使用 bigint + mode:'number'（Drizzle 自动转换为 number）
 */
import { relations } from 'drizzle-orm';
import { pgTable, serial, text, integer, bigint, primaryKey } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  githubId: text('github_id').notNull().unique(),
  username: text('username').notNull(),
  email: text('email'),
  avatarUrl: text('avatar_url'),
  role: text('role', { enum: ['user', 'admin'] })
    .notNull()
    .default('user'),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
  updatedAt: bigint('updated_at', { mode: 'number' }).notNull(),
});

export const posts = pgTable('posts', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  authorId: integer('author_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  /** published=公开可见；draft=仅作者/管理员可见（草稿箱） */
  status: text('status', { enum: ['published', 'draft'] })
    .notNull()
    .default('published'),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
  updatedAt: bigint('updated_at', { mode: 'number' }).notNull(),
});

export const tags = pgTable('tags', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
});

export const postTags = pgTable(
  'post_tags',
  {
    postId: integer('post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    tagId: integer('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
  },
  (table) => [primaryKey({ columns: [table.postId, table.tagId] })]
);

export const comments = pgTable('comments', {
  id: serial('id').primaryKey(),
  content: text('content').notNull(),
  authorId: integer('author_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  postId: integer('post_id')
    .notNull()
    .references(() => posts.id, { onDelete: 'cascade' }),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
});

export const onlineUsers = pgTable('online_users', {
  clientKey: text('client_key').primaryKey(),
  kind: text('kind', { enum: ['user', 'guest'] })
    .notNull()
    .default('guest'),
  name: text('name').notNull().default('游客'),
  lastSeenAt: bigint('last_seen_at', { mode: 'number' }).notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  posts: many(posts),
  comments: many(comments),
}));

export const postsRelations = relations(posts, ({ one, many }) => ({
  author: one(users, { fields: [posts.authorId], references: [users.id] }),
  tags: many(postTags),
  comments: many(comments),
}));

export const tagsRelations = relations(tags, ({ many }) => ({
  posts: many(postTags),
}));

export const postTagsRelations = relations(postTags, ({ one }) => ({
  post: one(posts, { fields: [postTags.postId], references: [posts.id] }),
  tag: one(tags, { fields: [postTags.tagId], references: [tags.id] }),
}));

export const commentsRelations = relations(comments, ({ one }) => ({
  author: one(users, { fields: [comments.authorId], references: [users.id] }),
  post: one(posts, { fields: [comments.postId], references: [posts.id] }),
}));
