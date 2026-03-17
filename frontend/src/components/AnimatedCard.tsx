export default function AnimatedCard({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div
      className="glass card-hover"
      style={{ padding: '1.25rem' }}
    >
      {children}
    </div>
  )
}
