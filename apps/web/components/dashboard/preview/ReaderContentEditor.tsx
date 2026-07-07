"use client";

import { useCallback, useRef, useState } from "react";
import { ActionButton } from "@/components/ui/action-button";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import useUpload from "@/lib/hooks/upload-file";
import { useTranslation } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import {
  Bold,
  Heading2,
  Italic,
  Link as LinkIcon,
  List,
  Loader2,
  Underline,
} from "lucide-react";

import { useUpdateBookmark } from "@karakeep/shared-react/hooks/bookmarks";
import { getAssetUrl } from "@karakeep/shared/utils/assetUtils";

export default function ReaderContentEditor({
  bookmarkId,
  initialHtml,
  className,
  style,
  onDone,
}: {
  bookmarkId: string;
  initialHtml: string;
  className?: string;
  style?: React.CSSProperties;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const contentRef = useRef<HTMLDivElement>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  // Seed the contentEditable's DOM once on mount via an imperative ref
  // callback instead of `dangerouslySetInnerHTML`. The latter is a *prop*
  // React reconciles on every re-render; since typing/pasting mutates the
  // DOM directly (outside React's model), any unrelated re-render of this
  // component (e.g. the isUploadingImage spinner toggling) would make React
  // reapply the original `initialHtml`, wiping out in-progress edits. A
  // `useCallback` with no deps is only invoked on actual mount/unmount, so
  // it can't clobber later edits.
  const setContentRef = useCallback((node: HTMLDivElement | null) => {
    contentRef.current = node;
    if (node) {
      node.innerHTML = initialHtml;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { mutateAsync: uploadImage } = useUpload({
    onError: () => {
      toast({
        description: t("preview.image_upload_failed"),
        variant: "destructive",
      });
    },
  });

  const updateBookmarkMutator = useUpdateBookmark({
    onSuccess: () => {
      toast({ description: t("preview.content_updated") });
      onDone();
    },
    onError: () => {
      toast({
        description: t("preview.content_update_failed"),
        variant: "destructive",
      });
    },
  });

  const exec = (command: string, value?: string) => {
    contentRef.current?.focus();
    document.execCommand(command, false, value);
  };

  const handlePaste = async (e: React.ClipboardEvent<HTMLDivElement>) => {
    const items = e.clipboardData?.items;
    if (!items) {
      return;
    }
    for (const item of items) {
      if (item.type.startsWith("image")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) {
          continue;
        }
        setIsUploadingImage(true);
        try {
          const resp = await uploadImage(file);
          contentRef.current?.focus();
          document.execCommand(
            "insertHTML",
            false,
            `<img src="${getAssetUrl(resp.assetId)}" alt="pasted image" />`,
          );
        } finally {
          setIsUploadingImage(false);
        }
        return;
      }
    }
  };

  const handleSave = () => {
    if (!contentRef.current) {
      return;
    }
    updateBookmarkMutator.mutate({
      bookmarkId,
      htmlContent: contentRef.current.innerHTML,
    });
  };

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex flex-wrap items-center gap-1 border-b px-2 py-1.5">
        <Button
          variant="ghost"
          size="sm"
          aria-label="Bold"
          onClick={() => exec("bold")}
        >
          <Bold className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          aria-label="Italic"
          onClick={() => exec("italic")}
        >
          <Italic className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          aria-label="Underline"
          onClick={() => exec("underline")}
        >
          <Underline className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          aria-label="Heading"
          onClick={() => exec("formatBlock", "h2")}
        >
          <Heading2 className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          aria-label="Bullet list"
          onClick={() => exec("insertUnorderedList")}
        >
          <List className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          aria-label="Link"
          onClick={() => {
            const url = window.prompt("Link URL");
            if (url) {
              exec("createLink", url);
            }
          }}
        >
          <LinkIcon className="size-4" />
        </Button>
        {isUploadingImage && (
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        )}
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={onDone}>
            {t("preview.cancel_edit")}
          </Button>
          <ActionButton
            size="sm"
            loading={updateBookmarkMutator.isPending}
            onClick={handleSave}
          >
            {t("preview.save_content")}
          </ActionButton>
        </div>
      </div>
      <div
        ref={setContentRef}
        contentEditable
        suppressContentEditableWarning
        onPaste={handlePaste}
        className={cn(
          "prose prose-neutral min-h-0 max-w-none flex-1 overflow-y-auto overflow-x-hidden break-words px-3 py-2 outline-none dark:prose-invert [&_code]:break-all [&_img]:h-auto [&_img]:max-w-full [&_pre]:overflow-x-auto [&_table]:block [&_table]:overflow-x-auto",
          className,
        )}
        style={style}
      />
    </div>
  );
}
