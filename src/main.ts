  // main.ts
import { setLogLevel, LogLevel } from '@angular/fire';
setLogLevel(LogLevel.VERBOSE);

import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

bootstrapApplication(App, appConfig).catch(console.error);
