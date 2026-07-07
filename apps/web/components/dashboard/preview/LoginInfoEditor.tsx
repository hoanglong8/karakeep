import { useState } from "react";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/sonner";
import { useClientConfig } from "@/lib/clientConfig";
import { useTranslation } from "@/lib/i18n/client";
import { Eye, EyeOff } from "lucide-react";

import type { ZBookmark } from "@karakeep/shared/types/bookmarks";
import { useUpdateBookmark } from "@karakeep/shared-react/hooks/bookmarks";

export function LoginInfoEditor({
  bookmark,
  disabled,
}: {
  bookmark: ZBookmark;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const demoMode = !!useClientConfig().demoMode;
  const [showPassword, setShowPassword] = useState(false);

  const updateBookmarkMutator = useUpdateBookmark({
    onSuccess: () => {
      toast({
        description: t("toasts.bookmarks.updated"),
      });
    },
    onError: () => {
      toast({
        description: "Something went wrong while saving the login info",
        variant: "destructive",
      });
    },
  });

  const isDisabled = demoMode || disabled;

  return (
    <div className="flex flex-col gap-2">
      <Input
        className="w-full text-sm"
        defaultValue={bookmark.loginUrl ?? ""}
        disabled={isDisabled}
        placeholder={t("preview.login_info.link_placeholder")}
        onBlur={(e) => {
          if (e.currentTarget.value === (bookmark.loginUrl ?? "")) {
            return;
          }
          updateBookmarkMutator.mutate({
            bookmarkId: bookmark.id,
            loginUrl: e.currentTarget.value || null,
          });
        }}
      />
      <Input
        className="w-full text-sm"
        defaultValue={bookmark.loginUsername ?? ""}
        disabled={isDisabled}
        placeholder={t("preview.login_info.username_placeholder")}
        onBlur={(e) => {
          if (e.currentTarget.value === (bookmark.loginUsername ?? "")) {
            return;
          }
          updateBookmarkMutator.mutate({
            bookmarkId: bookmark.id,
            loginUsername: e.currentTarget.value || null,
          });
        }}
      />
      <Input
        className="w-full text-sm"
        type={showPassword ? "text" : "password"}
        defaultValue={bookmark.loginPassword ?? ""}
        disabled={isDisabled}
        placeholder={t("preview.login_info.password_placeholder")}
        endIcon={
          <button
            type="button"
            aria-label={
              showPassword
                ? t("preview.login_info.hide_password")
                : t("preview.login_info.show_password")
            }
            onClick={() => setShowPassword((v) => !v)}
            className="text-muted-foreground hover:text-foreground"
          >
            {showPassword ? (
              <EyeOff className="size-4" />
            ) : (
              <Eye className="size-4" />
            )}
          </button>
        }
        onBlur={(e) => {
          if (e.currentTarget.value === (bookmark.loginPassword ?? "")) {
            return;
          }
          updateBookmarkMutator.mutate({
            bookmarkId: bookmark.id,
            loginPassword: e.currentTarget.value || null,
          });
        }}
      />
    </div>
  );
}
