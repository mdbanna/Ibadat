import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, EmptyState, ErrorMessage, Modal } from '../components/ui'
import { DataBoundary } from '../components/site/DataBoundary'
import { PageHero, Section } from '../components/site/Sections'
import { SiteImage } from '../components/site/SiteImage'
import { listGalleryImages, type GalleryImage } from '../lib/content'
import { formatDate, pickLocalized } from '../lib/localize'
import { usePaged } from '../lib/useAsync'
import { usePageMeta } from '../lib/usePageMeta'
import { useSignedUrls } from '../lib/useSignedUrls'
import type { Language } from '../i18n'

const PAGE_SIZE = 24

export default function GalleryPage() {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage as Language
  usePageMeta('gallery')
  const list = usePaged((offset, limit) => listGalleryImages(offset, limit), PAGE_SIZE)
  const urls = useSignedUrls('gallery', list.items.map((g) => g.image_path))
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  const caption = (g: GalleryImage) => pickLocalized(g.caption_bn, g.caption_en, lang)
  const current = openIndex === null ? null : list.items[openIndex]
  const step = (delta: number) =>
    setOpenIndex((i) => (i === null ? i : (i + delta + list.items.length) % list.items.length))

  return (
    <>
      <PageHero title={t('galleryPage.title')} lead={t('galleryPage.lead')} />
      <Section>
        <p className="max-w-3xl text-muted">{t('galleryPage.privacy')}</p>
        <DataBoundary status={list.status} onRetry={list.reload}>
          {list.items.length === 0 ? (
            <EmptyState title={t('galleryPage.empty')} description={t('galleryPage.emptyHint')} />
          ) : (
            <>
              <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 xl:grid-cols-4">
                {list.items.map((g, i) => (
                  <li key={g.id}>
                    <button
                      type="button"
                      onClick={() => setOpenIndex(i)}
                      aria-label={`${caption(g) || t('galleryPage.fallbackAlt')} — ${t('galleryPage.open')}`}
                      className="group block w-full overflow-hidden rounded-lg border border-line text-start"
                    >
                      <SiteImage url={urls[g.image_path]} alt="" className="transition-transform duration-300 group-hover:scale-[1.03]" />
                    </button>
                    {caption(g) && <p className="mt-1.5 text-sm text-muted">{caption(g)}</p>}
                  </li>
                ))}
              </ul>
              {list.moreError && <ErrorMessage onRetry={list.loadMore} />}
              {list.hasMore && (
                <div className="flex justify-center">
                  <Button variant="secondary" loading={list.loadingMore} onClick={list.loadMore}>{t('common.loadMore')}</Button>
                </div>
              )}
            </>
          )}
        </DataBoundary>
      </Section>

      <Modal
        wide
        open={current !== null}
        onClose={() => setOpenIndex(null)}
        title={current ? caption(current) || t('galleryPage.lightboxTitle') : t('galleryPage.lightboxTitle')}
        footer={list.items.length > 1 ? (
          <>
            <Button variant="secondary" onClick={() => step(-1)}>{t('galleryPage.prev')}</Button>
            <Button variant="secondary" onClick={() => step(1)}>{t('galleryPage.next')}</Button>
          </>
        ) : undefined}
      >
        {current && (
          <div
            className="flex flex-col gap-3"
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight') step(i18n.dir() === 'rtl' ? -1 : 1)
              if (e.key === 'ArrowLeft') step(i18n.dir() === 'rtl' ? 1 : -1)
            }}
          >
            {urls[current.image_path] ? (
              <img src={urls[current.image_path]} alt={caption(current) || t('galleryPage.fallbackAlt')} className="max-h-[70dvh] w-full rounded-lg object-contain" />
            ) : (
              <p className="p-6 text-center text-muted">{t('galleryPage.unavailable')}</p>
            )}
            {current.image_date && <p className="text-sm text-muted">{formatDate(current.image_date, lang)}</p>}
          </div>
        )}
      </Modal>
    </>
  )
}
