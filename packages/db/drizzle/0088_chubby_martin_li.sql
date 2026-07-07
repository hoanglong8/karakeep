CREATE TABLE `assetCategories` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`createdAt` integer NOT NULL,
	`userId` text NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `assetCategories_userId_idx` ON `assetCategories` (`userId`);--> statement-breakpoint
CREATE UNIQUE INDEX `assetCategories_userId_name_unique` ON `assetCategories` (`userId`,`name`);--> statement-breakpoint
ALTER TABLE `assets` ADD `categoryId` text REFERENCES assetCategories(id);--> statement-breakpoint
CREATE INDEX `assets_categoryId_idx` ON `assets` (`categoryId`);