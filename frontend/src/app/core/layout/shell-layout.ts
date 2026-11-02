import { Component, ElementRef, HostListener, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import {
  IconBell,
  IconChevronDown,
  IconChevronUp,
  IconLayoutDashboard,
  IconMenu2,
  IconMoon,
  IconSun,
  IconX,
  TablerIconComponent,
  type TablerIcon,
} from '@tabler/icons-angular';
import { filter, map, startWith } from 'rxjs';
import { ToastHostComponent } from '../toast/toast-host.component';
import { AppSidebar } from './app-sidebar';
import { NIHIL_NAV_GROUPS } from './nav.config';

type HeaderMenu = 'notifications' | 'theme' | null;

@Component({
  selector: 'app-shell-layout',
  imports: [RouterOutlet, AppSidebar, TablerIconComponent, ToastHostComponent],
  templateUrl: './shell-layout.html',
  styleUrl: './shell-layout.scss',
})
export class ShellLayout {
  private readonly router = inject(Router);
  private readonly host = inject(ElementRef<HTMLElement>);

  readonly menuOpen = signal(false);
  readonly openHeaderMenu = signal<HeaderMenu>(null);
  readonly themeMode = signal<'light' | 'dark'>('light');

  readonly iconMenu = IconMenu2;
  readonly iconClose = IconX;
  readonly iconBell = IconBell;
  readonly iconTheme = IconMoon;
  readonly iconSun = IconSun;
  readonly iconChevronDown = IconChevronDown;
  readonly iconChevronUp = IconChevronUp;

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map(() => this.router.url),
      startWith(this.router.url),
    ),
    { initialValue: this.router.url },
  );

  readonly pageMeta = computed(() => {
    const path = this.normalizePath(this.url());
    for (const group of NIHIL_NAV_GROUPS) {
      for (const item of group.items) {
        const itemPath = this.normalizePath(item.path);
        if (item.exact ? path === itemPath : path === itemPath || path.startsWith(`${itemPath}/`)) {
          return { title: item.label, icon: item.icon as TablerIcon };
        }
      }
    }
    return { title: 'Visão geral', icon: IconLayoutDashboard as TablerIcon };
  });

  toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  closeMenu(): void {
    this.menuOpen.set(false);
  }

  toggleHeaderMenu(menu: Exclude<HeaderMenu, null>, event: Event): void {
    event.stopPropagation();
    this.openHeaderMenu.update((current) => (current === menu ? null : menu));
  }

  closeHeaderMenus(): void {
    this.openHeaderMenu.set(null);
  }

  setTheme(mode: 'light' | 'dark'): void {
    this.themeMode.set(mode);
    // Placeholder until theme tokens/switcher are wired.
    this.closeHeaderMenus();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.openHeaderMenu()) {
      return;
    }
    const target = event.target as Node | null;
    if (target && !this.host.nativeElement.contains(target)) {
      this.closeHeaderMenus();
      return;
    }
    const el = target as HTMLElement | null;
    if (el && !el.closest('.shell__header-menu')) {
      this.closeHeaderMenus();
    }
  }

  @HostListener('window:keydown.escape')
  onEscape(): void {
    if (this.openHeaderMenu()) {
      this.closeHeaderMenus();
      return;
    }
    this.closeMenu();
  }

  private normalizePath(path: string): string {
    const bare = path.split('?')[0].split('#')[0];
    if (!bare || bare === '/') {
      return '/';
    }
    return bare.endsWith('/') ? bare.slice(0, -1) : bare;
  }
}
