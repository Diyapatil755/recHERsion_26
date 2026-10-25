import type {Incident, Language} from './types';

export type Signal = 'physicalThreat' | 'reportedThreat' | 'blackmail' | 'intimateCoercion' | 'repeatedContact' | 'accountCoercion' | 'doxxing';
export type RuleLevel = 'Low' | 'Medium' | 'High';

const patterns: Record<Language, Record<Signal, RegExp[]>> = {
  en: {
    physicalThreat: [/\b(kill you|hurt you|attack you|come find you|find where you live|you will regret|threaten(?:ing)? to hurt)\b/i],
    reportedThreat: [],
    blackmail: [/\b(blackmail|pay me or|send money or|give me money or|leak (?:your|the) (?:photo|picture|video|secret)|expose (?:you|your))\b/i],
    intimateCoercion: [/\b(nude|naked|intimate (?:photo|picture|image)|explicit (?:photo|image)|sex tape|private (?:photo|picture))\b/i],
    repeatedContact: [/\b(again and again|every day|keeps? (?:messaging|calling|contacting)|won't stop|multiple times|after i blocked|after being blocked|new account to contact)\b/i],
    accountCoercion: [/\b(send|give|tell me) (?:your )?(?:password|otp|one[- ]time code|verification code|login code)\b/i, /\b(if you don't|unless you|or else|you must|do it now)\b/i],
    doxxing: [/\b(post|share|publish|leak) (?:your )?(?:home )?(?:address|phone number|location)\b/i, /\b(doxx|doxxing|doxed)\b/i],
  },
  hi: {
    physicalThreat: [/(मार डाल(?:ूँगा|ूंगा|ेंगा|ेगा)?|मार दूंगा|जान से मार|नुकसान पहुँचाऊँगा|घर आकर देख लूँगा|तुम्हें ढूँढ निकालूँगा)/i],
    reportedThreat: [],
    blackmail: [/(ब्लैकमेल|पैसे दो वरना|पैसे नहीं दिए तो|तस्वीरें? (?:लीक|वायरल|सबको भेज)|तुम्हें बेनकाब कर दूँगा)/i],
    intimateCoercion: [/(न्यूड|नग्न (?:फोटो|तस्वीर)|अंतरंग (?:फोटो|तस्वीर)|निजी (?:फोटो|तस्वीर)|अश्लील (?:फोटो|वीडियो))/i],
    repeatedContact: [/(बार[- ]बार|रोज़(?:़)? संदेश|रुकने का नाम नहीं|ब्लॉक करने के बाद|कई बार संपर्क|नए अकाउंट से संपर्क)/i],
    accountCoercion: [/(ओटीपी|पासवर्ड|सत्यापन कोड).{0,18}(भेजो|बताओ|दो)|(?:नहीं किया तो|वरना|करना ही होगा)/i],
    doxxing: [/(पता|फोन नंबर|लोकेशन).{0,24}(लीक|सबको बताऊँगा|पोस्ट करूंगा)|डॉक्सिंग/i],
  },
  mr: {
    physicalThreat: [/(मारून टाकेन|जीवे मार|इजा करेन|घरी येऊन बघतो|तुला शोधून काढेन|तुला मारण्याची धमकी)/i],
    reportedThreat: [],
    blackmail: [/(ब्लॅकमेल|पैसे दे नाहीतर|पैसे नाही दिले तर|फोटो (?:लीक|व्हायरल|सगळ्यांना पाठव)|तुला उघड करेन)/i],
    intimateCoercion: [/(न्यूड|नग्न (?:फोटो|चित्र)|अंतरंग (?:फोटो|चित्र)|खाजगी (?:फोटो|चित्र)|अश्लील (?:फोटो|व्हिडिओ))/i],
    repeatedContact: [/(पुन्हा पुन्हा|रोज संदेश|थांबत नाही|ब्लॉक केल्यानंतर|अनेकदा संपर्क|नव्या अकाउंटवरून संपर्क)/i],
    accountCoercion: [/(ओटीपी|पासवर्ड|व्हेरिफिकेशन कोड).{0,18}(पाठव|सांग|दे)|(?:नाहीतर|नाही केले तर|करावेच लागेल)/i],
    doxxing: [/(पत्ता|फोन नंबर|लोकेशन).{0,24}(लीक|सगळ्यांना सांगेन|पोस्ट करेन)|डॉक्सिंग/i],
  },
};

export function matchMessageSignals(message: string, language: Language = 'en'): Signal[] {
  const value = message.normalize('NFKC').slice(0, 8_000);
  return (Object.keys(patterns[language]) as Signal[]).filter((signal) => patterns[language][signal].some((pattern) => pattern.test(value)));
}

export function cautiousLevel(signals: readonly Signal[]): RuleLevel {
  const has = (signal: Signal) => signals.includes(signal);
  if (has('physicalThreat') || has('doxxing') ||
      (has('intimateCoercion') && (has('blackmail') || has('accountCoercion'))) ||
      (has('blackmail') && has('accountCoercion'))) return 'High';
  return signals.length ? 'Medium' : 'Low';
}

export function analyzeMessage(message: string, language: Language = 'en') {
  const signals = matchMessageSignals(message, language);
  return {signals, level: cautiousLevel(signals)};
}

export function incidentRuleReview(incident: Incident, language: Language = 'en') {
  const searchable = [incident.title, incident.category, incident.description, incident.sender || ''].join(' ').slice(0, 12_000);
  const signals = matchMessageSignals(searchable, language);
  const category = `${incident.category} ${incident.title}`.toLowerCase();
  if (/(harass|stalk|unwanted|sextort|blackmail|doxx|threat|harassment|धमकी|ब्लैकमेल|छळ|धमकाव)/i.test(category)) {
    if (!signals.includes('repeatedContact') && /(harass|stalk|unwanted|छळ)/i.test(category)) signals.push('repeatedContact');
    if (!signals.includes('blackmail') && /(blackmail|sextort|ब्लैकमेल)/i.test(category)) signals.push('blackmail');
    if (!signals.includes('doxxing') && /(doxx)/i.test(category)) signals.push('doxxing');
    if (!signals.includes('reportedThreat') && /(threat|धमकी|धमकाव)/i.test(category)) signals.push('reportedThreat');
  }
  return {signals, level: cautiousLevel(signals)};
}
