export const fadePage = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.20, ease: 'easeInOut' as const } },
  exit:    { opacity: 0, transition: { duration: 0.15, ease: 'easeInOut' as const } },
};

export const fadePanel = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.18 } },
  exit:    { opacity: 0, transition: { duration: 0.12 } },
};
