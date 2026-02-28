import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createSafeStorage } from './safeStorage';

export interface CustomCategory {
  name: string;
  icon: string;
  keywords: string;
}

interface CustomCategoryState {
  categories: CustomCategory[];
  addCategory: (category: CustomCategory) => void;
  removeCategory: (name: string) => void;
}

const safeStorage = createSafeStorage<CustomCategoryState>('CustomCategoryStore');

export const useCustomCategoryStore = create<CustomCategoryState>()(
  persist(
    (set) => ({
      categories: [],

      // 防止重複分類名稱
      addCategory: (category) =>
        set((state) => {
          if (state.categories.some(c => c.name === category.name)) return state;
          return { categories: [...state.categories, category] };
        }),

      removeCategory: (name) =>
        set((state) => ({
          categories: state.categories.filter((c) => c.name !== name),
        })),
    }),
    {
      name: 'moyin-custom-categories',
      storage: safeStorage,
    },
  ),
);
