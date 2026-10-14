import { findCategory, visibleMains } from '@/data/catalog';
import { BASE_CATEGORIES, POPULAR_IDS } from '@/data/categorySeed';

export const CATEGORIES = BASE_CATEGORIES;

export const POPULAR_CATEGORIES = BASE_CATEGORIES.filter((item) => POPULAR_IDS.includes(item.id));

export function getCategoryById(id) {
  return findCategory(id);
}

export function getVisibleCategories() {
  return visibleMains();
}
