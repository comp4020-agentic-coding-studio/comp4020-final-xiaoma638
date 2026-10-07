CREATE TABLE `likes` (
	`response_id` text NOT NULL,
	`participant_id` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`response_id`, `participant_id`),
	FOREIGN KEY (`response_id`) REFERENCES `responses`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`participant_id`) REFERENCES `participants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `memberships` (
	`org_id` text NOT NULL,
	`participant_id` text NOT NULL,
	`nickname` text NOT NULL,
	`role` text NOT NULL,
	`joined_at` integer NOT NULL,
	PRIMARY KEY(`org_id`, `participant_id`),
	FOREIGN KEY (`org_id`) REFERENCES `orgs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`participant_id`) REFERENCES `participants`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "memberships_role" CHECK("memberships"."role" in ('host', 'member'))
);
--> statement-breakpoint
CREATE INDEX `memberships_participant` ON `memberships` (`participant_id`);--> statement-breakpoint
CREATE TABLE `options` (
	`id` text PRIMARY KEY NOT NULL,
	`question_id` text NOT NULL,
	`position` integer NOT NULL,
	`label` text NOT NULL,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `options_position` ON `options` (`question_id`,`position`);--> statement-breakpoint
CREATE TABLE `orgs` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`join_code` text NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `participants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `orgs_join_code_unique` ON `orgs` (`join_code`);--> statement-breakpoint
CREATE TABLE `participants` (
	`id` text PRIMARY KEY NOT NULL,
	`credential_hash` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `participants_credential_hash_unique` ON `participants` (`credential_hash`);--> statement-breakpoint
CREATE TABLE `questions` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`kind` text NOT NULL,
	`prompt` text NOT NULL,
	`duration_sec` integer NOT NULL,
	`phase` text NOT NULL,
	`deadline` integer,
	`revealed_at` integer,
	`closed_at` integer,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`org_id`) REFERENCES `orgs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `participants`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "questions_kind" CHECK("questions"."kind" in ('choice', 'open')),
	CONSTRAINT "questions_phase" CHECK("questions"."phase" in ('DRAFT', 'COLLECTING', 'REVEALED', 'CLOSED')),
	CONSTRAINT "questions_deadline" CHECK("questions"."phase" = 'DRAFT' or "questions"."deadline" is not null)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `questions_one_open_per_org` ON `questions` (`org_id`) WHERE phase <> 'CLOSED';--> statement-breakpoint
CREATE INDEX `questions_org` ON `questions` (`org_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `response_tags` (
	`response_id` text NOT NULL,
	`keyword` text NOT NULL,
	PRIMARY KEY(`response_id`, `keyword`),
	FOREIGN KEY (`response_id`) REFERENCES `responses`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `responses` (
	`id` text PRIMARY KEY NOT NULL,
	`question_id` text NOT NULL,
	`participant_id` text NOT NULL,
	`option_id` text,
	`text` text,
	`version` integer NOT NULL,
	`submitted_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`participant_id`) REFERENCES `participants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`option_id`) REFERENCES `options`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "responses_body" CHECK("responses"."option_id" is not null or "responses"."text" is not null)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `responses_one_per_participant` ON `responses` (`question_id`,`participant_id`);