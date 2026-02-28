import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { skillsApi } from '../utils/api';
import type { Profile } from '../types';

export function useSkills() {
  return useQuery({
    queryKey: ['skills'],
    queryFn: skillsApi.getAll,
  });
}

export function useProfiles() {
  return useQuery({
    queryKey: ['profiles'],
    queryFn: skillsApi.getProfiles,
  });
}

export function useProfile(name: string | null) {
  return useQuery({
    queryKey: ['profile', name],
    queryFn: () => name ? skillsApi.getProfile(name) : Promise.resolve(null),
    enabled: !!name,
  });
}

export function useSaveProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ name, data }: { name: string; data: Profile }) =>
      skillsApi.saveProfile(name, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      queryClient.invalidateQueries({ queryKey: ['profile', variables.name] });
    },
  });
}

export function useSyncSkills() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: skillsApi.syncSkills,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skills'] });
    },
  });
}

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: skillsApi.getCategories,
  });
}
