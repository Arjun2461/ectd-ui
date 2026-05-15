import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Submission } from './submission';

describe('Submission', () => {
  let component: Submission;
  let fixture: ComponentFixture<Submission>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Submission],
    }).compileComponents();

    fixture = TestBed.createComponent(Submission);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
