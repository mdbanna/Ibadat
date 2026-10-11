import { SiteImage } from './SiteImage'
import type { PublicMember } from '../../lib/content'
import { initials } from '../../lib/localize'

export function MemberCard({ member, photoUrl }: { member: PublicMember; photoUrl?: string }) {
  return (
    <article className="flex h-full gap-4 rounded-(--radius-card) border border-line bg-surface p-4 shadow-(--shadow-card)">
      {photoUrl ? (
        <SiteImage url={photoUrl} alt="" ratio="1 / 1" className="size-16 shrink-0 rounded-full" />
      ) : (
        <span aria-hidden className="grid size-16 shrink-0 place-items-center rounded-full bg-forest-soft text-lg font-bold text-forest-deep">{initials(member.full_name)}</span>
      )}
      <div className="min-w-0">
        <h3 className="break-words text-lg font-bold">{member.full_name}</h3>
        {member.general_location && <p className="text-sm text-muted">{member.general_location}</p>}
        {member.short_bio && <p className="mt-1 text-ink/90">{member.short_bio}</p>}
      </div>
    </article>
  )
}
