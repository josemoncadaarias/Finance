import { ErrorHandler } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { RouteReuseStrategy, provideRouter, withComponentInputBinding, withPreloading, PreloadAllModules } from '@angular/router';
import { IonicRouteStrategy, provideIonicAngular } from '@ionic/angular';

import { routes } from './app/app.routes';
import { AppComponent } from './app/app.component';
import { provideDatabase } from './app/core/database/database.init';
import { noteError } from './app/core/feedback/error-log';

/** Every error Angular sees is kept for a report (idea 11), then handled as always. */
class KeptErrorHandler extends ErrorHandler {
  override handleError(error: unknown): void {
    noteError(error);
    super.handleError(error);
  }
}
window.addEventListener('error', event => noteError(event.error ?? event.message));
window.addEventListener('unhandledrejection', event => noteError({ rejection: event.reason }));

bootstrapApplication(AppComponent, {
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideIonicAngular({ mode: 'md' }),
    provideRouter(routes, withPreloading(PreloadAllModules), withComponentInputBinding()),
    provideDatabase(),
    { provide: ErrorHandler, useClass: KeptErrorHandler },
  ],
});
