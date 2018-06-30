import { TestBed, async, inject } from '@angular/core/testing';

import { LockGuard } from './lock.guard';

describe('LockGuard', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [LockGuard]
    });
  });

  it('should ...', inject([LockGuard], (guard: LockGuard) => {
    expect(guard).toBeTruthy();
  }));
});
