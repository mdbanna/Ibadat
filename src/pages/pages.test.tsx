import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import axe from 'axe-core'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeFakeSupabase } from '../test/fakeSupabase'

const h = vi.hoisted(() => ({ client: null as unknown }))
vi.mock('../lib/supabase', () => ({
  get supabase() { return h.client },
  get isSupabaseConfigured() { return Boolean(h.client) },
  requireSupabase() { if (!h.client) throw new Error('supabase_not_configured'); return h.client },
}))

import { AppShell } from '../components/layout'
import i18n from '../i18n'
import AboutPage from './AboutPage'
import ActivitiesPage from './ActivitiesPage'
import ActivityDetailPage from './ActivityDetailPage'
import ContactPage from './ContactPage'
import GalleryPage from './GalleryPage'
import HomePage from './HomePage'
import JoinPage from './JoinPage'
import MembersPage from './MembersPage'

const activities = [
  { id: 'a1', slug: 'food-relief', title_bn: 'খাদ্য সহায়তা', title_en: 'Food relief', description_bn: 'বিবরণ', description_en: 'Details', activity_date: '2026-09-01', general_location: 'Dhaka', cover_image_path: 'covers/a1.jpg', publication_status: 'published' },
  { id: 'a2', slug: 'bn-only', title_bn: 'শুধু বাংলা শিরোনাম', title_en: null, description_bn: null, description_en: null, activity_date: null, general_location: null, cover_image_path: null, publication_status: 'published' },
]
const gallery = [
  { id: 'g1', image_path: 'g/one.jpg', caption_bn: 'ছবি এক', caption_en: 'Photo one', image_date: '2026-09-01', related_activity_id: 'a1', publication_status: 'published', privacy_level: 'public' },
  { id: 'g2', image_path: 'g/two.jpg', caption_bn: null, caption_en: null, image_date: null, related_activity_id: null, publication_status: 'published', privacy_level: 'public' },
]
const members = [{ id: 'm1', full_name: 'আব্দুল করিম', profile_image_path: null, short_bio: 'শিক্ষক', general_location: 'ঢাকা' }]

function setup() {
  const fake = makeFakeSupabase(
    { activities, gallery_images: gallery },
    { list_public_member_profiles: () => ({ data: members, error: null }) },
  )
  h.client = fake.client
  return fake
}

const pages: Array<[string, string, () => React.ReactElement]> = [
  ['/', 'home', () => <HomePage />],
  ['/about', 'about', () => <AboutPage />],
  ['/activities', 'activities', () => <ActivitiesPage />],
  ['/activities/food-relief', 'activity detail', () => <ActivityDetailPage />],
  ['/gallery', 'gallery', () => <GalleryPage />],
  ['/members', 'members', () => <MembersPage />],
  ['/join', 'join', () => <JoinPage />],
  ['/contact', 'contact', () => <ContactPage />],
]

function renderAt(path: string, element: React.ReactElement) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={element} />
          <Route path="/about" element={element} />
          <Route path="/activities" element={element} />
          <Route path="/activities/:slug" element={element} />
          <Route path="/gallery" element={element} />
          <Route path="/members" element={element} />
          <Route path="/join" element={element} />
          <Route path="/contact" element={element} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

const KEY_PATTERN = /^[a-z][A-Za-z0-9]*(\.[A-Za-z0-9]+)+$/

describe.each(['bn', 'en'] as const)('public pages in %s', (lang) => {
  beforeEach(async () => { setup(); await i18n.changeLanguage(lang) })

  it.each(pages)('%s (%s): one h1, landmarks, no raw translation keys, no donate action, no accessibility violations', async (path, _name, make) => {
    const { container } = renderAt(path, make())
    // let data-driven sections settle
    await waitFor(() => expect(screen.queryByText(i18n.t('common.loading'))).not.toBeInTheDocument())
    await screen.findAllByRole('heading', { level: 1 })

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByRole('banner')).toBeInTheDocument()
    expect(screen.getByRole('main')).toBeInTheDocument()
    expect(screen.getByRole('contentinfo')).toBeInTheDocument()
    expect(document.documentElement.lang).toBe(lang)

    // no untranslated keys leaking into the UI
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
    for (let n = walker.nextNode(); n; n = walker.nextNode()) expect((n.textContent ?? '').trim()).not.toMatch(KEY_PATTERN)

    // contributions are member-only: no donate button or link anywhere
    for (const el of [...screen.queryAllByRole('link'), ...screen.queryAllByRole('button')]) {
      expect(`${el.textContent} ${el.getAttribute('href') ?? ''}`).not.toMatch(/donate|donation|অনুদান দিন/i)
    }

    const results = await axe.run(container, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
      rules: { 'color-contrast': { enabled: false } }, // jsdom has no layout; contrast is covered by design.test.ts
    })
    expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([])
  })
})

describe('home page', () => {
  beforeEach(() => { setup() })
  it('explains that contributions come only from registered members and offers membership, not donation', async () => {
    renderAt('/', <HomePage />)
    expect(screen.getByRole('heading', { name: 'শুধু নিবন্ধিত সদস্যদের অনুদান গ্রহণ করা হয়' })).toBeInTheDocument()
    const links = screen.getAllByRole('link', { name: 'সদস্য হতে আবেদন করুন' })
    expect(links.length).toBeGreaterThan(0)
    for (const l of links) expect(l).toHaveAttribute('href', '/join')
  })
  it('shows published activities with localized titles and falls back to the other language', async () => {
    renderAt('/activities', <ActivitiesPage />)
    expect(await screen.findByRole('link', { name: 'খাদ্য সহায়তা' })).toHaveAttribute('href', '/activities/food-relief')
    expect(screen.getByRole('link', { name: 'শুধু বাংলা শিরোনাম' })).toBeInTheDocument()
    await i18n.changeLanguage('en')
    expect(await screen.findByRole('link', { name: 'Food relief' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'শুধু বাংলা শিরোনাম' })).toBeInTheDocument() // no English title -> falls back
  })
})

describe('language switcher', () => {
  beforeEach(() => { setup() })
  it('switches language, updates <html lang> and the page, and remembers the choice across navigation', async () => {
    const user = userEvent.setup()
    renderAt('/about', <AboutPage />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('IBADAT সম্পর্কে')
    const group = screen.getByRole('group', { name: /ভাষা পরিবর্তন করুন/ })
    await user.click(within(group).getByRole('button', { name: 'English' }))
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('About IBADAT')
    expect(document.documentElement.lang).toBe('en')
    expect(localStorage.getItem('ibadat.lang')).toBe('en')
    await user.click(screen.getAllByRole('link', { name: 'Home' })[0])
    expect(screen.getByRole('button', { name: 'English' })).toHaveAttribute('aria-pressed', 'true')
  })
})

describe('gallery', () => {
  beforeEach(() => { setup() })
  it('opens an image in an accessible dialog and navigates between images', async () => {
    const user = userEvent.setup()
    renderAt('/gallery', <GalleryPage />)
    const first = await screen.findByRole('button', { name: /ছবি এক/ })
    await user.click(first)
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('img', { name: 'ছবি এক' })).toHaveAttribute('src', 'https://signed.test/g/one.jpg')
    await user.click(within(dialog).getByRole('button', { name: 'পরের ছবি' }))
    expect(within(dialog).getByRole('img', { name: 'IBADAT-এর কার্যক্রমের ছবি' })).toHaveAttribute('src', 'https://signed.test/g/two.jpg')
  })
})

describe('members page', () => {
  it('lists only what the opt-in + approval function returns', async () => {
    const fake = setup()
    renderAt('/members', <MembersPage />)
    expect(await screen.findByRole('heading', { level: 3, name: 'আব্দুল করিম' })).toBeInTheDocument()
    expect(fake.rpc).toHaveBeenCalledWith('list_public_member_profiles', { p_limit: 24, p_offset: 0 })
    expect(fake.queries.some((q) => q.table === 'profiles')).toBe(false)
  })
  it('shows an honest empty state when nobody has opted in and been approved', async () => {
    h.client = makeFakeSupabase({}, { list_public_member_profiles: () => ({ data: [], error: null }) }).client
    renderAt('/members', <MembersPage />)
    expect(await screen.findByText('এখনো কোনো সদস্যের প্রোফাইল প্রকাশিত হয়নি')).toBeInTheDocument()
  })
})

describe('contact page', () => {
  it('does not invent contact details when none are configured', async () => {
    setup()
    renderAt('/contact', <ContactPage />)
    expect(screen.getByText(/যোগাযোগের তথ্য শীঘ্রই এখানে প্রকাশ করা হবে/)).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /@/ })).not.toBeInTheDocument()
  })
})

describe('without a Supabase configuration', () => {
  beforeEach(() => { h.client = null })
  it.each(pages)('%s (%s) renders without crashing', async (path, _name, make) => {
    renderAt(path, make())
    expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument()
  })
  it('data pages say the connection is not configured', async () => {
    renderAt('/gallery', <GalleryPage />)
    expect(await screen.findByText('ডাটাবেস সংযোগ এখনো কনফিগার করা হয়নি')).toBeInTheDocument()
  })
})
