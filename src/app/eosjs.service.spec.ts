import { TestBed, inject } from '@angular/core/testing';

import { EOSJSService } from './eosjs.service';

describe('EOSJSService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [EOSJSService]
    });
  });

  it('should be created', inject([EOSJSService], (service: EOSJSService) => {
    expect(service).toBeTruthy();
  }));
});
