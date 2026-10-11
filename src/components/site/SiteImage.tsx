import { useState } from 'react'
import { cx } from '../../lib/cx'

interface Props {
  url?: string
  /** Use '' when the image is decorative or already described by a surrounding control. */
  alt: string
  ratio?: string
  className?: string
}

/** Fixed aspect ratio (no layout shift), lazy loading and a quiet placeholder while the signed URL resolves or if it fails. */
export function SiteImage({ url, alt, ratio = '4 / 3', className }: Props) {
  const [failed, setFailed] = useState(false)
  return (
    <div className={cx('relative overflow-hidden bg-forest-soft', className)} style={{ aspectRatio: ratio }}>
      {url && !failed ? (
        <img src={url} alt={alt} loading="lazy" decoding="async" onError={() => setFailed(true)} className="absolute inset-0 size-full object-cover" />
      ) : (
        <svg aria-hidden viewBox="0 0 64 64" className="absolute inset-0 m-auto size-1/4 text-leaf/60">
          <path d="M32 10c9 9 14 16 14 24a14 14 0 0 1-28 0c0-8 5-15 14-24z" fill="currentColor" />
        </svg>
      )}
    </div>
  )
}
