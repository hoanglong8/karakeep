import { z } from "zod";

export const MAX_ASSET_CATEGORY_NAME_LENGTH = 100;

export const zAssetCategorySchema = z.object({
  id: z.string(),
  name: z.string(),
});
export type ZAssetCategory = z.infer<typeof zAssetCategorySchema>;

export const zCreateAssetCategoryRequestSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1)
    .max(MAX_ASSET_CATEGORY_NAME_LENGTH),
});

export const zAssetCategoryListResponseSchema = z.object({
  categories: z.array(zAssetCategorySchema),
});
