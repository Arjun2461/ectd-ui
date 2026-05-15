import { Component, Input, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-hitl-popup',
  imports: [],
  templateUrl: './hitl-popup.html',
  styleUrl: './hitl-popup.css',
})
export class HitlPopup {
  @Input() hitlEvent: any;
  @Input() hitlSuggestions: any[] = [];  // ✅ fixes your NG8002 error

  @Output() close = new EventEmitter<void>();

  selectedIndex = 0;

  select(i: number) {
    this.selectedIndex = i;
  }

  confirm() {
    console.log('Selected:', this.hitlSuggestions[this.selectedIndex]);
    this.close.emit();
  }

}
