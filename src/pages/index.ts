// Page registry — sidebar order, hash route id, header text, and the
// component that composes the page. Add a page: one file here + one entry.

import type { FC } from 'react';
import { HomePage } from './home';
import { FinancePage } from './finance';
import { FeedPage } from './feed';
import { JournalPage } from './journal';
import { TrainingPage } from './training';
import { ProfilePage } from './profile';

export interface PageDef {
  id: string;
  label: string;
  icon: string;
  title?: string;
  subtitle?: string;
  Component: FC;
}

export const PAGES: PageDef[] = [
  { id: 'home', label: 'Home', icon: 'icons/home.svg', Component: HomePage },
  { id: 'finance', label: 'Finance', icon: 'icons/points.svg', title: 'Portfolio', Component: FinancePage },
  { id: 'feed', label: 'Feed', icon: 'icons/library.svg', title: "What's new today?", Component: FeedPage },
  { id: 'journal', label: 'Journal', icon: 'icons/book.svg', title: 'Journal', Component: JournalPage },
  { id: 'training', label: 'Training', icon: 'icons/check.svg', title: 'Training', Component: TrainingPage },
  {
    id: 'profile',
    label: 'Profile',
    icon: 'icons/account.svg',
    title: 'Profile',
    subtitle: 'Numbers you always need but never remember',
    Component: ProfilePage,
  },
];
