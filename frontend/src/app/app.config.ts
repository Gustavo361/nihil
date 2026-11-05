import { registerLocaleData } from '@angular/common';
import localePt from '@angular/common/locales/pt';
import { ApplicationConfig, inject, LOCALE_ID, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter, withHashLocation } from '@angular/router';
import { routes } from './app.routes';
import { authInterceptor } from './core/auth/auth.interceptor';
import { OfflineSyncService } from './core/offline/offline-sync.service';
import { RemoteStorageBridgeService } from './core/offline/remote-storage-bridge.service';

registerLocaleData(localePt);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withHashLocation()),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideAppInitializer(() => {
      const sync = inject(OfflineSyncService);
      sync.start();
    }),
    provideAppInitializer(() => {
      const remoteStorage = inject(RemoteStorageBridgeService);
      remoteStorage.install();
      return remoteStorage.hydrate();
    }),
    { provide: LOCALE_ID, useValue: 'pt-BR' },
  ],
};
