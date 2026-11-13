// Seed data taken from wintershowdown/design-v2.html (display names, short codes, colors, jersey numbers)
// and the official schedule (§4). Team/player identity itself comes from the xlsx import.
export type SeedTeam = { key: string; displayName: string; short: string; group: 'A' | 'B'; color: string; squad: { name: string; number: number }[] };
export const SEED_TEAMS: SeedTeam[] = [
 {
  "key": "outsiders",
  "displayName": "The Outsiders",
  "short": "OUT",
  "group": "A",
  "color": "#00E5FF",
  "squad": [
   {
    "name": "Jubayer",
    "number": 1
   },
   {
    "name": "Yeamin",
    "number": 2
   },
   {
    "name": "Rifat",
    "number": 3
   },
   {
    "name": "Refat",
    "number": 4
   },
   {
    "name": "Fiham",
    "number": 5
   },
   {
    "name": "Zaber",
    "number": 6
   },
   {
    "name": "Labbaik",
    "number": 7
   },
   {
    "name": "Lihan",
    "number": 8
   },
   {
    "name": "Nazib",
    "number": 9
   },
   {
    "name": "Omar",
    "number": 10
   }
  ]
 },
 {
  "key": "eclipse",
  "displayName": "Eclipse FC",
  "short": "ECL",
  "group": "A",
  "color": "#CCFF00",
  "squad": [
   {
    "name": "Alfi Rahman Siam",
    "number": 1
   },
   {
    "name": "Ramim Ahmed Mikat",
    "number": 2
   },
   {
    "name": "Shakhawat Ferdous Shawon",
    "number": 3
   },
   {
    "name": "Mashrur Hossain Mahim",
    "number": 4
   },
   {
    "name": "Fahim",
    "number": 5
   },
   {
    "name": "SM Abrarul Hadi",
    "number": 6
   },
   {
    "name": "Saimum Shanto",
    "number": 7
   },
   {
    "name": "Fakrul Alam Joy",
    "number": 8
   },
   {
    "name": "Ahnaf Hadid",
    "number": 9
   },
   {
    "name": "Tawhid Islam",
    "number": 10
   }
  ]
 },
 {
  "key": "btg",
  "displayName": "BTG",
  "short": "BTG",
  "group": "A",
  "color": "#38BDF8",
  "squad": [
   {
    "name": "Saif Md Chowdhury",
    "number": 1
   },
   {
    "name": "Raziun Hasan",
    "number": 2
   },
   {
    "name": "Saiful Islam Robi",
    "number": 3
   },
   {
    "name": "Tahasin Md Chowdhury",
    "number": 4
   },
   {
    "name": "Tahmid Nafis",
    "number": 5
   },
   {
    "name": "Ataur Rahman Samnan",
    "number": 6
   },
   {
    "name": "Istiak Hossain",
    "number": 7
   },
   {
    "name": "Abdullah Al Mahin",
    "number": 8
   },
   {
    "name": "Tanveer Mahtab",
    "number": 9
   },
   {
    "name": "Sohan Islam",
    "number": 10
   }
  ]
 },
 {
  "key": "umbra",
  "displayName": "Umbra FC",
  "short": "UMB",
  "group": "A",
  "color": "#A855F7",
  "squad": [
   {
    "name": "Abid",
    "number": 1
   },
   {
    "name": "Safwan",
    "number": 2
   },
   {
    "name": "Ayat",
    "number": 3
   },
   {
    "name": "Hamim",
    "number": 4
   },
   {
    "name": "Inan",
    "number": 5
   },
   {
    "name": "Ishmum",
    "number": 6
   },
   {
    "name": "Tawkir",
    "number": 7
   },
   {
    "name": "Nehal",
    "number": 8
   }
  ]
 },
 {
  "key": "rebellions",
  "displayName": "Rebellions",
  "short": "REB",
  "group": "B",
  "color": "#F43F5E",
  "squad": [
   {
    "name": "Nasif Waliullah",
    "number": 1
   },
   {
    "name": "Sabrin Islam",
    "number": 2
   },
   {
    "name": "Shabab",
    "number": 3
   },
   {
    "name": "Tahsin Anan",
    "number": 4
   },
   {
    "name": "Aninda Khan",
    "number": 5
   },
   {
    "name": "Navid",
    "number": 6
   },
   {
    "name": "Arabi",
    "number": 7
   },
   {
    "name": "Enan",
    "number": 8
   },
   {
    "name": "Nafi Siddique",
    "number": 9
   },
   {
    "name": "Tepantor",
    "number": 10
   }
  ]
 },
 {
  "key": "hornets",
  "displayName": "Hornets",
  "short": "HOR",
  "group": "B",
  "color": "#FACC15",
  "squad": [
   {
    "name": "Ayman Rahmatullah",
    "number": 1
   },
   {
    "name": "Farhan Ahmed",
    "number": 2
   },
   {
    "name": "Arib",
    "number": 3
   },
   {
    "name": "Areeb",
    "number": 4
   },
   {
    "name": "Ayaan Zarraf",
    "number": 5
   },
   {
    "name": "Mayaz",
    "number": 6
   },
   {
    "name": "Mehrab",
    "number": 7
   },
   {
    "name": "Shamayel Keyzad",
    "number": 8
   },
   {
    "name": "Shahbaaz",
    "number": 9
   },
   {
    "name": "Arif",
    "number": 10
   }
  ]
 },
 {
  "key": "goaldiggers",
  "displayName": "Goal Diggers",
  "short": "GLD",
  "group": "B",
  "color": "#10B981",
  "squad": [
   {
    "name": "Saif Azam Arabi",
    "number": 1
   },
   {
    "name": "Sayeed Azam",
    "number": 2
   },
   {
    "name": "Abu Bakar Siddique",
    "number": 3
   },
   {
    "name": "Siyam",
    "number": 4
   },
   {
    "name": "Mostahid Ohi",
    "number": 5
   },
   {
    "name": "Tanjil Bhuiyan",
    "number": 6
   },
   {
    "name": "Adnan",
    "number": 7
   },
   {
    "name": "Fardeen Bhuiyan",
    "number": 8
   }
  ]
 },
 {
  "key": "payeball",
  "displayName": "Payeball",
  "short": "PAY",
  "group": "B",
  "color": "#FB923C",
  "squad": [
   {
    "name": "Sindid Imtiaz Sayem",
    "number": 1
   },
   {
    "name": "Saifur Rahman Jamil",
    "number": 2
   },
   {
    "name": "Rumman Al Jamiu",
    "number": 3
   },
   {
    "name": "Nishat Nio",
    "number": 4
   },
   {
    "name": "Araf Tahmid",
    "number": 5
   },
   {
    "name": "Mahir Iqbal",
    "number": 6
   },
   {
    "name": "Nahid Khan",
    "number": 7
   },
   {
    "name": "Mushfiqur Rahman",
    "number": 8
   },
   {
    "name": "Kazi Jawadul Haque Srabon",
    "number": 9
   },
   {
    "name": "Tafsirul Karim",
    "number": 10
   }
  ]
 }
];

// Registered (sheet) name -> design-v2 key. Matched after normalisation (lowercase, alnum only).
export const NAME_ALIASES: Record<string, string> = {
  theoutsiders: 'outsiders', outsiders: 'outsiders', eclipsefc: 'eclipse', eclipse: 'eclipse', btg: 'btg',
  umbrafc: 'umbra', umbra: 'umbra', rebellions: 'rebellions', hornets: 'hornets', goaldiggers: 'goaldiggers',
  payeball: 'payeball', 'পয়েবল': 'payeball',
};
export function normName(s: string): string {
  const t = s.normalize('NFC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
  return t;
}

export type SeedMatch = { code: string; no: number; stage: 'group' | 'semifinal' | 'final' | 'third_place'; group?: 'A' | 'B'; start: string; end: string; home?: string; away?: string; homePh?: string; awayPh?: string };
const D = '2026-11-13T';
const T = (hm: string) => { const [h, m] = hm.split(':').map(Number); return `${D}${String(h + 12).padStart(2, '0')}:${String(m).padStart(2, '0')}:00+06:00`; };
const raw: [string, number, SeedMatch['stage'], ('A' | 'B' | undefined), string, string, string, string][] = [
  ['M01', 1, 'group', 'A', '2:10', '2:22', 'outsiders', 'eclipse'],
  ['M02', 2, 'group', 'B', '2:23', '2:35', 'goaldiggers', 'payeball'],
  ['M03', 3, 'group', 'A', '2:36', '2:48', 'btg', 'umbra'],
  ['M04', 4, 'group', 'B', '2:49', '3:01', 'rebellions', 'hornets'],
  ['M05', 5, 'group', 'A', '3:02', '3:14', 'outsiders', 'btg'],
  ['M06', 6, 'group', 'B', '3:15', '3:27', 'rebellions', 'goaldiggers'],
  ['M07', 7, 'group', 'A', '3:28', '3:40', 'eclipse', 'umbra'],
  ['M08', 8, 'group', 'B', '3:41', '3:53', 'hornets', 'payeball'],
  ['M09', 9, 'group', 'A', '3:54', '4:06', 'outsiders', 'umbra'],
  ['M10', 10, 'group', 'B', '4:07', '4:19', 'rebellions', 'payeball'],
  ['M11', 11, 'group', 'A', '4:20', '4:32', 'eclipse', 'btg'],
  ['M12', 12, 'group', 'B', '4:33', '4:45', 'hornets', 'goaldiggers'],
  ['SF1', 13, 'semifinal', undefined, '4:50', '5:08', 'A1', 'B2'],
  ['SF2', 14, 'semifinal', undefined, '5:10', '5:28', 'B1', 'A2'],
  ['FINAL', 15, 'final', undefined, '5:35', '5:59', 'W(SF1)', 'W(SF2)'],
];
export const SEED_MATCHES: SeedMatch[] = raw.map(([code, no, stage, group, s, e, h, a]) =>
  stage === 'group'
    ? { code, no, stage, group, start: T(s), end: T(e), home: h, away: a }
    : { code, no, stage, start: T(s), end: T(e), homePh: h, awayPh: a });
export const THIRD_PLACE_SEED: SeedMatch = { code: 'THIRD', no: 16, stage: 'third_place', start: T('5:30'), end: T('5:34'), homePh: 'L(SF1)', awayPh: 'L(SF2)' };
export const KICKOFF_ISO = T('2:10');
