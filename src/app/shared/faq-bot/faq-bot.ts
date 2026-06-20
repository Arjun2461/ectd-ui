import { Component, ElementRef, ViewChild, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule, Bot, X, Send, Sparkles } from 'lucide-angular';
import { FAQ_TREE, Branch } from './faq-data';

interface ChatMessage {
  from: 'bot' | 'user';
  text: string;
  suggestions?: string[];
}

@Component({
  selector: 'app-faq-bot',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  templateUrl: './faq-bot.html',
  styleUrl: './faq-bot.css',
})
export class FaqBot implements AfterViewChecked {
  @ViewChild('scrollAnchor') private scrollAnchor!: ElementRef<HTMLDivElement>;

  // ✅ icons
  Bot = Bot;
  X = X;
  Send = Send;
  Sparkles = Sparkles;

  isOpen = false;
  draft = '';

  currentBranch: Branch | null = null;

  messages: ChatMessage[] = [
    {
      from: 'bot',
      text: 'Welcome 👋 Select a topic:',
      suggestions: FAQ_TREE.map((b) => b.title),
    },
  ];

  toggle(): void {
    this.isOpen = !this.isOpen;
  }

  close(): void {
    this.isOpen = false;
  }

  ask(text: string): void {
    const trimmed = text.trim();
    if (!trimmed) return;

    // remove old suggestions
    this.messages.forEach((m) => (m.suggestions = undefined));

    this.messages.push({ from: 'user', text: trimmed });
    this.draft = '';

    // 🔙 MAIN MENU
    if (trimmed === '⏮️ Return to Main Menu') {
      this.currentBranch = null;

      this.messages.push({
        from: 'bot',
        text: 'Main Menu 👇',
        suggestions: FAQ_TREE.map((b) => b.title),
      });
      return;
    }

    // ❌ CLOSE
    if (trimmed === '❌ Close Help Assistant') {
      this.close();
      return;
    }

    // 📂 BRANCH SELECT
    const branch = FAQ_TREE.find((b) => b.title === trimmed);
    if (branch) {
      this.currentBranch = branch;

      this.messages.push({
        from: 'bot',
        text: branch.intro,
        suggestions: [
          ...branch.items.map((i) => i.question),
          '⏮️ Return to Main Menu',
        ],
      });
      return;
    }

    // 📄 SUB QUESTION
    if (this.currentBranch) {
      const item = this.currentBranch.items.find(
        (i) => i.question === trimmed
      );

      if (item) {
        this.messages.push({
          from: 'bot',
          text: item.answer,
          suggestions: [
            ...this.currentBranch.items.map((i) => i.question),
            '⏮️ Return to Main Menu',
            '❌ Close Help Assistant',
          ],
        });
        return;
      }
    }

    // fallback
    this.messages.push({
      from: 'bot',
      text: 'Please choose from the menu 👇',
      suggestions: FAQ_TREE.map((b) => b.title),
    });
  }

  onSend(): void {
    this.ask(this.draft);
  }

  onSuggestionClick(question: string): void {
    this.ask(question);
  }

  ngAfterViewChecked(): void {
    this.scrollAnchor?.nativeElement.scrollIntoView({
      behavior: 'smooth',
      block: 'end',
    });
  }
}