import { Component , Input } from '@angular/core';


@Component({
  selector: 'app-translation',
  imports: [],
  templateUrl: './translation.html',
  styleUrl: './translation.css',
})
export class Translation {
    @Input() stats = {
    pages: 847,
    languages: 3,
    confidence: 98.4,
    flagged: 12
  };

  @Input() languagesList = [
    { name: 'Japanese (JA)', pages: 847, status: 'Complete' },
    { name: 'German (DE)', pages: 847, status: 'Complete' },
    { name: 'French (FR)', pages: 831, status: 'In progress' }
  ];


}
