import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GenerateDraft } from './generate-draft';

describe('GenerateDraft', () => {
  let component: GenerateDraft;
  let fixture: ComponentFixture<GenerateDraft>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GenerateDraft],
    }).compileComponents();

    fixture = TestBed.createComponent(GenerateDraft);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
