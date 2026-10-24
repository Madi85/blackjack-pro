import 'zone.js';

import { bootstrapApplication } from '@angular/platform-browser';
import { provideHttpClient } from '@angular/common/http';
import { provideTransloco } from '@jsverse/transloco';

import { AppComponent } from './app/app.component';
import { TranslocoHttpLoader } from './app/transloco-loader';

bootstrapApplication(AppComponent, {
  providers: [
    provideHttpClient(),

    provideTransloco({
      config: {
        availableLangs: ['de', 'en', 'ar'],
        defaultLang: 'de',
        fallbackLang: 'de',
        reRenderOnLangChange: true,
        prodMode: false
      },
      loader: TranslocoHttpLoader
    })
  ]
}).catch(console.error);