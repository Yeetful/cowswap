import { ReactNode, useCallback, useEffect, useRef, useState } from 'react'

import { useWalletInfo } from '@cowprotocol/wallet'

import styled from 'styled-components/macro'

// Yeetful embeddable chat (https://www.yeetful.com) — an agentic chat scoped to
// CoW Protocol + Snapshot MCPs with Yeetful's transaction-building guardrails.
// Equivalent to `mountYeetfulChat()` from the `yeetful/embed` npm module, done
// natively in React so the fork carries no extra dependency.
const EMBED_ORIGIN = process.env.REACT_APP_YEETFUL_EMBED_ORIGIN || 'https://www.yeetful.com'
const EMBED_MCPS = process.env.REACT_APP_YEETFUL_EMBED_MCPS || 'cow-free,snapshot-free'
// PUBLIC embed key (publishable by design, like a Stripe publishable key) —
// attributes this embed to the owning Yeetful account: the site shows under
// the dashboard's "Your embeds", turns feed its analytics, and house-model
// answers bill the owner's plan instead of each visitor's free tier.
const EMBED_KEY = process.env.REACT_APP_YEETFUL_EMBED_KEY || 'yfe_8aa8ef595a498c1fe15683b7'

// Embed postMessage contract v1: every payload is { source: 'yeetful-embed', v: 1, type, ... }
const MSG_SOURCE = 'yeetful-embed'

const LAUNCHER_Z_INDEX = 1050 // between theme fixed (1030) and modal (1060)

const Launcher = styled.button`
  position: fixed;
  bottom: 24px;
  right: 24px;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: #0a0a0a;
  color: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  z-index: ${LAUNCHER_Z_INDEX};
  transition: transform 0.15s ease-in-out;

  &:hover {
    transform: scale(1.06);
  }
`

const Panel = styled.div<{ open: boolean }>`
  position: fixed;
  bottom: 96px;
  right: 24px;
  width: min(400px, calc(100vw - 32px));
  height: min(640px, calc(100vh - 140px));
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: #0a0a0a;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5);
  z-index: ${LAUNCHER_Z_INDEX};
  opacity: ${({ open }) => (open ? 1 : 0)};
  transform: translateY(${({ open }) => (open ? '0' : '8px')});
  pointer-events: ${({ open }) => (open ? 'auto' : 'none')};
  transition:
    opacity 0.18s ease-in-out,
    transform 0.18s ease-in-out;

  > iframe {
    width: 100%;
    height: 100%;
    border: 0;
    display: block;
  }
`

function buildEmbedUrl(account: string | undefined): string {
  const params = new URLSearchParams({
    mcps: EMBED_MCPS,
    theme: 'dark',
    host: window.location.origin,
  })

  if (EMBED_KEY) params.set('key', EMBED_KEY)
  // Exact page URL for the owner dashboard's embeds roster (referrer
  // policies usually trim cross-origin referrers to the origin).
  params.set('page', window.location.href)
  if (account) params.set('address', account)

  return `${EMBED_ORIGIN}/embed?${params.toString()}`
}

export function YeetfulChatWidget(): ReactNode {
  const { account } = useWalletInfo()
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false) // iframe mounts lazily on first open, then persists
  const [embedUrl, setEmbedUrl] = useState<string | null>(null)
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const readyRef = useRef(false)

  const postAddress = useCallback((address: string | null) => {
    const target = iframeRef.current?.contentWindow

    if (!target || !readyRef.current) return

    target.postMessage({ source: MSG_SOURCE, v: 1, type: 'address', address }, EMBED_ORIGIN)
  }, [])

  // Handshake: wait for the embed's 'ready', then stream address updates
  useEffect(() => {
    function onMessage(event: MessageEvent): void {
      if (event.origin !== EMBED_ORIGIN) return

      const data = event.data as { source?: string; type?: string } | null

      if (!data || data.source !== MSG_SOURCE) return

      if (data.type === 'ready') {
        readyRef.current = true
        postAddress(account ?? null)
      }
    }

    window.addEventListener('message', onMessage)

    return () => window.removeEventListener('message', onMessage)
  }, [account, postAddress])

  // Keep the embed's $USER_ADDRESS context in sync with the connected wallet
  useEffect(() => {
    postAddress(account ?? null)
  }, [account, postAddress])

  useEffect(() => {
    if (!open) return

    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') setOpen(false)
    }

    window.addEventListener('keydown', onKeyDown)

    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open])

  const toggle = useCallback(() => {
    setOpen((prev) => {
      const next = !prev

      if (next && !mounted) {
        readyRef.current = false
        setEmbedUrl(buildEmbedUrl(account))
        setMounted(true)
      }

      return next
    })
  }, [account, mounted])

  return (
    <>
      {mounted && embedUrl && (
        <Panel open={open}>
          <iframe ref={iframeRef} src={embedUrl} title="Yeetful chat" allow="clipboard-write; payment" />
        </Panel>
      )}
      <Launcher aria-label="Open Yeetful chat" onClick={toggle}>
        <svg fill="none" height="24" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M12 3C7.03 3 3 6.58 3 11c0 2.09.91 3.99 2.4 5.42-.14 1.1-.55 2.35-1.4 3.58 1.94-.2 3.45-.87 4.53-1.56.78.2 1.61.31 2.47.31 4.97 0 9-3.58 9-8s-4.03-8-9-8Z"
            fill="currentColor"
          />
        </svg>
      </Launcher>
    </>
  )
}
