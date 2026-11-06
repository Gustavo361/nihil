import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { IconBuildingStore, IconCash, IconDatabase, IconLock, IconLogout, IconPackage, IconPalette, IconShieldLock, TablerIconComponent } from '@tabler/icons-angular';
import { AuthService } from '../../core/auth/auth.service';
import { ThemeId, ThemeService } from '../../core/theme/theme.service';

@Component({
  selector: 'app-settings-page',
  imports: [RouterLink, TablerIconComponent],
  templateUrl: './settings.page.html',
  styleUrl: './settings.page.scss',
})
export class SettingsPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly theme = inject(ThemeService);

  readonly themes = this.theme.themes;
  readonly themeId = this.theme.themeId;
  readonly iconRestaurant = IconBuildingStore;
  readonly iconPalette = IconPalette;
  readonly iconCash = IconCash;
  readonly iconStock = IconPackage;
  readonly iconSecurity = IconShieldLock;
  readonly iconData = IconDatabase;
  readonly iconLogout = IconLogout;
  readonly iconLock = IconLock;

  setTheme(themeId: ThemeId): void {
    this.theme.setTheme(themeId);
  }

  logout(): void {
    this.auth.logout();
    void this.router.navigateByUrl('/login');
  }
}
