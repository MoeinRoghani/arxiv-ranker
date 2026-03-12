const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export function formatYearMonth(ym: string): string {
  const [y, m] = ym.split('-');
  return `${MONTHS[parseInt(m) - 1]} ${y}`;
}

export function formatDate(iso: string): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function truncateAuthors(authors: string, max = 160): string {
  if (!authors) return '';
  return authors.length > max ? authors.slice(0, max) + '...' : authors;
}

const VENUE_ABBREV: [RegExp, string][] = [
  [/\bNeurIPS\b|Neural Information Processing/i, 'NeurIPS'],
  [/\bICML\b|Int Conf Mach Learn/i, 'ICML'],
  [/\bEMNLP\b|Empirical Methods.*Natural Language/i, 'EMNLP'],
  [/\bNAACL\b|North American.*Computational Linguistics/i, 'NAACL'],
  [/\bACL\b(?!.*access)/i, 'ACL'],
  [/\bCVPR\b|Computer Vision.*Pattern Recognition/i, 'CVPR'],
  [/\bICCV\b|International Conference.*Computer Vision/i, 'ICCV'],
  [/\bECCV\b|European Conference.*Computer Vision/i, 'ECCV'],
  [/\bAAAI\b|AAAI Conf/i, 'AAAI'],
  [/\bIJCAI\b|Joint Conference.*Artificial Intelligence/i, 'IJCAI'],
  [/\bICRA\b|Robotics and Automation/i, 'ICRA'],
  [/\bIROS\b|Intelligent Robots/i, 'IROS'],
  [/\bAAMAS\b|Autonomous Agents.*Multi-Agent/i, 'AAMAS'],
  [/\bUAI\b|Uncertainty.*Artificial Intelligence/i, 'UAI'],
  [/\bICLR\b|Learning Representations/i, 'ICLR'],
  [/\bCoRL\b|Robot Learning/i, 'CoRL'],
  [/\bRSS\b|Robotics.*Science and Systems/i, 'RSS'],
  [/\bKDD\b|Knowledge Discovery/i, 'KDD'],
  [/\bAISTATS\b|Artificial Intelligence.*Statistics/i, 'AISTATS'],
  [/\bEACL\b|European.*Computational Linguistics/i, 'EACL'],
  [/\bBIBM\b|Bioinform.*Biomed/i, 'BIBM'],
  [/\bSAMI\b|Symp.*Mach.*Intell/i, 'SAMI'],
  [/\bIUI\b|Intell.*User Interface/i, 'IUI'],
  [/\bSSRN\b|Social Science Research/i, 'SSRN'],
  [/\bBigData\b|Big Data/i, 'BigData'],
  [/\bIEEE Access\b/i, 'IEEE Access'],
  [/\bIEEE Trans.*Autom.*Control/i, 'IEEE TAC'],
  [/\bIEEE Robot.*Autom.*Lett/i, 'IEEE RA-L'],
  [/\bIEEE Commun.*Lett/i, 'IEEE CL'],
  [/Front.*Artif.*Intell/i, 'Frontiers AI'],
  [/Expert.*Syst.*Appl/i, 'Expert Syst Appl'],
  [/Workshop/i, 'Workshop'],
  [/Findings/i, 'Findings'],
  [/\barXiv\b/i, 'arXiv'],
];

export function shortVenue(venue: string): string {
  if (!venue) return '-';
  for (const [re, short] of VENUE_ABBREV) {
    if (re.test(venue)) return short;
  }
  if (venue.length > 20) {
    const parts = venue.split(',');
    const shortest = parts.reduce((a, b) => a.trim().length <= b.trim().length ? a : b).trim();
    if (shortest.length <= 20) return shortest;
  }
  return venue;
}

export function tierClass(tier: string): string {
  if (tier.includes('LANDMARK')) return 'landmark';
  if (tier.includes('IMPORTANT')) return 'important';
  return 'notable';
}

export function tierLabel(tier: string): string {
  if (tier.includes('LANDMARK')) return 'Landmark';
  if (tier.includes('IMPORTANT')) return 'Important';
  return 'Notable';
}
