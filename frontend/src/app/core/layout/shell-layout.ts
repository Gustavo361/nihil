import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import {
  IconLayoutDashboard,
  IconMenu2,
  IconX,
  TablerIconComponent,
  type TablerIcon,
} from '@tabler/icons-angular';
import { filter, map, startWith } from 'rxjs';
import { AppSidebar } from './app-sidebar';
import { NIHIL_NAV_GROUPS } from './nav.config';

@Component({
  selector: 'app-shell-layout',
  imports: [RouterOutlet, AppSidebar, TablerIconComponent],
  templateUrl: './shell-layout.html',
  styleUrl: './shell-layout.scss',
})
export class ShellLayout {
  private readonly router = inject(Router);

  readonly menuOpen = signal(false);
  readonly iconMenu = IconMenu2;
  readonly iconClose = IconX;

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

  @HostListener('window:keydown.escape')
  onEscape(): void {
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
