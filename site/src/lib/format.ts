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

const VENUE_FULL: Record<string, string> = {
  'NeurIPS': 'Conference on Neural Information Processing Systems',
  'ICML': 'International Conference on Machine Learning',
  'ICLR': 'International Conference on Learning Representations',
  'EMNLP': 'Conference on Empirical Methods in Natural Language Processing',
  'NAACL': 'North American Chapter of the Association for Computational Linguistics',
  'ACL': 'Annual Meeting of the Association for Computational Linguistics',
  'CVPR': 'IEEE/CVF Conference on Computer Vision and Pattern Recognition',
  'ICCV': 'IEEE/CVF International Conference on Computer Vision',
  'ECCV': 'European Conference on Computer Vision',
  'AAAI': 'AAAI Conference on Artificial Intelligence',
  'IJCAI': 'International Joint Conference on Artificial Intelligence',
  'ICRA': 'IEEE International Conference on Robotics and Automation',
  'IROS': 'IEEE/RSJ International Conference on Intelligent Robots and Systems',
  'AAMAS': 'International Conference on Autonomous Agents and Multi-Agent Systems',
  'UAI': 'Conference on Uncertainty in Artificial Intelligence',
  'CoRL': 'Conference on Robot Learning',
  'RSS': 'Robotics: Science and Systems',
  'KDD': 'ACM SIGKDD Conference on Knowledge Discovery and Data Mining',
  'AISTATS': 'International Conference on Artificial Intelligence and Statistics',
  'EACL': 'Conference of the European Chapter of the Association for Computational Linguistics',
  'SIGIR': 'ACM SIGIR Conference on Research and Development in Information Retrieval',
  'COLT': 'Conference on Learning Theory',
  'COLM': 'Conference on Language Modeling',
  'IEEE Access': 'IEEE Access',
  'IEEE TAC': 'IEEE Transactions on Automatic Control',
  'IEEE RA-L': 'IEEE Robotics and Automation Letters',
  'IEEE CL': 'IEEE Communications Letters',
  'Frontiers AI': 'Frontiers in Artificial Intelligence',
  'Expert Syst Appl': 'Expert Systems with Applications',
  'JMLR': 'Journal of Machine Learning Research',
  'TMLR': 'Transactions on Machine Learning Research',
  'JAIR': 'Journal of Artificial Intelligence Research',
  'TPAMI': 'IEEE Transactions on Pattern Analysis and Machine Intelligence',
  'TACL': 'Transactions of the Association for Computational Linguistics',
};

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

export function fullVenue(venue: string): string | null {
  const short = shortVenue(venue);
  if (short === '-' || short === venue) return null;
  return VENUE_FULL[short] ?? null;
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
