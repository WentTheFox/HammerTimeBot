/**
 * @fileOverview Aliases for commonly used timezone names and abbreviations
 */

const centralEuropeanTimeAliases = ['CET', 'CEST', 'MET'];
const westernEuropeanTimeAliases = ['WET', 'WEST'];
const easternTimeAliases = ['ET', 'EST', 'EDT'];
const easternStandardTimeAliases = ['EST'];
const pacificTimeAliases = ['PT', 'PST', 'PDT'];
const centralTimeAliases = ['CT', 'CST', 'CDT'];
const mountainTimeAliases = ['MT', 'MST', 'MDT'];
const centralStandardTimeAliases = ['CST'];
const samaraTimeAliases = ['SAMT'];
const krasnoyarskTimeAliases = ['KRAT'];
const yakutskTimeAliases = ['YAKT'];
const amazonTimeAliases = ['AMT'];
const brasiliaTimeAliases = ['BRT'];
const australianEasternTime = ['AEST', 'AEDT'];
const westAfricaTime = ['WAT'];

export const timeZoneAliases = {
  'Africa/Cairo': ['EET', 'EEST'],
  'Africa/Lagos': westAfricaTime,
  'Africa/Tunis': westAfricaTime,
  'America/Anchorage': ['Alaska'],
  'America/Cancun': easternStandardTimeAliases,
  'America/Chicago': centralTimeAliases,
  'America/Ciudad_Juarez': mountainTimeAliases,
  'America/Los_Angeles': pacificTimeAliases,
  'America/Mexico_City': centralStandardTimeAliases,
  'America/Monterrey': centralStandardTimeAliases,
  'America/New_York': easternTimeAliases,
  'America/Ojinaga': centralTimeAliases,
  'America/Phoenix': mountainTimeAliases,
  'America/Tijuana': pacificTimeAliases,
  'America/Toronto': easternTimeAliases,
  'America/Vancouver': pacificTimeAliases,
  'Asia/Anadyr': ['ANAT'],
  'Asia/Chita': yakutskTimeAliases,
  'Asia/Gaza': ['PST'],
  'Asia/Irkutsk': ['IRKT'],
  'Asia/Kamchatka': ['PETT', 'PETST'],
  'Asia/Karachi': ['PKT', 'PST'],
  'Asia/Magadan': ['MAGT'],
  'Asia/Manila': ['PHT', 'PhST', 'PST'],
  'Asia/Novosibirsk': krasnoyarskTimeAliases,
  'Asia/Omsk': ['OMST'],
  'Asia/Tomsk': krasnoyarskTimeAliases,
  'Asia/Vladivostok': ['VLAT'],
  'Asia/Yakutsk': yakutskTimeAliases,
  'Asia/Yekaterinburg': ['YEKT'],
  'Australia/Brisbane': ['AEST'],
  'Australia/Sydney': australianEasternTime,
  'Australia/Melbourne': australianEasternTime,
  'Australia/Hobart': australianEasternTime,
  'Australia/Perth': ['AWST'],
  'Australia/Darwin': ['ACST'],
  'Australia/Adelaide': ['ACT', 'ACST', 'ACDT'],
  'Australia/Eucla': ['ACWST'],
  'Europe/Amsterdam': centralEuropeanTimeAliases,
  'Europe/Andorra': centralEuropeanTimeAliases,
  'Europe/Astrakhan': samaraTimeAliases,
  'Europe/Belgrade': centralEuropeanTimeAliases,
  'Europe/Berlin': centralEuropeanTimeAliases,
  'Europe/Bratislava': centralEuropeanTimeAliases,
  'Europe/Brussels': centralEuropeanTimeAliases,
  'Europe/Budapest': centralEuropeanTimeAliases,
  'Europe/Copenhagen': centralEuropeanTimeAliases,
  'Europe/Dublin': ['IST'],
  'Europe/Gibraltar': centralEuropeanTimeAliases,
  'Europe/Kaliningrad': ['KALT'],
  'Europe/Ljubljana': centralEuropeanTimeAliases,
  'Europe/London': ['BST'],
  'Europe/Luxembourg': centralEuropeanTimeAliases,
  'Europe/Madrid': centralEuropeanTimeAliases,
  'Europe/Malta': centralEuropeanTimeAliases,
  'Europe/Monaco': centralEuropeanTimeAliases,
  'Europe/Moscow': ['MSK'],
  'Europe/Oslo': centralEuropeanTimeAliases,
  'Europe/Paris': centralEuropeanTimeAliases,
  'Europe/Podgorica': centralEuropeanTimeAliases,
  'Europe/Portugal': westernEuropeanTimeAliases,
  'Europe/Prague': centralEuropeanTimeAliases,
  'Europe/Rome': centralEuropeanTimeAliases,
  'Europe/Samara': samaraTimeAliases,
  'Europe/San_Marino': centralEuropeanTimeAliases,
  'Europe/Sarajevo': centralEuropeanTimeAliases,
  'Europe/Saratov': samaraTimeAliases,
  'Europe/Skopje': centralEuropeanTimeAliases,
  'Europe/Stockholm': centralEuropeanTimeAliases,
  'Europe/Tirane': centralEuropeanTimeAliases,
  'Europe/Ulyanovsk': samaraTimeAliases,
  'Europe/Vaduz': centralEuropeanTimeAliases,
  'Europe/Vatican': centralEuropeanTimeAliases,
  'Europe/Vienna': centralEuropeanTimeAliases,
  'Europe/Warsaw': centralEuropeanTimeAliases,
  'Europe/Zagreb': centralEuropeanTimeAliases,
  'Europe/Zurich': centralEuropeanTimeAliases,
  'America/Rio_Branco': ['ACT'],
  'America/Cuiaba': amazonTimeAliases,
  'America/Porto_Velho': amazonTimeAliases,
  'America/Campo_Grande': amazonTimeAliases,
  'America/Boa_Vista': amazonTimeAliases,
  'America/Manaus': amazonTimeAliases,
  'America/Sao_Paulo': brasiliaTimeAliases,
  'America/Maceio': brasiliaTimeAliases,
  'America/Fortaleza': brasiliaTimeAliases,
  'America/Recife': brasiliaTimeAliases,
  'America/Noronha': ['FNT'],
  'Pacific/Auckland': ['NZST', 'NZDT'],
} as const satisfies Record<string, string[]>;
