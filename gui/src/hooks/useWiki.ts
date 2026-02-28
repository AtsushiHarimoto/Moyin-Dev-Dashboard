import { useQuery } from '@tanstack/react-query';
import { wikiApi } from '../utils/api';
import type { WikiCategory, WikiProject, WikiFile, WikiContent } from '../types';

export function useWikiCategories() {
  return useQuery<WikiCategory[]>({
    queryKey: ['wiki', 'categories'],
    queryFn: () => wikiApi.getCategories(),
  });
}

export function useWikiProjects(category: string | null) {
  return useQuery<WikiProject[]>({
    queryKey: ['wiki', 'projects', category],
    queryFn: () => wikiApi.getProjects(category!),
    enabled: !!category,
  });
}

export function useWikiFiles(projectId: string | null) {
  return useQuery<WikiFile[]>({
    queryKey: ['wiki', 'files', projectId],
    queryFn: () => wikiApi.getFiles(projectId!),
    enabled: !!projectId,
  });
}

export function useWikiContent(fileId: string | null) {
  return useQuery<WikiContent>({
    queryKey: ['wiki', 'content', fileId],
    queryFn: () => wikiApi.getContent(fileId!),
    enabled: !!fileId,
  });
}
