import {
  Component, AfterViewInit, OnDestroy,
  ViewChild, ElementRef
} from '@angular/core';
import { CommonModule ,DecimalPipe  } from '@angular/common';
import {
  Chart, DoughnutController, ArcElement,
  Tooltip, Legend
} from 'chart.js';
 import { Hyperlinking } from './hyperlinking/hyperlinking';
 import { Consistency } from './consistency/consistency';
Chart.register(DoughnutController, ArcElement, Tooltip, Legend);
 
interface HITLEvent {
  id: number;
  file: string;
  section: string;
  anchor: string;
  selected: number   // index of chosen suggestion
  confirmed: boolean;
}
 
interface ResolvedRef {
  text: string;
  source: string;
  target: string;
  badge: 'User confirmed' | 'Auto-resolved';
}

@Component({
  selector: 'app-results',
  imports: [DecimalPipe ,CommonModule , Hyperlinking,Consistency],
  templateUrl: './results.html',
  styleUrl: './results.css',
})
export class Results {

 // ── Progress ──────────────────────────────────────────────
  progress = 0;
  private progressInterval: any;
  isProcessing = true;
 
  // ── Tabs ──────────────────────────────────────────────────
  activeTab: 'Hyperlinking' | 'Translation' | 'Consistency' = 'Hyperlinking';
 
  // ── HITL Popup ────────────────────────────────────────────
  showHITL = false;
  hitlEvent: HITLEvent = {
    id: 1,
    file: 'M2.5-clinical-overview.pdf',
    section: '§2.4 – Efficacy Conclusions',
    anchor: 'study rpt 205.pdf#sec3',
    selected: 0,
    confirmed: false,
  };
 
  hitlSuggestions = [
    { file: 'M2.7.4-clinical-summary.pdf', section: '§3.2.1', score: 96, recommended: true },
    { file: 'M2.7.3-clinical-overview.pdf', section: '§4.1',  score: 81, recommended: false },
    { file: 'M5.3.5.1-study-report.pdf',   section: '§7.2.4', score: 64, recommended: false },
  ];
 
  hitlLog: { file: string; section: string; chosen: string; time: string }[] = [
    { file: 'M2.5-clinical-overview.pdf', section: '§1.2', chosen: 'M2.7.4-clinical-summary.pdf §3.2.1', time: '2 min ago' },
    { file: 'M3.2-quality-report.pdf',    section: '§4.1', chosen: 'M3.2.P.5 §2.1',                      time: '5 min ago' },
  ];
 
  selectHITL(i: number) { this.hitlEvent.selected = i; }
 
  confirmHITL() {
    const s = this.hitlSuggestions[this.hitlEvent.selected!];
    this.hitlLog.unshift({
      file: this.hitlEvent.file,
      section: this.hitlEvent.section,
      chosen: `${s.file} ${s.section}`,
      time: 'just now',
    });
    this.hitlEvent.confirmed = true;
    setTimeout(() => { this.showHITL = false; this.hitlEvent.confirmed = false; }, 600);
  }
 
  // ── Resolved References ───────────────────────────────────
resolvedRefs = [
  {
    sourceDoc: "2.3-qos.pdf",
    statement: "study rpt 205.pdf#sec3",

    suggestions: [
      {
        file: "3.2.P.8-stability.pdf",
        page: "1",
        section: "3.2.P.8.1 Stability Summary",
        score: 96
      },
      {
        file: "3.2.S.2-manufacture.pdf",
        page: "3",
        section: "3.2.S.2.5 Process Validation",
        score: 81
      },
      {
        file: "3.2.S.2-manufacture.pdf",
        page: "1",
        section: "3.2.S.2.5 Process Validation",
        score: 64
      }
    ],

    selectedIndex: 0,
    userAction: "User confirmed",
    badge: "User confirmed",
    llmReason: "Semantic similarity matches stability section."
  },

  {
    sourceDoc: "2.5-clinical-overview.pdf",
    statement: "refer table 14.2.1.3",

    suggestions: [
      {
        file: "5.3.5.1-study-report.pdf",
        page: "47",
        section: "Table 14.2.1.3 Clinical Results",
        score: 94
      },
      {
        file: "5.3.1.1-protocol.pdf",
        page: "22",
        section: "Study Design Overview",
        score: 78
      },
      {
        file: "5.3.5.3-analysis.pdf",
        page: "51",
        section: "Statistical Analysis Tables",
        score: 69
      }
    ],

    selectedIndex: 0,
    userAction: "Auto-resolved",
    badge: "Auto-resolved",
    llmReason: "Exact table reference matched with clinical study report."
  },

  {
    sourceDoc: "1.3-labeling.pdf",
    statement: "see dosage guidelines section",

    suggestions: [
      {
        file: "1.3.1-product-label.pdf",
        page: "5",
        section: "Dosage and Administration",
        score: 92
      },
      {
        file: "2.7.1-summary.pdf",
        page: "12",
        section: "Clinical Usage Summary",
        score: 75
      },
      {
        file: "2.5-clinical-overview.pdf",
        page: "8",
        section: "Treatment Recommendations",
        score: 63
      }
    ],

    selectedIndex: 0,
    userAction: "User confirmed",
    badge: "User confirmed",
    llmReason: "Dosage keyword strongly aligned with product labeling section."
  }
];
 
  // ── Chart ─────────────────────────────────────────────────
  @ViewChild('donutChart') donutRef!: ElementRef<HTMLCanvasElement>;
  private chart: Chart | null = null;
 
  ngAfterViewInit() {
    // Simulate progress then trigger HITL popup
    this.progressInterval = setInterval(() => {
      if (this.progress < 72) {
        this.progress = Math.min(this.progress + 0.8, 72);
      } 
    }, 60);
  }
 
  ngOnDestroy() {
    clearInterval(this.progressInterval);
    this.chart?.destroy();
  }
 
 
 
  setTab(t: 'Hyperlinking' | 'Translation' | 'Consistency') { this.activeTab = t; }


jobId = 'JOB-2026-0514-A';

showServiceProgress = false;

services = [
  { name: 'Hyperlinking', progress: 72, status: 'Processing', icon: 'ti-link', iconClass: 'link' },
  { name: 'Translation', progress: 100, status: 'completed', icon: 'ti-language', iconClass: 'translate' },
  { name: 'Consistency', progress: 34, status: 'waiting', icon: 'ti-shield-check', iconClass: 'shield' }
];
triggerHITL(event: HITLEvent) {
  if (this.showHITL) return;
  this.hitlEvent = event;
  this.showHITL = true;
}


selectedLog: {
  file: string;
  section: string;
  chosen: string;
  time: string;
} | null = null;
showLogDetails = false;

openLogDetails(log: any) {
  this.selectedLog = log;
  this.showLogDetails = true;
}

}