import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useTRPC } from "../trpc";

type TRPCApi = ReturnType<typeof useTRPC>;

export function useAttachBookmarkAsset(
  opts?: Parameters<TRPCApi["assets"]["attachAsset"]["mutationOptions"]>[0],
) {
  const api = useTRPC();
  const queryClient = useQueryClient();
  return useMutation(
    api.assets.attachAsset.mutationOptions({
      ...opts,
      onSuccess: (res, req, meta, context) => {
        queryClient.invalidateQueries(api.bookmarks.getBookmarks.pathFilter());
        queryClient.invalidateQueries(
          api.bookmarks.searchBookmarks.pathFilter(),
        );
        queryClient.invalidateQueries(
          api.bookmarks.getBookmark.queryFilter({ bookmarkId: req.bookmarkId }),
        );
        queryClient.invalidateQueries(api.assets.list.pathFilter());
        return opts?.onSuccess?.(res, req, meta, context);
      },
    }),
  );
}

export function useReplaceBookmarkAsset(
  opts?: Parameters<TRPCApi["assets"]["replaceAsset"]["mutationOptions"]>[0],
) {
  const api = useTRPC();
  const queryClient = useQueryClient();
  return useMutation(
    api.assets.replaceAsset.mutationOptions({
      ...opts,
      onSuccess: (res, req, meta, context) => {
        queryClient.invalidateQueries(api.bookmarks.getBookmarks.pathFilter());
        queryClient.invalidateQueries(
          api.bookmarks.searchBookmarks.pathFilter(),
        );
        queryClient.invalidateQueries(
          api.bookmarks.getBookmark.queryFilter({ bookmarkId: req.bookmarkId }),
        );
        queryClient.invalidateQueries(api.assets.list.pathFilter());
        return opts?.onSuccess?.(res, req, meta, context);
      },
    }),
  );
}

export function useDetachBookmarkAsset(
  opts?: Parameters<TRPCApi["assets"]["detachAsset"]["mutationOptions"]>[0],
) {
  const api = useTRPC();
  const queryClient = useQueryClient();
  return useMutation(
    api.assets.detachAsset.mutationOptions({
      ...opts,
      onSuccess: (res, req, meta, context) => {
        queryClient.invalidateQueries(api.bookmarks.getBookmarks.pathFilter());
        queryClient.invalidateQueries(
          api.bookmarks.searchBookmarks.pathFilter(),
        );
        queryClient.invalidateQueries(
          api.bookmarks.getBookmark.queryFilter({ bookmarkId: req.bookmarkId }),
        );
        queryClient.invalidateQueries(api.assets.list.pathFilter());
        return opts?.onSuccess?.(res, req, meta, context);
      },
    }),
  );
}

export function useAssetCategories(
  opts?: Parameters<TRPCApi["assets"]["listCategories"]["queryOptions"]>[0],
) {
  const api = useTRPC();
  return useQuery(api.assets.listCategories.queryOptions(opts));
}

export function useCreateAssetCategory(
  opts?: Parameters<TRPCApi["assets"]["createCategory"]["mutationOptions"]>[0],
) {
  const api = useTRPC();
  const queryClient = useQueryClient();
  return useMutation(
    api.assets.createCategory.mutationOptions({
      ...opts,
      onSuccess: (res, req, meta, context) => {
        queryClient.invalidateQueries(api.assets.listCategories.pathFilter());
        return opts?.onSuccess?.(res, req, meta, context);
      },
    }),
  );
}

export function useDeleteAssetCategory(
  opts?: Parameters<TRPCApi["assets"]["deleteCategory"]["mutationOptions"]>[0],
) {
  const api = useTRPC();
  const queryClient = useQueryClient();
  return useMutation(
    api.assets.deleteCategory.mutationOptions({
      ...opts,
      onSuccess: (res, req, meta, context) => {
        queryClient.invalidateQueries(api.assets.listCategories.pathFilter());
        queryClient.invalidateQueries(api.bookmarks.getBookmarks.pathFilter());
        queryClient.invalidateQueries(
          api.bookmarks.searchBookmarks.pathFilter(),
        );
        queryClient.invalidateQueries(api.bookmarks.getBookmark.pathFilter());
        return opts?.onSuccess?.(res, req, meta, context);
      },
    }),
  );
}

export function useSetAssetCategory(
  opts?: Parameters<TRPCApi["assets"]["setAssetCategory"]["mutationOptions"]>[0],
) {
  const api = useTRPC();
  const queryClient = useQueryClient();
  return useMutation(
    api.assets.setAssetCategory.mutationOptions({
      ...opts,
      onSuccess: (res, req, meta, context) => {
        queryClient.invalidateQueries(api.bookmarks.getBookmarks.pathFilter());
        queryClient.invalidateQueries(
          api.bookmarks.searchBookmarks.pathFilter(),
        );
        queryClient.invalidateQueries(api.bookmarks.getBookmark.pathFilter());
        return opts?.onSuccess?.(res, req, meta, context);
      },
    }),
  );
}
