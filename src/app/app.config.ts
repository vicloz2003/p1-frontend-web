import { ApplicationConfig, importProvidersFrom, isDevMode, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideServiceWorker } from '@angular/service-worker';

import { FormlyModule } from '@ngx-formly/core';
import { FormlyMaterialModule } from '@ngx-formly/material';
import { FileFieldComponent } from './features/dashboard/task-complete/file-field/file-field.component';

import { routes } from './app.routes';
import { jwtInterceptor } from './core/http/jwt.interceptor';
import { errorInterceptor } from './core/http/error.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideAnimationsAsync(),
    provideHttpClient(withInterceptors([jwtInterceptor, errorInterceptor])),
    importProvidersFrom(
      FormlyModule.forRoot({
        types: [
          {
            name: 'file-upload',
            component: FileFieldComponent,
          },
        ],
        validationMessages: [
          { name: 'required', message: 'Este campo es obligatorio' },
        ],
      }),
      FormlyMaterialModule
    ),
    // PWA (RNF-7): register the ngsw worker in production builds only; wait until the app
    // is stable so it never competes with initial rendering.
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ]
};
