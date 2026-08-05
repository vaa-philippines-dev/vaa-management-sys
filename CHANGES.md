# What Changed — UI Cleanup

## Executive Overview

This update is a visual consistency pass across the platform — no data, permissions, or workflows changed. The goal was to make every page and the sidebar feel like one cohesive product instead of pieces built at different times. Three things drove it: inconsistent icon use on page titles, two thin pages (Birthdays, Anniversary) that deserved to be one useful view, and a sidebar with a couple of icon mix-ups and a highlight color that didn't match the rest of the design. Everything below is visible immediately after refresh — nothing needs to be configured or turned on.

## Cleaner Page Titles

Several pages — Customers, Accounts, Audit Log, History, Users, Merge/Split Department, VA Connections, Matching, and Vee — had a decorative icon sitting next to the page title. Most pages, including VA Masterlist and Assignments, never had one. Those icons have been removed so every page title now looks the same across the app. Nothing about the page content changed — just the header.

## Birthdays & Anniversaries → One "Celebrants" Calendar

The separate **Birthdays** and **Anniversary** pages (and their two sidebar entries) are now a single **Celebrants** page, shown as a month calendar — the same visual idea as Apple's Calendar app.

- Every day cell shows small avatar chips for anyone with a birthday or work anniversary that day.
- A filter lets you switch between **All / Birthdays / Anniversaries** instantly.
- Click any day to see the full list of names, with anniversary history (e.g. a promoted VA's prior VA start date) shown right there instead of buried in a long list.
- Move between months with the arrow buttons, or jump back to today with one click.

This replaces two long, mostly-empty list pages with one page that's actually useful for "who's celebrating this month" at a glance. Old bookmarks to the Birthdays or Anniversary pages still work — they redirect straight to the new calendar.

## Sidebar Polish

- **Icon spacing**: icons and labels in the sidebar now have a bit more breathing room between them.
- **No more duplicate icons**: "Dashboard" and "Admin Panel" used to share the same icon, as did "Customers" and "Departments." Each now has its own distinct icon, so it's easier to tell them apart at a glance.
- **Highlight color**: the sidebar's active-page highlight has moved from a gold/yellow tint to a neutral grey-and-black treatment (light and dark mode both), matching the rest of the app's understated design instead of standing out as an odd color choice.
- **Quick search (Ctrl+K)**: the quick-search shortcut list was missing several pages (Inbox, Celebrants, Tickets, Matching, Vee, VA Connections, Customers, Accounts) — those are now searchable, and its icons now match the sidebar's.

## Admin Panel Density

The main Admin Panel page had noticeably more vertical spacing between sections than every other admin page. That's been tightened to match the rest of the Admin section.
