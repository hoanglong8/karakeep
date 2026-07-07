import { useRef, useState } from "react";
import Link from "next/link";
import { ActionButton } from "@/components/ui/action-button";
import ActionConfirmingDialog from "@/components/ui/action-confirming-dialog";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import FilePickerButton from "@/components/ui/file-picker-button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/sonner";
import { ASSET_TYPE_TO_ICON } from "@/lib/attachments";
import useUpload from "@/lib/hooks/upload-file";
import { useTranslation } from "@/lib/i18n/client";
import {
  ChevronsDownUp,
  Download,
  FolderPlus,
  ImagePlus,
  Loader2,
  Paperclip,
  Pencil,
  Trash2,
  X,
} from "lucide-react";

import {
  useAssetCategories,
  useAttachBookmarkAsset,
  useCreateAssetCategory,
  useDeleteAssetCategory,
  useDetachBookmarkAsset,
  useReplaceBookmarkAsset,
} from "@karakeep/shared-react/hooks/assets";
import { BookmarkTypes, ZBookmark } from "@karakeep/shared/types/bookmarks";
import { getAssetUrl } from "@karakeep/shared/utils/assetUtils";
import {
  humanFriendlyNameForAssertType,
  isAllowedToAttachAsset,
  isAllowedToDetachAsset,
} from "@karakeep/trpc/lib/attachments";

type BookmarkAsset = ZBookmark["assets"][number];

function AssetRow({
  asset,
  readOnly,
  isReplacing,
  isDetaching,
  onReplace,
  onDetach,
}: {
  asset: BookmarkAsset;
  readOnly: boolean;
  isReplacing: boolean;
  isDetaching: boolean;
  onReplace: (assetId: string, file: File) => void;
  onDetach: (assetId: string) => void;
}) {
  const displayName =
    asset.assetType === "userUploaded" && asset.fileName
      ? asset.fileName
      : humanFriendlyNameForAssertType(asset.assetType);
  return (
    <div className="flex items-center justify-between">
      <Link
        target="_blank"
        href={getAssetUrl(asset.id)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        prefetch={false}
      >
        {ASSET_TYPE_TO_ICON[asset.assetType]}
        <p>{displayName}</p>
      </Link>
      <div className="flex gap-1 text-muted-foreground">
        <Link
          title="Download"
          target="_blank"
          href={getAssetUrl(asset.id)}
          className="flex items-center gap-1 rounded-md p-1 hover:text-foreground"
          download={displayName}
          prefetch={false}
        >
          <Download className="size-3.5" strokeWidth={1.5} />
        </Link>
        {!readOnly &&
          isAllowedToAttachAsset(asset.assetType) &&
          asset.assetType !== "userUploaded" && (
            <FilePickerButton
              title="Replace"
              loading={isReplacing}
              accept=".jgp,.JPG,.jpeg,.png,.webp"
              multiple={false}
              variant="none"
              size="none"
              className="flex items-center gap-2 rounded-md p-1 hover:text-foreground"
              onFileSelect={(file) => onReplace(asset.id, file)}
            >
              <Pencil className="size-3.5" strokeWidth={1.5} />
            </FilePickerButton>
          )}
        {!readOnly && isAllowedToDetachAsset(asset.assetType) && (
          <ActionConfirmingDialog
            title="Delete Attachment?"
            description={`Are you sure you want to delete the attachment of the bookmark?`}
            actionButton={(setDialogOpen) => (
              <ActionButton
                loading={isDetaching}
                variant="destructive"
                onClick={() => {
                  onDetach(asset.id);
                  setDialogOpen(false);
                }}
              >
                <Trash2 className="mr-2 size-4" />
                Delete
              </ActionButton>
            )}
          >
            <Button
              variant="none"
              size="none"
              title="Delete"
              className="rounded-md p-1 hover:text-foreground"
            >
              <Trash2 className="size-3.5" strokeWidth={1.5} />
            </Button>
          </ActionConfirmingDialog>
        )}
      </div>
    </div>
  );
}

export default function AttachmentBox({
  bookmark,
  readOnly = false,
}: {
  bookmark: ZBookmark;
  readOnly?: boolean;
}) {
  const { t } = useTranslation();
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");

  const {
    mutate: attachAsset,
    mutateAsync: attachAssetAsync,
    isPending: isAttaching,
  } = useAttachBookmarkAsset({
    onSuccess: () => {
      toast({
        description: "Attachment has been attached!",
      });
    },
    onError: (e) => {
      toast({
        description: e.message,
        variant: "destructive",
      });
    },
  });

  const { mutate: replaceAsset, isPending: isReplacing } =
    useReplaceBookmarkAsset({
      onSuccess: () => {
        toast({
          description: "Attachment has been replaced!",
        });
      },
      onError: (e) => {
        toast({
          description: e.message,
          variant: "destructive",
        });
      },
    });

  const { mutate: detachAsset, isPending: isDetaching } =
    useDetachBookmarkAsset({
      onSuccess: () => {
        toast({
          description: "Attachment has been detached!",
        });
      },
      onError: (e) => {
        toast({
          description: e.message,
          variant: "destructive",
        });
      },
    });

  const { mutate: uploadAsset, mutateAsync: uploadAssetAsync } = useUpload({
    onError: (e) => {
      toast({
        description: e.error,
        variant: "destructive",
      });
    },
  });

  const { data: categoriesData } = useAssetCategories();
  const categories = categoriesData?.categories ?? [];

  const { mutate: createCategory, isPending: isCreatingCategory } =
    useCreateAssetCategory({
      onSuccess: () => {
        setNewCategoryName("");
        setIsAddingCategory(false);
      },
      onError: (e) => {
        toast({
          description: e.message,
          variant: "destructive",
        });
      },
    });

  const { mutate: deleteCategory, isPending: isDeletingCategory } =
    useDeleteAssetCategory({
      onError: (e) => {
        toast({
          description: e.message,
          variant: "destructive",
        });
      },
    });

  const doReplace = (oldAssetId: string, file: File) => {
    uploadAsset(file, {
      onSuccess: (resp) => {
        replaceAsset({
          bookmarkId: bookmark.id,
          oldAssetId,
          newAssetId: resp.assetId,
        });
      },
    });
  };

  const doDetach = (assetId: string) => {
    detachAsset({ bookmarkId: bookmark.id, assetId });
  };

  // Calling the shared upload/attach mutations concurrently (e.g. selecting
  // several files at once) drops earlier calls' success callbacks, since a
  // single mutation hook instance only tracks the latest in-flight call.
  // Chaining onto this ref serializes multi-file uploads so each file's
  // upload+attach fully completes before the next one starts.
  const uploadQueueRef = useRef<Promise<unknown>>(Promise.resolve());

  const uploadInto = (file: File, categoryId: string | null) => {
    uploadQueueRef.current = uploadQueueRef.current.then(async () => {
      try {
        const resp = await uploadAssetAsync(file);
        await attachAssetAsync({
          bookmarkId: bookmark.id,
          asset: {
            id: resp.assetId,
            assetType: "userUploaded",
            categoryId,
          },
        });
      } catch {
        // Errors are already surfaced via the mutations' onError toasts.
      }
    });
  };

  const systemAssets = bookmark.assets
    .filter((a) => a.assetType !== "userUploaded")
    .sort((a, b) => a.assetType.localeCompare(b.assetType));
  const userUploadedAssets = bookmark.assets.filter(
    (a) => a.assetType === "userUploaded",
  );

  const assetsByCategory = new Map<string, BookmarkAsset[]>();
  const uncategorizedAssets: BookmarkAsset[] = [];
  for (const asset of userUploadedAssets) {
    if (asset.categoryId) {
      const list = assetsByCategory.get(asset.categoryId) ?? [];
      list.push(asset);
      assetsByCategory.set(asset.categoryId, list);
    } else {
      uncategorizedAssets.push(asset);
    }
  }

  const hasAssets = bookmark.assets.length > 0;

  const submitNewCategory = () => {
    const name = newCategoryName.trim();
    if (!name) {
      return;
    }
    createCategory({ name });
  };

  return (
    <Collapsible defaultOpen={true}>
      <div className="flex w-full items-center justify-between gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {t("common.attachments")}
        <div className="flex items-center gap-1">
          {!readOnly && (
            <>
              {!bookmark.assets.some(
                (asset) => asset.assetType == "bannerImage",
              ) &&
                bookmark.content.type != BookmarkTypes.ASSET && (
                  <FilePickerButton
                    title="Attach a Banner"
                    loading={isAttaching}
                    accept=".jgp,.JPG,.jpeg,.png,.webp"
                    multiple={false}
                    variant="none"
                    size="none"
                    className="rounded-md p-1 hover:text-foreground"
                    onFileSelect={(file) =>
                      uploadAsset(file, {
                        onSuccess: (resp) => {
                          attachAsset({
                            bookmarkId: bookmark.id,
                            asset: {
                              id: resp.assetId,
                              assetType: "bannerImage",
                            },
                          });
                        },
                      })
                    }
                  >
                    <ImagePlus className="size-3.5" strokeWidth={1.5} />
                  </FilePickerButton>
                )}
              <FilePickerButton
                title="Upload File"
                loading={isAttaching}
                multiple={false}
                variant="none"
                size="none"
                className="rounded-md p-1 hover:text-foreground"
                onFileSelect={(file) => uploadInto(file, null)}
              >
                <Paperclip className="size-3.5" strokeWidth={1.5} />
              </FilePickerButton>
            </>
          )}
          {hasAssets && (
            <CollapsibleTrigger>
              <ChevronsDownUp className="size-4" />
            </CollapsibleTrigger>
          )}
        </div>
      </div>
      <CollapsibleContent className="flex flex-col gap-1 py-3 text-sm">
        {systemAssets.map((asset) => (
          <AssetRow
            key={asset.id}
            asset={asset}
            readOnly={readOnly}
            isReplacing={isReplacing}
            isDetaching={isDetaching}
            onReplace={doReplace}
            onDetach={doDetach}
          />
        ))}
        {!hasAssets && readOnly && (
          <p className="py-1 text-xs text-muted-foreground">No attachments</p>
        )}

        {(categories.length > 0 || uncategorizedAssets.length > 0) && (
          <div className="mt-2 flex flex-col gap-3">
            {categories.map((category) => {
              const assetsInCategory =
                assetsByCategory.get(category.id) ?? [];
              return (
                <div key={category.id} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium text-muted-foreground">
                      {category.name}
                    </p>
                    {!readOnly && (
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <FilePickerButton
                          title="Upload into this category"
                          loading={isAttaching}
                          multiple={true}
                          variant="none"
                          size="none"
                          className="rounded-md p-1 hover:text-foreground"
                          onFileSelect={(file) =>
                            uploadInto(file, category.id)
                          }
                        >
                          <Paperclip className="size-3.5" strokeWidth={1.5} />
                        </FilePickerButton>
                        <ActionConfirmingDialog
                          title="Delete Category?"
                          description="Files in this category will not be deleted, but will become uncategorized."
                          actionButton={(setDialogOpen) => (
                            <ActionButton
                              loading={isDeletingCategory}
                              variant="destructive"
                              onClick={() =>
                                deleteCategory(
                                  { categoryId: category.id },
                                  { onSettled: () => setDialogOpen(false) },
                                )
                              }
                            >
                              <Trash2 className="mr-2 size-4" />
                              Delete
                            </ActionButton>
                          )}
                        >
                          <Button
                            variant="none"
                            size="none"
                            title="Delete Category"
                            className="rounded-md p-1 hover:text-foreground"
                          >
                            <Trash2 className="size-3.5" strokeWidth={1.5} />
                          </Button>
                        </ActionConfirmingDialog>
                      </div>
                    )}
                  </div>
                  {assetsInCategory.length === 0 ? (
                    <p className="py-0.5 text-xs italic text-muted-foreground">
                      No files yet
                    </p>
                  ) : (
                    assetsInCategory.map((asset) => (
                      <AssetRow
                        key={asset.id}
                        asset={asset}
                        readOnly={readOnly}
                        isReplacing={isReplacing}
                        isDetaching={isDetaching}
                        onReplace={doReplace}
                        onDetach={doDetach}
                      />
                    ))
                  )}
                </div>
              );
            })}

            {uncategorizedAssets.length > 0 && (
              <div className="flex flex-col gap-1">
                <p className="text-xs font-medium text-muted-foreground">
                  Uncategorized
                </p>
                {uncategorizedAssets.map((asset) => (
                  <AssetRow
                    key={asset.id}
                    asset={asset}
                    readOnly={readOnly}
                    isReplacing={isReplacing}
                    isDetaching={isDetaching}
                    onReplace={doReplace}
                    onDetach={doDetach}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {!readOnly && (
          <div className="mt-2">
            {isAddingCategory ? (
              <div className="flex items-center gap-1">
                <Input
                  autoFocus
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      submitNewCategory();
                    } else if (e.key === "Escape") {
                      setIsAddingCategory(false);
                      setNewCategoryName("");
                    }
                  }}
                  placeholder="Category name"
                  className="h-7 text-xs"
                />
                <Button
                  variant="none"
                  size="none"
                  className="rounded-md p-1 text-muted-foreground hover:text-foreground"
                  disabled={isCreatingCategory}
                  onClick={submitNewCategory}
                >
                  {isCreatingCategory ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <FolderPlus className="size-3.5" strokeWidth={1.5} />
                  )}
                </Button>
                <Button
                  variant="none"
                  size="none"
                  className="rounded-md p-1 text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    setIsAddingCategory(false);
                    setNewCategoryName("");
                  }}
                >
                  <X className="size-3.5" strokeWidth={1.5} />
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setIsAddingCategory(true)}
              >
                <FolderPlus className="mr-2 size-3.5" strokeWidth={1.5} />
                New Category
              </Button>
            )}
          </div>
        )}

        {!hasAssets &&
          !readOnly &&
          categories.length === 0 &&
          uncategorizedAssets.length === 0 && (
            <p className="py-1 text-xs text-muted-foreground">
              No attachments yet
            </p>
          )}
      </CollapsibleContent>
    </Collapsible>
  );
}
