import { Injectable } from '@angular/core';
import { Observable, of, shareReplay, switchMap } from 'rxjs';

import { CurrentUserService } from './current-user.service';
import { OfficesService } from './offices.service';
import { Office } from '../types';

@Injectable({ providedIn: 'root' })
export class CurrentOfficeService {
  readonly officeId$: Observable<string | null>;
  readonly office$: Observable<Office | null>;

  constructor(
    private readonly currentUser: CurrentUserService,
    private readonly officesService: OfficesService
  ) {
    this.officeId$ = this.currentUser.officeId$;
    this.office$ = this.officeId$.pipe(
      switchMap((officeId) => {
        if (!officeId) {
          return of(null);
        }
        return this.officesService.watchOffice(officeId);
      }),
      shareReplay({ bufferSize: 1, refCount: true })
    );
  }
}
