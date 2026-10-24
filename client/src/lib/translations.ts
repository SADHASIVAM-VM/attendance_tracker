import { LanguageCode } from '../types/fieldWorker';

export interface TranslationStrings {
  appTitle: string;
  assignedLocation: string;
  notClockedIn: string;
  workingSince: string;
  shiftDone: string;
  clockIn: string;
  clockOut: string;
  confirmClockOut: string;
  confirmClockOutDesc: string;
  cancel: string;
  continue: string;
  locationCheck: string;
  youAreAtSite: string;
  youAreTooFar: string;
  metersAway: string;
  insideZone: string;
  takePhoto: string;
  retakePhoto: string;
  confirmPhoto: string;
  clockInSuccess: string;
  clockOutSuccess: string;
  backToHome: string;
  history: string;
  today: string;
  weeklyTotal: string;
  hoursWorked: string;
  viewPhotos: string;
  gpsSearching: string;
  gpsReady: string;
  noGpsError: string;
  cameraDeniedError: string;
  offlineBanner: string;
  syncNow: string;
  sunlightMode: string;
  standardMode: string;
  switchRole: string;
  loginTitle: string;
  enterPhone: string;
  enterPin: string;
  signIn: string;
  quickTestLogin: string;
  hoursShort: string;
  minsShort: string;
}

export const TRANSLATIONS: Record<LanguageCode, TranslationStrings> = {
  en: {
    appTitle: 'FIELD ATTENDANCE',
    assignedLocation: 'ASSIGNED WORKSITE',
    notClockedIn: 'NOT CLOCKED IN',
    workingSince: 'WORKING SINCE',
    shiftDone: 'SHIFT FINISHED',
    clockIn: 'CLOCK IN',
    clockOut: 'CLOCK OUT',
    confirmClockOut: 'End Your Shift Now?',
    confirmClockOutDesc: 'Are you ready to clock out and finish today’s work?',
    cancel: 'Cancel',
    continue: 'Continue',
    locationCheck: 'Location Check',
    youAreAtSite: "YOU'RE AT SITE",
    youAreTooFar: "YOU'RE TOO FAR",
    metersAway: 'm away',
    insideZone: 'Inside work zone',
    takePhoto: 'TAKE SELFIE PHOTO',
    retakePhoto: 'Retake',
    confirmPhoto: 'CONFIRM & SUBMIT',
    clockInSuccess: 'CLOCK-IN RECORDED!',
    clockOutSuccess: 'SHIFT COMPLETE!',
    backToHome: 'BACK TO HOME',
    history: 'History',
    today: 'Today',
    weeklyTotal: 'WEEKLY TOTAL',
    hoursWorked: 'Total Shift Time',
    viewPhotos: 'View Verification Photo',
    gpsSearching: 'Searching GPS signal...',
    gpsReady: 'GPS signal verified (±{acc}m)',
    noGpsError: 'GPS Location unavailable. Please enable device location.',
    cameraDeniedError: 'Camera permission denied. Tap here to retry or use snapshot.',
    offlineBanner: 'OFFLINE MODE: Attendance saved locally. Auto-syncs when online.',
    syncNow: 'Sync Now',
    sunlightMode: 'Sunlight Mode',
    standardMode: 'Standard Mode',
    switchRole: 'Role',
    loginTitle: 'WORKER LOGIN',
    enterPhone: 'Phone Number',
    enterPin: '4-Digit PIN',
    signIn: 'SIGN IN',
    quickTestLogin: 'Quick Demo Worker',
    hoursShort: 'h',
    minsShort: 'm',
  },
  ta: {
    appTitle: 'பணி வருகை பதிவு',
    assignedLocation: 'ஒதுக்கப்பட்ட பணி இடம்',
    notClockedIn: 'வேலை தொடங்கவில்லை',
    workingSince: 'வேலை தொடக்கம்',
    shiftDone: 'பணி முடிந்தது',
    clockIn: 'பணியை தொடங்கு (Clock In)',
    clockOut: 'பணியை முடி (Clock Out)',
    confirmClockOut: 'இன்றைய பணியை முடிக்கலாமா?',
    confirmClockOutDesc: 'நீங்கள் Clock Out செய்து வீட்டுக்கு செல்ல தயாரா?',
    cancel: 'ரத்து செய்',
    continue: 'தொடரவும்',
    locationCheck: 'இட சரிபார்ப்பு',
    youAreAtSite: 'நீங்கள் பணி இடத்தில் உள்ளீர்கள்',
    youAreTooFar: 'நீங்கள் பணி இடத்தை விட்டு தூரத்தில் உள்ளீர்கள்',
    metersAway: 'மீட்டர் தொலைவு',
    insideZone: 'பணி எல்லைக்குள் உள்ளீர்கள்',
    takePhoto: 'புகைப்படம் எடுங்கள்',
    retakePhoto: 'மீண்டும் எடு',
    confirmPhoto: 'உறுதி செய்து சமர்ப்பி',
    clockInSuccess: 'வருகை பதிவானது!',
    clockOutSuccess: 'பணி வெற்றிகரமாக முடிந்தது!',
    backToHome: 'முகப்புக்கு செல்',
    history: 'பதிவுகள்',
    today: 'இன்று',
    weeklyTotal: 'வார மொத்த நேரம்',
    hoursWorked: 'பணி நேரம்',
    viewPhotos: 'புகைப்படத்தை பார்',
    gpsSearching: 'GPS சிக்னல் தேடுகிறது...',
    gpsReady: 'GPS உறுதி செய்யப்பட்டது (±{acc}m)',
    noGpsError: 'GPS இருப்பிடம் கிடைக்கவில்லை. Location-ஐ இயக்கவும்.',
    cameraDeniedError: 'கேமரா அனுமதி இல்லை. அனுமதிக்கவும்.',
    offlineBanner: 'ஆஃப்லைன்: தகவல் போனில் சேமிக்கப்பட்டது. இணையம் வந்ததும் தானாக ஏறும்.',
    syncNow: 'இப்போதே ஏற்று',
    sunlightMode: 'வெயில் முறை (Sunlight Mode)',
    standardMode: 'சாதாரண முறை',
    switchRole: 'பங்கு',
    loginTitle: 'தொழிலாளர் உள்நுழைவு',
    enterPhone: 'தொலைபேசி எண்',
    enterPin: '4-இலக்க பின் (PIN)',
    signIn: 'உள்நுழைக',
    quickTestLogin: 'மாதிரி தொழிலாளி',
    hoursShort: 'ம',
    minsShort: 'நி',
  },
  hi: {
    appTitle: 'फ़ील्ड हाजिरी ट्रैकर',
    assignedLocation: 'आवंटित कार्य स्थल',
    notClockedIn: 'हाजिरी नहीं लगी',
    workingSince: 'काम चालू समय',
    shiftDone: 'शिफ्ट समाप्त',
    clockIn: 'काम शुरू करें (Clock In)',
    clockOut: 'काम समाप्त करें (Clock Out)',
    confirmClockOut: 'क्या आज की शिफ्ट समाप्त करें?',
    confirmClockOutDesc: 'क्या आप क्लॉक आउट करके आज का काम खत्म करना चाहते हैं?',
    cancel: 'रद्द करें',
    continue: 'आगे बढ़ें',
    locationCheck: 'स्थान सत्यापन',
    youAreAtSite: 'आप कार्यस्थल पर हैं',
    youAreTooFar: 'आप कार्यस्थल से दूर हैं',
    metersAway: 'मीटर दूर',
    insideZone: 'कार्य क्षेत्र के अंदर',
    takePhoto: 'सेल्फी फोटो लें',
    retakePhoto: 'दोबारा लें',
    confirmPhoto: 'पुष्टि करें और भेजें',
    clockInSuccess: 'हाजिरी दर्ज हो गई!',
    clockOutSuccess: 'शिफ्ट सफलतापूर्वक समाप्त!',
    backToHome: 'होम पेज पर जाएं',
    history: 'इतिहास',
    today: 'आज',
    weeklyTotal: 'इस सप्ताह का कुल समय',
    hoursWorked: 'कुल काम का समय',
    viewPhotos: 'वेरिफिकेशन फोटो देखें',
    gpsSearching: 'GPS सिग्नल खोजा जा रहा है...',
    gpsReady: 'GPS सत्यापित (±{acc}m)',
    noGpsError: 'GPS लोकेशन नहीं मिली। कृपया लोकेशन चालू करें।',
    cameraDeniedError: 'कैमरा अनुमति नहीं मिली। कृपया अनुमति दें।',
    offlineBanner: 'ऑफ़लाइन मोड: हाजिरी फोन में सुरक्षित है। इंटरनेट आते ही अपलोड होगी।',
    syncNow: 'अभी सिंक करें',
    sunlightMode: 'धूप मोड (Sunlight Mode)',
    standardMode: 'सामान्य मोड',
    switchRole: 'रोल बदलें',
    loginTitle: 'वर्कर लॉगिन',
    enterPhone: 'मोबाइल नंबर',
    enterPin: '4-अंकों का पिन (PIN)',
    signIn: 'साइन इन करें',
    quickTestLogin: 'डेमो वर्कर लॉगिन',
    hoursShort: 'घंटे',
    minsShort: 'मिनट',
  },
};
