"use client";

import { useState } from "react";
import BookmarksGrid from "@/components/dashboard/bookmarks/BookmarksGrid";
import BookmarksGridSkeleton from "@/components/dashboard/bookmarks/BookmarksGridSkeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTRPC } from "@karakeep/shared-react/trpc";
import { useQuery } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";

export default function AiSearchPage() {
  const api = useTRPC();
  const [text, setText] = useState("");
  const [submittedText, setSubmittedText] = useState("");

  const { data, isFetching, error } = useQuery(
    api.bookmarks.searchBookmarksSemantic.queryOptions(
      { text: submittedText },
      { enabled: submittedText.length > 0 },
    ),
  );

  return (
    <div className="flex flex-col gap-4">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setSubmittedText(text);
        }}
      >
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Hỏi bằng ngôn ngữ tự nhiên, vd: tài liệu về lịch sử AI..."
          className="flex-1"
        />
        <Button type="submit" disabled={isFetching || text.trim().length === 0}>
          <Sparkles className="mr-2 size-4" />
          {isFetching ? "Đang tìm..." : "Tìm"}
        </Button>
      </form>

      {error && (
        <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error.message}
        </p>
      )}

      {submittedText.length > 0 && isFetching && <BookmarksGridSkeleton />}

      {submittedText.length > 0 && !isFetching && data && (
        <>
          {data.bookmarks.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Không tìm thấy kết quả nào có liên quan về mặt ngữ nghĩa.
            </p>
          ) : (
            <BookmarksGrid
              bookmarks={data.bookmarks}
              hasNextPage={false}
              fetchNextPage={() => undefined}
              isFetchingNextPage={false}
            />
          )}
        </>
      )}
    </div>
  );
}
