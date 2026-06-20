export interface SubItem {
  question: string;
  answer: string;
}

export interface Branch {
  id: string;
  title: string;
  icon: string;
  intro: string;
  items: SubItem[];
}

export const MAIN_MENU_LABEL = 'Main Menu';
export const CLOSE_LABEL = 'Close Assistant';

export const FAQ_TREE: Branch[] = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    icon: '🚀',
    intro:
      'Welcome to the Viatris eCTD AI Platform. Here is how to navigate the workspace and kick off your first run.',
    items: [
      {
        question: 'What can I do from the Dashboard?',
        answer:
          'The Dashboard shows AI service cards (Hyperlinking, Consistency, Translation, Draft Module 2), recent job activity, and quick links to start a new upload or review results.',
      },
      {
        question: 'How do I upload an eCTD dossier?',
        answer:
          'Go to Upload in the sidebar, drag files into Modules M1–M5, select one or more AI services, then click Run Pipeline. You can track progress on the Results page.',
      },
      {
        question: 'Where do I see past submissions?',
        answer:
          'Open History from the sidebar to browse previous pipeline runs, filter by status, and reopen completed jobs in Results.',
      },
      {
        question: 'Which modules should I upload?',
        answer:
          'Upload all modules relevant to your submission. M1 is regional admin info; M2 summaries; M3 quality (CMC); M4 nonclinical; M5 clinical. The pipeline works best when source PDFs are complete.',
      },
    ],
  },
  {
    id: 'upload-pipeline',
    title: 'Upload & AI Pipeline',
    icon: '⚡',
    intro:
      'The upload workspace runs selected AI agents in a single orchestrated pipeline against your dossier modules.',
    items: [
      {
        question: 'Which AI services can I run together?',
        answer:
          'You can combine Hyperlinking & Auto-Tagging, Consistency, and Translation in one run. Draft Module 2 generation uses a separate tab with M3, M4, and M5 source documents.',
      },
      {
        question: 'How long does a pipeline take?',
        answer:
          'Runtime depends on dossier size and services selected. Small runs may finish in minutes; large multi-module submissions can take longer. Live progress appears on the Results page.',
      },
      {
        question: 'What file formats are supported?',
        answer:
          'PDF is the primary format for eCTD modules. Ensure documents are text-searchable where possible — scanned PDFs may take longer and rely on document intelligence extraction.',
      },
      {
        question: 'Can I run only one service?',
        answer:
          'Yes. Select only the service you need before starting the pipeline. For example, choose Consistency alone to audit numerical and terminology alignment across modules.',
      },
    ],
  },
  {
    id: 'hyperlinking',
    title: 'Hyperlinking & Auto-Tagging',
    icon: '🔗',
    intro:
      'The Hyperlinking agent builds cross-document links, validates anchors, and surfaces items that need human review.',
    items: [
      {
        question: 'How does deep-link validation work?',
        answer:
          'The validation crawler opens target PDFs in the background and confirms named destinations (e.g. #nameddest) resolve correctly before links are written to the backbone.',
      },
      {
        question: 'What happens if a link scores below 95%?',
        answer:
          'Low-confidence links are routed to Human-in-the-Loop (HITL) on the Results page. You can approve, edit, or reject each suggestion before export.',
      },
      {
        question: 'Can it handle sequence amendments?',
        answer:
          'Yes. For lifecycle submissions the agent calculates deltas and applies replace, append, or delete operations against the existing index.xml backbone.',
      },
      {
        question: 'Where do I review hyperlink results?',
        answer:
          'Open Results and select the Hyperlinking tab. You will see link statistics, module distribution, and the HITL queue for items needing approval.',
      },
    ],
  },
  {
    id: 'consistency',
    title: 'Consistency & QA Audits',
    icon: '🧪',
    intro:
      'The Consistency agent cross-checks scientific data, dosages, and terminology across modules to catch mismatches before submission.',
    items: [
      {
        question: 'How does it catch dosage discrepancies?',
        answer:
          'It compares values referenced in Module 2 summaries against Module 3, 4, and 5 source data and flags any conflicting numbers or units.',
      },
      {
        question: 'What happens when a mismatch is found?',
        answer:
          'The issue is highlighted on the Consistency results dashboard with the exact location in each document. Critical mismatches can block export until resolved.',
      },
      {
        question: 'Can it read scanned tables?',
        answer:
          'Yes. Azure Document Intelligence extracts table structure and bounding boxes from scanned PDFs so values can still be compared programmatically.',
      },
      {
        question: 'How do I interpret consistency scores?',
        answer:
          'Scores reflect how many cross-references passed automated checks. Review flagged items in priority order — high-severity issues typically involve patient-facing dosage or safety data.',
      },
    ],
  },
  {
    id: 'translation',
    title: 'Translation & Glossaries',
    icon: '🌐',
    intro:
      'The Translation agent localizes dossiers using Oracle-backed glossaries to keep regulatory terminology consistent across languages.',
    items: [
      {
        question: 'How do I choose a target language?',
        answer:
          'On the Upload page, select Translation as a service and pick the target language before running the pipeline. Regional rules adapt automatically for FDA, EMA, and PMDA contexts.',
      },
      {
        question: 'How do I update the glossary?',
        answer:
          'Edit approved translations in the glossary management view. Updates propagate to Oracle storage and embedding indexes so future runs use the latest terms immediately.',
      },
      {
        question: 'How does the system learn from feedback?',
        answer:
          'Short-term: RAG retrieves similar approved phrases at inference time. Long-term: monthly fine-tuning incorporates validated corrections from your tenant only.',
      },
      {
        question: 'How are incorrect translations prevented?',
        answer:
          'Glossary terms are locked where defined. Ambiguous phrases fall back to Human-in-the-Loop review before they appear in the exported dossier.',
      },
    ],
  },
  {
    id: 'results-history',
    title: 'Results & History',
    icon: '📊',
    intro:
      'Review live pipeline output, approve HITL items, and revisit completed jobs from prior sessions.',
    items: [
      {
        question: 'How do I monitor a running job?',
        answer:
          'Navigate to Results while a pipeline is active. Service-level progress bars update in real time via live event streaming until each agent completes.',
      },
      {
        question: 'What is Human-in-the-Loop (HITL)?',
        answer:
          'HITL is a review queue for AI outputs that need human confirmation — such as uncertain hyperlinks or translation candidates. Approve items individually or in batch.',
      },
      {
        question: 'Can I download processed outputs?',
        answer:
          'Yes. Once all selected services finish and required HITL items are resolved, download links appear on the Results page for the compiled dossier artifacts.',
      },
      {
        question: 'How far back does History go?',
        answer:
          'History lists all pipeline runs for your workspace. Use it to reopen a job, compare outcomes across submissions, or audit who ran which services and when.',
      },
    ],
  },
  {
    id: 'privacy-security',
    title: 'Data Privacy & Security',
    icon: '🔒',
    intro:
      'Your dossier data stays inside a private Azure tenant with strict isolation — never used to train public models.',
    items: [
      {
        question: 'Is my data used to train public AI models?',
        answer:
          'No. Processing runs in a fully private tenant. Your documents and corrections are never shared externally or used to train public foundation models.',
      },
      {
        question: 'Does data travel over the public internet?',
        answer:
          'All processing stays inside a secure Azure VNet. Data at rest and in transit is encrypted with AES-256.',
      },
      {
        question: 'Who can access my submissions?',
        answer:
          'Only authenticated users in your organization workspace. Access is scoped by your identity provider and workspace permissions.',
      },
      {
        question: 'What compliance standards apply?',
        answer:
          'The platform is designed for pharmaceutical regulatory workflows with audit logging, tenant isolation, and encryption aligned to enterprise GxP expectations.',
      },
    ],
  },
];
