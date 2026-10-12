import '@testing-library/jest-dom/vitest'
import { cleanup, configure } from '@testing-library/react'
import { afterEach, vi } from 'vitest'
import i18n from '../i18n'

// Lazy route chunks + axe make some tests slow under CPU load; the default 1s wait caused rare flakes.
configure({ asyncUtilTimeout: 5000 })

// jsdom gaps
window.scrollTo = vi.fn()
if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) { this.removeAttribute('open'); this.dispatchEvent(new Event('close')) }
}

afterEach(async () => {
  cleanup()
  await i18n.changeLanguage('bn')
})
