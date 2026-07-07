import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CopyBtnV2 } from "@/components/ui/copy-button";
import MarkdownEditor from "@/components/ui/markdown/markdown-editor";
import { MarkdownReadonly } from "@/components/ui/markdown/markdown-readonly";
import { toast } from "@/components/ui/sonner";
import { useClientConfig } from "@/lib/clientConfig";
import { Pencil, Plus } from "lucide-react";

import type { ZBookmark } from "@karakeep/shared/types/bookmarks";
import { useUpdateBookmark } from "@karakeep/shared-react/hooks/bookmarks";

export function NoteEditor({
  bookmark,
  disabled,
}: {
  bookmark: ZBookmark;
  disabled?: boolean;
}) {
  const demoMode = !!useClientConfig().demoMode;
  const isDisabled = demoMode || disabled;
  const note = bookmark.note ?? "";
  const [isEditing, setIsEditing] = useState(false);

  const updateBookmarkMutator = useUpdateBookmark({
    onSuccess: () => {
      toast({ description: "The bookmark has been updated!" });
      setIsEditing(false);
    },
    onError: () => {
      toast({
        description: "Something went wrong while saving the note",
        variant: "destructive",
      });
    },
  });

  const saveNote = (text: string) => {
    updateBookmarkMutator.mutate({
      bookmarkId: bookmark.id,
      note: text,
    });
  };

  if (!note && !isEditing) {
    return (
      <Button
        variant="outline"
        size="sm"
        disabled={isDisabled}
        onClick={() => setIsEditing(true)}
      >
        <Plus className="mr-2 size-4" />
        Add a note
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="min-h-[8rem] w-full overflow-hidden rounded-md border bg-background">
        {isEditing ? (
          <div className="h-64">
            <MarkdownEditor
              onSave={saveNote}
              isSaving={updateBookmarkMutator.isPending}
            >
              {note}
            </MarkdownEditor>
          </div>
        ) : (
          <div className="p-2.5 text-sm">
            <MarkdownReadonly onSave={saveNote}>{note}</MarkdownReadonly>
          </div>
        )}
      </div>
      {!isDisabled && (
        <div className="flex justify-end gap-1">
          <CopyBtnV2 getStringToCopy={() => note} />
          {!isEditing && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditing(true)}
            >
              <Pencil className="mr-2 size-4" />
              Edit
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
