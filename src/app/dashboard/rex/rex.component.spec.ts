import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { RexComponent } from './rex.component';

describe('RexComponent', () => {
  let component: RexComponent;
  let fixture: ComponentFixture<RexComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ RexComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(RexComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
