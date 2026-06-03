import { Component, Input } from '@angular/core';

interface LanguageRow {
  name: string;
  pages: number;
  status: string;
  /** Filename (no extension) of the glossary CSV inside assets/glossaries/ */
  glossaryFile?: string;
  /** Filename (no extension) of the translated ZIP inside assets/translations/ */
  translationZip?: string;
}

@Component({
  selector: 'app-translation',
  imports: [],
  templateUrl: './translation.html',
  styleUrl: './translation.css',
})
export class Translation {
  @Input() stats = {
    pages: 47,
    languages: 3,
  };

  @Input() languagesList: LanguageRow[] = [
    {
      name: 'Japanese (JA)',
      pages: 847,
      status: 'Complete',
      glossaryFile: 'glossary_ja',
      translationZip: 'translation_ja',
    },
    {
      name: 'German (DE)',
      pages: 847,
      status: 'Complete',
      glossaryFile: 'glossary_de',
      translationZip: 'translation_de',
    },
    {
      name: 'French (FR)',
      pages: 831,
      status: 'In progress',
      glossaryFile: 'glossary_fr',
      translationZip: 'translation_fr',
    },
  ];

  /** Download a language-specific glossary CSV from assets/glossaries/ */
  downloadGlossary(lang: LanguageRow): void {
    const fileName = lang.glossaryFile ?? this.toSlug(lang.name) + '_glossary';
    this.triggerDownload(`assets/Outputs/Translated_output/glossaries/${lang.glossaryFile}.csv`, `${fileName}.csv`);
  }

  /** Download the translated PDF ZIP from assets/translations/ */
  downloadTranslatedPdf(lang: LanguageRow): void {
    const fileName = lang.translationZip ?? this.toSlug(lang.name) + '_translation';
    this.triggerDownload(`assets/Outputs/Translated_output/output_docs.zip`, `translated_eCTD.zip`);
  }

  /** Download the master glossary CSV (top-level button) */
  downloadMasterGlossary(): void {
    this.triggerDownload('assets/Outputs/Translated_output/dynamic_glossary_de.csv', 'master_glossary.csv');
  }

  // ── helpers ──────────────────────────────────────────────────────────────

  private triggerDownload(assetPath: string, downloadName: string): void {
    const anchor = document.createElement('a');
    anchor.href = assetPath;
    anchor.download = downloadName;
    anchor.rel = 'noopener noreferrer';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  }

  private toSlug(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_|_$)/g, '');
  }
}