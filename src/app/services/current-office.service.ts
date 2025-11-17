import { Injectable } from '@angular/core';
import { of, shareReplay, switchMap } from 'rxjs';

import { CurrentUserService } from './current-user.service';
import { OfficesService } from './offices.service';

@Injectable({ providedIn: 'root' })
export class CurrentOfficeService {
  readonly officeId$ = this.currentUser.officeId$;

  readonly office$ = this.officeId$.pipe(
    switchMap((officeId) => {
      if (!officeId) {
        return of(null);
      }
      return this.officesService.watchOffice(officeId);
    }),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  constructor(
    private readonly currentUser: CurrentUserService,
    private readonly officesService: OfficesService
  ) {}
}
