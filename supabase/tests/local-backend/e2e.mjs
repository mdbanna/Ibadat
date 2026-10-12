// Real-browser verification (headless Chromium) of the built app against the local backend:
// REAL PostgreSQL + REAL PostgREST/RLS; FAKE GoTrue login and FAKE storage (see backend.mjs). Not a Supabase Auth test.
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

const TOOLS = process.env.BROWSER_TOOLS ?? '/tmp/browser'
const req = createRequire(join(TOOLS, 'package.json'))
const puppeteer = req('puppeteer-core')
const chromium = (await import(pathToFileURL(req.resolve('@sparticuz/chromium')).href)).default
const BASE = process.env.APP_URL ?? 'http://127.0.0.1:4173'
const OUT = process.env.SHOT_DIR ?? '/tmp/shots'
mkdirSync(OUT, { recursive: true })
const PASSWORD = 'Test-Pass-1'
const VIEWPORTS = [{ name: 'mobile-360', width: 360, height: 740 }, { name: 'tablet-768', width: 768, height: 1024 }, { name: 'desktop-1280', width: 1280, height: 900 }]
const PUBLIC = ['/', '/about', '/activities', '/activities/winter-relief', '/gallery', '/members', '/join', '/contact', '/login']
const DASH = ['/dashboard', '/dashboard/profile', '/dashboard/contributions', '/dashboard/funds', '/dashboard/reports', '/dashboard/assistance', '/dashboard/employment', '/dashboard/medical', '/dashboard/activities', '/dashboard/announcements', '/dashboard/documents', '/dashboard/settings']

const results = []
const check = (name, ok, detail = '') => { results.push({ name, ok: Boolean(ok), detail }); console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${detail && !ok ? `  -> ${detail}` : ''}`) }

const browser = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: [...chromium.args.filter((a) => !['--single-process', '--no-zygote'].includes(a)), '--no-sandbox'], headless: 'shell' })

async function newPage(vp) {
  const ctx = await browser.createBrowserContext()
  const page = await ctx.newPage()
  await page.setViewport({ width: vp.width, height: vp.height, deviceScaleFactor: 1 })
  const problems = []
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`))
  page.on('console', (m) => { if (m.type() === 'error' && !/status of (400|401|403|404)/.test(m.text())) problems.push(`console: ${m.text()}`) })
  return { page, ctx, problems }
}
const settle = async (page) => { await page.waitForNetworkIdle({ idleTime: 500, timeout: 15000 }).catch(() => {}); await new Promise((r) => setTimeout(r, 150)) }
const go = async (page, path) => { await page.goto(BASE + path, { waitUntil: 'domcontentloaded' }); await page.waitForSelector('h1', { timeout: 15000 }).catch(() => {}); await settle(page) }
const text = (page) => page.evaluate(() => document.body.innerText)
const overflow = (page) => page.evaluate(() => {
  const vw = document.documentElement.clientWidth
  const bad = []
  for (const el of document.body.querySelectorAll('*')) {
    const r = el.getBoundingClientRect()
    if (r.width === 0 || r.height === 0 || r.right <= vw + 1) continue
    // ignore anything inside an element that scrolls horizontally on purpose
    let p = el.parentElement, scrolls = false
    while (p && p !== document.body) { const ox = getComputedStyle(p).overflowX; if (ox === 'auto' || ox === 'scroll' || ox === 'hidden') { scrolls = true; break } p = p.parentElement }
    if (!scrolls) bad.push(`${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : ''} right=${Math.round(r.right)}`)
  }
  return { scrollWidth: document.documentElement.scrollWidth, vw, bad: bad.slice(0, 4) }
})
const h1s = (page) => page.evaluate(() => [...document.querySelectorAll('h1')].map((h) => h.innerText))
const shot = (page, name) => page.screenshot({ path: join(OUT, `${name}.png`), fullPage: true })

async function login(page, id, pw) {
  await page.waitForSelector('input[name="username"]')
  await page.type('input[name="username"]', id)
  await page.type('input[name="password"]', pw)
  await Promise.all([page.click('button[type="submit"]'), settle(page)])
}

for (const vp of VIEWPORTS) {
  console.log(`\n===== ${vp.name} =====`)
  // ------------------------------------------------ public pages
  {
    const { page, ctx, problems } = await newPage(vp)
    for (const path of PUBLIC) {
      await go(page, path)
      const o = await overflow(page)
      const titles = await h1s(page)
      check(`[${vp.name}] ${path}: no horizontal overflow`, o.scrollWidth <= o.vw + 1 && o.bad.length === 0, `scrollWidth ${o.scrollWidth} vs ${o.vw}; ${o.bad.join(', ')}`)
      check(`[${vp.name}] ${path}: exactly one h1`, titles.length === 1, JSON.stringify(titles))
      await shot(page, `${vp.name}-public-${path === '/' ? 'home' : path.slice(1).replace(/\//g, '_')}`)
    }
    await go(page, '/')
    const fonts = await page.evaluate(async () => { await document.fonts.ready; return { bn: document.fonts.check('16px "Hind Siliguri"', 'আমাদের কাজ'), lang: document.documentElement.lang } })
    check(`[${vp.name}] Bengali webfont (Hind Siliguri) loaded and html lang=bn`, fonts.bn && fonts.lang === 'bn', JSON.stringify(fonts))
    check(`[${vp.name}] public pages: no script/console errors`, problems.length === 0, problems.slice(0, 3).join(' | '))
    await ctx.close()
  }

  // ------------------------------------------------ member A: login, persistence, dashboard
  {
    const { page, ctx, problems } = await newPage(vp)
    await go(page, '/dashboard/contributions')
    check(`[${vp.name}] unauthenticated /dashboard/contributions redirects to login with next`, page.url().includes('/login?next=%2Fdashboard%2Fcontributions'), page.url())
    check(`[${vp.name}] dashboard content is not rendered for a visitor`, !(await text(page)).includes('TRX-A1'))

    await page.type('input[name="username"]', 'IBD-0001'); await page.type('input[name="password"]', 'wrong-password')
    await Promise.all([page.click('button[type="submit"]'), settle(page)])
    const err = await page.$eval('[role="alert"]', (e) => e.innerText).catch(() => '')
    check(`[${vp.name}] wrong password shows the generic Bengali error`, err.includes('সদস্য আইডি বা পাসওয়ার্ড সঠিক নয়'), err)
    await shot(page, `${vp.name}-login-error`)

    await page.$eval('input[name="username"]', (e) => { e.value = '' }); await page.$eval('input[name="password"]', (e) => { e.value = '' })
    await page.focus('input[name="username"]'); await page.keyboard.down('Control'); await page.keyboard.press('A'); await page.keyboard.up('Control'); await page.keyboard.press('Backspace')
    await page.type('input[name="username"]', 'ibd-0001'); await page.type('input[name="password"]', PASSWORD)
    await Promise.all([page.click('button[type="submit"]'), settle(page)])
    await page.waitForSelector('nav[aria-label="ড্যাশবোর্ডের অংশসমূহ"]', { timeout: 10000 }).catch(() => {})
    check(`[${vp.name}] correct login returns the member to the requested section`, page.url().endsWith('/dashboard/contributions'), page.url())
    let body = await text(page)
    check(`[${vp.name}] member A sees their own contributions (TRX-A1) and NOT member B's (TRX-B1)`, body.includes('TRX-A1') && !body.includes('TRX-B1'))

    await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForSelector('h1'); await settle(page)
    check(`[${vp.name}] session persists across a page reload`, page.url().endsWith('/dashboard/contributions') && (await text(page)).includes('TRX-A1'), page.url())

    for (const path of DASH) {
      await go(page, path)
      const o = await overflow(page); const titles = await h1s(page); body = await text(page)
      check(`[${vp.name}] ${path}: no horizontal overflow`, o.scrollWidth <= o.vw + 1 && o.bad.length === 0, `scrollWidth ${o.scrollWidth} vs ${o.vw}; ${o.bad.join(', ')}`)
      check(`[${vp.name}] ${path}: one h1 and it is not a raw key`, titles.length === 1 && !/^[a-z]+(\.[A-Za-z0-9]+)+$/.test(titles[0]), JSON.stringify(titles))
      check(`[${vp.name}] ${path}: no beneficiary secrets or other members' data on screen`, !/SECRET|Fatima|Chattogram|01722222222|b@example\.org|TRX-B1|DRAFT report|secret admin notice|Admin handbook/.test(body))
      await shot(page, `${vp.name}-dash-${path === '/dashboard' ? 'overview' : path.split('/').pop()}`)
    }
    // the stored access token cannot read another member in the browser either
    const leak = await page.evaluate(async (base) => {
      const key = Object.keys(localStorage).find((k) => k.endsWith('-auth-token')); const tok = JSON.parse(localStorage.getItem(key)).access_token
      const get = async (p) => (await fetch(`${base}/rest/v1/${p}`, { headers: { authorization: `Bearer ${tok}`, apikey: tok } })).json()
      return { others: await get('profiles?id=eq.b0000000-0000-0000-0000-000000000002&select=id'), all: await get('profiles?select=id'), ben: await get('beneficiaries?select=full_name'), roles: await get('user_roles?select=role') }
    }, 'http://127.0.0.1:3112')
    check(`[${vp.name}] in-browser REST with A's token: B's profile, beneficiaries and roles are invisible`, leak.others.length === 0 && leak.all.length === 1 && leak.ben.length === 0 && leak.roles.length === 0, JSON.stringify(leak))

    // language switching persists
    await go(page, '/dashboard/funds')
    if (vp.width < 1200) { /* language switcher is in the header on every width */ }
    await page.evaluate(() => [...document.querySelectorAll('header button')].find((b) => b.textContent.trim() === 'English')?.click())
    await settle(page)
    check(`[${vp.name}] switching to English translates the dashboard`, (await h1s(page))[0] === 'Fund overview', JSON.stringify(await h1s(page)))
    await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForSelector('h1'); await settle(page)
    check(`[${vp.name}] language choice survives a reload`, (await h1s(page))[0] === 'Fund overview' && (await page.evaluate(() => document.documentElement.lang)) === 'en')
    await shot(page, `${vp.name}-dash-funds-en`)

    // logout
    await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /^(Log out|লগআউট)$/.test(x.textContent.trim())); b?.click() })
    await page.waitForFunction(() => location.pathname === '/login', { timeout: 8000 }).catch(() => {})
    await settle(page)
    check(`[${vp.name}] logout returns to /login`, new URL(page.url()).pathname === '/login', page.url())
    await go(page, '/dashboard/documents')
    check(`[${vp.name}] after logout the dashboard is locked again`, page.url().includes('/login?next='), page.url())
    check(`[${vp.name}] dashboard flow: no script/console errors`, problems.length === 0, problems.slice(0, 3).join(' | '))
    await ctx.close()
  }
}

// ------------------------------------------------ other identities (desktop viewport)
{
  const vp = VIEWPORTS[2]
  for (const [id, label, expectText] of [['ibd-0003', 'pending member', 'আপনার সদস্যপদ এখনো সক্রিয় হয়নি'], ['ibd-0006', 'suspended member', 'আপনার সদস্যপদ বর্তমানে স্থগিত']]) {
    const { page, ctx } = await newPage(vp)
    await go(page, '/login'); await login(page, id, PASSWORD)
    await page.waitForFunction((t) => document.body.innerText.includes(t), { timeout: 8000 }, expectText).catch(() => {})
    const body = await text(page)
    check(`[${vp.name}] ${label}: login is accepted but the dashboard is blocked with a clear message`, body.includes(expectText) && !(await page.$('nav[aria-label="ড্যাশবোর্ডের অংশসমূহ"]')))
    await go(page, '/dashboard/reports')
    check(`[${vp.name}] ${label}: deep link to the dashboard stays blocked`, !(await page.$('nav[aria-label="ড্যাশবোর্ডের অংশসমূহ"]')) && !(await text(page)).includes('সেপ্টেম্বর'))
    await shot(page, `${vp.name}-blocked-${label.split(' ')[0]}`)
    await ctx.close()
  }
  const { page, ctx } = await newPage(vp)
  await go(page, '/login'); await login(page, 'ibd-0002', PASSWORD)
  await go(page, '/dashboard/contributions')
  const body = await text(page)
  check(`[${vp.name}] member B sees only B's contribution and none of A's`, body.includes('TRX-B1') && !body.includes('TRX-A1') && !body.includes('TRX-A3'))
  await go(page, '/dashboard/settings')
  await page.type('input[name="current-password"]', PASSWORD); await page.type('input[name="new-password"]', 'Another-Pass-9'); await page.type('input[name="confirm-password"]', 'Another-Pass-9')
  await Promise.all([page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.includes('পাসওয়ার্ড পরিবর্তন করুন'))?.click()), settle(page)])
  await page.waitForFunction(() => document.body.innerText.includes('পাসওয়ার্ড পরিবর্তন হয়েছে'), { timeout: 8000 }).catch(() => {})
  check(`[${vp.name}] password change flow completes (fake auth backend)`, (await text(page)).includes('পাসওয়ার্ড পরিবর্তন হয়েছে'))
  await ctx.close()
}

await browser.close()
const failed = results.filter((r) => !r.ok)
console.log(`\nE2E SUMMARY: ${results.length - failed.length} passed, ${failed.length} failed`)
if (failed.length) { for (const f of failed) console.log(' - ' + f.name + '  ' + f.detail); process.exit(1) }
