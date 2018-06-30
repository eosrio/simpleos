import { TestBed, inject } from '@angular/core/testing';

import { RamService } from './ram.service';

describe('RamService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [RamService]
    });
  });

  it('should be created', inject([RamService], (service: RamService) => {
    expect(service).toBeTruthy();
  }));
});
