import { Component, input, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TablerIconComponent } from '@tabler/icons-angular';
import { NIHIL_NAV_GROUPS } from './nav.config';

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive, TablerIconComponent],
  templateUrl: './app-sidebar.html',
  styleUrl: './app-sidebar.scss',
})
export class AppSidebar {
  readonly open = input(false);
  readonly navigate = output<void>();

  readonly groups = NIHIL_NAV_GROUPS;

  onNavigate(): void {
    this.navigate.emit();
  }
}
