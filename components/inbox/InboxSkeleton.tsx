export function MessageListSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      {[
        { isMe: false, w: 'w-40' },
        { isMe: false, w: 'w-56' },
        { isMe: true, w: 'w-32' },
        { isMe: false, w: 'w-48' },
        { isMe: true, w: 'w-44' },
      ].map((row, i) => (
        <div key={i} className={`flex items-end gap-2 ${row.isMe ? 'flex-row-reverse' : ''}`}>
          {!row.isMe && <div className="h-7 w-7 shrink-0 animate-pulse rounded-full bg-muted" />}
          <div className={`h-8 ${row.w} animate-pulse rounded-2xl bg-muted`} />
        </div>
      ))}
    </div>
  )
}
