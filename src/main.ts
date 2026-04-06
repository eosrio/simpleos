import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app';
import { installWheelScrollFix } from './app/core/wheel-scroll-fix';

installWheelScrollFix();

bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));
