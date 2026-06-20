export interface SubItem {
  question: string;
  answer: string;
}

export interface Branch {
  title: string;
  intro: string;
  items: SubItem[];
}

// 🔥 FULL TREE STRUCTURE
export const FAQ_TREE: Branch[] = [
  {
    title: '📑 XML Backbone & Hyperlinks',
    intro:
      "The platform’s XML Architect agent automatically compiles your index.xml backbone and validates every hyperlink before download.",
    items: [
      {
        question: 'How does the validation crawler check deep links?',
        answer:
          'It opens PDFs in the background and verifies anchors like #nameddest exist.',
      },
      {
        question: 'What happens if a link scores below 95%?',
        answer:
          'Low-confidence links are routed to Human-in-the-Loop for approval.',
      },
      {
        question: 'Can it handle Sequence 0001 lifecycle amendments?',
        answer:
          'Yes. It calculates delta and applies replace/append/delete operations.',
      },
    ],
  },

  {
    title: '🌐 Translations & Oracle Glossaries',
    intro:
      'Translation agent ensures consistent terminology using Oracle glossary.',
    items: [
      {
        question: 'How do I update the glossary?',
        answer:
          'Edit translation → system updates Oracle + embeddings instantly.',
      },
      {
        question: 'How does system learn from feedback?',
        answer:
          'Uses RAG short-term and monthly fine-tuning long-term.',
      },
    ],
  },

  {
    title: '🔒 Data Privacy & Compliance',
    intro:
      'Platform runs in secure Azure VNet with strict data isolation.',
    items: [
      {
        question: 'Is data used to train public AI?',
        answer: 'No. Fully private tenant. Never used externally.',
      },
      {
        question: 'Does data travel over internet?',
        answer:
          'No. Fully contained inside VNet with AES-256 encryption.',
      },
    ],
  },

  {
    title: '🧪 Consistency Agent & QA Audits',
    intro:
      'Automated QA layer ensuring clinical data consistency across modules.',
    items: [
      {
        question: 'How does it catch dosage discrepancies?',
        answer:
          'Cross-checks Module 2 vs Module 3 & 4 data automatically.',
      },
      {
        question: 'What happens on mismatch?',
        answer:
          'Blocks submission and highlights exact issue.',
      },
      {
        question: 'Can it read scanned tables?',
        answer:
          'Yes using Azure Document Intelligence bounding boxes.',
      },
    ],
  },

  {
    title: '🥢 Translation Automation & Regional Dossiers',
    intro:
      'Automates localization for FDA, EMA, PMDA dossiers.',
    items: [
      {
        question: 'How does it handle ingestion pipelines?',
        answer:
          'Python orchestrators process and store structured metadata.',
      },
      {
        question: 'How does it adapt to regional rules?',
        answer:
          'Dynamic ruleset switching based on region selection.',
      },
      {
        question: 'How are incorrect translations prevented?',
        answer:
          'Glossary locked + human fallback for ambiguity.',
      },
    ],
  },

  {
    title: '⏱️ ROI, Performance & Metrics',
    intro:
      'Improves submission economics and reduces timelines.',
    items: [
      {
        question: 'What is timeline reduction?',
        answer:
          'From 12 weeks → under 3 weeks (70% reduction).',
      },
      {
        question: 'How does it impact revenue?',
        answer:
          'Recovers ~58 days → $15M–$75M potential gain.',
      },
      {
        question: 'Cost savings on rejections?',
        answer:
          '$80K–$200K saved per avoided resubmission.',
      },
    ],
  },
];