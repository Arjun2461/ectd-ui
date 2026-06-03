import { DraftSourceModule } from '../models/draft-history.types';

/** Sample eCTD document base names (without .pdf) per source module. */
export const DEMO_FILES_BY_MODULE: Record<DraftSourceModule, readonly string[]> = {
  M3: [
    '3.2.P.2-pharm-dev',
    '3.2.P.3-manufacture',
    '3.2.P.8-stability',
    '3.2.S.1-general-info',
    '3.2.S.2-manufacture',
    '3.2.S.4-control',
    '3.2.S.7-stability',
  ],
  M4: [
    '4.2.1.1-primary-pd',
    '4.2.1.3-safety-pharm',
    '4.2.3.2-repeat-dose-tox',
    '4.2.3.3-genotoxicity',
  ],
  M5: [
    '5.2-tabular-listing',
    '5.3.4.2-phase3-study1',
    '5.3.4-integrated-safety',
    '5.4-references',
  ],
};

export function demoFileNamesForModule(tag: DraftSourceModule): string[] {
  return [...DEMO_FILES_BY_MODULE[tag]];
}

export function createDemoPdfFile(baseName: string): File {
  const name = baseName.endsWith('.pdf') ? baseName : `${baseName}.pdf`;
  return new File([new Uint8Array(2048)], name, { type: 'application/pdf' });
}

export function countDemoFilesForModules(modules: DraftSourceModule[]): number {
  return modules.reduce((sum, tag) => sum + DEMO_FILES_BY_MODULE[tag].length, 0);
}
