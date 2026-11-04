import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

bootstrapApplication(App, appConfig)
  .then(() => {
    if ('serviceWorker' in navigator) {
      return navigator.serviceWorker.register('/offline-worker.js');
    }
    return undefined;
  })
  .catch((err) => console.error(err));
