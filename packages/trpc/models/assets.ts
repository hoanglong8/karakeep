import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { AssetTypes, assetCategories, assets } from "@karakeep/db/schema";
import { deleteAsset, newAssetId } from "@karakeep/shared/assetdb";
import serverConfig from "@karakeep/shared/config";
import { createSignedToken } from "@karakeep/shared/signedTokens";
import { zAssetSignedTokenSchema } from "@karakeep/shared/types/assets";
import { zAssetTypesSchema } from "@karakeep/shared/types/bookmarks";
import { getAssetUrl } from "@karakeep/shared/utils/assetUtils";

import { AuthedContext } from "..";
import {
  isAllowedToAttachAsset,
  isAllowedToDetachAsset,
  mapDBAssetTypeToUserType,
  mapSchemaAssetTypeToDB,
} from "../lib/attachments";
import { BareBookmark } from "./bookmarks";

// Accepts youtube.com/watch, youtube.com/shorts, m.youtube.com, and youtu.be
// links and returns the bare video id, or null if the URL isn't a
// recognizable YouTube video link.
export function extractYoutubeVideoId(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const host = parsed.hostname.replace(/^www\./, "");
  if (host === "youtube.com" || host === "m.youtube.com") {
    return (
      parsed.searchParams.get("v") ??
      parsed.pathname.match(/^\/(?:embed|shorts)\/([^/]+)/)?.[1] ??
      null
    );
  }
  if (host === "youtu.be") {
    return parsed.pathname.slice(1) || null;
  }
  return null;
}

export class Asset {
  constructor(
    protected ctx: AuthedContext,
    public asset: typeof assets.$inferSelect,
  ) {}

  static async fromId(ctx: AuthedContext, id: string): Promise<Asset> {
    const assetdb = await ctx.db.query.assets.findFirst({
      where: eq(assets.id, id),
    });

    if (!assetdb) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Asset not found",
      });
    }

    const asset = new Asset(ctx, assetdb);

    if (!(await asset.canUserView())) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Asset not found",
      });
    }

    return asset;
  }

  static async list(
    ctx: AuthedContext,
    input: {
      limit: number;
      cursor: number | null;
    },
  ) {
    const page = input.cursor ?? 1;
    const [results, totalCount] = await Promise.all([
      ctx.db
        .select()
        .from(assets)
        .where(eq(assets.userId, ctx.user.id))
        .orderBy(desc(assets.size))
        .limit(input.limit)
        .offset((page - 1) * input.limit),
      ctx.db
        .select({ count: sql<number>`count(*)` })
        .from(assets)
        .where(eq(assets.userId, ctx.user.id)),
    ]);

    return {
      assets: results.map((a) => ({
        ...a,
        assetType: mapDBAssetTypeToUserType(a.assetType),
      })),
      nextCursor: page * input.limit < totalCount[0].count ? page + 1 : null,
      totalCount: totalCount[0].count,
    };
  }

  static async attachAsset(
    ctx: AuthedContext,
    input: {
      bookmarkId: string;
      asset: {
        id: string;
        assetType: z.infer<typeof zAssetTypesSchema>;
        categoryId?: string | null;
      };
    },
  ) {
    const [asset] = await Promise.all([
      Asset.fromId(ctx, input.asset.id),
      this.ensureBookmarkOwnership(ctx, input.bookmarkId),
    ]);
    asset.ensureOwnership();

    if (!isAllowedToAttachAsset(input.asset.assetType)) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "You can't attach this type of asset",
      });
    }

    if (input.asset.categoryId) {
      await Asset.ensureCategoryOwnership(ctx, input.asset.categoryId);
    }

    const [updatedAsset] = await ctx.db
      .update(assets)
      .set({
        assetType: mapSchemaAssetTypeToDB(input.asset.assetType),
        bookmarkId: input.bookmarkId,
        categoryId: input.asset.categoryId ?? null,
      })
      .where(and(eq(assets.id, input.asset.id), eq(assets.userId, ctx.user.id)))
      .returning();

    return {
      id: updatedAsset.id,
      assetType: mapDBAssetTypeToUserType(updatedAsset.assetType),
      fileName: updatedAsset.fileName,
      contentType: updatedAsset.contentType,
      categoryId: updatedAsset.categoryId,
      sourceUrl: updatedAsset.sourceUrl,
    };
  }

  static async attachVideoLink(
    ctx: AuthedContext,
    input: {
      bookmarkId: string;
      url: string;
      categoryId?: string | null;
    },
  ) {
    const videoId = extractYoutubeVideoId(input.url);
    if (!videoId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Only YouTube video links are supported",
      });
    }

    await Asset.ensureBookmarkOwnership(ctx, input.bookmarkId);
    if (input.categoryId) {
      await Asset.ensureCategoryOwnership(ctx, input.categoryId);
    }

    // Video links have no bytes of their own in the asset store: the row
    // just carries the external URL, unlike every other asset type.
    const [created] = await ctx.db
      .insert(assets)
      .values({
        id: newAssetId(),
        assetType: AssetTypes.VIDEO_LINK,
        bookmarkId: input.bookmarkId,
        userId: ctx.user.id,
        categoryId: input.categoryId ?? null,
        sourceUrl: `https://www.youtube.com/watch?v=${videoId}`,
      })
      .returning();

    return {
      id: created.id,
      assetType: mapDBAssetTypeToUserType(created.assetType),
      fileName: created.fileName,
      contentType: created.contentType,
      categoryId: created.categoryId,
      sourceUrl: created.sourceUrl,
    };
  }

  static async setCategory(
    ctx: AuthedContext,
    input: { assetId: string; categoryId: string | null },
  ) {
    const asset = await Asset.fromId(ctx, input.assetId);
    asset.ensureOwnership();

    if (input.categoryId) {
      await Asset.ensureCategoryOwnership(ctx, input.categoryId);
    }

    await ctx.db
      .update(assets)
      .set({ categoryId: input.categoryId })
      .where(and(eq(assets.id, input.assetId), eq(assets.userId, ctx.user.id)));
  }

  private static async ensureCategoryOwnership(
    ctx: AuthedContext,
    categoryId: string,
  ) {
    const category = await ctx.db.query.assetCategories.findFirst({
      where: and(
        eq(assetCategories.id, categoryId),
        eq(assetCategories.userId, ctx.user.id),
      ),
    });
    if (!category) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Asset category not found",
      });
    }
  }

  static async listCategories(ctx: AuthedContext) {
    const categories = await ctx.db.query.assetCategories.findMany({
      where: eq(assetCategories.userId, ctx.user.id),
      orderBy: [asc(assetCategories.name)],
    });
    return categories.map((c) => ({ id: c.id, name: c.name }));
  }

  static async createCategory(ctx: AuthedContext, input: { name: string }) {
    // Idempotent create-or-get, mirroring how tag creation behaves when the
    // name already exists.
    const existing = await ctx.db.query.assetCategories.findFirst({
      where: and(
        eq(assetCategories.userId, ctx.user.id),
        eq(assetCategories.name, input.name),
      ),
    });
    if (existing) {
      return { id: existing.id, name: existing.name };
    }
    const [created] = await ctx.db
      .insert(assetCategories)
      .values({ name: input.name, userId: ctx.user.id })
      .returning();
    return { id: created.id, name: created.name };
  }

  static async deleteCategory(
    ctx: AuthedContext,
    input: { categoryId: string },
  ) {
    // The `assets.categoryId` column was added via an SQLite `ALTER TABLE
    // ADD COLUMN`, which doesn't carry an `ON DELETE SET NULL` action (SQLite
    // only applies FK actions declared at table-creation time). Uncategorize
    // affected assets explicitly before deleting the category to avoid a
    // FOREIGN KEY constraint failure.
    await ctx.db.transaction(async (tx) => {
      await tx
        .update(assets)
        .set({ categoryId: null })
        .where(
          and(
            eq(assets.categoryId, input.categoryId),
            eq(assets.userId, ctx.user.id),
          ),
        );
      const result = await tx
        .delete(assetCategories)
        .where(
          and(
            eq(assetCategories.id, input.categoryId),
            eq(assetCategories.userId, ctx.user.id),
          ),
        );
      if (result.changes === 0) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
    });
  }

  static async replaceAsset(
    ctx: AuthedContext,
    input: {
      bookmarkId: string;
      oldAssetId: string;
      newAssetId: string;
    },
  ) {
    const [oldAsset, newAsset] = await Promise.all([
      Asset.fromId(ctx, input.oldAssetId),
      Asset.fromId(ctx, input.newAssetId),
      this.ensureBookmarkOwnership(ctx, input.bookmarkId),
    ]);
    oldAsset.ensureOwnership();
    newAsset.ensureOwnership();

    if (
      !isAllowedToAttachAsset(
        mapDBAssetTypeToUserType(oldAsset.asset.assetType),
      )
    ) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "You can't attach this type of asset",
      });
    }

    await ctx.db.transaction(async (tx) => {
      await tx.delete(assets).where(eq(assets.id, input.oldAssetId));
      await tx
        .update(assets)
        .set({
          bookmarkId: input.bookmarkId,
          assetType: oldAsset.asset.assetType,
        })
        .where(eq(assets.id, input.newAssetId));
    });

    await deleteAsset({
      userId: ctx.user.id,
      assetId: input.oldAssetId,
    }).catch(() => ({}));
  }

  static async detachAsset(
    ctx: AuthedContext,
    input: {
      bookmarkId: string;
      assetId: string;
    },
  ) {
    const [asset] = await Promise.all([
      Asset.fromId(ctx, input.assetId),
      this.ensureBookmarkOwnership(ctx, input.bookmarkId),
    ]);

    if (
      !isAllowedToDetachAsset(mapDBAssetTypeToUserType(asset.asset.assetType))
    ) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "You can't detach this type of asset",
      });
    }

    const result = await ctx.db
      .delete(assets)
      .where(
        and(
          eq(assets.id, input.assetId),
          eq(assets.bookmarkId, input.bookmarkId),
        ),
      );
    if (result.changes == 0) {
      throw new TRPCError({ code: "NOT_FOUND" });
    }
    await deleteAsset({ userId: ctx.user.id, assetId: input.assetId }).catch(
      () => ({}),
    );
  }

  private static async ensureBookmarkOwnership(
    ctx: AuthedContext,
    bookmarkId: string,
  ) {
    const bookmark = await BareBookmark.bareFromId(ctx, bookmarkId);
    bookmark.ensureOwnership();
  }

  ensureOwnership() {
    if (this.asset.userId != this.ctx.user.id) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "User is not allowed to access resource",
      });
    }
  }

  static async ensureOwnership(ctx: AuthedContext, assetId: string) {
    return (await Asset.fromId(ctx, assetId)).ensureOwnership();
  }

  async canUserView(): Promise<boolean> {
    // Asset owner can always view it
    if (this.asset.userId === this.ctx.user.id) {
      return true;
    }

    // Avatars are always public
    if (this.asset.assetType === "avatar") {
      return true;
    }

    // If asset is attached to a bookmark, check bookmark access permissions
    if (this.asset.bookmarkId) {
      try {
        // This throws if the user doesn't have access to the bookmark
        await BareBookmark.bareFromId(this.ctx, this.asset.bookmarkId);
        return true;
      } catch (e) {
        if (e instanceof TRPCError && e.code === "FORBIDDEN") {
          return false;
        }
        throw e;
      }
    }

    return false;
  }

  async ensureCanView() {
    if (!(await this.canUserView())) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Asset not found",
      });
    }
  }

  getUrl() {
    return getAssetUrl(this.asset.id);
  }

  static getPublicSignedAssetUrl(
    assetId: string,
    assetOwnerId: string,
    expireAt: number,
  ) {
    const payload: z.infer<typeof zAssetSignedTokenSchema> = {
      assetId,
      userId: assetOwnerId,
    };
    const signedToken = createSignedToken(
      payload,
      serverConfig.signingSecret(),
      expireAt,
    );
    return `${serverConfig.publicApiUrl}/public/assets/${assetId}?token=${signedToken}`;
  }
}
