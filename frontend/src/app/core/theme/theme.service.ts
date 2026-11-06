import { DOCUMENT } from '@angular/common';
import { Injectable, computed, inject, signal } from '@angular/core';

export type ThemeId = 'light' | 'sand' | 'dusk' | 'midnight' | 'obsidian';

export interface NihilTheme {
  id: ThemeId;
  name: string;
  background: string;
  surface: string;
  accent: string;
  text: string;
}

export const NIHIL_THEMES: readonly NihilTheme[] = [
  { id: 'light', name: 'Nihil Light', background: '#ECF2F9', surface: '#FFFFFF', accent: '#6729F2', text: '#302D50' },
  { id: 'sand', name: 'Nihil Sand', background: '#F3EFE6', surface: '#FFFCF5', accent: '#8B7158', text: '#43382E' },
  { id: 'dusk', name: 'Nihil Dusk', background: '#303445', surface: '#3C4154', accent: '#A78BFA', text: '#F1EFFA' },
  { id: 'midnight', name: 'Nihil Midnight', background: '#1E1E2E', surface: '#28283D', accent: '#CBA6F7', text: '#CDD6F4' },
  { id: 'obsidian', name: 'Nihil Obsidian', background: '#101114', surface: '#1B1D22', accent: '#8B8CF8', text: '#E6E6EA' },
];

const STORAGE_KEY = 'nihil.theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  readonly themeId = signal<ThemeId>(this.readStoredTheme());
  readonly themes = NIHIL_THEMES;
  readonly activeTheme = computed(() => NIHIL_THEMES.find((theme) => theme.id === this.themeId()) ?? NIHIL_THEMES[0]);

  constructor() {
    this.apply(this.themeId(), false);
  }

  setTheme(themeId: ThemeId): void {
    this.themeId.set(themeId);
    this.apply(themeId, true);
  }

  private apply(themeId: ThemeId, persist: boolean): void {
    this.document.documentElement.dataset['theme'] = themeId;
    if (persist) localStorage.setItem(STORAGE_KEY, themeId);
  }

  private readStoredTheme(): ThemeId {
    const stored = localStorage.getItem(STORAGE_KEY);
    return NIHIL_THEMES.some((theme) => theme.id === stored) ? stored as ThemeId : 'light';
  }
}
