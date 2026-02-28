/**
 * Moyin Brand Animation Configurations
 * 使用 Framer Motion 實現品牌動效
 */

import type { Variants, Transition } from 'framer-motion';

/**
 * 淡入動畫
 * 用途：元素進場
 */
export const fadeIn: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

/**
 * 過渡配置（內部使用）
 */
const transitions = {
  fast: { duration: 0.15, ease: 'easeOut' } as Transition,
};

/**
 * 懸停動畫
 */
export const hoverScale = {
  scale: 1.02,
  transition: transitions.fast,
};
