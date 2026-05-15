import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Translation } from './translation';

describe('Translation', () => {
  let component: Translation;
  let fixture: ComponentFixture<Translation>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Translation],
    }).compileComponents();

    fixture = TestBed.createComponent(Translation);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
