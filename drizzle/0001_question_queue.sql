PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_questions` (
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
	CONSTRAINT "questions_kind" CHECK("__new_questions"."kind" in ('choice', 'open')),
	CONSTRAINT "questions_phase" CHECK("__new_questions"."phase" in ('DRAFT', 'COLLECTING', 'REVEALED', 'CLOSED')),
	CONSTRAINT "questions_deadline" CHECK("__new_questions"."phase" = 'DRAFT' or "__new_questions"."deadline" is not null or "__new_questions"."duration_sec" = 0)
);
--> statement-breakpoint
INSERT INTO `__new_questions`("id", "org_id", "kind", "prompt", "duration_sec", "phase", "deadline", "revealed_at", "closed_at", "created_by", "created_at") SELECT "id", "org_id", "kind", "prompt", "duration_sec", "phase", "deadline", "revealed_at", "closed_at", "created_by", "created_at" FROM `questions`;--> statement-breakpoint
DROP TABLE `questions`;--> statement-breakpoint
ALTER TABLE `__new_questions` RENAME TO `questions`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `questions_one_live_per_org` ON `questions` (`org_id`) WHERE phase in ('COLLECTING', 'REVEALED');--> statement-breakpoint
CREATE INDEX `questions_org` ON `questions` (`org_id`,`created_at`);