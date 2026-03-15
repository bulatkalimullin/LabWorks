import { motion } from 'framer-motion'

export default function AnimatedCard({
  children,
  delay = 0,
}: {
  children: React.ReactNode
  delay?: number
}) {
  return (
    <motion.div
      className="glass card-hover"
      style={{ padding: '1.25rem' }}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35 }}
    >
      {children}
    </motion.div>
  )
}
