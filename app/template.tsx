'use client';

import { motion } from 'framer-motion';
import { fadePage } from '@/lib/motion-variants';

export default function Template({ children }: { children: React.ReactNode }) {
  return <motion.div {...fadePage}>{children}</motion.div>;
}
