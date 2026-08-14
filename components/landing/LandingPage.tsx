'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import {
  Users,
  Briefcase,
  ListTodo,
  MessageSquare,
  BarChart3,
  Ticket,
  ArrowRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spotlight } from '@/components/ui/spotlight'
import { AuthModal } from '@/components/auth/AuthModal'
import { ThemeSwitch } from '@/components/landing/ThemeSwitch'
import { SpotlightCard } from '@/components/landing/SpotlightCard'
import { cn } from '@/lib/utils'

const FEATURES = [
  {
    icon: Users,
    title: 'VA Masterlist',
    description: 'A single source of truth for every virtual assistant — skills, rates, capacity, and availability.',
  },
  {
    icon: Briefcase,
    title: 'Assignments & Staffing',
    description: 'Match VAs to clients, track active engagements, and keep staffing decisions organized.',
  },
  {
    icon: ListTodo,
    title: 'Work Log Tracking',
    description: 'Log hours against assignments and catch shortfalls before they become a problem.',
  },
  {
    icon: MessageSquare,
    title: 'Team Inbox',
    description: 'Department channels, direct messages, and announcements — all in real time.',
  },
  {
    icon: BarChart3,
    title: 'Reports & Analytics',
    description: 'Headcount, hours, and performance rolled up into reports your managers actually use.',
  },
  {
    icon: Ticket,
    title: 'Support Tickets',
    description: 'Raise, route, and resolve issues without losing the conversation history.',
  },
]

export function LandingPage() {
  const [authOpen, setAuthOpen] = useState(false)
  const [navHidden, setNavHidden] = useState(false)
  const [navSolid, setNavSolid] = useState(false)
  const lastScrollY = useRef(0)

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY
      const goingDown = y > lastScrollY.current

      setNavSolid(y > 24)
      setNavHidden(goingDown && y > 96)

      lastScrollY.current = y
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div className="min-h-screen bg-background">
      <header
        className={cn(
          'fixed top-0 z-30 w-full transition-all duration-300',
          navHidden ? '-translate-y-full' : 'translate-y-0',
          navSolid
            ? 'border-b border-border/60 bg-background/80 shadow-sm backdrop-blur-xl'
            : 'border-b border-transparent bg-transparent'
        )}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Image src="/blackLogo.png" alt="VAA Philippines" width={34} height={34} className="block dark:hidden" priority />
          <Image src="/whiteLogo.png" alt="VAA Philippines" width={34} height={34} className="hidden dark:block" priority />
          <ThemeSwitch />
        </div>
      </header>

      <main>
        <section className="relative flex min-h-[88vh] w-full items-center justify-center overflow-hidden">
          <div
            className={
              'pointer-events-none absolute inset-0 select-none ' +
              '[background-size:44px_44px] ' +
              '[background-image:linear-gradient(to_right,rgba(0,0,0,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,0,0,0.05)_1px,transparent_1px)] ' +
              'dark:[background-image:linear-gradient(to_right,rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.06)_1px,transparent_1px)]'
            }
          />
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              maskImage: 'radial-gradient(ellipse 80% 60% at 50% 20%, black 40%, transparent 100%)',
              WebkitMaskImage: 'radial-gradient(ellipse 80% 60% at 50% 20%, black 40%, transparent 100%)',
            }}
          />

          <Spotlight className="left-0 top-[-20rem] text-foreground md:left-60 md:top-[-30rem]" fill="currentColor" />
          <Spotlight className="left-full top-[-25rem] -translate-x-[80%] text-foreground/70 md:top-[-32rem]" fill="currentColor" />

          <div className="relative z-10 mx-auto w-full max-w-3xl px-4 pt-10 text-center sm:px-6">
            <p className="fade-in-stagger text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">
              VAA Philippines · Internal System
            </p>

            <h1 className="fade-in-stagger mt-5 bg-gradient-to-b from-foreground to-foreground/60 bg-clip-text text-4xl font-bold leading-[1.1] tracking-tight text-transparent sm:text-6xl">
              One system.
              <br />
              Every VA at VAA.
            </h1>

            <p className="fade-in-stagger mx-auto mt-4 max-w-sm text-xs text-muted-foreground sm:text-sm">
              Staffing, assignments, work logs, and team communication for VAA Philippines only.
            </p>

            <div className="fade-in-stagger mt-9 flex flex-col items-center gap-3">
              <Button
                onClick={() => setAuthOpen(true)}
                className="h-11 !bg-foreground px-7 text-sm !text-background hover:!bg-foreground/85"
              >
                Open Workforce MS
                <ArrowRight className="h-4 w-4" />
              </Button>
              <span className="text-xs text-muted-foreground">
                Access is provided by your manager.
              </span>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-28 pt-20 sm:px-6 sm:pt-28">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Everything workforce operations needs
            </h2>
            <p className="mt-2 text-sm text-muted-foreground sm:text-base">
              One system for VAs, clients, staffing, and the day-to-day work of keeping it all running.
            </p>
          </div>

          <div className="fade-in-stagger grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, description }) => (
              <SpotlightCard key={title}>
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-foreground/[0.06]">
                  <Icon className="h-5 w-5 text-foreground" />
                </div>
                <h3 className="mt-4 text-sm font-semibold">{title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
              </SpotlightCard>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border/60">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-2 px-4 py-8 text-center text-xs text-muted-foreground sm:px-6">
          <div className="flex items-center gap-2">
            <Image src="/blackLogo.png" alt="VAA Philippines" width={18} height={18} className="block dark:hidden" />
            <Image src="/whiteLogo.png" alt="VAA Philippines" width={18} height={18} className="hidden dark:block" />
            <span>© {new Date().getFullYear()} VAA Philippines. All rights reserved.</span>
          </div>
        </div>
      </footer>

      <AuthModal open={authOpen} onOpenChange={setAuthOpen} />
    </div>
  )
}
