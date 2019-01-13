import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { ReferendumComponent } from './referendum.component';

describe('referendumComponent', () => {
  let component: ReferendumComponent;
  let fixture: ComponentFixture<ReferendumComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ ReferendumComponent ]
    })
      .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(ReferendumComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
