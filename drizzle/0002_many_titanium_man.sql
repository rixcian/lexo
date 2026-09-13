CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`username` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_idx` ON `users` (`username`);--> statement-breakpoint
-- Seeds the account that inherits everything predating accounts. The empty
-- username marks it unclaimed: registration is validated to at least two
-- characters, so no one can collide with it, and the first person to sign
-- up renames this row instead of inserting a new one. The ALTER TABLE
-- statements below default every existing card and review to this id.
INSERT INTO `users` (`id`, `username`) VALUES (1, '');--> statement-breakpoint
DROP INDEX `cards_note_template_idx`;--> statement-breakpoint
DROP INDEX `cards_deck_due_idx`;--> statement-breakpoint
DROP INDEX `cards_due_idx`;--> statement-breakpoint
DROP INDEX `cards_state_idx`;--> statement-breakpoint
ALTER TABLE `cards` ADD `user_id` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `cards_user_note_template_idx` ON `cards` (`user_id`,`note_id`,`template`);--> statement-breakpoint
CREATE INDEX `cards_user_deck_due_idx` ON `cards` (`user_id`,`deck_id`,`due`);--> statement-breakpoint
CREATE INDEX `cards_user_state_idx` ON `cards` (`user_id`,`state`);--> statement-breakpoint
CREATE INDEX `cards_note_idx` ON `cards` (`note_id`);--> statement-breakpoint
DROP INDEX `reviews_reviewed_at_idx`;--> statement-breakpoint
DROP INDEX `reviews_deck_idx`;--> statement-breakpoint
ALTER TABLE `reviews` ADD `user_id` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
CREATE INDEX `reviews_user_reviewed_at_idx` ON `reviews` (`user_id`,`reviewed_at`);--> statement-breakpoint
CREATE INDEX `reviews_user_deck_idx` ON `reviews` (`user_id`,`deck_id`,`reviewed_at`);