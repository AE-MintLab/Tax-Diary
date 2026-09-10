import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Calculator, UserCheck, Building2, Upload, Plus, Edit2,
  CheckCircle2, Sparkles, Download, Heart, ChevronDown, ChevronUp, X,
  Trash2, Receipt, Tag, Check, AlertTriangle, Search, Settings, Archive,
  ExternalLink, ArrowRight, Calendar, Camera, Zap, Smartphone, Laptop,
  Copy, RefreshCw, Link2, ShieldAlert, Crown, Lock, FileText, Clock,
  Mail, LogIn, PieChart, ClipboardCopy, Info, Sliders, ShieldCheck,
  DollarSign, Home, Briefcase, LogOut, Eye, EyeOff
} from "lucide-react";
import { auth, db } from "./firebase";
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
} from "firebase/auth";
import { doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// Turns Firestore's error codes into messages a non-technical user can act on.
function firestoreErrorMessage(err) {
  const code = err?.code || "";
  if (code.includes("permission-denied")) return "Permission denied — the Firestore security rules haven't been published yet (or don't match this account).";
  if (code.includes("unavailable")) return "Can't reach Firestore right now — check your connection and try again.";
  if (code.includes("unauthenticated")) return "Not signed in — please sign in again.";
  if (code.includes("not-found")) return "Firestore database not found — check it's been created in Firebase Console.";
  if (code.includes("resource-exhausted")) return "Firestore quota reached for today — try again later.";
  return err?.message || "Unknown Firestore error";
}
// Turns Firebase Auth's error codes into messages a non-technical user can act on.
function authErrorMessage(err) {
  const code = err?.code || "";
  if (code.includes("email-already-in-use")) return "An account with this email already exists — try signing in instead.";
  if (code.includes("invalid-email")) return "That doesn't look like a valid email address.";
  if (code.includes("user-not-found") || code.includes("invalid-credential") || code.includes("wrong-password")) return "Incorrect email or password.";
  if (code.includes("weak-password")) return "Password should be at least 6 characters.";
  if (code.includes("too-many-requests")) return "Too many attempts — please wait a moment and try again.";
  if (code.includes("network-request-failed")) return "Network error — check your connection and try again.";
  return "Something went wrong — please try again.";
}

// ── Storage Utility (window.storage with localStorage fallback) ───────────────
const store = {
  async get(k, shared = false) {
    try {
      if (window.storage?.get) return await window.storage.get(k, shared);
      const v = localStorage.getItem(k);
      return v ? { value: v } : null;
    } catch { return null; }
  },
  async set(k, v, shared = false) {
    try {
      if (window.storage?.set) return await window.storage.set(k, v, shared);
      localStorage.setItem(k, v);
    } catch {}
  },
};

const userKey = (uid, key) => uid ? `mc26-user-${uid}-${key}` : key;

// ── Constants & Updated LHDN YA 2026 Tax Data ─────────────────────────────────
const POOL_LIMITS = { med_pool: 10000, edu_fees_pool: 7000 }; 

const CATS = [
  { id: "epf",       g: "Financial", name: "EPF / i-Saraan",                nameBM: "KWSP / i-Saraan",                     limit: 4000,  note: "Mandatory + voluntary EPF contributions",                  isAuto: true, beLine: "D8",  emoji: "🛡️" },
  { id: "life_ins",  g: "Financial", name: "Life Insurance / Takaful",       nameBM: "Insurans Hayat / Takaful",            limit: 3000,  note: "Self, spouse or child policies & takaful plans",          beLine: "D9",  emoji: "💖" },
  { id: "med_ins",   g: "Financial", name: "Medical & Education Insurance",   nameBM: "Insurans Perubatan dan Pendidikan",  limit: 4000,  note: "Insurance/takaful with medical or education benefits",     beLine: "D10", emoji: "🩺" },
  { id: "socso",     g: "Financial", name: "SOCSO & EIS",                    nameBM: "SOCSO & EIS",                         limit: 350,   note: "Employee SOCSO / EIS contributions", fontClass: "isAuto", beLine: "D11", emoji: "📋" },
  { id: "prs",       g: "Financial", name: "PRS / Deferred Annuity",         nameBM: "PRS / Anuiti Ditangguhkan",           limit: 3000,  note: "SC-approved Private Retirement Scheme",                   beLine: "D12", emoji: "🌱" },
  { id: "med_self",  g: "Medical",   name: "Serious Illness & Fertility Treatment", nameBM: "Rawatan Penyakit Sukar & Kesuburan", limit: 10000, note: "Self, spouse or child. Shares the RM10,000 combined medical pool below.", pool: "med_pool", beLine: "D4",  emoji: "💊" },
  { id: "med_vaccination", g: "Medical", name: "Vaccination",                nameBM: "Vaksinasi",                           limit: 1000,  note: "Sub-limit within the RM10,000 combined medical pool",     pool: "med_pool", beLine: "D4a", emoji: "💉" },
  { id: "med_dental", g: "Medical",  name: "Registered Dental Treatment",     nameBM: "Rawatan Pergigian Berdaftar",         limit: 1000,  note: "Sub-limit within the RM10,000 combined medical pool",     pool: "med_pool", beLine: "D4c", emoji: "🦷" },
  { id: "med_checkup", g: "Medical", name: "Check-up, Disease Screening & Mental Health", nameBM: "Pemeriksaan Perubatan, Saringan Penyakit & Kesihatan Mental", limit: 1000, note: "Complete medical exam, disease-detection fees/self-testing devices, or mental health exam/consultation — these three SHARE one RM1,000 sub-limit within the RM10,000 combined medical pool (not RM1,000 each).", pool: "med_pool", beLine: "D4d", emoji: "🩻" },
  { id: "med_par",   g: "Medical",   name: "Medical – Parents & Grandparents",nameBM: "Perbelanjaan Perubatan Ibu Bapa",    limit: 8000,  note: "Treatment, carer, nursing home & grandparent medical",    beLine: "D3",  emoji: "👵" },
  { id: "dis_child", g: "Medical",   name: "Child Disability Care & Rehab",   nameBM: "Rawatan & Pemulihan Kanak-Kanak OKU",limit: 10000, note: "Early intervention, screening & therapy for disabled children (≤18 yrs). Raised to RM10,000 for YA2026 — effectively able to use the full combined medical pool.", pool: "med_pool", beLine: "D4b", emoji: "🧸" },
  { id: "dis_equip", g: "Medical",   name: "Disabled Supporting Equipment",   nameBM: "Peralatan Sokongan OKU",              limit: 6000,  note: "Wheelchairs, hearing aids, prostheses for OKU",           beLine: "D5",  emoji: "♿" },
  { id: "childcare", g: "Education", name: "Childcare, Kindergarten & Transit",nameBM: "Taska, Tadika & Jagaan Transit",    limit: 3000, note: "Registered childcare, kindergarten & transit care — age ceiling raised to 12 for YA2026 (was ≤6)",beLine: "D13", emoji: "🍼" },
  { id: "sspn",      g: "Education", name: "SSPN Net Savings",                nameBM: "Tabungan Bersih SSPN",                limit: 8000,  note: "Child higher education savings account (PTPTN)",          beLine: "D14", emoji: "🎒" },
  { id: "edu_fees",  g: "Education", name: "Education Fees – Formal (Diploma/Degree/Masters/PhD)", nameBM: "Yuran Pengajian Formal", limit: 7000, note: "Formal qualifications up to tertiary level, or Masters/PhD. Shares the RM7,000 combined education-fee pool below.", pool: "edu_fees_pool", beLine: "D2", emoji: "🎓" },
  { id: "edu_skills", g: "Education", name: "Education Fees – Upskilling Courses", nameBM: "Yuran Kursus Peningkatan Kemahiran", limit: 2000, note: "DSD-recognised upskilling/self-enhancement courses — sub-limit within the RM7,000 combined education-fee pool (not on top of it).", pool: "edu_fees_pool", beLine: "D2a", emoji: "📘" },
  { id: "lifestyle", g: "Lifestyle", name: "Lifestyle",                       nameBM: "Gaya Hidup",                          limit: 2500,  note: "Books, smartphones, laptops, broadband, gym",             beLine: "D6",  emoji: "📱" },
  { id: "sports",    g: "Lifestyle", name: "Sports Equipment & Facilities",   nameBM: "Peralatan & Kemudahan Sukan",         limit: 1000,  note: "Sports gear, gym fees, facility rentals & competition",   beLine: "D7",  emoji: "🎾" },
  { id: "tourism",   g: "Lifestyle", name: "Domestic Tourism (Visit MY 2026)",nameBM: "Pelancongan Domestik",                limit: 1000,  note: "Hotel stays, theme parks, zoos & local tour packages",    beLine: "D15", emoji: "🏝️" },
  { id: "ev_green",  g: "Lifestyle", name: "EV / Composting / Grinders / CCTV", nameBM: "Pengecasan EV / Kompos / Pengisar / CCTV",limit: 2500,  note: "EV chargers, food waste composters & grinders, and home CCTV (CCTV/grinders limited to one purchase each, YA2026–YA2027)",  beLine: "D16", emoji: "🔌" },
  { id: "home_loan", g: "Property",  name: "Home Loan Interest – 1st Home",   nameBM: "Faedah Pinjaman Perumahan Pertama",   limit: 7000,  dynamicLimit: "homeLoanTier", note: "1st residential home. Cap depends on property price — set the price tier in Settings > Income. Only claimable for your first 3 consecutive YAs of ownership.", beLine: "D17", emoji: "🏡" },
  { id: "donation",  g: "Other",     name: "Approved Donations & Gifts",      nameBM: "Derma & Hadiah Diluluskan",           limit: 100000, dynamicLimit: "income10pct", note: "To approved institutions/organisations — capped at 10% of aggregate income", beLine: "D18", emoji: "🤲" },
  { id: "breastfeed", g: "Other",    name: "Breastfeeding Equipment",         nameBM: "Peralatan Menyusu Badan",             limit: 1000,  note: "For your own child aged 2 and below. Claimable once every 2 years.", beLine: "D19", emoji: "🤱" },
];

const GROUPS    = ["Financial", "Medical", "Education", "Lifestyle", "Property", "Other"];
const AUDIT_YRS = [2026, 2025, 2024, 2023, 2022, 2021, 2020];
const BRACKETS  = [
  { max: 5000,     rate: 0.00, base: 0      },
  { max: 20000,    rate: 0.01, base: 0      },
  { max: 35000,    rate: 0.03, base: 150    },
  { max: 50000,    rate: 0.06, base: 600    },
  { max: 70000,    rate: 0.11, base: 1500   },
  { max: 100000,   rate: 0.19, base: 3700   },
  { max: 400000,   rate: 0.25, base: 9400   },
  { max: 600000,   rate: 0.26, base: 84400  },
  { max: 1000000,  rate: 0.28, base: 136400 },
  { max: 2000000,  rate: 0.28, base: 248400 },
  { max: Infinity, rate: 0.30, base: 528400 },
];

const SLIDES = [
  { badge: "🗂️ SMART TAX VAULT",   headline: "STRESS-FREE\ne-FILING YA 2026", body: "Store LHDN receipts securely with full Budget 2026 updates (CCTV, Transit & Tourism). Be audit-ready for 7 years.", bg: "from-emerald-950 via-emerald-900 to-slate-950" },
  { badge: "💡 SMART SUGGESTIONS", headline: "MAXIMIZE YOUR\nREFUNDS", body: "Tax Diary flags unclaimed YA 2026 opportunities and calculates exact ringgit tax savings in real-time.", bg: "from-emerald-950 via-teal-900 to-slate-950" },
  { badge: "👑 TRY VAULT FREE",    headline: "7 DAYS FREE\nTHEN RM19/YR", body: "Unlock AI receipt scanning, the Audit-Ready Checklist, Form BE sheet & multi-device cloud sync.", bg: "from-slate-950 via-emerald-950 to-teal-950" },
];

const DAY = 86400000;
const YEAR = 365 * DAY;
const PRICE = 29;
const DONATION_URL = "https://toyyibpay.com/YOUR_OPEN_AMOUNT_BILL_CODE";

const calcTax  = (inc) => { if (!inc || inc <= 0) return 0; let p = 0; for (const b of BRACKETS) { if (inc <= b.max) return b.base + (inc - p) * b.rate; p = b.max; } return 0; };
const taxWithRebate = (chg, spouseRebateEligible = false) => {
  const tax = calcTax(chg);
  if (chg <= 0 || chg > 35000) return Math.max(tax, 0);
  let rebate = Math.min(400, tax);
  if (spouseRebateEligible) rebate += Math.min(400, Math.max(tax - rebate, 0));
  return Math.max(tax - rebate, 0);
};
const marginalRate = (inc) => { for (const b of BRACKETS) { if (inc <= b.max) return b.rate; } return 0.30; };
const fmt      = (n, d = 2) => "RM " + Number(n).toLocaleString("en-MY", { minimumFractionDigits: d, maximumFractionDigits: d });
const blank    = (yr = 2026) => ({ category: "", amount: "", merchant: "", date: new Date().toISOString().slice(0, 10), image: null, taxYear: yr, owner: "joint" });

// ── Main App Component ────────────────────────────────────────────────────────
export default function App() {
  const [view,         setView]         = useState("loading");
  const [slideIdx,     setSlideIdx]     = useState(0);
  const [taxYear,      setTaxYear]      = useState(2026);
  const [receipts,     setReceipts]     = useState([]);
  const [income,       setIncome]       = useState("");
  const [otherIncomeAmt, setOtherIncomeAmt] = useState("0");
  const [epfAmt,       setEpfAmt]       = useState("");
  const [pcbAmt,       setPcbAmt]       = useState("");
  const [socsoAmt,     setSocsoAmt]     = useState("");
  const [zakatAmt,     setZakatAmt]     = useState("0");
  const [isSelfOKU,    setIsSelfOKU]    = useState(false);
  const [maritalStatus, setMaritalStatus] = useState("single");
  const hasSpouse = maritalStatus === "married";
  const [spouseInc,    setSpouseInc]    = useState("");
  const [spouseEpfAmt, setSpouseEpfAmt] = useState("");
  const [spouseEpfTouched, setSpouseEpfTouched] = useState(false);
  const [spouseSocsoAmt, setSpouseSocsoAmt] = useState("");
  const [spousePcbAmt, setSpousePcbAmt] = useState("");
  const [spouseName,   setSpouseName]   = useState("Spouse");
  const [spouseDisabled, setSpouseDisabled] = useState(false);
  const [childrenClaimedBy, setChildrenClaimedBy] = useState("mine");
  const [childU18,     setChildU18]     = useState(0);
  const [childHiEduDegree, setChildHiEduDegree] = useState(0);
  const [childHiEduOther, setChildHiEduOther] = useState(0);
  const [childDisabled, setChildDisabled] = useState(0);
  const [childDisabledHiEdu, setChildDisabledHiEdu] = useState(0);
  const [homeLoanTier, setHomeLoanTier] = useState("under500k");
  const [clientName,   setClientName]   = useState("");
  const [toast,        setToast]        = useState("");
  const [expanded,     setExpanded]     = useState({ Financial: false, Medical: false, Education: false, Lifestyle: false, Property: false });
  const [rcptSearch,   setRcptSearch]   = useState("");
  const [rcptCatF,     setRcptCatF]     = useState("all");
  const [showSettings, setShowSettings] = useState(false);
  const [settingsReturnTo, setSettingsReturnTo] = useState(null);
  const [settingsTab,  setSettingsTab]  = useState("user");
  const [showReceipt,  setShowReceipt]  = useState(false);
  const [showCatPick,  setShowCatPick]  = useState(false);
  const [showScan,     setShowScan]     = useState(false);
  const [scanReturnTo, setScanReturnTo] = useState(null);
  const [ocrLoading,   setOcrLoading]   = useState(false);
  const [showFormBE,   setShowFormBE]   = useState(false);
  const [showScenario, setShowScenario] = useState(false);
  const [showAuditCheck, setShowAuditCheck] = useState(false);
  const [showTools,    setShowTools]    = useState(false);
  const [showVault,    setShowVault]    = useState(false);
  const [vaultReturnTo, setVaultReturnTo] = useState(null);
  const [receiptReturnTo, setReceiptReturnTo] = useState(null);
  const [showFilterPick, setShowFilterPick] = useState(false);
  const [showSpouseDetail, setShowSpouseDetail] = useState(false);
  const [showDonate, setShowDonate] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const [form,         setForm]         = useState(blank());
  const [editId,       setEditId]       = useState(null);
  const touchX = useRef(null);

  // ── Scenario Modeling state (Side Hustle / Sole Prop & Rental) ──────────────
  const [sideHustleInc, setSideHustleInc] = useState("");
  const [sideHustleExp, setSideHustleExp] = useState("");
  const [rentalInc,     setRentalInc]     = useState("");
  const [rentalExp,     setRentalExp]     = useState("");

  // ── Billing / Trial State ───────────────────────────────────────────────────
  const [now, setNow] = useState(Date.now());
  const [showPaywall, setShowPaywall] = useState(false);
  const [paywallCtx,  setPaywallCtx]  = useState({ title: "AI Receipt Scanner", desc: "Snap a receipt and let AI fill in the details for you." });
  const [paywallReturnTo, setPaywallReturnTo] = useState(null);

  // ── Account & Cloud Sync ─────────────────────────────────────────────────────
  const [vaultEmail,     setVaultEmail]     = useState("");
  const [signedIn,       setSignedIn]       = useState(false);
  const [authLoading,    setAuthLoading]    = useState(true);
  const [authMode,       setAuthMode]       = useState("signin");
  const [authPassword,   setAuthPassword]   = useState("");
  const [authError,      setAuthError]      = useState("");
  const [authBusy,       setAuthBusy]       = useState(false);
  const [showAuthPassword, setShowAuthPassword] = useState(false);
  const [cloudSyncStatus, setCloudSyncStatus] = useState("idle");
  const [cloudSyncError,  setCloudSyncError]  = useState("");
  const [lastSyncedAt,   setLastSyncedAt]   = useState("");
  const [localCacheReadyUid, setLocalCacheReadyUid] = useState("");
  const cloudPullStarted  = useRef(null);
  const cloudPullComplete = useRef(null);
  const localCacheLoadedUid = useRef(null);
  const hadRealCloudDataRef = useRef(false);

  const looksSuspiciouslyBlank = (snap) =>
    snap.receipts.length === 0 && !snap.income && !snap.spouseInc &&
    snap.maritalStatus === "single" && !snap.clientName && snap.childU18 === 0;

  const localUpdatedAtRef = useRef(0);
  const skipNextLocalStampRef = useRef(false);
  const signOutInProgressRef = useRef(false);
  const hydrated = useRef(false);

  useEffect(() => { init(); }, []);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(t); }, []);

  // ── PWA Install Banner ──────────────────────────────────────────────────────
  const [installPromptEvent, setInstallPromptEvent] = useState(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator.standalone === true;
    setIsStandalone(!!standalone);
    const ios = /iphone|ipad|ipod/i.test(window.navigator.userAgent) && !window.MSStream;
    setIsIOS(ios);

    const dismissedAt = localStorage.getItem("mc26-install-dismissed");
    const recentlyDismissed = dismissedAt && (Date.now() - parseInt(dismissedAt, 10) < 14 * DAY);

    const onBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setInstallPromptEvent(e);
      if (!standalone && !recentlyDismissed) setShowInstallBanner(true);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);

    if (ios && !standalone && !recentlyDismissed) setShowInstallBanner(true);

    const onInstalled = () => { setShowInstallBanner(false); setInstallPromptEvent(null); };
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (installPromptEvent) {
      installPromptEvent.prompt();
      const { outcome } = await installPromptEvent.userChoice;
      if (outcome === "accepted") showToast("Installing Tax Diary…");
      setInstallPromptEvent(null);
      setShowInstallBanner(false);
    }
  };
  const dismissInstallBanner = () => {
    setShowInstallBanner(false);
    try { localStorage.setItem("mc26-install-dismissed", String(Date.now())); } catch {}
  };

  useEffect(() => {
    const anyModalOpen = showSettings || showTools || showReceipt || showCatPick || showFilterPick || showScan || showFormBE || showScenario || showAuditCheck || showVault || showSpouseDetail || showPaywall || showDonate || !!previewImage;
    document.body.style.overflow = anyModalOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [showSettings, showTools, showReceipt, showCatPick, showFilterPick, showScan, showFormBE, showScenario, showAuditCheck, showVault, showSpouseDetail, showPaywall, showDonate, previewImage]);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 3500); };

  const init = async () => {
    try {
      const ob = await store.get("mc26-onboard");
      const r  = await store.get("mc26-receipts");
      if (r?.value) setReceipts(JSON.parse(r.value));
      else setReceipts([]);

      const i = await store.get("mc26-income");
      if (i?.value) {
        const p = JSON.parse(i.value);
        setIncome(p.income || ""); setOtherIncomeAmt(p.otherIncomeAmt || "0"); setEpfAmt(p.epf || ""); setSocsoAmt(p.socsoAmt || "350"); setZakatAmt(p.zakatAmt || "0"); setIsSelfOKU(p.isSelfOKU || false);
        setMaritalStatus(p.maritalStatus || (p.hasSpouse ? "married" : "single")); setSpouseInc(p.spouseInc || ""); setSpouseDisabled(p.spouseDisabled || false); setSpouseName(p.spouseName || "Spouse"); setPcbAmt(p.pcbAmt || ""); setSpouseEpfAmt(p.spouseEpfAmt || ""); setSpouseSocsoAmt(p.spouseSocsoAmt || "350"); setSpousePcbAmt(p.spousePcbAmt || ""); setChildrenClaimedBy(p.childrenClaimedBy || "mine"); if (p.spouseEpfAmt) setSpouseEpfTouched(true);
        setChildU18(p.childU18 || 0); setChildHiEduDegree(p.childHiEduDegree ?? p.childHiEdu ?? 0); setChildHiEduOther(p.childHiEduOther || 0); setChildDisabled(p.childDisabled || 0); setChildDisabledHiEdu(p.childDisabledHiEdu || 0); setHomeLoanTier(p.homeLoanTier || "under500k");
      }

      const s = await store.get("mc26-settings");
      if (s?.value) { const p = JSON.parse(s.value); setClientName(p.clientName || ""); }

      const lu = await store.get("mc26-lastlocalupdate");
      localUpdatedAtRef.current = lu?.value ? parseInt(lu.value, 10) : 0;

      setView(ob?.value ? "home" : "onboard");
      hydrated.current = true;
    } catch { setView("home"); hydrated.current = true; }
  };

  const doneOnboard = async () => { try { await store.set("mc26-onboard", "1"); } catch {} setView("home"); };

  const persist = async (list) => {
    const next = Array.isArray(list) ? list : [];
    setReceipts(next);
    const uid = auth.currentUser?.uid;
    const key = userKey(uid, "receipts");
    const t = Date.now();
    localUpdatedAtRef.current = t;
    try {
      await store.set(key, JSON.stringify(next));
      await store.set(userKey(uid, "lastlocalupdate"), String(t));
      if (!uid) await store.set("mc26-receipts", JSON.stringify(next));
    } catch { showToast("Saved this session"); }
  };
  const persistIncome = async () => {
    const payload = { income, otherIncomeAmt, epf: epfAmt, socsoAmt, pcbAmt, zakatAmt, isSelfOKU, maritalStatus, spouseInc, spouseEpfAmt, spouseSocsoAmt, spousePcbAmt, spouseDisabled, spouseName, childU18, childHiEduDegree, childHiEduOther, childDisabled, childDisabledHiEdu, homeLoanTier, childrenClaimedBy };
    const uid = auth.currentUser?.uid;
    const t = Date.now();
    localUpdatedAtRef.current = t;
    try {
      await store.set(userKey(uid, "income"), JSON.stringify(payload));
      await store.set(userKey(uid, "lastlocalupdate"), String(t));
      if (!uid) await store.set("mc26-income", JSON.stringify(payload));
    } catch {}
  };
  const persistSettings = async () => {
    const payload = { clientName };
    const uid = auth.currentUser?.uid;
    const t = Date.now();
    localUpdatedAtRef.current = t;
    try {
      await store.set(userKey(uid, "settings"), JSON.stringify(payload));
      await store.set(userKey(uid, "lastlocalupdate"), String(t));
      if (!uid) await store.set("mc26-settings", JSON.stringify(payload));
    } catch {}
  };

  // ── Tier / Trial Derived State ──────────────────────────────────────────────
  const [cloudBilling, setCloudBilling] = useState(null);
  const [billingListenerError, setBillingListenerError] = useState("");
  useEffect(() => {
    if (!signedIn) { setCloudBilling(null); setBillingListenerError(""); return; }
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const ref = doc(db, "users", uid, "private", "billing");
    const unsub = onSnapshot(
      ref,
      (snap) => { setCloudBilling(snap.exists() ? snap.data() : null); setBillingListenerError(""); },
      (err) => {
        console.error("Billing listener error:", err);
        setBillingListenerError(firestoreErrorMessage(err));
        showToast(`Plus status error: ${firestoreErrorMessage(err)}`);
      }
    );
    return () => unsub();
  }, [signedIn]);

  const trialEnd   = cloudBilling?.trialStart ? cloudBilling.trialStart + 7 * DAY : null;
  const isTrialing = !!(trialEnd && now < trialEnd);
  const trialDaysLeft = isTrialing ? Math.max(1, Math.ceil((trialEnd - now) / DAY)) : 0;
  const trialUsed = !!cloudBilling?.trialUsed;
  const isSubscribed  = !!(cloudBilling?.subEnd && now < cloudBilling.subEnd);
  const isPro = isTrialing || isSubscribed;
  const daysToRenewal = isSubscribed ? Math.ceil((cloudBilling.subEnd - now) / DAY) : null;
  const showRenewalBanner = isSubscribed && daysToRenewal <= 30;
  const trialJustExpired = !!(trialEnd && now >= trialEnd && !isSubscribed);
  const subJustExpired = !!(cloudBilling?.subEnd && now >= cloudBilling.subEnd);

  const openPaywall = (title, desc, returnTo = null) => {
    setPaywallCtx({ title, desc });
    setPaywallReturnTo(() => returnTo);
    setShowPaywall(true);
  };
  const closePaywall = () => {
    setShowPaywall(false);
    const fn = paywallReturnTo;
    setPaywallReturnTo(null);
    if (fn) fn();
  };
  const openScan = (returnTo = null) => { setScanReturnTo(() => returnTo); setShowScan(true); };
  const closeScan = () => {
    setShowScan(false);
    const fn = scanReturnTo;
    setScanReturnTo(null);
    if (fn) fn();
  };

  const startTrial = async () => {
    if (!signedIn) {
      closePaywall();
      openSettings("sync");
      showToast("Please sign in first, then tap Start Trial again.");
      return;
    }
    setPaymentLoading(true);
    try {
      const idToken = await auth.currentUser.getIdToken();
      const r = await fetch("/api/start-trial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || "Could not start trial");
      showToast("Plus trial started — 7 days free ✓");
      closePaywall();
    } catch (err) {
      showToast(err.message);
    } finally { setPaymentLoading(false); }
  };

  const [paymentLoading, setPaymentLoading] = useState(false);
  const subscribe = async () => {
    if (!signedIn) {
      closePaywall();
      openSettings("sync");
      showToast("Please sign in first, then tap Subscribe again.");
      return;
    }
    setPaymentLoading(true);
    try {
      const idToken = await auth.currentUser.getIdToken();
      const r = await fetch("/api/create-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      const data = await r.json();
      if (!r.ok || !data.paymentUrl) throw new Error(data?.error || "Could not start payment");
      window.location.href = data.paymentUrl;
    } catch (err) {
      console.error("Payment creation failed:", err);
      showToast(`Payment error: ${err.message}`);
      setPaymentLoading(false);
    }
  };

  const [redeemInput, setRedeemInput] = useState("");
  const [redeemBusy, setRedeemBusy] = useState(false);
  const redeemCode = async () => {
    if (!signedIn) {
      closePaywall();
      openSettings("sync");
      showToast("Please sign in first, then try your code again.");
      return;
    }
    if (!redeemInput.trim()) return showToast("Enter a code first.");
    setRedeemBusy(true);
    try {
      const idToken = await auth.currentUser.getIdToken();
      const r = await fetch("/api/redeem-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken, code: redeemInput.trim() }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || "That code didn't work");
      showToast("Plus unlocked ✓");
      setRedeemInput("");
      closePaywall();
    } catch (err) {
      showToast(err.message);
    } finally { setRedeemBusy(false); }
  };

  const requireProOrPaywall = (title, desc, returnTo = null) => {
    if (isPro) return true;
    openPaywall(title, desc, returnTo);
    return false;
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has("payment")) {
      const statusId = params.get("status_id");
      if (statusId === "1") showToast("Payment received — activating Plus…");
      else if (statusId === "3") showToast("Payment failed or was cancelled.");
      else if (statusId === "2") showToast("Payment pending — this may take a moment.");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const sanitizeReceiptForCloud = (r) => ({
    id: typeof r.id === "number" ? r.id : Date.now(),
    taxYear: typeof r.taxYear === "number" ? r.taxYear : 2026,
    category: typeof r.category === "string" ? r.category : "lifestyle",
    amount: typeof r.amount === "number" && isFinite(r.amount) ? r.amount : 0,
    merchant: typeof r.merchant === "string" ? r.merchant : "",
    date: typeof r.date === "string" ? r.date : new Date().toISOString().slice(0, 10),
    image: typeof r.image === "string" ? r.image : null,
    owner: ["mine", "spouse", "joint"].includes(r.owner) ? r.owner : "joint",
  });

  const sanitizeScalar = (v, fallback) => {
    if (Array.isArray(v) || (v !== null && typeof v === "object")) return fallback;
    return v === undefined || v === null ? fallback : v;
  };
  const sanitizeBool = (v, fallback) => typeof v === "boolean" ? v : fallback;
  const sanitizeNum = (v, fallback) => typeof v === "number" && isFinite(v) ? v : fallback;

  const buildCloudSnapshot = () => ({
    receipts: receipts.map(sanitizeReceiptForCloud),
    income: sanitizeScalar(income, ""),
    otherIncomeAmt: sanitizeScalar(otherIncomeAmt, "0"),
    epfAmt: sanitizeScalar(epfAmt, ""),
    socsoAmt: sanitizeScalar(socsoAmt, "350"),
    pcbAmt: sanitizeScalar(pcbAmt, ""),
    zakatAmt: sanitizeScalar(zakatAmt, "0"),
    isSelfOKU: sanitizeBool(isSelfOKU, false),
    maritalStatus: sanitizeScalar(maritalStatus, "single"),
    spouseInc: sanitizeScalar(spouseInc, ""),
    spouseEpfAmt: sanitizeScalar(spouseEpfAmt, ""),
    spouseSocsoAmt: sanitizeScalar(spouseSocsoAmt, "350"),
    spousePcbAmt: sanitizeScalar(spousePcbAmt, ""),
    spouseDisabled: sanitizeBool(spouseDisabled, false),
    spouseName: sanitizeScalar(spouseName, "Spouse"),
    childU18: sanitizeNum(childU18, 0),
    childHiEduDegree: sanitizeNum(childHiEduDegree, 0),
    childHiEduOther: sanitizeNum(childHiEduOther, 0),
    childDisabled: sanitizeNum(childDisabled, 0),
    childDisabledHiEdu: sanitizeNum(childDisabledHiEdu, 0),
    homeLoanTier: sanitizeScalar(homeLoanTier, "under500k"),
    childrenClaimedBy: sanitizeScalar(childrenClaimedBy, "mine"),
    clientName: sanitizeScalar(clientName, ""),
    updatedAt: new Date().toISOString(),
  });

  useEffect(() => {
    if (!signedIn || authLoading) return;
    const uid = auth.currentUser?.uid;
    if (!uid || localCacheLoadedUid.current !== uid || localCacheReadyUid !== uid) return;
    if (!uid || cloudPullStarted.current === uid) return;
    cloudPullStarted.current = uid;

    (async () => {
      setCloudSyncStatus("loading");
      try {
        const ref = doc(db, "users", uid);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const d = snap.data();
          const cloudUpdatedAt = d.updatedAt ? new Date(d.updatedAt).getTime() : 0;
          if (localUpdatedAtRef.current > cloudUpdatedAt) {
            const snapshot = buildCloudSnapshot();
            const cloudHadRealData = (d.receipts || []).length > 0 || d.income || d.spouseInc || d.maritalStatus === "married" || d.clientName;
            if (cloudHadRealData && looksSuspiciouslyBlank(snapshot)) {
              console.error("[cloudSync] BLOCKED a reconciliation push that would have overwritten real cloud data with a blank snapshot.", { cloudSnapshot: d, localSnapshotAttempted: snapshot });
              showToast("⚠️ Sync conflict detected — your cloud data was kept safe. Please contact support.");
              skipNextLocalStampRef.current = true;
              setReceipts(d.receipts || []); setIncome(d.income ?? ""); setOtherIncomeAmt(d.otherIncomeAmt ?? "0"); setEpfAmt(d.epfAmt ?? ""); setSocsoAmt(d.socsoAmt ?? "350"); setPcbAmt(d.pcbAmt ?? ""); setZakatAmt(d.zakatAmt ?? "0"); setIsSelfOKU(d.isSelfOKU || false);
              setMaritalStatus(d.maritalStatus || "single"); setSpouseInc(d.spouseInc ?? ""); setSpouseEpfAmt(d.spouseEpfAmt ?? ""); setSpouseSocsoAmt(d.spouseSocsoAmt ?? "350"); setSpousePcbAmt(d.spousePcbAmt ?? ""); setSpouseDisabled(!!d.spouseDisabled); setSpouseName(d.spouseName || "Spouse"); setChildrenClaimedBy(d.childrenClaimedBy || "mine");
              setChildU18(d.childU18 ?? 0); setChildHiEduDegree(d.childHiEduDegree ?? 0); setChildHiEduOther(d.childHiEduOther ?? 0); setChildDisabled(d.childDisabled ?? 0); setChildDisabledHiEdu(d.childDisabledHiEdu ?? 0); setHomeLoanTier(d.homeLoanTier || "under500k");
              setClientName(d.clientName || "");
              localUpdatedAtRef.current = cloudUpdatedAt;
            } else {
              await setDoc(ref, snapshot, { merge: true });
              showToast("Local changes synced to cloud ✓");
            }
          } else {
            skipNextLocalStampRef.current = true;
            setReceipts(d.receipts || []); setIncome(d.income ?? ""); setOtherIncomeAmt(d.otherIncomeAmt ?? "0"); setEpfAmt(d.epfAmt ?? ""); setSocsoAmt(d.socsoAmt ?? "350"); setPcbAmt(d.pcbAmt ?? ""); setZakatAmt(d.zakatAmt ?? "0"); setIsSelfOKU(d.isSelfOKU || false);
            setMaritalStatus(d.maritalStatus || "single"); setSpouseInc(d.spouseInc ?? ""); setSpouseEpfAmt(d.spouseEpfAmt ?? ""); setSpouseSocsoAmt(d.spouseSocsoAmt ?? "350"); setSpousePcbAmt(d.spousePcbAmt ?? ""); setSpouseDisabled(!!d.spouseDisabled); setSpouseName(d.spouseName || "Spouse"); setChildrenClaimedBy(d.childrenClaimedBy || "mine");
            if (d.spouseEpfAmt) setSpouseEpfTouched(true);
            setChildU18(d.childU18 ?? 0); setChildHiEduDegree(d.childHiEduDegree ?? 0); setChildHiEduOther(d.childHiEduOther ?? 0); setChildDisabled(d.childDisabled ?? 0); setChildDisabledHiEdu(d.childDisabledHiEdu ?? 0); setHomeLoanTier(d.homeLoanTier || "under500k");
            setClientName(d.clientName || "");
            if ((d.receipts || []).length > 0 || d.income || d.spouseInc || d.maritalStatus === "married" || d.clientName) {
              hadRealCloudDataRef.current = true;
            }
            localUpdatedAtRef.current = cloudUpdatedAt;
            try {
              await store.set(userKey(uid, "receipts"), JSON.stringify(d.receipts || []));
              await store.set(userKey(uid, "income"), JSON.stringify({ income: d.income, otherIncomeAmt: d.otherIncomeAmt, epf: d.epfAmt, socsoAmt: d.socsoAmt, pcbAmt: d.pcbAmt, zakatAmt: d.zakatAmt, isSelfOKU: d.isSelfOKU, maritalStatus: d.maritalStatus, spouseInc: d.spouseInc, spouseEpfAmt: d.spouseEpfAmt, spouseSocsoAmt: d.spouseSocsoAmt, spousePcbAmt: d.spousePcbAmt, spouseDisabled: d.spouseDisabled, spouseName: d.spouseName, childU18: d.childU18, childHiEduDegree: d.childHiEduDegree, childHiEduOther: d.childHiEduOther, childDisabled: d.childDisabled, childDisabledHiEdu: d.childDisabledHiEdu, homeLoanTier: d.homeLoanTier, childrenClaimedBy: d.childrenClaimedBy }));
              await store.set(userKey(uid, "settings"), JSON.stringify({ clientName: d.clientName || "" }));
              await store.set(userKey(uid, "lastlocalupdate"), String(cloudUpdatedAt));
            } catch {}
            showToast("Cloud data loaded ✓");
          }
        } else {
          await setDoc(ref, buildCloudSnapshot());
          showToast("Cloud backup created ✓");
        }
        setCloudSyncStatus("synced");
        setCloudSyncError("");
        setLastSyncedAt(new Date().toLocaleTimeString());
        cloudPullComplete.current = uid;
      } catch (err) {
        console.error("Firestore load failed:", err);
        setCloudSyncStatus("error");
        setCloudSyncError(firestoreErrorMessage(err));
        showToast(`Cloud sync error: ${firestoreErrorMessage(err)}`);
      }
    })();
  }, [signedIn, authLoading, localCacheReadyUid]);

  useEffect(() => {
    if (!hydrated.current || !signedIn || signOutInProgressRef.current) return;
    const uid = auth.currentUser?.uid;
    if (!uid || cloudPullComplete.current !== uid) return;
    (async () => {
      try {
        const snapshot = buildCloudSnapshot();
        if (hadRealCloudDataRef.current && looksSuspiciouslyBlank(snapshot)) {
          console.error("[cloudSync] BLOCKED a push that would have overwritten confirmed real cloud data with a blank snapshot.");
          showToast("⚠️ Sync conflict detected — your cloud data was kept safe. Please contact support.");
          return;
        }
        await setDoc(doc(db, "users", uid), snapshot, { merge: true });
        setCloudSyncStatus("synced");
        setCloudSyncError("");
        setLastSyncedAt(new Date().toLocaleTimeString());
      } catch (err) {
        console.error("Firestore save failed:", err);
        setCloudSyncStatus("error");
        setCloudSyncError(firestoreErrorMessage(err));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receipts, income, otherIncomeAmt, epfAmt, socsoAmt, pcbAmt, zakatAmt, isSelfOKU, maritalStatus, spouseInc, spouseEpfAmt, spouseSocsoAmt, spousePcbAmt, spouseDisabled, spouseName, childU18, childHiEduDegree, childHiEduOther, childDisabled, childDisabledHiEdu, homeLoanTier, childrenClaimedBy, clientName, signedIn]);

  useEffect(() => {
    if (!hydrated.current) return;
    if (skipNextLocalStampRef.current) { skipNextLocalStampRef.current = false; return; }
    const t = Date.now();
    localUpdatedAtRef.current = t;
    store.set(userKey(auth.currentUser?.uid, "lastlocalupdate"), String(t)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receipts, income, otherIncomeAmt, epfAmt, socsoAmt, pcbAmt, zakatAmt, isSelfOKU, maritalStatus, spouseInc, spouseEpfAmt, spouseSocsoAmt, spousePcbAmt, spouseDisabled, spouseName, childU18, childHiEduDegree, childHiEduOther, childDisabled, childDisabledHiEdu, homeLoanTier, childrenClaimedBy, clientName]);

  useEffect(() => {
    if (!hasSpouse || spouseEpfTouched) return;
    const auto = Math.round((parseFloat(spouseInc) || 0) * 0.11);
    setSpouseEpfAmt(auto > 0 ? String(auto) : "");
  }, [spouseInc, hasSpouse, spouseEpfTouched]);

  const resetLocalStateToBlank = async () => {
    skipNextLocalStampRef.current = true;
    localUpdatedAtRef.current = 0;
    setReceipts([]); setIncome(""); setOtherIncomeAmt("0"); setEpfAmt(""); setPcbAmt(""); setSocsoAmt(""); setZakatAmt("0"); setIsSelfOKU(false);
    setMaritalStatus("single"); setSpouseInc(""); setSpouseEpfAmt(""); setSpouseEpfTouched(false); setSpouseSocsoAmt(""); setSpousePcbAmt(""); setSpouseDisabled(false); setSpouseName("Spouse"); setChildrenClaimedBy("mine");
    setChildU18(0); setChildHiEduDegree(0); setChildHiEduOther(0); setChildDisabled(0); setChildDisabledHiEdu(0); setHomeLoanTier("under500k");
    setClientName("");
    try {
      await store.set("mc26-receipts", JSON.stringify([]));
      await store.set("mc26-income", JSON.stringify({}));
      await store.set("mc26-settings", JSON.stringify({ clientName: "" }));
      await store.set("mc26-lastlocalupdate", "0");
    } catch {}
  };

  const loadUserLocalCache = async (uid) => {
    if (!uid) return false;
    const key = (name) => userKey(uid, name);
    try {
      let [r, i, st, lu] = await Promise.all([
        store.get(key("receipts")),
        store.get(key("income")),
        store.get(key("settings")),
        store.get(key("lastlocalupdate")),
      ]);

      if (!r && !i && !st) {
        const legacy = await Promise.all([
          store.get("mc26-receipts"), store.get("mc26-income"),
          store.get("mc26-settings"), store.get("mc26-lastlocalupdate")
        ]);
        [r, i, st, lu] = legacy;
        if (r?.value) await store.set(key("receipts"), r.value);
        if (i?.value) await store.set(key("income"), i.value);
        if (st?.value) await store.set(key("settings"), st.value);
        if (lu?.value) await store.set(key("lastlocalupdate"), lu.value);
      }

      if (r?.value) {
        try { setReceipts(JSON.parse(r.value) || []); } catch {}
      }
      if (i?.value) {
        try {
          const p = JSON.parse(i.value) || {};
          setIncome(p.income || ""); setOtherIncomeAmt(p.otherIncomeAmt || "0"); setEpfAmt(p.epf || "");
          setSocsoAmt(p.socsoAmt || "350"); setZakatAmt(p.zakatAmt || "0"); setIsSelfOKU(!!p.isSelfOKU);
          setMaritalStatus(p.maritalStatus || (p.hasSpouse ? "married" : "single")); setSpouseInc(p.spouseInc || "");
          setSpouseDisabled(!!p.spouseDisabled); setSpouseName(p.spouseName || "Spouse"); setPcbAmt(p.pcbAmt || "");
          setSpouseEpfAmt(p.spouseEpfAmt || ""); setSpouseSocsoAmt(p.spouseSocsoAmt || "350"); setSpousePcbAmt(p.spousePcbAmt || "");
          setChildrenClaimedBy(p.childrenClaimedBy || "mine"); if (p.spouseEpfAmt) setSpouseEpfTouched(true);
          setChildU18(p.childU18 || 0); setChildHiEduDegree(p.childHiEduDegree ?? p.childHiEdu ?? 0);
          setChildHiEduOther(p.childHiEduOther || 0); setChildDisabled(p.childDisabled || 0); setChildDisabledHiEdu(p.childDisabledHiEdu || 0);
          setHomeLoanTier(p.homeLoanTier || "under500k");
        } catch {}
      }
      if (st?.value) {
        try { const p = JSON.parse(st.value) || {}; setClientName(p.clientName || ""); } catch {}
      }
      localUpdatedAtRef.current = lu?.value ? parseInt(lu.value, 10) || 0 : 0;
      return !!(r?.value || i?.value || st?.value);
    } catch (err) {
      console.error("Local account cache load failed:", err);
      return false;
    }
  };

  useEffect(() => {
    let cancelled = false;
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (cancelled) return;
      setSignedIn(!!user);
      setVaultEmail(user?.email || "");
      setAuthLoading(false);
      cloudPullStarted.current = null;
      cloudPullComplete.current = null;
      localCacheLoadedUid.current = null;
      setLocalCacheReadyUid("");
      hadRealCloudDataRef.current = false;

      if (!user) {
        setCloudSyncStatus("idle");
        return;
      }

      await loadUserLocalCache(user.uid);
      if (cancelled) return;
      localCacheLoadedUid.current = user.uid;
      setLocalCacheReadyUid(user.uid);
      hydrated.current = true;
    });
    return () => { cancelled = true; unsub(); };
  }, []);

  const doAuthSubmit = async () => {
    setAuthError("");
    if (!vaultEmail || !vaultEmail.includes("@")) return setAuthError("Enter a valid email address.");
    if (!authPassword || authPassword.length < 6) return setAuthError("Password must be at least 6 characters.");
    setAuthBusy(true);
    try {
      if (authMode === "signup") {
        await createUserWithEmailAndPassword(auth, vaultEmail, authPassword);
        showToast("Account created ✓");
      } else {
        await signInWithEmailAndPassword(auth, vaultEmail, authPassword);
        showToast("Signed in ✓");
      }
      setAuthPassword("");
    } catch (err) {
      setAuthError(authErrorMessage(err));
    } finally { setAuthBusy(false); }
  };

  const doSignOut = async () => {
    signOutInProgressRef.current = true;
    const uid = auth.currentUser?.uid;
    try {
      if (uid) {
        try {
          await setDoc(doc(db, "users", uid), buildCloudSnapshot(), { merge: true });
        } catch (err) {
          console.error("Final cloud save before sign-out failed:", err);
          showToast("Could not finish cloud backup. Please try again.");
          return;
        }
      }
      await signOut(auth);
      await resetLocalStateToBlank();
      showToast("Signed out ✓");
    } catch (err) {
      console.error("Sign-out failed:", err);
      showToast("Could not sign out — please try again.");
    } finally { signOutInProgressRef.current = false; }
  };

  const doPasswordReset = async () => {
    setAuthError("");
    if (!vaultEmail || !vaultEmail.includes("@")) return setAuthError("Enter your email address first.");
    setAuthBusy(true);
    try {
      await sendPasswordResetEmail(auth, vaultEmail);
      showToast(`Password reset email sent to ${vaultEmail}`);
    } catch (err) {
      setAuthError(authErrorMessage(err));
    } finally { setAuthBusy(false); }
  };

  // ── Computed Stats & Calculations ──────────────────────────────────────────
  const activeR  = useMemo(() => receipts.filter(r => (r.taxYear || 2026) === taxYear), [receipts, taxYear]);
  const getCat   = (id) => CATS.find(c => c.id === id);
  const getCatLimit = (c, incomeOverride) => {
    if (!c) return 0;
    if (c.dynamicLimit === "income10pct") {
      const inc = incomeOverride !== undefined ? incomeOverride : (parseFloat(income) || 0) + (parseFloat(otherIncomeAmt) || 0);
      return Math.round(inc * 0.10);
    }
    if (c.dynamicLimit === "homeLoanTier") {
      return homeLoanTier === "500to750k" ? 5000 : 7000;
    }
    return c.limit;
  };
  const getSpent = (id) => {
    if (id === "epf") return epfRelief;
    if (id === "socso") return socsoRelief;
    return activeR.filter(r => r.category === id).reduce((s, r) => s + r.amount, 0);
  };
  const getStats = (id) => { const cat = getCat(id); const limit = getCatLimit(cat); const spent = getSpent(id); return { spent, limit, rem: Math.max(limit - spent, 0), pct: limit > 0 ? Math.min((spent / limit) * 100, 100) : 0 }; };

  const sumRelief = (receiptsSubset, incomeForDynamic) => {
    const perCatSpent = {};
    CATS.forEach(c => { if (c.id !== "epf") perCatSpent[c.id] = 0; });
    receiptsSubset.forEach(r => { if (perCatSpent[r.category] !== undefined) perCatSpent[r.category] += r.amount; });
    const poolTotals = {};
    let total = 0;
    CATS.forEach(c => {
      if (c.id === "epf" || c.id === "socso") return;
      const capped = Math.min(perCatSpent[c.id] || 0, getCatLimit(c, incomeForDynamic));
      if (c.pool) poolTotals[c.pool] = (poolTotals[c.pool] || 0) + capped;
      else total += capped;
    });
    Object.keys(poolTotals).forEach(poolId => { total += Math.min(poolTotals[poolId], POOL_LIMITS[poolId] || Infinity); });
    return total;
  };

  const totalTracked  = useMemo(() => activeR.reduce((s, r) => s + r.amount, 0), [activeR]);
  const totalLimit    = useMemo(() => {
    const poolLims = {};
    let sum = 0;
    CATS.forEach(c => { if (c.pool) poolLims[c.pool] = POOL_LIMITS[c.pool] || 0; else sum += getCatLimit(c); });
    return sum + Object.values(poolLims).reduce((a, b) => a + b, 0);
  }, [income, otherIncomeAmt, homeLoanTier]);
  const epfRelief     = useMemo(() => { const t = activeR.filter(r => r.category === "epf").reduce((s, r) => s + r.amount, 0); return Math.min(epfAmt ? parseFloat(epfAmt) : t, 4000); }, [activeR, epfAmt]);
  const socsoRelief   = useMemo(() => Math.min(parseFloat(socsoAmt) || 0, 350), [socsoAmt]);
  const otherReliefs  = useMemo(() => sumRelief(activeR), [activeR, income, otherIncomeAmt]);
  const childR        = useMemo(() => (childU18 * 2000) + (childHiEduDegree * 8000) + (childHiEduOther * 2000) + (childDisabled * 8000) + (childDisabledHiEdu * 8000), [childU18, childHiEduDegree, childHiEduOther, childDisabled, childDisabledHiEdu]);

  const spouseHasNoIncome = hasSpouse && !(parseFloat(spouseInc) > 0);
  const myChildRelief = (hasSpouse && childrenClaimedBy === "spouse") ? 0 : childR;

  const totalIncome   = useMemo(() => (parseFloat(income) || 0) + (parseFloat(otherIncomeAmt) || 0), [income, otherIncomeAmt]);
  const totalReliefs  = useMemo(() => 9000 + (isSelfOKU ? 7000 : 0) + epfRelief + socsoRelief + (spouseHasNoIncome ? 4000 : 0) + myChildRelief + otherReliefs, [epfRelief, socsoRelief, isSelfOKU, spouseHasNoIncome, myChildRelief, otherReliefs]);
  const chargeable    = useMemo(() => Math.max(totalIncome - totalReliefs, 0), [totalIncome, totalReliefs]);
  const taxAfter      = useMemo(() => taxWithRebate(chargeable, spouseHasNoIncome), [chargeable, spouseHasNoIncome]);
  const taxBefore     = useMemo(() => Math.max(calcTax(Math.max(totalIncome - 9000, 0)), 0), [totalIncome]);
  const taxSaved      = useMemo(() => Math.max(taxBefore - taxAfter, 0), [taxBefore, taxAfter]);
  const effRate       = useMemo(() => totalIncome > 0 ? (taxAfter / (totalIncome || 1) * 100).toFixed(2) : "0.00", [taxAfter, totalIncome]);
  const myMarginalRate = useMemo(() => marginalRate(chargeable), [chargeable]);

  const netTaxPayable  = useMemo(() => Math.max(taxAfter - (parseFloat(zakatAmt) || 0), 0), [taxAfter, zakatAmt]);
  const myBalance      = useMemo(() => netTaxPayable - (parseFloat(pcbAmt) || 0), [netTaxPayable, pcbAmt]);

  const auditHealthScore = useMemo(() => {
    let flags = [];
    let score = 100;
    activeR.forEach(r => {
      if (!r.image) {
        score -= 5;
        flags.push({ level: "warn", msg: `Missing receipt photo for ${r.merchant || "entry"} (RM ${r.amount})` });
      }
    });
    CATS.forEach(c => {
      const sp = getSpent(c.id);
      const lim = getCatLimit(c);
      if (sp === lim && sp > 0) {
        flags.push({ level: "info", msg: `${c.name} is claimed at exactly 100% cap (RM ${lim.toLocaleString()}). Ensure full proof is attached.` });
      }
    });
    return { score: Math.max(score, 40), flags: flags.slice(0, 6) };
  }, [activeR]);

  const scenarioCalc = useMemo(() => {
    const grossEmp = parseFloat(income) || 0;
    const netSide  = Math.max((parseFloat(sideHustleInc) || 0) - (parseFloat(sideHustleExp) || 0), 0);
    const netRent  = Math.max((parseFloat(rentalInc) || 0) - (parseFloat(rentalExp) || 0), 0);
    const netOther = netSide + netRent;
    const totalTaxable = grossEmp + netOther;
    const chgNormal = Math.max(totalTaxable - totalReliefs, 0);
    const taxNormal = calcTax(chgNormal);
    const currentlyConnected = parseFloat(otherIncomeAmt) || 0;
    const isConnected = currentlyConnected > 0 && Math.abs(currentlyConnected - netOther) < 0.01;
    return { grossEmp, netSide, netRent, netOther, totalTaxable, chgNormal, taxNormal, isConnected };
  }, [income, sideHustleInc, sideHustleExp, rentalInc, rentalExp, totalReliefs, otherIncomeAmt]);

  const spouseSplit = useMemo(() => {
    if (!hasSpouse) return null;
    const mine = activeR.filter(r => r.owner === "mine").reduce((s, r) => s + r.amount, 0);
    const spouse = activeR.filter(r => r.owner === "spouse").reduce((s, r) => s + r.amount, 0);
    const joint = activeR.filter(r => !r.owner || r.owner === "joint").reduce((s, r) => s + r.amount, 0);
    return { mine, spouse, joint };
  }, [activeR, hasSpouse]);

  const spouseAnalysisDetailed = useMemo(() => {
    if (!hasSpouse) return null;
    const grossMine = totalIncome;
    const grossSpouse = parseFloat(spouseInc) || 0;

    const catBreakdown = CATS.filter(c => c.id !== "epf").map(c => {
      const lim = getCatLimit(c);
      const mineAmt = activeR.filter(r => r.category === c.id && (r.owner === "mine" || r.owner === "joint" || !r.owner)).reduce((s, r) => s + r.amount, 0);
      const spouseAmt = activeR.filter(r => r.category === c.id && r.owner === "spouse").reduce((s, r) => s + r.amount, 0);
      return { ...c, limit: lim, mine: Math.min(mineAmt, lim), spouse: Math.min(spouseAmt, lim), combined: Math.min(mineAmt + spouseAmt, lim) };
    });
    const selfReceiptsForRelief = activeR.filter(r => r.owner === "mine" || r.owner === "joint" || !r.owner);
    const spouseReceiptsForRelief = activeR.filter(r => r.owner === "spouse");
    const selfOtherTotal = sumRelief(selfReceiptsForRelief, grossMine);
    const spouseOtherTotal = sumRelief(spouseReceiptsForRelief, grossSpouse);
    const jointOtherTotal = sumRelief(activeR, grossMine + grossSpouse);

    const selfEpf = Math.min(parseFloat(epfAmt) || 0, 4000);
    const spouseEpfEffective = spouseEpfAmt !== "" ? (parseFloat(spouseEpfAmt) || 0) : Math.round(grossSpouse * 0.11);
    const spouseEpf = Math.min(spouseEpfEffective, 4000);
    const jointEpf = Math.min((parseFloat(epfAmt) || 0) + spouseEpfEffective, 4000);

    const spouseSocso = grossSpouse > 0 ? Math.min(parseFloat(spouseSocsoAmt) || 0, 350) : 0;
    const selfReliefs = 9000 + (isSelfOKU ? 7000 : 0) + selfEpf + socsoRelief + selfOtherTotal + (childrenClaimedBy === "spouse" ? 0 : childR);
    const spouseReliefs = 9000 + spouseEpf + spouseSocso + spouseOtherTotal + (childrenClaimedBy === "spouse" ? childR : 0);
    const chargeableSelfSep = Math.max(grossMine - selfReliefs, 0);
    const chargeableSpouseSep = Math.max(grossSpouse - spouseReliefs, 0);
    const taxSelfSep = taxWithRebate(chargeableSelfSep);
    const taxSpouseSep = taxWithRebate(chargeableSpouseSep);
    const totalTaxSeparate = taxSelfSep + taxSpouseSep;
    const pcbSelf = parseFloat(pcbAmt) || 0;
    const pcbSpouse = parseFloat(spousePcbAmt) || 0;
    const balanceSelfSep = taxSelfSep - pcbSelf;
    const balanceSpouseSep = taxSpouseSep - pcbSpouse;

    const combinedGross = grossMine + grossSpouse;
    const jointReliefTotal = 9000 + (isSelfOKU ? 7000 : 0) + 4000 + (spouseDisabled ? 6000 : 0) + jointEpf + socsoRelief + spouseSocso + jointOtherTotal + childR;
    const chargeableJoint = Math.max(combinedGross - jointReliefTotal, 0);
    const totalTaxJoint = taxWithRebate(chargeableJoint, true);
    const balanceJoint = totalTaxJoint - (pcbSelf + pcbSpouse);

    const savings = Math.abs(totalTaxJoint - totalTaxSeparate);
    let recommended = "SEPARATE", reasoning = "";
    if (grossSpouse === 0) {
      recommended = "JOINT";
      reasoning = `Your spouse has no income this year, so Joint Assessment grants a RM4,000 Spouse Relief on top of your own reliefs.`;
    } else if (totalTaxSeparate < totalTaxJoint) {
      recommended = "SEPARATE";
      reasoning = `Separate Assessment saves RM ${savings.toLocaleString()}. Each of you keeps your own RM9,000 self-relief and starts fresh at the bottom of the progressive tax brackets.`;
    } else if (totalTaxJoint < totalTaxSeparate) {
      recommended = "JOINT";
      reasoning = `Joint Assessment saves RM ${savings.toLocaleString()} for your household this year.`;
    } else {
      recommended = "EITHER";
      reasoning = `Both options result in the same tax liability of RM ${totalTaxSeparate.toLocaleString()}.`;
    }

    return {
      separate: { grossMine, grossSpouse, selfReliefs, spouseReliefs, chargeableSelfSep, chargeableSpouseSep, taxSelfSep, taxSpouseSep, totalTax: totalTaxSeparate, balanceSelfSep, balanceSpouseSep },
      joint: { combinedGross, jointReliefTotal, chargeableJoint, totalTax: totalTaxJoint, balanceJoint },
      recommended, reasoning, savings, catBreakdown, spouseEpfEffective, spouseEpfIsAuto: spouseEpfAmt === "",
    };
  }, [hasSpouse, totalIncome, spouseInc, epfAmt, spouseEpfAmt, spouseSocsoAmt, socsoRelief, isSelfOKU, pcbAmt, spousePcbAmt, activeR, childR, spouseDisabled, childrenClaimedBy]);

  const today    = new Date();
  const yearEnd  = new Date(taxYear, 11, 31);
  const daysLeft = taxYear === 2026 ? Math.max(Math.ceil((yearEnd - today) / DAY), 0) : 0;
  const yearPct  = taxYear === 2026 ? Math.min(Math.round(((365 - daysLeft) / 365) * 100), 100) : 100;
  const opps     = useMemo(() => CATS.map(c => ({ ...c, ...getStats(c.id) })).filter(c => c.rem > 0).sort((a, b) => b.rem - a.rem), [activeR, taxYear]);
  const filteredR= useMemo(() => activeR.filter(r => {
    const ms = (r.merchant || "").toLowerCase().includes(rcptSearch.toLowerCase());
    const mc = rcptCatF === "all" || r.category === rcptCatF;
    return ms && mc;
  }), [activeR, rcptSearch, rcptCatF]);

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleAmountChange = (val) => {
    if (!form.category) { setForm(f => ({ ...f, amount: val })); return; }
    const { rem } = getStats(form.category);
    const orig = editId ? (receipts.find(r => r.id === editId)?.amount || 0) : 0;
    const max = rem + orig, num = parseFloat(val) || 0;
    if (max > 0 && num > max) { setForm(f => ({ ...f, amount: String(max) })); showToast(`Auto-capped to RM ${max.toLocaleString()}`); }
    else setForm(f => ({ ...f, amount: val }));
  };

  const handleSave = async () => {
    if (!form.category || !form.amount) return showToast("Fill in Category and Amount");
    await persist([...receipts, { id: Date.now(), ...form, taxYear, amount: parseFloat(form.amount) }]);
    showToast("Receipt vaulted ✓");
    closeReceiptModal();
  };
  const handleUpdate = async () => {
    if (!form.category || !form.amount) return showToast("Fill in Category and Amount");
    await persist(receipts.map(r => r.id === editId ? { ...r, ...form, amount: parseFloat(form.amount) } : r));
    showToast("Updated ✓");
    closeReceiptModal();
  };
  const handleDelete = async (id) => { await persist(receipts.filter(r => r.id !== id)); showToast("Deleted from vault"); };
  const startEdit = (r) => { setForm({ category: r.category, amount: String(r.amount), merchant: r.merchant || "", date: r.date, image: r.image || null, taxYear: r.taxYear || 2026, owner: r.owner || "joint" }); setEditId(r.id); setShowVault(false); openReceiptModal(() => setShowVault(true)); };

  const compressImage = (file, maxDimension = 1600, quality = 0.75) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Couldn't read that image"));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error("Couldn't read that image"));
        img.onload = () => {
          let { width, height } = img;
          if (width > maxDimension || height > maxDimension) {
            if (width > height) { height = Math.round(height * (maxDimension / width)); width = maxDimension; }
            else { width = Math.round(width * (maxDimension / height)); height = maxDimension; }
          }
          const canvas = document.createElement("canvas");
          canvas.width = width; canvas.height = height;
          canvas.getContext("2d").drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", quality));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleImage = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    if (f.size > 15000000) return showToast("Image too large (max 15MB) — try a different photo");
    try {
      const compressed = await compressImage(f);
      setForm(p => ({ ...p, image: compressed }));
    } catch {
      showToast("Couldn't process that image — please try again");
    }
  };

  const exportCSV = () => {
    if (taxYear !== 2026 && !requireProOrPaywall("7-Year Vault Access", "Free plan only covers the current tax year. Upgrade to view and export past years.")) return;
    const rows = activeR.map(r => `${r.date},"${getCat(r.category)?.name || r.category}","${r.merchant || ""}",${r.amount}`);
    const csv = [`Tax Diary – YA ${taxYear}`, "Date,Category,Merchant,Amount (RM)", ...rows].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `TaxDiary-YA${taxYear}.csv`;
    a.click();
    showToast(`YA ${taxYear} CSV exported ✓`);
  };

  const exportPDF = () => {
    if (taxYear !== 2026 && !requireProOrPaywall("7-Year Vault Access", "Free plan only covers the current tax year. Upgrade to view and export past years.")) return;
    if (!requireProOrPaywall("PDF Audit Export", "Compile all receipts into one audit-ready PDF file.")) return;
    const pdf = new jsPDF();
    pdf.setFontSize(16);
    pdf.text(`Tax Diary — YA ${taxYear} Receipt Summary`, 14, 18);
    pdf.setFontSize(9);
    pdf.setTextColor(120);
    pdf.text(`Generated ${new Date().toLocaleDateString("en-MY")} · ${activeR.length} receipt${activeR.length !== 1 ? "s" : ""} · Estimates only, verify with LHDN before filing`, 14, 24);
    const total = activeR.reduce((s, r) => s + r.amount, 0);
    autoTable(pdf, {
      startY: 30,
      head: [["Date", "Category", "Merchant", "Amount (RM)", "Photo"]],
      body: activeR.map(r => [r.date, getCat(r.category)?.name || r.category, r.merchant || "—", r.amount.toFixed(2), r.image ? "Attached (see below)" : "Missing"]),
      foot: [["", "", "", "Total", `RM ${total.toLocaleString("en-MY", { minimumFractionDigits: 2 })}`]],
      headStyles: { fillColor: [6, 78, 59] },
      styles: { fontSize: 8 },
    });

    const receiptsWithPhotos = activeR.filter(r => r.image);
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 14;
    const maxImgWidth = pageWidth - margin * 2;
    const maxImgHeight = pageHeight - 50;

    receiptsWithPhotos.forEach((r) => {
      pdf.addPage();
      let imgW = maxImgWidth;
      let imgH = maxImgHeight;
      try {
        const props = pdf.getImageProperties(r.image);
        const ratio = props.width / props.height;
        imgH = imgW / ratio;
        if (imgH > maxImgHeight) { imgH = maxImgHeight; imgW = imgH * ratio; }
      } catch {}

      const format = (r.image.match(/^data:image\/(\w+);/)?.[1] || "jpeg").toUpperCase();
      const x = (pageWidth - imgW) / 2;
      pdf.addImage(r.image, format, x, 20, imgW, imgH);

      pdf.setFontSize(10);
      pdf.setTextColor(6, 78, 59);
      pdf.text(`${r.merchant || getCat(r.category)?.name || "Receipt"}  ·  ${getCat(r.category)?.name || r.category}`, margin, 20 + imgH + 10);
      pdf.setFontSize(9);
      pdf.setTextColor(120);
      pdf.text(`${r.date}  ·  RM ${r.amount.toLocaleString("en-MY", { minimumFractionDigits: 2 })}  ·  YA ${taxYear}`, margin, 20 + imgH + 16);
    });

    pdf.save(`TaxDiary-YA${taxYear}.pdf`);
    const photoNote = receiptsWithPhotos.length < activeR.length ? ` (${activeR.length - receiptsWithPhotos.length} missing photos)` : "";
    showToast(`YA ${taxYear} PDF exported with ${receiptsWithPhotos.length} photo${receiptsWithPhotos.length !== 1 ? "s" : ""}${photoNote} ✓`);
  };

  const saveAll = async () => { await persistSettings(); await persistIncome(); showToast("Profile saved ✓"); closeSettings(); };
  const openSettings = (tab = "user", returnTo = null) => { setSettingsTab(tab); setShowTools(false); setShowPaywall(false); setSettingsReturnTo(() => returnTo); setShowSettings(true); };
  const closeSettings = () => {
    setShowSettings(false);
    const fn = settingsReturnTo; setSettingsReturnTo(null); if (fn) fn();
  };
  const openVault = (returnTo = null) => { setVaultReturnTo(() => returnTo); setShowVault(true); };
  const closeVault = () => {
    setShowVault(false);
    const fn = vaultReturnTo; setVaultReturnTo(null); if (fn) fn();
  };
  const openReceiptModal = (returnTo = null) => { setReceiptReturnTo(() => returnTo); setShowReceipt(true); };
  const closeReceiptModal = () => {
    setShowReceipt(false); setForm(blank(taxYear)); setEditId(null);
    const fn = receiptReturnTo; setReceiptReturnTo(null); if (fn) fn();
  };

  const handleOCRUpload = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    if (f.size > 5000000) return showToast("Image too large (max 5MB)");
    const rd = new FileReader();
    rd.onloadend = async () => {
      const dataUrl = rd.result; setOcrLoading(true); showToast("AI analyzing receipt image…");
      let storedImage = dataUrl;
      try { storedImage = await compressImage(f); } catch {}
      try {
        const base64Data = dataUrl.split(",")[1];
        const mimeType = dataUrl.split(";")[0].split(":")[1] || "image/png";
        const response = await fetch("/api/scan-receipt", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ base64Data, mimeType })
        });
        const parsed = await response.json();
        if (!response.ok) throw new Error(parsed?.error || "Scan failed");
        const validCategoryIds = CATS.map(c => c.id);
        const safeMerchant = typeof parsed.merchant === "string" && parsed.merchant.trim() ? parsed.merchant.trim() : "Extracted Receipt";
        const safeAmount = (typeof parsed.amount === "number" && isFinite(parsed.amount)) ? String(parsed.amount) : (typeof parsed.amount === "string" && !isNaN(parseFloat(parsed.amount))) ? parsed.amount : "0.00";
        const safeDate = (typeof parsed.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(parsed.date)) ? parsed.date : new Date().toISOString().split("T")[0];
        const safeCategory = (typeof parsed.category === "string" && validCategoryIds.includes(parsed.category)) ? parsed.category : "lifestyle";
        setForm(f => ({ ...f, merchant: safeMerchant, amount: safeAmount, date: safeDate, category: safeCategory, image: storedImage, taxYear }));
        setShowScan(false); setShowReceipt(true);
        showToast(`AI Extracted: ${safeMerchant} · RM ${safeAmount}`);
      } catch (err) {
        console.error("AI scan failed:", err);
        setForm(f => ({ ...f, image: storedImage, taxYear }));
        setShowScan(false); setShowReceipt(true);
        showToast(`AI scan failed: ${err.message} — fill in manually`);
      } finally { setOcrLoading(false); }
    };
    rd.readAsDataURL(f);
  };

  const onTS = (e) => { touchX.current = e.targetTouches[0].clientX; };
  const onTE = (e) => {
    if (!touchX.current) return;
    const d = touchX.current - e.changedTouches[0].clientX;
    if (d > 50) slideIdx < SLIDES.length - 1 ? setSlideIdx(p => p + 1) : doneOnboard();
    else if (d < -50 && slideIdx > 0) setSlideIdx(p => p - 1);
    touchX.current = null;
  };

  if (view === "loading") return <div className="flex items-center justify-center h-screen bg-slate-100 text-slate-500 text-sm font-medium">Loading Tax Diary…</div>;

  if (view === "onboard") {
    const sl = SLIDES[slideIdx];
    return (
      <div className={`fixed inset-0 bg-gradient-to-br ${sl.bg} flex flex-col justify-between overflow-hidden select-none`} onTouchStart={onTS} onTouchEnd={onTE}>
        <div className="flex justify-between items-center p-6 z-10">
          <div className="flex items-center gap-2">
            <img src="/icons/icon-512.png" alt="Tax Diary" className="w-9 h-9 rounded-xl object-contain bg-white/90 p-0.5" />
            <img src="/brand/wordmark.png" alt="Tax Diary" className="h-6 w-auto" />
          </div>
          <button onClick={doneOnboard} className="text-emerald-100 text-xs font-bold px-3 py-1.5 rounded-full bg-emerald-900/40 border border-emerald-700/50">Skip</button>
        </div>
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center space-y-4">
            <div className="text-5xl">{sl.badge.slice(0, 2)}</div>
            <p className="text-emerald-400 text-xs font-bold tracking-widest uppercase">{sl.badge.slice(3)}</p>
            <h1 className="text-4xl font-black text-white leading-tight whitespace-pre-line">{sl.headline}</h1>
            <p className="text-emerald-100/80 text-sm leading-relaxed max-w-xs mx-auto">{sl.body}</p>
          </div>
        </div>
        <div className="p-8 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex gap-2">{SLIDES.map((_, i) => (<button key={i} onClick={() => setSlideIdx(i)} className={`rounded-full transition-all ${slideIdx === i ? "w-8 h-2.5 bg-emerald-500" : "w-2.5 h-2.5 bg-white/30"}`} />))}</div>
            <button onClick={() => slideIdx < SLIDES.length - 1 ? setSlideIdx(p => p + 1) : doneOnboard()} className="w-14 h-14 rounded-full bg-emerald-500 text-slate-950 font-bold flex items-center justify-center shadow-xl hover:bg-emerald-400 transition active:scale-95">
              <ArrowRight className="w-6 h-6 stroke-[2.5]" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 font-sans flex flex-col">
      {toast && (
        <div className="fixed bottom-5 right-5 z-[100] bg-emerald-950 text-emerald-100 px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-2 text-xs font-semibold border border-emerald-800 animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />{toast}
        </div>
      )}

      {cloudSyncStatus === "loading" && (
        <div className="bg-emerald-900 text-emerald-100 text-center text-xs font-bold py-2 px-4 flex items-center justify-center gap-2">
          <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" /> Syncing your data…
        </div>
      )}

      {isTrialing && (
        <div className="bg-emerald-950 text-emerald-200 text-center text-xs font-bold py-2 px-4 flex items-center justify-center gap-2 border-b border-emerald-800">
          <Clock className="w-3.5 h-3.5 text-emerald-400" /> Plus trial: {trialDaysLeft} day{trialDaysLeft !== 1 ? "s" : ""} left
          <button onClick={() => openPaywall("Keep Plus Features", "Subscribe now so you never lose access when your trial ends.")} className="underline ml-1 text-white hover:text-emerald-300">Subscribe now — RM{PRICE.toFixed(2)}/yr</button>
        </div>
      )}
      {showRenewalBanner && (
        <div className="bg-emerald-900 text-white text-center text-xs font-bold py-2 px-4 flex items-center justify-center gap-2">
          <RefreshCw className="w-3.5 h-3.5" /> Plus renews in {daysToRenewal} day{daysToRenewal !== 1 ? "s" : ""}
          <button onClick={() => openPaywall("Renew Plus", "Renew your subscription to keep your Plus features active.")} className="underline ml-1">Renew now — RM{PRICE.toFixed(2)}/yr</button>
        </div>
      )}

      {showInstallBanner && !isStandalone && (
        <div className="bg-emerald-950 text-emerald-100 text-xs font-bold py-2.5 px-4 flex items-center justify-center gap-3 flex-wrap border-b border-emerald-800">
          <Smartphone className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          {isIOS ? (
            <span>Install Tax Diary: tap <strong>Share</strong> below, then <strong>"Add to Home Screen"</strong></span>
          ) : (
            <>
              <span>Install Tax Diary for quick, offline access</span>
              <button onClick={handleInstallClick} className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg">Install</button>
            </>
          )}
          <button onClick={dismissInstallBanner} className="text-emerald-400 hover:text-white ml-1"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-40 bg-emerald-950 text-white border-b border-emerald-900 shadow-md px-4 py-3">
        <div className="max-w-6xl mx-auto flex justify-between items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2.5">
            <img src="/icons/icon-512.png" alt="Tax Diary" className="w-9 h-9 rounded-xl object-contain bg-emerald-900 p-0.5" />
            <div>
              <div className="flex items-center gap-2">
                <img src="/brand/wordmark.png" alt="Tax Diary" className="h-5 w-auto filter brightness-200" />
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-900 text-emerald-300 border border-emerald-700">YA {taxYear}</span>
                {isPro && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30 flex items-center gap-1"><Crown className="w-3 h-3 text-amber-400" /> Plus</span>}
              </div>
              <p className="text-[10px] text-emerald-300/70 hidden sm:block">LHDN e-Filing Relief Organizer · Budget 2026 Ready</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isPro && (
              <button onClick={() => setShowDonate(true)} title="Support the project" className="p-2 rounded-xl bg-emerald-900/60 hover:bg-emerald-900 text-emerald-300 border border-emerald-800 flex items-center gap-1.5 text-xs font-bold">
                <Heart className="w-4 h-4 text-emerald-400" />
              </button>
            )}
            {!isPro && (
              <button onClick={() => openPaywall("Upgrade to Plus", "Unlock AI scanning, 7-year history, Form BE sheet and more.")} className="px-3 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold flex items-center gap-1.5 shadow">
                <Crown className="w-3.5 h-3.5 text-amber-300" /> <span className="hidden sm:inline">Upgrade</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Persistent disclaimer */}
      <div className="bg-slate-200 border-b border-slate-300 px-4 py-1.5 text-center">
        <p className="text-[10px] sm:text-[11px] text-slate-600 font-medium">
          ⚠️ Estimates only, not tax advice — always verify figures with LHDN / MyTax before filing.
        </p>
      </div>

      <main className="flex-1 max-w-6xl w-full mx-auto p-4 space-y-4 pb-24">

        {/* Hero Banner */}
        <div className="bg-emerald-950 text-white rounded-3xl p-5 sm:p-6 shadow-lg border border-emerald-900 relative overflow-hidden space-y-4">
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-emerald-800/30 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-teal-800/30 rounded-full blur-2xl pointer-events-none" />

          <div className="border-b border-emerald-900 pb-4 relative">
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">Salam{clientName ? `, ${clientName}` : ""} 👋</h1>
            <p className="text-xs text-emerald-300 font-medium">Track YA {taxYear} reliefs · Log receipts · Maximize your refund before 31 Dec {taxYear}</p>
          </div>
          <div className="grid grid-cols-2 gap-3 relative">
            <div className={`bg-emerald-900/60 border ${myBalance <= 0 ? "border-emerald-700/80" : "border-amber-500/50"} p-3.5 rounded-2xl`}>
              <p className={`text-[10px] font-black uppercase tracking-wider ${myBalance <= 0 ? "text-emerald-300" : "text-amber-400"}`}>{myBalance <= 0 ? "Est. Refund" : "Est. Balance Owed"}</p>
              <p className={`text-lg sm:text-2xl font-black mt-0.5 ${myBalance <= 0 ? "text-emerald-200" : "text-amber-300"}`}>{fmt(Math.abs(myBalance), 0)}</p>
              <p className="text-[10px] font-medium text-emerald-400/80 mt-0.5">vs PCB already paid</p>
            </div>
            <div className="bg-emerald-900/60 border border-emerald-700/80 p-3.5 rounded-2xl">
              <p className="text-[10px] font-black uppercase tracking-wider text-emerald-300">Total Reliefs Claimed</p>
              <p className="text-lg sm:text-2xl font-black mt-0.5 text-white">RM {totalReliefs.toLocaleString()}</p>
              <p className="text-[10px] font-medium text-emerald-400/80 mt-0.5">Chargeable income: RM {chargeable.toLocaleString()}</p>
            </div>
          </div>
        </div>

        {taxYear === 2026 && (
          <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm space-y-2">
            <div className="flex justify-between text-xs font-bold">
              <span className="flex items-center gap-1.5 text-emerald-950"><Calendar className="w-4 h-4 text-emerald-700" /> YA 2026 Planning Window</span>
              <span className={daysLeft <= 30 ? "text-red-600" : daysLeft <= 90 ? "text-amber-600" : "text-slate-600"}>{daysLeft > 0 ? `${daysLeft} days to 31 Dec 2026` : "Year closed"}</span>
            </div>
            <div className="bg-slate-100 h-2.5 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${daysLeft <= 30 ? "bg-red-500" : daysLeft <= 90 ? "bg-amber-500" : "bg-emerald-700"}`} style={{ width: `${yearPct}%` }} />
            </div>
            <div className="flex justify-between text-xs text-slate-500 font-medium">
              <span>{opps.length} relief opportunities unfulfilled</span>
              <span className="font-bold text-emerald-800">RM {opps.reduce((s, c) => s + c.rem, 0).toLocaleString()} available</span>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <button onClick={() => { setForm(blank(taxYear)); setEditId(null); setShowReceipt(true); }} className="w-full py-3.5 px-4 rounded-2xl bg-emerald-900 hover:bg-emerald-800 text-white font-bold text-sm shadow-md flex items-center justify-center gap-2 active:scale-95 transition">
          <Plus className="w-4 h-4 text-emerald-300" /> Add Receipt
        </button>

        {/* Main Content Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          <div className="lg:col-span-2 space-y-4">
            {/* LHDN Category Breakdown */}
            <div className="space-y-3">
              <div className="flex justify-between items-center px-1">
                <h3 className="font-extrabold text-sm text-emerald-950">LHDN Relief Categories (YA {taxYear})</h3>
              </div>
              {GROUPS.map(g => {
                const cats = CATS.filter(c => c.g === g);
                const gS = cats.reduce((s, c) => s + getStats(c.id).spent, 0);
                const gPoolLims = {};
                let gL = 0;
                cats.forEach(c => { if (c.pool) gPoolLims[c.pool] = POOL_LIMITS[c.pool] || 0; else gL += getCatLimit(c); });
                gL += Object.values(gPoolLims).reduce((a, b) => a + b, 0);
                return (
                  <div key={g} className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                    <button onClick={() => setExpanded(p => ({ ...p, [g]: !p[g] }))} className="w-full p-4 flex items-center justify-between bg-slate-50 hover:bg-slate-100 transition border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-sm text-emerald-950">{g} Reliefs</span>
                        {gS > 0 && <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 font-extrabold border border-emerald-200">RM {gS.toLocaleString()}</span>}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
                        <span>Max RM {gL.toLocaleString()}</span>
                        {expanded[g] ? <ChevronUp className="w-4 h-4 text-slate-600" /> : <ChevronDown className="w-4 h-4 text-slate-600" />}
                      </div>
                    </button>
                    {expanded[g] && (
                      <div className="divide-y divide-slate-100">
                        {cats.map(c => {
                          const { spent, limit, rem, pct } = getStats(c.id);
                          const isMaxed = pct >= 100;
                          const estSave = Math.round(taxWithRebate(chargeable, spouseHasNoIncome) - taxWithRebate(Math.max(chargeable - rem, 0), spouseHasNoIncome));
                          return (
                            <div key={c.id} className="p-4 space-y-2 hover:bg-slate-50 transition">
                              <div className="flex justify-between items-start">
                                <div>
                                  <p className="font-bold text-sm text-slate-800 flex items-center gap-1.5"><span>{c.emoji}</span> {c.name}</p>
                                  <p className="text-xs text-slate-500">{c.note}</p>
                                </div>
                                <div className="text-right text-xs">
                                  {spent > 0 ? <p className="font-extrabold text-emerald-800">RM {spent.toLocaleString()}</p> : <p className="text-slate-400 font-medium">RM 0.00</p>}
                                  {isMaxed ? <span className="text-emerald-700 font-bold text-[10px] flex items-center gap-0.5 justify-end mt-0.5"><CheckCircle2 className="w-3 h-3 text-emerald-600" /> Maxed</span> : <span className="text-slate-400 text-[10px]">RM {rem.toLocaleString()} remaining</span>}
                                </div>
                              </div>
                              <div className="bg-slate-100 h-2 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full transition-all ${isMaxed ? "bg-emerald-700" : spent > 0 ? "bg-emerald-700" : "bg-transparent"}`} style={{ width: `${pct}%` }} />
                              </div>
                              {!isMaxed && rem > 0 && (
                                <div className="flex items-center justify-between text-xs bg-emerald-50/80 p-2.5 rounded-xl border border-emerald-200/60 gap-2">
                                  <span className="text-[11px] text-emerald-950 font-medium flex items-center gap-1 flex-wrap">
                                    <Sparkles className="w-3 h-3 text-emerald-700" /> <strong>RM {rem.toLocaleString()}</strong> unclaimed
                                    {isPro ? (
                                      <span className="text-emerald-800 font-bold">· saves ~RM {estSave.toLocaleString()} tax</span>
                                    ) : (
                                      <button onClick={() => openPaywall("Personalized Tax-Savings Estimate", "See exactly how much tax you'd save by maxing out each relief category.")} className="text-slate-500 font-bold flex items-center gap-0.5 hover:text-emerald-900"><Lock className="w-2.5 h-2.5" /> see RM saved</button>
                                    )}
                                  </span>
                                  {c.isAuto ? (
                                    <button onClick={() => openSettings("income")} className="text-[11px] font-bold text-emerald-800 hover:underline shrink-0">Edit in Profile</button>
                                  ) : (
                                    <button onClick={() => { setForm({ ...blank(taxYear), category: c.id }); setShowReceipt(true); }} className="text-[11px] font-bold text-emerald-800 hover:underline shrink-0">+ Add Receipt</button>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column / Sidebar */}
          <div className="space-y-4">
            {/* Top Opportunities */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h4 className="font-extrabold text-sm text-emerald-950 flex items-center gap-2"><Sparkles className="w-4 h-4 text-emerald-700" /> Top Relief Opportunities</h4>
                <span className="text-[10px] bg-emerald-100 text-emerald-900 font-bold px-2 py-0.5 rounded-full border border-emerald-200">YA {taxYear}</span>
              </div>
              {opps.length === 0 ? (
                <p className="text-xs text-emerald-800 font-semibold text-center py-2">🎉 All categories have entries!</p>
              ) : (
                <div className="space-y-2.5">
                  {opps.slice(0, 4).map(c => (
                    <div key={c.id} className="p-3 rounded-2xl bg-slate-50 border border-slate-200 hover:border-emerald-300 transition space-y-1.5">
                      <div className="flex justify-between items-start text-xs">
                        <span className="font-bold text-slate-800">{c.emoji} {c.name}</span>
                        <span className="font-extrabold text-emerald-800">RM {c.rem.toLocaleString()}</span>
                      </div>
                      <p className="text-[11px] text-slate-500">{c.note}</p>
                      {c.isAuto ? (
                        <button onClick={() => openSettings("income")} className="w-full py-1.5 rounded-xl bg-emerald-900 hover:bg-emerald-800 text-white font-bold text-[11px] border border-emerald-800 flex items-center justify-center gap-1">Edit in Profile</button>
                      ) : (
                        <button onClick={() => { setForm({ ...blank(taxYear), category: c.id }); setShowReceipt(true); }} className="w-full py-1.5 rounded-xl bg-emerald-900 hover:bg-emerald-800 text-white font-bold text-[11px] border border-emerald-800 flex items-center justify-center gap-1"><Plus className="w-3 h-3 text-emerald-300" /> Add Receipt</button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Footer */}
        <footer className="pt-6 pb-2 flex flex-col items-center gap-2 text-center">
          <img src="/brand/wordmark.png" alt="Tax Diary" className="h-6 w-auto opacity-70 filter grayscale hover:grayscale-0 transition" />
          <p className="text-[11px] text-slate-400 font-medium">Track · Save · File with confidence</p>
        </footer>
      </main>
    </div>
  );
}
