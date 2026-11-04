import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { IconEye, IconEyeOff, TablerIconComponent } from '@tabler/icons-angular';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-login-page',
  imports: [FormsModule, TablerIconComponent],
  templateUrl: './login.page.html',
  styleUrl: './login.page.scss',
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly username = signal('');
  readonly password = signal('');
  readonly error = signal('');
  readonly busy = signal(false);
  readonly passwordVisible = signal(false);
  readonly iconEye = IconEye;
  readonly iconEyeOff = IconEyeOff;

  togglePasswordVisibility(): void {
    this.passwordVisible.update((visible) => !visible);
  }

  async submit(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      await this.auth.login(this.username(), this.password());
      const destination = this.route.snapshot.queryParamMap.get('returnUrl') || '/';
      await this.router.navigateByUrl(destination.startsWith('/') ? destination : '/');
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Não foi possível entrar.');
    } finally {
      this.busy.set(false);
    }
  }
}
