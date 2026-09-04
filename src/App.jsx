import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Calculator, UserCheck, Building2, Upload, Plus, Edit2,
  CheckCircle2, Sparkles, Download, Heart, ChevronDown, ChevronUp, X,
  Trash2, Receipt, Tag, Check, AlertTriangle, Search, Settings, Archive,
  ExternalLink, ArrowRight, Calendar, Camera, Zap, Smartphone, Laptop,
  Copy, RefreshCw, Link2, ShieldAlert, Crown, Lock, FileText, Clock,
  Mail, LogIn, PieChart, ClipboardCopy, Info, Sliders, ShieldCheck,
  DollarSign, Home, Briefcase
} from "lucide-react";

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
      if (window.storage?.set) return await window.storage.set(k, shared);
      localStorage.setItem(k, v);
    } catch {}
  },
};

// ── Constants & Updated LHDN YA 2026 Tax Data ─────────────────────────────────
const POOL_LIMITS = { med_pool: 10000, edu_fees_pool: 7000 }; // combined ceilings shared across categories tagged with the matching pool

const CATS = [
  { id: "epf",       g: "Financial", name: "EPF / i-Saraan",                nameBM: "KWSP / i-Saraan",                     limit: 4000,  note: "Mandatory + voluntary EPF contributions",                  isAuto: true, beLine: "D8",  emoji: "🛡️" },
  { id: "life_ins",  g: "Financial", name: "Life Insurance / Takaful",       nameBM: "Insurans Hayat / Takaful",            limit: 3000,  note: "Self, spouse or child policies & takaful plans",          beLine: "D9",  emoji: "💖" },
  { id: "med_ins",   g: "Financial", name: "Medical & Education Insurance",   nameBM: "Insurans Perubatan dan Pendidikan",  limit: 4000,  note: "Insurance/takaful with medical or education benefits",     beLine: "D10", emoji: "🩺" },
  { id: "socso",     g: "Financial", name: "SOCSO & EIS",                    nameBM: "SOCSO & EIS",                         limit: 350,   note: "Employee SOCSO / EIS contributions",                       isAuto: true, beLine: "D11", emoji: "📋" },
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
  { badge: "🗂️ SMART TAX VAULT",   headline: "STRESS-FREE\ne-FILING YA 2026", body: "Store LHDN receipts securely with full Budget 2026 updates (CCTV, Transit & Tourism). Be audit-ready for 7 years.", bg: "from-pink-950 via-fuchsia-900 to-gray-900" },
  { badge: "💡 SMART SUGGESTIONS", headline: "MAXIMIZE YOUR\nREFUNDS", body: "Tax Diary flags unclaimed YA 2026 opportunities and calculates exact ringgit tax savings in real-time.", bg: "from-fuchsia-950 via-gray-900 to-pink-950" },
  { badge: "👑 TRY VAULT FREE",    headline: "7 DAYS FREE\nTHEN RM19/YR", body: "Unlock AI receipt scanning, the Audit-Ready Checklist, Form BE sheet & multi-device cloud sync.", bg: "from-gray-950 via-pink-950 to-fuchsia-950" },
];

const DAY = 86400000;
const YEAR = 365 * DAY;
const PRICE = 29;
const DONATION_URL = "https://buymeacoffee.com/YOUR_USERNAME"; // TODO: replace with your real donation link once you've picked a platform (Buy Me a Coffee / Ko-fi / PayPal.me)

const calcTax  = (inc) => { if (!inc || inc <= 0) return 0; let p = 0; for (const b of BRACKETS) { if (inc <= b.max) return b.base + (inc - p) * b.rate; p = b.max; } return 0; };
// RM400 personal rebate if chargeable <= RM35,000. An ADDITIONAL RM400 applies on the same
// chargeable-income test if spouse relief is being claimed for a spouse with no income
// (or under Joint Assessment) — this is a real, separate LHDN rebate, not a duplicate.
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
const genCode  = () => Math.random().toString(36).substr(2, 6).toUpperCase();

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
  const [socsoAmt,     setSocsoAmt]     = useState("350");
  const [zakatAmt,     setZakatAmt]     = useState("0");
  const [isSelfOKU,    setIsSelfOKU]    = useState(false);
  const [maritalStatus, setMaritalStatus] = useState("single"); // "single" | "married" — set under Profile
  const hasSpouse = maritalStatus === "married";
  const [spouseInc,    setSpouseInc]    = useState("");
  const [spouseEpfAmt, setSpouseEpfAmt] = useState("");
  const [spouseEpfTouched, setSpouseEpfTouched] = useState(false);
  const [spouseSocsoAmt, setSpouseSocsoAmt] = useState("350");
  const [spousePcbAmt, setSpousePcbAmt] = useState("");
  const [spouseName,   setSpouseName]   = useState("Spouse");
  const [spouseDisabled, setSpouseDisabled] = useState(false);
  const [childrenClaimedBy, setChildrenClaimedBy] = useState("mine"); // "mine" | "spouse" — who claims the children reliefs
  const [childU18,     setChildU18]     = useState(0);
  const [childHiEduDegree, setChildHiEduDegree] = useState(0); // Diploma+/Degree/Masters/PhD — RM8,000 each
  const [childHiEduOther, setChildHiEduOther] = useState(0);   // Other qualifying full-time study (pre-degree, matriculation, A-Level etc) — RM2,000 each
  const [childDisabled, setChildDisabled] = useState(0);
  const [childDisabledHiEdu, setChildDisabledHiEdu] = useState(0);
  const [homeLoanTier, setHomeLoanTier] = useState("under500k"); // "under500k" (RM7,000 cap) | "500to750k" (RM5,000 cap)
  const [clientName,   setClientName]   = useState("");
  const [toast,        setToast]        = useState("");
  const [expanded,     setExpanded]     = useState({ Financial: false, Medical: false, Education: false, Lifestyle: false, Property: false });
  const [rcptSearch,   setRcptSearch]   = useState("");
  const [rcptCatF,     setRcptCatF]     = useState("all");
  const [showSettings, setShowSettings] = useState(false);
  const [settingsReturnTo, setSettingsReturnTo] = useState(null); // fn to call when Settings is dismissed, to reopen wherever it was triggered from
  const [settingsTab,  setSettingsTab]  = useState("user");
  const [showReceipt,  setShowReceipt]  = useState(false);
  const [showCatPick,  setShowCatPick]  = useState(false);
  const [showScan,     setShowScan]     = useState(false);
  const [scanReturnTo, setScanReturnTo] = useState(null); // fn to call when the AI Scan modal is dismissed without completing a scan
  const [ocrLoading,   setOcrLoading]   = useState(false);
  const [showFormBE,   setShowFormBE]   = useState(false);
  const [showScenario, setShowScenario] = useState(false);
  const [showAuditCheck, setShowAuditCheck] = useState(false);
  const [showTools,    setShowTools]    = useState(false);
  const [showVault,    setShowVault]    = useState(false);
  const [vaultReturnTo, setVaultReturnTo] = useState(null); // fn to call when the Receipt Vault list is dismissed
  const [receiptReturnTo, setReceiptReturnTo] = useState(null); // fn to call when the Add/Edit Receipt form is dismissed
  const [showFilterPick, setShowFilterPick] = useState(false); // custom category-filter picker for the Vault list (replaces native <select>)
  const [showSpouseDetail, setShowSpouseDetail] = useState(false);
  const [previewImage, setPreviewImage] = useState(null); // full-size receipt photo lightbox — { src, merchant } or null
  const [form,         setForm]         = useState(blank());
  const [editId,       setEditId]       = useState(null);
  const touchX = useRef(null);

  // ── Scenario Modeling state (Side Hustle / Sole Prop & Rental) ──────────────
  const [sideHustleInc, setSideHustleInc] = useState("18000");
  const [sideHustleExp, setSideHustleExp] = useState("4500");
  const [rentalInc,     setRentalInc]     = useState("14400");
  const [rentalExp,     setRentalExp]     = useState("3200");

  // ── Billing / Trial State ───────────────────────────────────────────────────
  const [billing, setBilling] = useState({ trialUsed: false, trialStart: null, subEnd: null });
  const [now, setNow] = useState(Date.now());
  const [showPaywall, setShowPaywall] = useState(false);
  const [paywallCtx,  setPaywallCtx]  = useState({ title: "AI Receipt Scanner", desc: "Snap a receipt and let AI fill in the details for you." });
  const [paywallReturnTo, setPaywallReturnTo] = useState(null); // fn to call when paywall is dismissed, to reopen wherever it was triggered from

  // ── Device Sync ─────────────────────────────────────────────────────────────
  const [vaultCode,      setVaultCode]      = useState("");
  const [vaultEmail,     setVaultEmail]     = useState("");
  const [signedIn,       setSignedIn]       = useState(false);
  const [vaultCodeInput, setVaultCodeInput] = useState("");
  const [deviceSyncedAt, setDeviceSyncedAt] = useState("");
  const [loadingVault,   setLoadingVault]   = useState(false);
  const [pendingPull,    setPendingPull]    = useState(null);
  const hydrated = useRef(false);

  useEffect(() => { init(); }, []);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(t); }, []);

  // ── PWA Install Banner ──────────────────────────────────────────────────────
  // Android/Chrome fires 'beforeinstallprompt' when install criteria are met
  // (manifest + service worker + HTTPS). We capture it instead of letting the
  // browser show its own generic mini-banner, so we can show our own styled
  // one and re-trigger the prompt whenever the user taps our button.
  // iOS Safari never fires this event — there is no programmatic install API
  // there — so for iOS we show a manual "tap Share" instruction instead.
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
      e.preventDefault(); // stop Chrome's own mini-infobar
      setInstallPromptEvent(e);
      if (!standalone && !recentlyDismissed) setShowInstallBanner(true);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);

    // iOS gets no event to listen for — just show the manual-instructions
    // banner directly, once, if not already installed and not recently dismissed.
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
    // On iOS there's nothing to "click" programmatically — the banner itself
    // already shows the Share → Add to Home Screen instructions, so this
    // button just dismisses it once they've done that manually.
  };
  const dismissInstallBanner = () => {
    setShowInstallBanner(false);
    try { localStorage.setItem("mc26-install-dismissed", String(Date.now())); } catch {}
  };

  // Lock background page scroll whenever any modal is open — without this, touch/wheel
  // events pass through the modal's backdrop and scroll the dashboard behind it.
  useEffect(() => {
    const anyModalOpen = showSettings || showTools || showReceipt || showCatPick || showFilterPick || showScan || showFormBE || showScenario || showAuditCheck || showVault || showSpouseDetail || showPaywall || !!previewImage;
    document.body.style.overflow = anyModalOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [showSettings, showTools, showReceipt, showCatPick, showFilterPick, showScan, showFormBE, showScenario, showAuditCheck, showVault, showSpouseDetail, showPaywall, previewImage]);

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

      const b = await store.get("mc26-billing");
      if (b?.value) setBilling(JSON.parse(b.value));

      let code = "";
      try { const c = await store.get("mc26-vaultcode"); code = c?.value || ""; if (!code) { code = genCode(); await store.set("mc26-vaultcode", code); } } catch { code = genCode(); }
      setVaultCode(code);

      const em = await store.get("mc26-email");
      if (em?.value) { setVaultEmail(em.value); setSignedIn(true); }

      setView(ob?.value ? "home" : "onboard");
      hydrated.current = true;
    } catch { setView("home"); hydrated.current = true; }
  };

  const doneOnboard = async () => { try { await store.set("mc26-onboard", "1"); } catch {} setView("home"); };

  const persist = async (list) => { setReceipts(list); try { await store.set("mc26-receipts", JSON.stringify(list)); } catch { showToast("Saved this session"); } };
  const persistIncome   = async () => { try { await store.set("mc26-income",   JSON.stringify({ income, otherIncomeAmt, epf: epfAmt, socsoAmt, pcbAmt, zakatAmt, isSelfOKU, maritalStatus, spouseInc, spouseEpfAmt, spouseSocsoAmt, spousePcbAmt, spouseDisabled, spouseName, childU18, childHiEduDegree, childHiEduOther, childDisabled, childDisabledHiEdu, homeLoanTier, childrenClaimedBy })); } catch {} };
  const persistSettings = async () => { try { await store.set("mc26-settings", JSON.stringify({ clientName })); } catch {} };
  const persistBilling  = async (b) => { setBilling(b); try { await store.set("mc26-billing", JSON.stringify(b)); } catch {} };

  // ── Tier / Trial Derived State ──────────────────────────────────────────────
  const trialEnd   = billing.trialStart ? billing.trialStart + 7 * DAY : null;
  const isTrialing = !!(trialEnd && now < trialEnd);
  const trialDaysLeft = isTrialing ? Math.max(1, Math.ceil((trialEnd - now) / DAY)) : 0;
  const isSubscribed  = !!(billing.subEnd && now < billing.subEnd);
  const isPro = isTrialing || isSubscribed;
  const daysToRenewal = isSubscribed ? Math.ceil((billing.subEnd - now) / DAY) : null;
  const showRenewalBanner = isSubscribed && daysToRenewal <= 30;
  const trialJustExpired = !!(trialEnd && now >= trialEnd && !isSubscribed);
  const subJustExpired = !!(billing.subEnd && now >= billing.subEnd);

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
    await persistBilling({ ...billing, trialUsed: true, trialStart: Date.now() });
    showToast("Plus trial started — 7 days free ✓");
    closePaywall();
  };
  const subscribe = async () => {
    await persistBilling({ ...billing, subEnd: Date.now() + YEAR });
    showToast(`Subscribed to Plus (RM${PRICE.toFixed(2)}/yr) ✓`);
    closePaywall();
  };

  const requireProOrPaywall = (title, desc, returnTo = null) => {
    if (isPro) return true;
    openPaywall(title, desc, returnTo);
    return false;
  };

  const pushDeviceVault = async () => {
    if (!isPro || !signedIn || !vaultCode) return;
    const snapshot = { receipts, income, otherIncomeAmt, epfAmt, socsoAmt, pcbAmt, zakatAmt, isSelfOKU, maritalStatus, spouseInc, spouseEpfAmt, spouseSocsoAmt, spousePcbAmt, spouseDisabled, spouseName, childU18, childHiEduDegree, childHiEduOther, childDisabled, childDisabledHiEdu, homeLoanTier, childrenClaimedBy, clientName, updatedAt: new Date().toISOString() };
    try { await store.set(`mintcukai-vault:${vaultCode}`, JSON.stringify(snapshot), true); setDeviceSyncedAt(new Date().toLocaleTimeString()); } catch {}
  };
  useEffect(() => {
    if (!hydrated.current || !isPro || !signedIn) return;
    pushDeviceVault();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receipts, income, otherIncomeAmt, epfAmt, socsoAmt, pcbAmt, zakatAmt, isSelfOKU, maritalStatus, spouseInc, spouseEpfAmt, spouseSocsoAmt, spousePcbAmt, spouseDisabled, spouseName, childU18, childHiEduDegree, childHiEduOther, childDisabled, childDisabledHiEdu, homeLoanTier, childrenClaimedBy, clientName, isPro, signedIn]);
  useEffect(() => {
    if (!hasSpouse || spouseEpfTouched) return;
    const auto = Math.round((parseFloat(spouseInc) || 0) * 0.11);
    setSpouseEpfAmt(auto > 0 ? String(auto) : "");
  }, [spouseInc, hasSpouse, spouseEpfTouched]);

  const signIn = async () => {
    if (!vaultEmail || !vaultEmail.includes("@")) return showToast("Enter a valid email");
    await store.set("mc26-email", vaultEmail);
    setSignedIn(true);
    showToast(`Signed in as ${vaultEmail} (demo mode)`);
  };

  const requestLoadVault = async () => {
    const code = vaultCodeInput.trim().toUpperCase();
    if (code.length < 4) return showToast("Enter the 6-character Vault Code from your other device");
    setLoadingVault(true);
    try {
      const r = await store.get(`mintcukai-vault:${code}`, true);
      setLoadingVault(false);
      if (!r?.value) return showToast("No vault found for that code");
      setPendingPull(code);
    } catch { setLoadingVault(false); showToast("Couldn't reach cloud vault"); }
  };
  const confirmLoadVault = async () => {
    const code = pendingPull; if (!code) return;
    setLoadingVault(true);
    try {
      const r = await store.get(`mintcukai-vault:${code}`, true);
      if (!r?.value) { showToast("Vault no longer available"); setLoadingVault(false); setPendingPull(null); return; }
      const d = JSON.parse(r.value);
      setReceipts(d.receipts || []); setIncome(d.income ?? ""); setOtherIncomeAmt(d.otherIncomeAmt ?? "0"); setEpfAmt(d.epfAmt ?? ""); setSocsoAmt(d.socsoAmt ?? "350"); setZakatAmt(d.zakatAmt ?? "0"); setIsSelfOKU(d.isSelfOKU || false);
      setMaritalStatus(d.maritalStatus || (d.hasSpouse ? "married" : "single")); setSpouseInc(d.spouseInc ?? ""); setSpouseDisabled(!!d.spouseDisabled); setSpouseName(d.spouseName || "Spouse"); setPcbAmt(d.pcbAmt ?? ""); setSpouseEpfAmt(d.spouseEpfAmt ?? ""); setSpouseSocsoAmt(d.spouseSocsoAmt ?? "350"); setSpousePcbAmt(d.spousePcbAmt ?? ""); setChildrenClaimedBy(d.childrenClaimedBy || "mine"); if (d.spouseEpfAmt) setSpouseEpfTouched(true);
      setChildU18(d.childU18 ?? 0); setChildHiEduDegree(d.childHiEduDegree ?? d.childHiEdu ?? 0); setChildHiEduOther(d.childHiEduOther ?? 0); setChildDisabled(d.childDisabled ?? 0); setChildDisabledHiEdu(d.childDisabledHiEdu ?? 0); setHomeLoanTier(d.homeLoanTier || "under500k");
      setClientName(d.clientName || "");
      await store.set("mc26-receipts", JSON.stringify(d.receipts || []));
      await store.set("mc26-income", JSON.stringify({ income: d.income, otherIncomeAmt: d.otherIncomeAmt, epf: d.epfAmt, socsoAmt: d.socsoAmt, pcbAmt: d.pcbAmt, zakatAmt: d.zakatAmt, isSelfOKU: d.isSelfOKU, maritalStatus: d.maritalStatus, spouseInc: d.spouseInc, spouseEpfAmt: d.spouseEpfAmt, spouseSocsoAmt: d.spouseSocsoAmt, spousePcbAmt: d.spousePcbAmt, spouseDisabled: d.spouseDisabled, spouseName: d.spouseName, childU18: d.childU18, childHiEduDegree: d.childHiEduDegree, childHiEduOther: d.childHiEduOther, childDisabled: d.childDisabled, childDisabledHiEdu: d.childDisabledHiEdu, homeLoanTier: d.homeLoanTier, childrenClaimedBy: d.childrenClaimedBy }));
      await store.set("mc26-settings", JSON.stringify({ clientName: d.clientName }));
      await store.set("mc26-vaultcode", code);
      setVaultCode(code); setVaultCodeInput(""); setDeviceSyncedAt(new Date().toLocaleTimeString());
      showToast(`Loaded vault ${code} onto this device ✓`);
    } catch { showToast("Couldn't load that vault"); } finally { setLoadingVault(false); setPendingPull(null); }
  };
  const copyVaultCode = () => { try { navigator.clipboard?.writeText(vaultCode); showToast(`Code ${vaultCode} copied ✓`); } catch { showToast(`Your code is ${vaultCode}`); } };

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
    // EPF & SOCSO are settings-driven (isAuto), not receipt-driven — reuse the exact same
    // values that feed the real tax calculation, so this display can never drift out of
    // sync with what's actually being claimed.
    if (id === "epf") return epfRelief;
    if (id === "socso") return socsoRelief;
    return activeR.filter(r => r.category === id).reduce((s, r) => s + r.amount, 0);
  };
  const getStats = (id) => { const cat = getCat(id); const limit = getCatLimit(cat); const spent = getSpent(id); return { spent, limit, rem: Math.max(limit - spent, 0), pct: limit > 0 ? Math.min((spent / limit) * 100, 100) : 0 }; };

  // Sums relief across a given set of receipts, correctly applying per-category caps,
  // shared pool ceilings (e.g. the RM10,000 combined medical pool), and dynamic caps
  // (e.g. donations at 10% of income). Single source of truth reused everywhere relief
  // totals are calculated, so the medical pool and donation cap can't drift out of sync
  // between the main dashboard and the spouse engine.
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
  // Spouse relief (RM4,000) only applies unconditionally when spouse has no income — otherwise it depends on
  // electing Joint Assessment, which this single-person dashboard doesn't ask about. See the Spouse tab for the
  // full Joint vs Separate comparison, which handles this correctly either way.
  const spouseHasNoIncome = hasSpouse && !(parseFloat(spouseInc) > 0);
  const myChildRelief = (hasSpouse && childrenClaimedBy === "spouse") ? 0 : childR;
  // Total taxable income = employment income + any side-hustle/rental income the user has
  // explicitly included via the Scenario Planner. Using this everywhere (not raw `income`)
  // ensures the Planner's numbers actually feed the real tax calculation instead of being
  // a disconnected "what-if" sandbox.
  const totalIncome   = useMemo(() => (parseFloat(income) || 0) + (parseFloat(otherIncomeAmt) || 0), [income, otherIncomeAmt]);
  const totalReliefs  = useMemo(() => 9000 + (isSelfOKU ? 7000 : 0) + epfRelief + socsoRelief + (spouseHasNoIncome ? 4000 : 0) + myChildRelief + otherReliefs, [epfRelief, socsoRelief, isSelfOKU, spouseHasNoIncome, myChildRelief, otherReliefs]);
  const chargeable    = useMemo(() => Math.max(totalIncome - totalReliefs, 0), [totalIncome, totalReliefs]);
  const taxAfter      = useMemo(() => taxWithRebate(chargeable, spouseHasNoIncome), [chargeable, spouseHasNoIncome]);
  const taxBefore     = useMemo(() => Math.max(calcTax(Math.max(totalIncome - 9000, 0)), 0), [totalIncome]);
  const taxSaved      = useMemo(() => Math.max(taxBefore - taxAfter, 0), [taxBefore, taxAfter]);
  const effRate       = useMemo(() => totalIncome > 0 ? (taxAfter / (totalIncome || 1) * 100).toFixed(2) : "0.00", [taxAfter, totalIncome]);
  const myMarginalRate = useMemo(() => marginalRate(chargeable), [chargeable]);
  // Zakat is a direct offset against tax payable (not a relief reducing chargeable income) —
  // applied after all reliefs and the RM400 rebate, capped so it can't push tax below zero.
  const netTaxPayable  = useMemo(() => Math.max(taxAfter - (parseFloat(zakatAmt) || 0), 0), [taxAfter, zakatAmt]);
  const myBalance      = useMemo(() => netTaxPayable - (parseFloat(pcbAmt) || 0), [netTaxPayable, pcbAmt]);

  // Audit-Ready Checklist score calculator
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

  // Side Hustle & Rental Scenario Calculation
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

  // Detailed per-category Separate vs Joint household analysis (Plus, married users)
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

    // Separate Assessment: each spouse gets own RM9,000 self-relief; child relief goes to whichever parent is claiming it
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

    // Joint Assessment: one RM9,000 self-relief + RM4,000 spouse relief (+RM6,000 if certified disabled spouse), categories combined & capped once
    const combinedGross = grossMine + grossSpouse;
    const jointReliefTotal = 9000 + (isSelfOKU ? 7000 : 0) + 4000 + (spouseDisabled ? 6000 : 0) + jointEpf + socsoRelief + spouseSocso + jointOtherTotal + childR;
    const chargeableJoint = Math.max(combinedGross - jointReliefTotal, 0);
    // Electing Joint Assessment always carries the RM4,000 spouse relief, which makes the
    // additional RM400 spouse rebate apply too (on top of the personal RM400), same RM35,000 gate.
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

  const handleImage = (e) => {
    const f = e.target.files[0]; if (!f) return;
    if (f.size > 600000) return showToast("Image over 600KB");
    const rd = new FileReader(); rd.onloadend = () => setForm(p => ({ ...p, image: rd.result })); rd.readAsDataURL(f);
  };

  const exportCSV = (pdf = false) => {
    if (taxYear !== 2026 && !requireProOrPaywall("7-Year Vault Access", "Free plan only covers the current tax year. Upgrade to view and export past years.")) return;
    if (pdf && !requireProOrPaywall("PDF Audit Export", "Compile all receipts into one audit-ready PDF file.")) return;
    const rows = activeR.map(r => `${r.date},"${getCat(r.category)?.name || r.category}","${r.merchant || ""}",${r.amount}`);
    const csv = [`Tax Diary – YA ${taxYear}`, "Date,Category,Merchant,Amount (RM)", ...rows].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `TaxDiary-YA${taxYear}.csv`;
    a.click();
    showToast(`YA ${taxYear} CSV exported ✓`);
  };

  const saveAll = async () => { await persistSettings(); await persistIncome(); showToast("Profile saved ✓"); closeSettings(); };
  const openSettings = (tab = "user", returnTo = null) => { setSettingsTab(tab); setShowTools(false); setShowPaywall(false); setSettingsReturnTo(() => returnTo); setShowSettings(true); };
  const closeSettings = () => {
    setShowSettings(false); setPendingPull(null);
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

  // Enhanced AI OCR — calls our own /api/scan-receipt serverless function, which
  // holds the Gemini key server-side (see api/scan-receipt.js). The browser never
  // sees the API key.
  const handleOCRUpload = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    if (f.size > 5000000) return showToast("Image too large (max 5MB)");
    const rd = new FileReader();
    rd.onloadend = async () => {
      const dataUrl = rd.result; setOcrLoading(true); showToast("AI analyzing receipt image…");
      try {
        const base64Data = dataUrl.split(",")[1];
        const mimeType = dataUrl.split(";")[0].split(":")[1] || "image/png";
        const response = await fetch("/api/scan-receipt", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ base64Data, mimeType })
        });
        const parsed = await response.json();
        if (!response.ok) throw new Error(parsed?.error || "Scan failed");
        setForm(f => ({ ...f, merchant: parsed.merchant || "Extracted Receipt", amount: parsed.amount ? String(parsed.amount) : "0.00", date: parsed.date || new Date().toISOString().split("T")[0], category: parsed.category || "lifestyle", image: dataUrl, taxYear }));
        setShowScan(false); setShowReceipt(true);
        showToast(`AI Extracted: ${parsed.merchant || "Receipt"} · RM ${parsed.amount || "0"}`);
      } catch (err) {
        // Honest failure — drop into manual entry with the photo attached rather
        // than silently faking merchant/amount/category.
        console.error("AI scan failed:", err);
        setForm(f => ({ ...f, image: dataUrl, taxYear }));
        setShowScan(false); setShowReceipt(true);
        showToast("AI scan failed — fill in the details manually below");
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

  if (view === "loading") return <div className="flex items-center justify-center h-screen text-gray-400 text-sm">Loading Tax Diary…</div>;

  if (view === "onboard") {
    const sl = SLIDES[slideIdx];
    return (
      <div className={`fixed inset-0 bg-gradient-to-br ${sl.bg} flex flex-col justify-between overflow-hidden select-none`} onTouchStart={onTS} onTouchEnd={onTE}>
        <div className="flex justify-between items-center p-6 z-10">
          <div className="flex items-center gap-2">
            <img src="/icons/icon-512.png" alt="Tax Diary" className="w-9 h-9 rounded-xl object-contain bg-white/90 p-0.5" />
            <img src="/brand/wordmark.png" alt="Tax Diary" className="h-6 w-auto" />
          </div>
          <button onClick={doneOnboard} className="text-gray-300 text-xs font-bold px-3 py-1.5 rounded-full bg-white/10 border border-white/20">Skip</button>
        </div>
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center space-y-4">
            <div className="text-5xl">{sl.badge.slice(0, 2)}</div>
            <p className="text-pink-300 text-xs font-bold tracking-widest uppercase">{sl.badge.slice(3)}</p>
            <h1 className="text-4xl font-black text-white leading-tight whitespace-pre-line">{sl.headline}</h1>
            <p className="text-gray-300 text-sm leading-relaxed max-w-xs mx-auto">{sl.body}</p>
          </div>
        </div>
        <div className="p-8 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex gap-2">{SLIDES.map((_, i) => (<button key={i} onClick={() => setSlideIdx(i)} className={`rounded-full transition-all ${slideIdx === i ? "w-8 h-2.5 bg-pink-400" : "w-2.5 h-2.5 bg-white/30"}`} />))}</div>
            <button onClick={() => slideIdx < SLIDES.length - 1 ? setSlideIdx(p => p + 1) : doneOnboard()} className="w-14 h-14 rounded-full bg-white text-gray-950 font-bold flex items-center justify-center shadow-xl hover:bg-pink-400 transition active:scale-95">
              <ArrowRight className="w-6 h-6 stroke-[2.5]" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-100 via-purple-50 to-fuchsia-50 font-sans flex flex-col">
      {toast && (
        <div className="fixed bottom-5 right-5 z-[100] bg-gray-900 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-2 text-xs font-semibold animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-pink-400" />{toast}
        </div>
      )}

      {/* Trial / Renewal Countdown Banner */}
      {isTrialing && (
        <div className="bg-amber-500 text-amber-950 text-center text-xs font-bold py-2 px-4 flex items-center justify-center gap-2">
          <Clock className="w-3.5 h-3.5" /> Plus trial: {trialDaysLeft} day{trialDaysLeft !== 1 ? "s" : ""} left
          <button onClick={() => openPaywall("Keep Plus Features", "Subscribe now so you never lose access when your trial ends.")} className="underline ml-1">Subscribe now — RM{PRICE.toFixed(2)}/yr</button>
        </div>
      )}
      {showRenewalBanner && (
        <div className="bg-violet-600 text-white text-center text-xs font-bold py-2 px-4 flex items-center justify-center gap-2">
          <RefreshCw className="w-3.5 h-3.5" /> Plus renews in {daysToRenewal} day{daysToRenewal !== 1 ? "s" : ""}
          <button onClick={() => openPaywall("Renew Plus", "Renew your subscription to keep your Plus features active.")} className="underline ml-1">Renew now — RM{PRICE.toFixed(2)}/yr</button>
        </div>
      )}

      {/* Install App Banner — Android shows a real install button (beforeinstallprompt);
          iOS shows manual "tap Share" instructions since iOS has no install API. */}
      {showInstallBanner && !isStandalone && (
        <div className="bg-gray-900 text-white text-xs font-bold py-2.5 px-4 flex items-center justify-center gap-3 flex-wrap">
          <Smartphone className="w-3.5 h-3.5 text-pink-400 shrink-0" />
          {isIOS ? (
            <span>Install Tax Diary: tap <strong>Share</strong> below, then <strong>"Add to Home Screen"</strong></span>
          ) : (
            <>
              <span>Install Tax Diary for quick, offline access</span>
              <button onClick={handleInstallClick} className="px-3 py-1 bg-pink-600 hover:bg-pink-500 rounded-lg">Install</button>
            </>
          )}
          <button onClick={dismissInstallBanner} className="text-gray-400 hover:text-white ml-1"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-200 px-4 py-3">
        <div className="max-w-6xl mx-auto flex justify-between items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2.5">
            <img src="/icons/icon-512.png" alt="Tax Diary" className="w-9 h-9 rounded-xl object-contain" />
            <div>
              <div className="flex items-center gap-2">
                <img src="/brand/wordmark.png" alt="Tax Diary" className="h-5 w-auto" />
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-pink-50 text-pink-700 border border-pink-200">YA {taxYear}</span>
                {isPro && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1"><Crown className="w-3 h-3" /> Plus</span>}
              </div>
              <p className="text-[10px] text-gray-400 hidden sm:block">LHDN e-Filing Relief Organizer · Budget 2026 Ready</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => { setShowSettings(false); setShowPaywall(false); setShowTools(true); }} className="px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200 flex items-center gap-1.5 text-xs font-bold">
              <Sliders className="w-4 h-4 text-pink-600" /><span className="hidden sm:inline">Tools</span>
            </button>
            {!isPro && (
              <button onClick={() => { setShowTools(false); setShowSettings(false); openPaywall("Upgrade to Plus", "Unlock AI scanning, 7-year history, Form BE sheet and more."); }} className="px-3 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-white text-xs font-bold flex items-center gap-1.5 shadow">
                <Crown className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Upgrade</span>
              </button>
            )}
            <button onClick={() => openSettings("user")} className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 border border-gray-200 flex items-center gap-1.5 text-xs font-bold">
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Persistent disclaimer — always visible, not tucked into a modal */}
      <div className="bg-gray-100 border-b border-gray-200 px-4 py-1.5 text-center">
        <p className="text-[10px] sm:text-[11px] text-gray-500 font-medium">
          ⚠️ Estimates only, not tax advice — always verify figures with LHDN / MyTax before filing.
        </p>
      </div>

      <main className="flex-1 max-w-6xl w-full mx-auto p-4 space-y-4">

        {/* Hero Banner */}
        <div className="bg-white/90 backdrop-blur-md rounded-3xl p-5 sm:p-6 shadow-xl border-2 border-pink-200/70 relative overflow-hidden space-y-4">
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-pink-200/50 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-fuchsia-200/50 rounded-full blur-2xl pointer-events-none" />

          <div className="border-b border-pink-100 pb-4 relative">
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-gray-800">Salam{clientName ? `, ${clientName}` : ""} 👋</h1>
            <p className="text-xs text-purple-500/80 font-semibold">Track YA {taxYear} reliefs · Log receipts · Maximize your refund before 31 Dec {taxYear}</p>
          </div>
          <div className="grid grid-cols-2 gap-3 relative">
            <div className={`bg-gradient-to-br ${myBalance <= 0 ? "from-pink-50 to-rose-50 border-pink-200" : "from-amber-50 to-orange-50 border-amber-200"} border p-3 rounded-2xl`}>
              <p className={`text-[10px] font-black uppercase tracking-wider ${myBalance <= 0 ? "text-pink-600" : "text-amber-600"}`}>{myBalance <= 0 ? "Est. Refund" : "Est. Balance Owed"}</p>
              <p className={`text-lg sm:text-2xl font-black mt-0.5 ${myBalance <= 0 ? "text-pink-600" : "text-amber-600"}`}>{fmt(Math.abs(myBalance), 0)}</p>
              <p className={`text-[10px] font-medium opacity-70 ${myBalance <= 0 ? "text-pink-600" : "text-amber-600"}`}>vs PCB already paid</p>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-fuchsia-50 border border-purple-200 p-3 rounded-2xl">
              <p className="text-[10px] font-black uppercase tracking-wider text-purple-600">Total Reliefs Claimed</p>
              <p className="text-lg sm:text-2xl font-black mt-0.5 text-purple-600">RM {totalReliefs.toLocaleString()}</p>
              <p className="text-[10px] font-medium opacity-70 text-purple-600">Chargeable income: RM {chargeable.toLocaleString()}</p>
            </div>
          </div>
        </div>

        {taxYear === 2026 && (
          <div className={`bg-white p-4 rounded-3xl border shadow-sm space-y-2 ${daysLeft <= 30 ? "border-red-200" : daysLeft <= 90 ? "border-orange-200" : "border-gray-200"}`}>
            <div className="flex justify-between text-xs font-bold">
              <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4 text-pink-600" /> YA 2026 Planning Window</span>
              <span className={daysLeft <= 30 ? "text-red-600" : daysLeft <= 90 ? "text-orange-500" : "text-gray-600"}>{daysLeft > 0 ? `${daysLeft} days to 31 Dec 2026` : "Year closed"}</span>
            </div>
            <div className="bg-gray-100 h-2.5 rounded-full overflow-hidden"><div className={`h-full rounded-full ${daysLeft <= 30 ? "bg-red-500" : daysLeft <= 90 ? "bg-orange-400" : "bg-pink-600"}`} style={{ width: `${yearPct}%` }} /></div>
            <div className="flex justify-between text-xs text-gray-500">
              <span>{opps.length} relief opportunities unfulfilled</span>
              <span className="font-bold text-pink-700">RM {opps.reduce((s, c) => s + c.rem, 0).toLocaleString()} available</span>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <button onClick={() => { setForm(blank(taxYear)); setEditId(null); setShowReceipt(true); }} className="w-full py-3.5 px-4 rounded-2xl bg-pink-600 hover:bg-pink-500 text-white font-bold text-sm shadow flex items-center justify-center gap-2 active:scale-95 transition">
          <Plus className="w-4 h-4" /> Add Receipt
        </button>

        {/* Main Content Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          <div className="lg:col-span-2 space-y-4">
            {/* LHDN Category Breakdown */}
            <div className="space-y-3">
              <div className="flex justify-between items-center px-1">
                <h3 className="font-extrabold text-sm text-gray-800">LHDN Relief Categories (YA {taxYear})</h3>
              </div>
              {GROUPS.map(g => {
                const cats = CATS.filter(c => c.g === g);
                const gS = cats.reduce((s, c) => s + getStats(c.id).spent, 0);
                const gPoolLims = {};
                let gL = 0;
                cats.forEach(c => { if (c.pool) gPoolLims[c.pool] = POOL_LIMITS[c.pool] || 0; else gL += getCatLimit(c); });
                gL += Object.values(gPoolLims).reduce((a, b) => a + b, 0);
                return (
                  <div key={g} className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
                    <button onClick={() => setExpanded(p => ({ ...p, [g]: !p[g] }))} className="w-full p-4 flex items-center justify-between bg-gray-50/80 hover:bg-gray-100 transition border-b border-gray-100">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-sm">{g} Reliefs</span>
                        {gS > 0 && <span className="text-xs px-2.5 py-0.5 rounded-full bg-pink-50 text-pink-700 font-extrabold border border-pink-200">RM {gS.toLocaleString()}</span>}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <span>Max RM {gL.toLocaleString()}</span>
                        {expanded[g] ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </button>
                    {expanded[g] && (
                      <div className="divide-y divide-gray-100">
                        {cats.map(c => {
                          const { spent, limit, rem, pct } = getStats(c.id);
                          const isMaxed = pct >= 100;
                          const estSave = Math.round(taxWithRebate(chargeable, spouseHasNoIncome) - taxWithRebate(Math.max(chargeable - rem, 0), spouseHasNoIncome));
                          return (
                            <div key={c.id} className="p-4 space-y-2 hover:bg-gray-50/40 transition">
                              <div className="flex justify-between items-start">
                                <div>
                                  <p className="font-bold text-sm flex items-center gap-1.5"><span>{c.emoji}</span> {c.name}</p>
                                  <p className="text-xs text-gray-400">{c.note}</p>
                                </div>
                                <div className="text-right text-xs">
                                  {spent > 0 ? <p className="font-extrabold text-pink-700">RM {spent.toLocaleString()}</p> : <p className="text-gray-400 font-medium">RM 0.00</p>}
                                  {isMaxed ? <span className="text-emerald-600 font-bold text-[10px] flex items-center gap-0.5 justify-end mt-0.5"><CheckCircle2 className="w-3 h-3" /> Maxed</span> : <span className="text-gray-400 text-[10px]">RM {rem.toLocaleString()} remaining</span>}
                                </div>
                              </div>
                              <div className="bg-gray-100 h-2 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full transition-all ${isMaxed ? "bg-emerald-500" : spent > 0 ? "bg-fuchsia-600" : "bg-transparent"}`} style={{ width: `${pct}%` }} />
                              </div>
                              {!isMaxed && rem > 0 && (
                                <div className="flex items-center justify-between text-xs bg-pink-50/60 p-2 rounded-xl border border-pink-100 gap-2">
                                  <span className="text-[11px] text-pink-900 font-medium flex items-center gap-1 flex-wrap">
                                    <Sparkles className="w-3 h-3 text-pink-600" /> <strong>RM {rem.toLocaleString()}</strong> unclaimed
                                    {isPro ? (
                                      <span className="text-amber-700 font-bold">· saves ~RM {estSave.toLocaleString()} tax</span>
                                    ) : (
                                      <button onClick={() => openPaywall("Personalized Tax-Savings Estimate", "See exactly how much tax you'd save by maxing out each relief category.")} className="text-gray-400 font-bold flex items-center gap-0.5"><Lock className="w-2.5 h-2.5" /> see RM saved</button>
                                    )}
                                  </span>
                                  {c.isAuto ? (
                                    <button onClick={() => openSettings("income")} className="text-[11px] font-bold text-pink-700 hover:underline shrink-0">Edit in Settings</button>
                                  ) : (
                                    <button onClick={() => { setForm({ ...blank(taxYear), category: c.id }); setShowReceipt(true); }} className="text-[11px] font-bold text-pink-700 hover:underline shrink-0">+ Add Receipt</button>
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
            <div className="bg-white rounded-3xl p-5 border border-gray-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <h4 className="font-extrabold text-sm flex items-center gap-2"><Sparkles className="w-4 h-4 text-pink-600" /> Top Relief Opportunities</h4>
                <span className="text-[10px] bg-pink-50 text-pink-700 font-bold px-2 py-0.5 rounded-full border border-pink-200">YA {taxYear}</span>
              </div>
              {opps.length === 0 ? (
                <p className="text-xs text-pink-600 font-semibold text-center py-2">🎉 All categories have entries!</p>
              ) : (
                <div className="space-y-2.5">
                  {opps.slice(0, 4).map(c => (
                    <div key={c.id} className="p-3 rounded-2xl bg-gray-50 border border-gray-100 hover:border-pink-200 transition space-y-1.5">
                      <div className="flex justify-between items-start text-xs">
                        <span className="font-bold text-gray-800">{c.emoji} {c.name}</span>
                        <span className="font-extrabold text-pink-700">RM {c.rem.toLocaleString()}</span>
                      </div>
                      <p className="text-[11px] text-gray-500">{c.note}</p>
                      {c.isAuto ? (
                        <button onClick={() => openSettings("income")} className="w-full py-1.5 rounded-xl bg-pink-50 hover:bg-pink-100 text-pink-800 font-bold text-[11px] border border-pink-200 flex items-center justify-center gap-1">Edit in Settings</button>
                      ) : (
                        <button onClick={() => { setForm({ ...blank(taxYear), category: c.id }); setShowReceipt(true); }} className="w-full py-1.5 rounded-xl bg-pink-50 hover:bg-pink-100 text-pink-800 font-bold text-[11px] border border-pink-200 flex items-center justify-center gap-1"><Plus className="w-3 h-3" /> Add Receipt</button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>
      </main>

      {/* ── Tools Hub Modal ─────────────────────────────────────────────────── */}
      {showTools && (
        <div className="fixed inset-0 z-[65] bg-gray-900/60 backdrop-blur-sm overflow-y-auto p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 mx-auto my-8">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <div>
                <h3 className="font-extrabold text-base flex items-center gap-2"><Sliders className="w-5 h-5 text-pink-600" /> Tools</h3>
                <p className="text-xs text-gray-400">Receipt Vault · Checklist · Planner · Form BE · Spouse Strategy</p>
              </div>
              <button onClick={() => setShowTools(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>

            {!isPro && (
              <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-3xl p-5 text-white shadow-md space-y-3">
                <div className="flex items-center gap-2 font-bold text-sm"><Crown className="w-4 h-4" /> Try Plus Free for 7 Days</div>
                <p className="text-xs text-amber-50 leading-relaxed">AI receipt scanning, Audit-Ready Checklist, Form BE copy sheet, tax-savings estimates & multi-device sync.</p>
                <button onClick={() => { setShowTools(false); openPaywall("Upgrade to Plus", "Unlock AI scanning, 7-year history, Form BE sheet and more.", () => setShowTools(true)); }} className="w-full py-2 bg-white text-amber-700 rounded-xl text-xs font-extrabold">See Plus Features</button>
              </div>
            )}

            {/* Donation — separate ask from Plus, only shown to free users. If you've already subscribed
                to Plus you're already supporting the project, so this doesn't need to appear for you too. */}
            {!isPro && (
              <div className="bg-white rounded-3xl p-5 border border-gray-200 shadow-sm space-y-2">
                <div className="flex items-center gap-2 font-bold text-sm text-gray-800"><Heart className="w-4 h-4 text-rose-500" /> Just here to support the project?</div>
                <p className="text-xs text-gray-500 leading-relaxed">No pressure to subscribe — if you'd rather just chip in to keep this app running, that's welcome too. Doesn't unlock anything, just goodwill.</p>
                <a href={DONATION_URL} target="_blank" rel="noreferrer" className="w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition"><Heart className="w-3.5 h-3.5 text-rose-500" /> Buy me a coffee</a>
              </div>
            )}

            {/* Tool launcher grid */}
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => { setShowTools(false); isPro ? setShowAuditCheck(true) : openPaywall("Audit-Ready Checklist", "A quick self-check so your claims are well-documented before you file.", () => setShowTools(true)); }} className="p-3 rounded-2xl bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-800 font-bold text-xs flex flex-col items-center gap-1.5 text-center">
                {isPro ? <ShieldCheck className="w-5 h-5 text-pink-600" /> : <Lock className="w-4 h-4 text-amber-500" />} Checklist
              </button>
              <button onClick={() => { setShowTools(false); setShowScenario(true); }} className="p-3 rounded-2xl bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-800 font-bold text-xs flex flex-col items-center gap-1.5 text-center">
                <Briefcase className="w-5 h-5 text-violet-600" /> Other Income
              </button>
              <button onClick={() => { setShowTools(false); isPro ? setShowFormBE(true) : openPaywall("LHDN Form BE Copy Sheet", "Get your relief totals mapped straight to Form BE lines D1–D18, ready to paste into MyTax.", () => setShowTools(true)); }} className="p-3 rounded-2xl bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-800 font-bold text-xs flex flex-col items-center gap-1.5 text-center">
                {isPro ? <FileText className="w-5 h-5 text-pink-600" /> : <Lock className="w-4 h-4 text-amber-500" />} Form BE Sheet
              </button>
              <button onClick={() => { setShowTools(false); setShowSpouseDetail(true); }} className="p-3 rounded-2xl bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-800 font-bold text-xs flex flex-col items-center gap-1.5 text-center">
                <Heart className="w-5 h-5 text-rose-500" /> Spouse Strategy
              </button>
              <button onClick={() => { setShowTools(false); openVault(() => setShowTools(true)); }} className="p-3 rounded-2xl bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-800 font-bold text-xs flex flex-col items-center gap-1.5 text-center">
                <Receipt className="w-5 h-5 text-pink-600" /> Receipt Vault
              </button>
            </div>

            {/* Compliance & Vault Years */}
            <div className="bg-gradient-to-br from-gray-900 to-pink-950 rounded-3xl p-5 text-white shadow-md space-y-3">
              <div className="flex items-center gap-2 text-amber-300 font-bold text-xs border-b border-white/10 pb-2"><Archive className="w-4 h-4" /> LHDN 7-Year Vault Compliance</div>
              <p className="text-xs text-gray-300 leading-relaxed">Section 82A, ITA 1967: retain all receipts for <strong>7 years</strong> after the relevant YA.</p>
              <button onClick={() => { setShowTools(false); openSettings("audit", () => setShowTools(true)); }} className="w-full py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border border-white/20 transition"><Archive className="w-3.5 h-3.5" /> Manage Vault Years</button>
              <a href="https://mytax.hasil.gov.my" target="_blank" rel="noreferrer" className="w-full py-2 bg-pink-700 hover:bg-pink-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition"><ExternalLink className="w-3.5 h-3.5" /> MyTax Official Portal</a>
            </div>


          </div>
        </div>
      )}

      {/* ── Audit-Ready Checklist Modal ────────────────────────────────────── */}
      {showAuditCheck && (
        <div className="fixed inset-0 z-[70] bg-gray-900/60 backdrop-blur-sm overflow-y-auto p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 mx-auto my-8">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <h3 className="font-bold text-base flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-pink-600" /> Audit-Ready Checklist</h3>
              <button onClick={() => { setShowAuditCheck(false); setShowTools(true); }}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="bg-pink-50 border border-pink-200 rounded-2xl p-4 text-center space-y-1">
              <p className="text-xs font-bold text-pink-800">Documentation Score</p>
              <p className="text-3xl font-black text-pink-700">{auditHealthScore.score}%</p>
              <p className="text-[11px] text-pink-600">{auditHealthScore.score >= 90 ? "Nicely done — your claims are well documented." : "A few things worth tidying up before you file."}</p>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-bold text-gray-700">Worth double-checking:</p>
              {auditHealthScore.flags.length === 0 ? (
                <p className="text-xs text-pink-600 font-semibold p-3 bg-gray-50 rounded-xl">✓ All claims have attached receipt images and reasonable claim amounts.</p>
              ) : (
                auditHealthScore.flags.map((f, i) => (
                  <div key={i} className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${f.level === "warn" ? "bg-amber-50 border-amber-200 text-amber-900" : "bg-gray-50 border-gray-200 text-gray-700"}`}>
                    <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                    <span>{f.msg}</span>
                  </div>
                ))
              )}
            </div>
            <button onClick={() => exportCSV(true)} className="w-full py-3 bg-pink-600 hover:bg-pink-500 text-white font-extrabold rounded-2xl text-xs flex items-center justify-center gap-2 shadow">
              <FileText className="w-4 h-4" /> Download Checklist Summary (PDF)
            </button>
          </div>
        </div>
      )}

      {/* ── Other Income (Side Hustle & Rental) Modal — free, feeds real tax calc ───────── */}
      {showScenario && (
        <div className="fixed inset-0 z-[70] bg-gray-900/60 backdrop-blur-sm overflow-y-auto p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 mx-auto my-8">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <h3 className="font-bold text-base flex items-center gap-2"><Briefcase className="w-5 h-5 text-violet-600" /> Other Income</h3>
              <button onClick={() => { setShowScenario(false); setShowTools(true); }}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <p className="text-xs text-gray-500">If you have side business, freelance, or rental income alongside your salary, enter it here so your reliefs, refund, and Spouse tab all reflect your real total income.</p>

            <div className="space-y-3">
              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 space-y-2">
                <p className="font-bold text-xs text-gray-800 flex items-center gap-1.5"><DollarSign className="w-4 h-4 text-violet-600" /> Side Business / Freelance (Form B)</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><label className="text-[11px] font-semibold text-gray-600 block mb-1 min-h-[28px] leading-tight">Gross Side Income (RM)</label><input type="number" value={sideHustleInc} onChange={e => setSideHustleInc(e.target.value)} className="w-full p-2.5 rounded-xl border border-gray-200 font-bold outline-none focus:ring-2 focus:ring-violet-400 bg-white" /></div>
                  <div><label className="text-[11px] font-semibold text-gray-600 block mb-1 min-h-[28px] leading-tight">Claimable Expenses (RM)</label><input type="number" value={sideHustleExp} onChange={e => setSideHustleExp(e.target.value)} className="w-full p-2.5 rounded-xl border border-gray-200 font-bold outline-none focus:ring-2 focus:ring-violet-400 bg-white" /></div>
                </div>
              </div>

              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 space-y-2">
                <p className="font-bold text-xs text-gray-800 flex items-center gap-1.5"><Home className="w-4 h-4 text-pink-600" /> Rental Property Income</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><label className="text-[11px] font-semibold text-gray-600 block mb-1 min-h-[28px] leading-tight">Rental Collected (RM)</label><input type="number" value={rentalInc} onChange={e => setRentalInc(e.target.value)} className="w-full p-2.5 rounded-xl border border-gray-200 font-bold outline-none focus:ring-2 focus:ring-violet-400 bg-white" /></div>
                  <div><label className="text-[11px] font-semibold text-gray-600 block mb-1 min-h-[28px] leading-tight">Repairs & Assessment (RM)</label><input type="number" value={rentalExp} onChange={e => setRentalExp(e.target.value)} className="w-full p-2.5 rounded-xl border border-gray-200 font-bold outline-none focus:ring-2 focus:ring-violet-400 bg-white" /></div>
                </div>
              </div>

              <div className="p-4 bg-violet-50 border border-violet-200 rounded-2xl space-y-2 text-xs text-violet-950">
                <div className="flex justify-between"><span>Employment Income:</span><span className="font-bold">RM {scenarioCalc.grossEmp.toLocaleString()}</span></div>
                <div className="flex justify-between"><span>Net Side Business Profit:</span><span className="font-bold text-violet-700">+ RM {scenarioCalc.netSide.toLocaleString()}</span></div>
                <div className="flex justify-between"><span>Net Taxable Rental Income:</span><span className="font-bold text-violet-700">+ RM {scenarioCalc.netRent.toLocaleString()}</span></div>
                <div className="border-t border-violet-200 pt-2 flex justify-between font-black text-sm"><span>Combined Taxable Income:</span><span>RM {scenarioCalc.totalTaxable.toLocaleString()}</span></div>
              </div>

              {scenarioCalc.isConnected ? (
                <div className="p-3.5 bg-pink-50 border border-pink-200 rounded-2xl space-y-2">
                  <p className="text-xs font-bold text-pink-800 flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" /> Included in your tax calculation</p>
                  <p className="text-[11px] text-pink-700">Your dashboard, refund/owed, and Spouse tab all currently include this RM {scenarioCalc.netOther.toLocaleString()} as real income.</p>
                  <button onClick={() => setOtherIncomeAmt("0")} className="w-full py-2 rounded-xl bg-white border border-pink-300 text-pink-700 font-bold text-xs">Remove From My Tax Calculation</button>
                </div>
              ) : (
                <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-2xl space-y-2">
                  <p className="text-[11px] text-gray-500">This is a what-if sandbox — it doesn't affect your real numbers until you connect it below.</p>
                  <button onClick={() => setOtherIncomeAmt(String(scenarioCalc.netOther))} disabled={scenarioCalc.netOther <= 0} className="w-full py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs disabled:opacity-40 disabled:cursor-not-allowed">Include RM {scenarioCalc.netOther.toLocaleString()} in My Tax Calculation</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Paywall Modal ─────────────────────────────────────────────────── */}
      {showPaywall && (
        <div className="fixed inset-0 z-[90] bg-gray-900/70 backdrop-blur-sm overflow-y-auto p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl overflow-hidden mx-auto my-8">
            <div className="p-6 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-extrabold text-lg text-gray-900 flex items-center gap-2"><Crown className="w-5 h-5 text-amber-500" /> Upgrade to Plus</h3>
                <button onClick={closePaywall}><X className="w-5 h-5 text-gray-400" /></button>
              </div>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                <p className="text-sm font-bold text-amber-900">Plus Feature: {paywallCtx.title}</p>
                <p className="text-xs text-amber-700 mt-0.5">{paywallCtx.desc}</p>
              </div>
              <div className="bg-gray-900 rounded-2xl p-5 text-white space-y-2">
                <span className="font-bold text-sm text-gray-200">Plus Subscription</span>
                <div className="flex items-end gap-2 flex-wrap">
                  <span className="text-amber-400 font-black text-2xl leading-none">RM {PRICE.toFixed(2)}</span>
                  <span className="text-gray-400 text-xs pb-0.5">/year</span>
                </div>
                <div className="space-y-3 text-xs pt-1">
                  {[
                    { group: "📸 Let AI do the work", items: [
                      "AI Receipt Scanner",
                      "Personalized Tax-Savings Estimates",
                    ]},
                    { group: "🗂️ Keep your records safe", items: [
                      "7-Year LHDN Cloud Vault",
                      "Multi-Device Cloud Sync",
                    ]},
                    { group: "📋 Be ready for tax season", items: [
                      "Form BE Auto-Copy Sheet (D1–D18)",
                      "CSV & PDF Audit File Export",
                      "Audit-Ready Checklist & Summary Export",
                    ]},
                    ...(hasSpouse ? [{ group: "💑 For married couples", items: [
                      "Advanced Spouse Strategy & Shared Claim Division",
                    ]}] : []),
                  ].map(({ group, items }) => (
                    <div key={group} className="space-y-1">
                      <p className="text-[10px] font-black uppercase tracking-wider text-amber-300/90">{group}</p>
                      {items.map(f => (
                        <div key={f} className="flex items-center gap-2 text-gray-200 pl-1"><Check className="w-3.5 h-3.5 text-pink-400 shrink-0" /> {f}</div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
              {!billing.trialUsed ? (
                <div className="space-y-2">
                  <button onClick={startTrial} className="w-full py-3.5 rounded-2xl bg-pink-600 hover:bg-pink-500 text-white font-extrabold transition shadow-md">Start 7-Day Free Trial</button>
                  <button onClick={subscribe} className="w-full py-2.5 rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs transition">Skip trial, subscribe now — RM{PRICE.toFixed(2)}/yr</button>
                </div>
              ) : (
                <button onClick={subscribe} className="w-full py-3.5 rounded-2xl bg-pink-600 hover:bg-pink-500 text-white font-extrabold transition shadow-md">Subscribe to Plus — RM{PRICE.toFixed(2)}/yr</button>
              )}
              <button onClick={closePaywall} className="w-full py-2.5 rounded-xl bg-white text-gray-500 font-bold text-xs">Continue with Basic (Free) Plan</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Form BE Copy Sheet Modal ────────────────────────────────────────── */}
      {showFormBE && (
        <div className="fixed inset-0 z-[70] bg-gray-900/60 backdrop-blur-sm overflow-y-auto p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl mx-auto my-8 overflow-hidden">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-pink-100 text-pink-700 rounded-2xl shrink-0"><Sparkles className="w-5 h-5" /></div>
                <div>
                  <h3 className="font-black text-gray-900 text-base leading-tight">Form BE Auto-Copy Helper</h3>
                  <p className="text-[11px] text-gray-500">Tahun Taksiran {taxYear} · Form BE / MyTax Direct Mapping</p>
                </div>
              </div>
              <button onClick={() => { setShowFormBE(false); setShowTools(true); }}><X className="w-5 h-5 text-gray-400 shrink-0" /></button>
            </div>

            <div className="bg-amber-50 border-b border-amber-100 px-5 py-3 flex items-center justify-between gap-3 text-xs text-amber-900">
              <span className="flex items-center gap-1.5 font-medium"><ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" /> Values are capped to official statutory limits automatically.</span>
              <a href="https://mytax.hasil.gov.my" target="_blank" rel="noreferrer" className="font-bold text-amber-950 flex items-center gap-1 hover:underline shrink-0">Open MyTax <ExternalLink className="w-3 h-3" /></a>
            </div>

            <div className="p-5 space-y-5">
              <div>
                <h4 className="text-[10px] font-black uppercase tracking-wider text-gray-400 border-b border-gray-100 pb-1 mb-2">Bahagian C: Pendapatan Tolakan &amp; Pelepasan</h4>
                <div className="p-3.5 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-bold text-gray-800 text-xs">C1: Penggajian (Employment Income)</p>
                    <p className="text-[10px] text-gray-400">Match EA Form Line C</p>
                  </div>
                  <button onClick={() => { navigator.clipboard?.writeText(String(Math.round(parseFloat(income) || 0))); showToast(`C1 copied: RM ${(parseFloat(income) || 0).toLocaleString()}`); }} className="shrink-0 flex flex-col items-end gap-1">
                    <span className="font-extrabold text-gray-900 text-xs">RM {(parseFloat(income) || 0).toLocaleString()}</span>
                    <span className="px-2.5 py-1 bg-white border border-gray-200 rounded-lg font-bold text-[10px] flex items-center gap-1 hover:border-pink-400"><ClipboardCopy className="w-3 h-3" /> Copy</span>
                  </button>
                </div>
              </div>

              <div>
                <h4 className="text-[10px] font-black uppercase tracking-wider text-gray-400 border-b border-gray-100 pb-1 mb-2">Bahagian D: Pelepasan Cukai (Tax Reliefs)</h4>
                <div className="space-y-2">
                  {[{ line: "D1", label: "Individu dan Saudara Tanggungan", en: "Self relief", val: 9000, limit: 9000 }, ...CATS.map(c => ({ line: c.beLine, label: c.nameBM || c.name, en: c.name, val: getSpent(c.id), limit: getCatLimit(c) }))]
                    .map(r => (
                      <div key={r.line} className={`p-3 rounded-2xl border flex items-center justify-between gap-2 ${r.val > 0 ? "bg-gray-50 border-gray-100" : "bg-white border-gray-100 opacity-70"}`}>
                        <div className="min-w-0">
                          <p className="font-bold text-gray-800 text-xs">{r.line}: {r.label}</p>
                          <p className="text-[10px] text-gray-400">Statutory Cap: RM {r.limit.toLocaleString()}</p>
                        </div>
                        <button onClick={() => { navigator.clipboard?.writeText(String(r.val)); showToast(`${r.line} copied: RM ${r.val.toLocaleString()}`); }} className="shrink-0 flex flex-col items-end gap-1">
                          <span className={`font-extrabold text-xs ${r.val > 0 ? "text-gray-900" : "text-gray-400"}`}>RM {r.val.toLocaleString()}</span>
                          <span className="px-2.5 py-1 bg-white border border-gray-200 rounded-lg font-bold text-[10px] flex items-center gap-1 hover:border-pink-400"><ClipboardCopy className="w-3 h-3" /> Copy</span>
                        </button>
                      </div>
                    ))}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end">
              <button onClick={() => { setShowFormBE(false); setShowTools(true); }} className="px-6 py-2.5 bg-gray-900 hover:bg-gray-800 text-white text-xs font-bold rounded-xl">Done</button>
            </div>
          </div>
        </div>
      )}


      {/* ── Receipt Vault Modal (split out of Tools) ─────────────────────────── */}
      {showVault && (
        <div className="fixed inset-0 z-[70] bg-gray-900/60 backdrop-blur-sm overflow-y-auto p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 mx-auto my-8">
            <div className="flex justify-end">
              <button onClick={closeVault}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="bg-white rounded-3xl p-5 border border-gray-200 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-gray-100 pb-3">
                <div>
                  <h3 className="font-bold text-base flex items-center gap-2"><Receipt className="w-5 h-5 text-pink-600" /> YA {taxYear} Receipt Vault</h3>
                  <p className="text-xs text-gray-400">Keep digital proof for 7 years (LHDN Section 82A audit requirement)</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => exportCSV(false)} className="px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs flex items-center gap-1.5">
                    <Download className="w-3.5 h-3.5" /> CSV
                  </button>
                  <button onClick={() => exportCSV(true)} className="px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs flex items-center gap-1.5">
                    {isPro ? <FileText className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5 text-amber-500" />} PDF
                  </button>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
                  <input value={rcptSearch} onChange={e => setRcptSearch(e.target.value)} placeholder="Search vendor…" className="pl-8 pr-3 py-2 rounded-xl border border-gray-200 text-xs w-full outline-none focus:ring-2 focus:ring-pink-400" />
                </div>
                <button onClick={() => { setShowVault(false); setShowFilterPick(true); }} className="px-3 py-2 rounded-xl border border-gray-200 text-xs bg-white font-medium flex items-center justify-between gap-2 hover:bg-gray-50 transition min-w-[140px]">
                  <span className="truncate">{rcptCatF === "all" ? "All Categories" : getCat(rcptCatF)?.name || rcptCatF}</span>
                  <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                </button>
              </div>

              {filteredR.length === 0 ? (
                <div className="p-8 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200 space-y-2">
                  <Archive className="w-8 h-8 text-gray-300 mx-auto" />
                  <p className="text-xs font-bold text-gray-600">No receipts for YA {taxYear}</p>
                  <p className="text-[11px] text-gray-400">Add receipts or use AI OCR to scan and auto-fill.</p>
                  <div className="flex gap-2 justify-center pt-1">
                    <button onClick={() => { setForm(blank(taxYear)); setShowVault(false); openReceiptModal(() => setShowVault(true)); }} className="px-4 py-2 bg-pink-600 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Add</button>
                    <button onClick={() => isPro ? (() => { setShowVault(false); setReceiptReturnTo(() => () => setShowVault(true)); openScan(() => setShowReceipt(true)); })() : (() => { setShowVault(false); openPaywall("AI Receipt Scanner", "Snap a receipt and let AI fill in the details for you.", () => setShowVault(true)); })()} className="px-4 py-2 bg-gray-800 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1">{isPro ? <Zap className="w-3.5 h-3.5 text-pink-400" /> : <Lock className="w-3.5 h-3.5 text-amber-400" />} AI Scan</button>
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {filteredR.map(r => {
                    const c = getCat(r.category);
                    return (
                      <div key={r.id} className="py-3 flex items-center justify-between text-xs hover:bg-gray-50/60 transition rounded-xl px-1">
                        <div className="flex items-center gap-3 min-w-0">
                          {r.image ? (
                            <button onClick={() => setPreviewImage({ src: r.image, merchant: r.merchant || "Expense Receipt" })} className="shrink-0">
                              <img src={r.image} alt="Receipt" className="w-10 h-10 rounded-xl object-cover border border-gray-200" />
                            </button>
                          ) : <div className="w-10 h-10 rounded-xl bg-pink-50 text-pink-700 border border-pink-100 flex items-center justify-center shrink-0"><Receipt className="w-5 h-5" /></div>}
                          <div className="min-w-0">
                            <p className="font-extrabold text-gray-800 truncate">{r.merchant || "Expense Receipt"}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{c?.name || r.category}</span>
                              <span className="text-[10px] text-gray-400">{r.date}</span>
                              {hasSpouse && isPro && r.owner && r.owner !== "joint" && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-100">{r.owner === "mine" ? "Mine" : "Spouse"}</span>}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-2 shrink-0">
                          <span className="font-extrabold text-pink-700 text-sm">RM {r.amount.toLocaleString()}</span>
                          <button onClick={() => startEdit(r)} className="p-1.5 rounded-lg text-gray-400 hover:text-pink-600"><Edit2 className="w-3.5 h-3.5" /></button>
                          <button onClick={() => handleDelete(r.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-rose-500"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Detailed Household Assessment Modal (split out of Settings, married + Plus) ──── */}
      {showSpouseDetail && (
        <div className="fixed inset-0 z-[70] bg-gray-900/60 backdrop-blur-sm overflow-y-auto p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 mx-auto my-8">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <div>
                <h3 className="font-extrabold text-base flex items-center gap-2"><Heart className="w-5 h-5 text-rose-500" /> Detailed Household Assessment</h3>
                <p className="text-xs text-gray-400">Separate vs Joint, category-by-category (married couples)</p>
              </div>
              <button onClick={() => { setShowSpouseDetail(false); setShowTools(true); }}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            {!hasSpouse ? (
              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 text-xs text-gray-500 space-y-2">
                <p>Spouse tools apply once you're set as married.</p>
                <button onClick={() => { setShowSpouseDetail(false); setMaritalStatus("married"); openSettings("user", () => setShowSpouseDetail(true)); }} className="text-pink-700 font-bold underline">Set marital status to Married in Profile</button>
              </div>
            ) : !isPro ? (
              <button onClick={() => { setShowSpouseDetail(false); openPaywall("Detailed Household Assessment", "See a full category-by-category breakdown of who should claim what, not just the aggregate number.", () => setShowSpouseDetail(true)); }} className="w-full py-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold text-xs border border-amber-200 flex items-center justify-center gap-1.5"><Lock className="w-3.5 h-3.5" /> Unlock Detailed Analysis</button>
            ) : spouseAnalysisDetailed && (
                        <div className="space-y-3">
                          <div className={`p-3 rounded-2xl border ${spouseAnalysisDetailed.recommended === "SEPARATE" ? "bg-pink-50 border-pink-300" : "bg-rose-50 border-rose-200"}`}>
                            <div className="flex items-center gap-1.5">
                              <CheckCircle2 className="w-4 h-4 text-pink-600 shrink-0" />
                              <p className="font-extrabold text-sm text-gray-900">Recommended: {spouseAnalysisDetailed.recommended === "SEPARATE" ? "Separate Assessment" : spouseAnalysisDetailed.recommended === "JOINT" ? "Joint Assessment" : "Either — same result"}</p>
                            </div>
                            <p className="text-[11px] text-gray-600 mt-0.5">{spouseAnalysisDetailed.reasoning}</p>
                          </div>

                          {/* Separate Assessment — full per-person breakdown table */}
                          <div className={`rounded-2xl border overflow-hidden ${spouseAnalysisDetailed.recommended === "SEPARATE" ? "border-pink-300 ring-1 ring-pink-200" : "border-gray-200 opacity-90"}`}>
                            <div className="px-3 py-2 bg-gray-900 text-white flex items-center justify-between">
                              <span className="font-bold text-xs">Option A — Separate Assessment</span>
                              {spouseAnalysisDetailed.recommended === "SEPARATE" && <span className="text-[9px] bg-pink-500 px-2 py-0.5 rounded-full font-bold">Recommended</span>}
                            </div>
                            <table className="w-full text-[11px]">
                              <thead>
                                <tr className="bg-gray-50 text-gray-500 font-semibold">
                                  <th className="text-left px-3 py-1.5 font-semibold">Item</th>
                                  <th className="text-right px-3 py-1.5 font-semibold">You</th>
                                  <th className="text-right px-3 py-1.5 font-semibold">{spouseName || "Spouse"}</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                <tr><td className="px-3 py-1.5 text-gray-600">Gross Income</td><td className="px-3 py-1.5 text-right font-semibold">RM {spouseAnalysisDetailed.separate.grossMine.toLocaleString()}</td><td className="px-3 py-1.5 text-right font-semibold">RM {spouseAnalysisDetailed.separate.grossSpouse.toLocaleString()}</td></tr>
                                <tr><td className="px-3 py-1.5 text-gray-600">Total Reliefs Claimed</td><td className="px-3 py-1.5 text-right text-pink-700 font-semibold">-RM {spouseAnalysisDetailed.separate.selfReliefs.toLocaleString()}</td><td className="px-3 py-1.5 text-right text-pink-700 font-semibold">-RM {spouseAnalysisDetailed.separate.spouseReliefs.toLocaleString()}</td></tr>
                                <tr><td className="px-3 py-1.5 text-gray-800 font-semibold">Chargeable Income</td><td className="px-3 py-1.5 text-right font-bold">RM {spouseAnalysisDetailed.separate.chargeableSelfSep.toLocaleString()}</td><td className="px-3 py-1.5 text-right font-bold">RM {spouseAnalysisDetailed.separate.chargeableSpouseSep.toLocaleString()}</td></tr>
                                <tr className="bg-gray-50"><td className="px-3 py-1.5 font-bold text-gray-900">Tax Payable</td><td className="px-3 py-1.5 text-right font-black">RM {spouseAnalysisDetailed.separate.taxSelfSep.toLocaleString()}</td><td className="px-3 py-1.5 text-right font-black">RM {spouseAnalysisDetailed.separate.taxSpouseSep.toLocaleString()}</td></tr>
                              </tbody>
                            </table>
                            <div className="px-3 py-2 bg-white border-t border-gray-100 flex justify-between items-center">
                              <span className="text-[11px] font-semibold text-gray-600">Combined Tax:</span>
                              <span className="font-black text-pink-700 text-sm">RM {spouseAnalysisDetailed.separate.totalTax.toLocaleString()}</span>
                            </div>
                            <div className={`px-3 py-2 border-t flex justify-between items-center ${(spouseAnalysisDetailed.separate.balanceSelfSep + spouseAnalysisDetailed.separate.balanceSpouseSep) <= 0 ? "bg-pink-50 border-pink-100" : "bg-amber-50 border-amber-100"}`}>
                              <span className="text-[11px] font-semibold text-gray-600">{(spouseAnalysisDetailed.separate.balanceSelfSep + spouseAnalysisDetailed.separate.balanceSpouseSep) <= 0 ? "Est. Combined Refund:" : "Est. Combined Balance Owed:"}</span>
                              <span className="font-black text-sm">RM {Math.abs(spouseAnalysisDetailed.separate.balanceSelfSep + spouseAnalysisDetailed.separate.balanceSpouseSep).toLocaleString()}</span>
                            </div>
                          </div>

                          {/* Joint Assessment */}
                          <div className={`rounded-2xl border overflow-hidden ${spouseAnalysisDetailed.recommended === "JOINT" ? "border-pink-300 ring-1 ring-pink-200" : "border-gray-200 opacity-90"}`}>
                            <div className="px-3 py-2 bg-gray-900 text-white flex items-center justify-between">
                              <span className="font-bold text-xs">Option B — Joint Assessment</span>
                              {spouseAnalysisDetailed.recommended === "JOINT" && <span className="text-[9px] bg-pink-500 px-2 py-0.5 rounded-full font-bold">Recommended</span>}
                            </div>
                            <div className="p-3 space-y-1.5 text-[11px] bg-white">
                              <div className="flex justify-between"><span className="text-gray-600">Combined Gross Income:</span><span className="font-semibold">RM {spouseAnalysisDetailed.joint.combinedGross.toLocaleString()}</span></div>
                              <div className="flex justify-between"><span className="text-gray-600">Combined Reliefs (incl. RM4,000 spouse relief{spouseDisabled ? " + RM6,000 disabled" : ""}):</span><span className="text-pink-700 font-semibold">-RM {spouseAnalysisDetailed.joint.jointReliefTotal.toLocaleString()}</span></div>
                              <div className="flex justify-between font-semibold text-gray-800 pt-1 border-t border-gray-100"><span>Chargeable Income:</span><span>RM {spouseAnalysisDetailed.joint.chargeableJoint.toLocaleString()}</span></div>
                            </div>
                            <div className="px-3 py-2 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
                              <span className="text-[11px] font-semibold text-gray-600">Joint Tax Payable:</span>
                              <span className="font-black text-pink-700 text-sm">RM {spouseAnalysisDetailed.joint.totalTax.toLocaleString()}</span>
                            </div>
                            <div className={`px-3 py-2 border-t flex justify-between items-center ${spouseAnalysisDetailed.joint.balanceJoint <= 0 ? "bg-pink-50 border-pink-100" : "bg-amber-50 border-amber-100"}`}>
                              <span className="text-[11px] font-semibold text-gray-600">{spouseAnalysisDetailed.joint.balanceJoint <= 0 ? "Est. Refund:" : "Est. Balance Owed:"}</span>
                              <span className="font-black text-sm">RM {Math.abs(spouseAnalysisDetailed.joint.balanceJoint).toLocaleString()}</span>
                            </div>
                          </div>

                          {/* Category-by-category claim utilization, per person */}
                          <div className="p-3 rounded-2xl bg-gray-50 border border-gray-200 space-y-3">
                            <p className="font-bold text-gray-700 text-[11px]">Who's claiming what (by category)</p>
                            {spouseAnalysisDetailed.catBreakdown.filter(c => c.mine > 0 || c.spouse > 0).map(c => (
                              <div key={c.id} className="space-y-1">
                                <div className="flex justify-between text-[11px] text-gray-700 font-semibold"><span className="truncate pr-2">{c.name}</span><span className="text-gray-400 font-normal shrink-0">Cap RM {c.limit.toLocaleString()}</span></div>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[9px] text-pink-700 font-bold w-8 shrink-0">You</span>
                                  <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden"><div className="h-full bg-pink-500" style={{ width: `${Math.min(100, (c.mine / c.limit) * 100)}%` }} /></div>
                                  <span className="text-[9px] text-gray-500 w-16 text-right shrink-0">RM {c.mine.toLocaleString()}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[9px] text-rose-600 font-bold w-8 shrink-0 truncate">{(spouseName || "Spouse").slice(0, 6)}</span>
                                  <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden"><div className="h-full bg-rose-400" style={{ width: `${Math.min(100, (c.spouse / c.limit) * 100)}%` }} /></div>
                                  <span className="text-[9px] text-gray-500 w-16 text-right shrink-0">RM {c.spouse.toLocaleString()}</span>
                                </div>
                              </div>
                            ))}
                            {spouseAnalysisDetailed.catBreakdown.every(c => c.mine === 0 && c.spouse === 0) && (
                              <p className="text-[11px] text-gray-400">Tag receipts as "Mine" or "Spouse" when adding them to see the split here.</p>
                            )}
                          </div>
                        </div>
            )}
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-[60] bg-gray-900/60 backdrop-blur-sm overflow-y-auto p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 mx-auto my-8">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <div>
                <h3 className="font-extrabold text-base flex items-center gap-2"><Settings className="w-5 h-5 text-pink-600" /> Settings & Profile</h3>
                <p className="text-xs text-gray-400">Profile · Income · Spouse Optimizer · 7-Year Vault · Devices</p>
              </div>
              <button onClick={closeSettings}><X className="w-5 h-5 text-gray-400" /></button>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-5 bg-gray-100 p-1 rounded-2xl border border-gray-200 text-[11px] font-bold gap-1">
              {[["user", "👤 Profile"], ["income", "🧮 Income"], ["spouse", "❤️ Spouse"], ["audit", "🗂️ Vault"], ["sync", "📱 Devices"]].map(([tab, label]) => (
                <button key={tab} onClick={() => { setSettingsTab(tab); setPendingPull(null); }} className={`py-2 rounded-xl transition ${settingsTab === tab ? "bg-white text-pink-700 shadow-sm" : "text-gray-600 hover:text-gray-900"}`}>{label}</button>
              ))}
            </div>

            {settingsTab === "user" && (
              <div className="space-y-3 text-xs">
                <div>
                  <label className="font-bold text-gray-700 block mb-1">Your Name</label>
                  <input type="text" value={clientName} onChange={e => setClientName(e.target.value)} placeholder="e.g. Ahmad Ridzuan" className="w-full p-3 rounded-xl border border-gray-200 font-semibold outline-none focus:ring-2 focus:ring-pink-400" />
                </div>
                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 space-y-2">
                  <label className="font-bold text-gray-800 block">Marital Status</label>
                  <p className="text-[11px] text-gray-500 leading-relaxed">Controls whether spouse fields, disabled-spouse relief, and the Joint vs Separate assessment tools appear.</p>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button onClick={() => setMaritalStatus("single")} className={`py-2.5 rounded-xl border font-bold text-xs ${maritalStatus === "single" ? "bg-pink-50 border-pink-300 text-pink-700" : "bg-white border-gray-200 text-gray-500"}`}>Single</button>
                    <button onClick={() => setMaritalStatus("married")} className={`py-2.5 rounded-xl border font-bold text-xs ${maritalStatus === "married" ? "bg-pink-50 border-pink-300 text-pink-700" : "bg-white border-gray-200 text-gray-500"}`}>Married</button>
                  </div>
                </div>
                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-gray-800 text-sm">Registered OKU (Disabled)</p>
                    <p className="text-[11px] text-gray-500">Adds RM7,000 personal disability relief on top of your RM9,000 self relief</p>
                  </div>
                  <button onClick={() => setIsSelfOKU(!isSelfOKU)} className={`w-12 h-6 rounded-full flex items-center p-1 transition-colors shrink-0 ml-3 ${isSelfOKU ? "bg-pink-600 justify-end" : "bg-gray-300 justify-start"}`}><span className="w-4 h-4 bg-white rounded-full shadow" /></button>
                </div>
              </div>
            )}

            {settingsTab === "income" && (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100 space-y-3">
                  <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider">Annual Income</p>
                  <div><label className="text-xs font-bold text-gray-700 block mb-1">Employment Income — All Employers Combined (RM)</label><input type="number" value={income} onChange={e => setIncome(e.target.value)} placeholder="e.g. 91800" className="w-full p-3 rounded-xl border border-gray-200 font-bold text-sm outline-none focus:ring-2 focus:ring-pink-400 bg-white" /><p className="text-[10px] text-gray-400 mt-1">If you had more than one job this year, enter the total across all of them</p></div>
                  {parseFloat(otherIncomeAmt) > 0 && (
                    <div className="flex items-center justify-between p-2.5 bg-violet-50 border border-violet-200 rounded-xl text-xs">
                      <span className="text-violet-800 font-semibold">+ Side Hustle/Rental Income (connected)</span>
                      <span className="font-bold text-violet-900">RM {parseFloat(otherIncomeAmt).toLocaleString()}</span>
                    </div>
                  )}
                  <div><label className="text-xs font-bold text-gray-700 block mb-1">Annual EPF Contribution (RM)</label><input type="number" value={epfAmt} onChange={e => setEpfAmt(e.target.value)} placeholder="e.g. 10098" className="w-full p-3 rounded-xl border border-gray-200 font-bold text-sm outline-none focus:ring-2 focus:ring-pink-400 bg-white" /><p className="text-[10px] text-gray-400 mt-1">LHDN relief cap: RM 4,000</p></div>
                  <div><label className="text-xs font-bold text-gray-700 block mb-1">Annual SOCSO / EIS Contribution (RM)</label><input type="number" value={socsoAmt} onChange={e => setSocsoAmt(e.target.value)} placeholder="e.g. 350" className="w-full p-3 rounded-xl border border-gray-200 font-bold text-sm outline-none focus:ring-2 focus:ring-pink-400 bg-white" /><p className="text-[10px] text-gray-400 mt-1">Auto-defaulted at the RM350 cap — a payroll deduction, no receipt needed</p></div>
                  <div><label className="text-xs font-bold text-gray-700 block mb-1">Total PCB Deducted This Year (RM)</label><input type="number" value={pcbAmt} onChange={e => setPcbAmt(e.target.value)} placeholder="e.g. 3600" className="w-full p-3 rounded-xl border border-gray-200 font-bold text-sm outline-none focus:ring-2 focus:ring-pink-400 bg-white" /><p className="text-[10px] text-gray-400 mt-1">The full-year total from your EA Form (Item E) — not a monthly figure</p></div>
                  <div><label className="text-xs font-bold text-gray-700 block mb-1">Zakat Paid This Year (RM)</label><input type="number" value={zakatAmt} onChange={e => setZakatAmt(e.target.value)} placeholder="e.g. 2400" className="w-full p-3 rounded-xl border border-gray-200 font-bold text-sm outline-none focus:ring-2 focus:ring-pink-400 bg-white" /><p className="text-[10px] text-gray-400 mt-1">Offsets your tax payable directly, RM-for-RM (not a relief on chargeable income)</p></div>
                  <div>
                    <label className="text-xs font-bold text-gray-700 block mb-1">First Home Price (for Home Loan Interest relief)</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button onClick={() => setHomeLoanTier("under500k")} className={`py-2 rounded-xl border font-bold text-[11px] ${homeLoanTier === "under500k" ? "bg-pink-50 border-pink-300 text-pink-700" : "bg-white border-gray-200 text-gray-500"}`}>≤ RM500k (cap RM7,000)</button>
                      <button onClick={() => setHomeLoanTier("500to750k")} className={`py-2 rounded-xl border font-bold text-[11px] ${homeLoanTier === "500to750k" ? "bg-pink-50 border-pink-300 text-pink-700" : "bg-white border-gray-200 text-gray-500"}`}>RM500k–750k (cap RM5,000)</button>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1">Only matters if you're tracking Home Loan Interest receipts. Skip if not applicable.</p>
                  </div>
                </div>
                <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100 space-y-4">
                  <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider">Family Reliefs</p>
                  {hasSpouse && (
                    <div className="flex items-center justify-between text-xs pl-3 border-l-2 border-pink-100">
                      <div><p className="font-bold">Certified Disabled Spouse</p><p className="text-gray-400">+RM 6,000 (JKM-certified, Joint Assessment only)</p></div>
                      <button onClick={() => setSpouseDisabled(!spouseDisabled)} className={`w-12 h-6 rounded-full flex items-center p-1 transition-colors ${spouseDisabled ? "bg-pink-600 justify-end" : "bg-gray-300 justify-start"}`}><span className="w-4 h-4 bg-white rounded-full shadow" /></button>
                    </div>
                  )}
                  {[["Children under 18", "RM 2,000 each", childU18, setChildU18], ["Children Higher Edu (Diploma+/Degree/Masters/PhD)", "RM 8,000 each", childHiEduDegree, setChildHiEduDegree], ["Children Higher Edu (other full-time study)", "RM 2,000 each", childHiEduOther, setChildHiEduOther], ["Disabled Child", "RM 8,000 each", childDisabled, setChildDisabled], ["Disabled Child in Higher Edu", "+RM 8,000 more each", childDisabledHiEdu, setChildDisabledHiEdu]].map(([l, s, v, sv]) => (
                    <div key={l} className="flex items-center justify-between text-xs">
                      <div><p className="font-bold">{l}</p><p className="text-gray-400">{s}</p></div>
                      <div className="flex items-center gap-3">
                        <button onClick={() => sv(Math.max(0, v - 1))} className="w-8 h-8 rounded-full bg-gray-200 font-bold flex items-center justify-center">−</button>
                        <span className="font-extrabold text-sm w-4 text-center">{v}</span>
                        <button onClick={() => sv(v + 1)} className="w-8 h-8 rounded-full bg-pink-100 text-pink-800 font-bold flex items-center justify-center">+</button>
                      </div>
                    </div>
                  ))}
                  {(childHiEduDegree > 0 || childHiEduOther > 0) && (
                    <p className="text-[10px] text-gray-400 pl-1">The RM8,000 tier is only for Diploma level and above (incl. Masters/PhD) or a first degree overseas. Matriculation, A-Levels, and other pre-degree full-time study qualify for RM2,000 instead.</p>
                  )}
                  {(childDisabledHiEdu > 0) && (
                    <p className="text-[10px] text-gray-400 pl-1">"Disabled Child in Higher Edu" is an additional RM8,000 on top of the RM8,000 base — only count a disabled child here if they're also 18+ and in full-time diploma/degree study.</p>
                  )}
                  {hasSpouse && (childU18 + childHiEduDegree + childHiEduOther + childDisabled + childDisabledHiEdu > 0) && (
                    <div className="pl-3 border-l-2 border-pink-100 space-y-1.5">
                      <p className="text-[11px] font-bold text-gray-600">Who's claiming the children's relief?</p>
                      <p className="text-[10px] text-gray-400">LHDN requires each child be claimed by one parent only — pick whichever of you benefits more (usually the higher earner).</p>
                      <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => setChildrenClaimedBy("mine")} className={`py-2 rounded-xl border font-bold text-[11px] ${childrenClaimedBy === "mine" ? "bg-pink-50 border-pink-300 text-pink-700" : "bg-white border-gray-200 text-gray-500"}`}>You</button>
                        <button onClick={() => setChildrenClaimedBy("spouse")} className={`py-2 rounded-xl border font-bold text-[11px] truncate ${childrenClaimedBy === "spouse" ? "bg-rose-50 border-rose-300 text-rose-600" : "bg-white border-gray-200 text-gray-500"}`}>{spouseName || "Spouse"}</button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-4 rounded-2xl bg-pink-50 border border-pink-200 space-y-2 text-xs">
                  <div className="flex justify-between font-bold"><span>Tax without reliefs:</span><span>{fmt(taxBefore)}</span></div>
                  <div className="flex justify-between font-bold text-pink-700"><span>Tax payable (with reliefs):</span><span>{fmt(taxAfter)}</span></div>
                  {parseFloat(zakatAmt) > 0 && (
                    <div className="flex justify-between font-bold text-violet-700"><span>Zakat offset:</span><span>– {fmt(Math.min(parseFloat(zakatAmt) || 0, taxAfter))}</span></div>
                  )}
                  <div className="p-3 bg-pink-100 rounded-xl flex justify-between items-center mt-1">
                    <span className="font-extrabold text-xs text-pink-900 tracking-wider">YOU'RE SAVING</span>
                    <span className="font-extrabold text-xl text-pink-900">{fmt(taxSaved)}</span>
                  </div>
                  <div className={`p-3 rounded-xl flex justify-between items-center ${myBalance <= 0 ? "bg-white border border-pink-200" : "bg-amber-50 border border-amber-200"}`}>
                    <span className={`font-extrabold text-xs tracking-wider ${myBalance <= 0 ? "text-pink-900" : "text-amber-900"}`}>{myBalance <= 0 ? "ESTIMATED REFUND" : "ESTIMATED BALANCE OWED"}</span>
                    <span className={`font-extrabold text-xl ${myBalance <= 0 ? "text-pink-900" : "text-amber-900"}`}>{fmt(Math.abs(myBalance))}</span>
                  </div>
                  <p className="text-[10px] text-gray-500">Net tax payable (after zakat) minus PCB already deducted. Effective rate: {effRate}%</p>
                </div>
              </div>
            )}

            {settingsTab === "spouse" && (
              <div className="space-y-4">
                {!hasSpouse ? (
                  <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 text-xs text-gray-500 space-y-2">
                    <p>Spouse tools apply once you're set as married.</p>
                    <button onClick={() => { setMaritalStatus("married"); setSettingsTab("user"); }} className="text-pink-700 font-bold underline">Set marital status to Married in Profile</button>
                  </div>
                ) : (
                  <>
                    <p className="text-xs text-gray-500 leading-relaxed bg-gray-50 p-3 rounded-2xl border border-gray-200">
                      In Malaysia, married working couples can choose between <strong>Joint Assessment</strong> and <strong>Separate Assessment</strong>. Separate is usually better when both earn taxable income.
                    </p>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div><label className="font-bold text-gray-700 block mb-1">Your Income</label><div className="p-3 rounded-2xl bg-gray-100 font-extrabold text-sm border border-gray-200">RM {totalIncome.toLocaleString()}</div></div>
                      <div><label className="font-bold text-gray-700 block mb-1">Spouse Income</label><input type="number" value={spouseInc} onChange={e => setSpouseInc(e.target.value)} placeholder="e.g. 54000" className="w-full p-3 rounded-2xl border border-gray-200 font-extrabold text-sm outline-none focus:ring-2 focus:ring-rose-400 bg-white" /></div>
                    </div>
                    <div>
                      <label className="font-bold text-gray-700 block mb-1">Spouse Name / Label</label>
                      <input type="text" value={spouseName} onChange={e => setSpouseName(e.target.value)} placeholder="e.g. Siti, Husband, Wife" className="w-full p-2.5 rounded-2xl border border-gray-200 font-semibold text-xs outline-none focus:ring-2 focus:ring-rose-400 bg-white" />
                    </div>
                    {isPro && (
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <label className="font-bold text-gray-700 block mb-1 min-h-[32px] leading-tight">Spouse EPF (RM)</label>
                          <input type="number" value={spouseEpfAmt} onChange={e => { setSpouseEpfAmt(e.target.value); setSpouseEpfTouched(true); }} placeholder="e.g. 5940" className="w-full p-2.5 rounded-2xl border border-gray-200 font-bold text-sm outline-none focus:ring-2 focus:ring-rose-400 bg-white" />
                          <p className="text-[10px] text-gray-400 mt-1">{!spouseEpfTouched ? "Auto-filled at 11% of her income — edit if you know her real figure" : "Using your entered figure"}</p>
                        </div>
                        <div>
                          <label className="font-bold text-gray-700 block mb-1 min-h-[32px] leading-tight">Spouse PCB This Year (RM)</label>
                          <input type="number" value={spousePcbAmt} onChange={e => setSpousePcbAmt(e.target.value)} placeholder="e.g. 1400" className="w-full p-2.5 rounded-2xl border border-gray-200 font-bold text-sm outline-none focus:ring-2 focus:ring-rose-400 bg-white" />
                          <p className="text-[10px] text-gray-400 mt-1">Full-year total from her EA Form, not monthly</p>
                        </div>
                        <div>
                          <label className="font-bold text-gray-700 block mb-1 min-h-[32px] leading-tight">Spouse SOCSO / EIS (RM)</label>
                          <input type="number" value={spouseSocsoAmt} onChange={e => setSpouseSocsoAmt(e.target.value)} placeholder="e.g. 350" className="w-full p-2.5 rounded-2xl border border-gray-200 font-bold text-sm outline-none focus:ring-2 focus:ring-rose-400 bg-white" />
                          <p className="text-[10px] text-gray-400 mt-1">Auto-defaulted at the RM350 cap — edit if her actual contribution differs</p>
                        </div>
                      </div>
                    )}
                    <div className="p-4 rounded-2xl bg-pink-50 border border-pink-200 space-y-3 text-xs">
                      <p className="font-bold text-pink-900 text-sm">Quick Comparison:</p>
                      <div className="flex justify-between p-2 rounded-xl bg-white/60 border border-pink-100"><span className="text-gray-600">Joint Filing Tax:</span><span className="font-extrabold text-rose-600">RM {spouseAnalysisDetailed.joint.totalTax.toLocaleString()}</span></div>
                      <div className="flex justify-between p-2 rounded-xl bg-white/60 border border-pink-100"><span className="text-gray-600">Separate Filing:</span><span className="font-extrabold text-pink-700">RM {spouseAnalysisDetailed.separate.totalTax.toLocaleString()}</span></div>
                      <div className="pt-2 border-t border-pink-200 flex items-start gap-2">
                        <CheckCircle2 className="w-5 h-5 text-pink-600 shrink-0 mt-0.5" />
                        <div><p className="font-extrabold text-sm text-pink-800">{spouseAnalysisDetailed.recommended === "SEPARATE" ? "File Separately" : spouseAnalysisDetailed.recommended === "JOINT" ? "File Jointly" : "Either — same result"}</p><p className="text-[11px] text-pink-700 font-normal">{spouseAnalysisDetailed.savings > 0 ? `Saves RM ${spouseAnalysisDetailed.savings.toLocaleString()} in household taxes` : "Both options result in the same tax"}</p></div>
                      </div>
                    </div>

                    <div className="border-t border-gray-100 pt-4">
                      <button onClick={() => { setShowSettings(false); setShowSpouseDetail(true); }} className="w-full py-2.5 rounded-xl bg-pink-50 hover:bg-pink-100 text-pink-700 font-bold text-xs border border-pink-200 flex items-center justify-center gap-1.5">
                        <Crown className="w-3.5 h-3.5 text-amber-500" /> See Full Household Comparison
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {settingsTab === "audit" && (
              <div className="space-y-4 text-xs">
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-sm"><Archive className="w-4 h-4 text-amber-700" /> LHDN Section 82A</div>
                  <p className="text-[11px] leading-relaxed">All original receipts must be kept for <strong>7 full years</strong> after the relevant Year of Assessment.</p>
                </div>
                <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200 space-y-3">
                  <p className="font-bold text-gray-800">Select Year to Review:</p>
                  <div className="grid grid-cols-4 gap-2">
                    {AUDIT_YRS.map(y => {
                      const ct = receipts.filter(r => (r.taxYear || 2026) === y).length;
                      const locked = y !== 2026 && !isPro;
                      return (
                        <button key={y} onClick={() => locked ? (() => { setShowSettings(false); openPaywall("7-Year Vault Access", "Free plan only covers the current tax year. Upgrade to view and export past years.", () => openSettings("audit")); })() : setTaxYear(y)} className={`p-2.5 rounded-xl border text-center transition relative ${taxYear === y ? "bg-pink-600 text-white border-pink-700 font-extrabold" : locked ? "bg-gray-50 text-gray-400 border-gray-200" : "bg-white text-gray-700 border-gray-200 hover:bg-gray-100 font-bold"}`}>
                          {locked && <Lock className="w-3 h-3 absolute top-1.5 right-1.5 text-amber-500" />}
                          <span className="block text-xs">YA {y}</span>
                          <span className="block text-[10px] opacity-80">{ct} receipts</span>
                        </button>
                      );
                    })}
                  </div>
                  <button onClick={() => { setShowSettings(false); openVault(() => openSettings("audit")); }} className="w-full py-2.5 rounded-xl bg-pink-50 hover:bg-pink-100 text-pink-700 font-bold text-xs border border-pink-200 flex items-center justify-center gap-1.5">
                    <Receipt className="w-3.5 h-3.5" /> View Receipts for YA {taxYear}
                  </button>
                </div>
              </div>
            )}

            {settingsTab === "sync" && (
              <div className="space-y-4 text-xs">
                {!isPro ? (
                  <div className="p-5 bg-amber-50 border border-amber-200 rounded-2xl text-center space-y-3">
                    <Lock className="w-6 h-6 text-amber-500 mx-auto" />
                    <p className="font-bold text-amber-900">Multi-Device Sync is a Plus feature</p>
                    <p className="text-[11px] text-amber-700">Snap receipts on your phone, then pick up the exact same vault on your laptop at e-Filing time.</p>
                    <button onClick={() => { setShowSettings(false); openPaywall("Multi-Device Cloud Sync", "Sign in once, then access your vault from any device.", () => openSettings("sync")); }} className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold">Unlock Device Sync</button>
                  </div>
                ) : !signedIn ? (
                  <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 space-y-3">
                    <p className="font-bold text-gray-800 flex items-center gap-1.5"><Mail className="w-4 h-4 text-violet-600" /> Sign in to enable sync</p>
                    <div className="flex gap-2">
                      <input type="email" value={vaultEmail} onChange={e => setVaultEmail(e.target.value)} placeholder="you@email.com" className="flex-1 p-2.5 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-violet-400" />
                      <button onClick={signIn} className="px-4 py-2.5 bg-gray-900 hover:bg-gray-800 text-white font-bold rounded-xl flex items-center gap-1.5"><LogIn className="w-3.5 h-3.5" /> Sign In</button>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-pink-50 rounded-2xl border border-pink-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-sm text-pink-900 flex items-center gap-1.5"><Smartphone className="w-4 h-4" /> Device Vault Code</span>
                      <span className="text-[10px] bg-pink-200 text-pink-900 px-2 py-0.5 rounded font-bold">{vaultEmail}</span>
                    </div>
                    <div className="flex items-center gap-2 bg-white p-3 rounded-xl border border-pink-200 justify-between">
                      <span className="font-mono text-2xl font-black text-pink-800 tracking-widest">{vaultCode}</span>
                      <button onClick={copyVaultCode} className="px-3 py-1.5 bg-pink-700 text-white rounded-lg font-bold flex items-center gap-1"><Copy className="w-3.5 h-3.5" /> Copy</button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <button onClick={saveAll} className="w-full py-3.5 rounded-2xl bg-pink-600 hover:bg-pink-500 text-white font-extrabold transition shadow-md">Save Settings</button>
          </div>
        </div>
      )}

      {/* AI OCR Scanner Modal */}
      {showScan && (
        <div className="fixed inset-0 z-[60] bg-gray-900/60 backdrop-blur-sm overflow-y-auto p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 mx-auto my-8">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <h3 className="font-bold text-base flex items-center gap-2"><Zap className="w-5 h-5 text-pink-600" /> AI Receipt Scanner (Budget 2026 Ready)</h3>
              <button onClick={closeScan}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            {ocrLoading ? (
              <div className="p-10 text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-pink-100 flex items-center justify-center mx-auto animate-pulse"><Sparkles className="w-8 h-8 text-pink-600" /></div>
                <p className="text-sm font-bold text-gray-700">AI analyzing receipt image…</p>
                <p className="text-xs text-gray-400">Extracting merchant, amount, date & LHDN category</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="border-2 border-dashed border-pink-200 rounded-2xl p-6 text-center space-y-3 bg-pink-50">
                  <Camera className="w-10 h-10 text-pink-500 mx-auto" />
                  <p className="text-sm font-bold text-gray-700">Upload or photograph your receipt</p>
                  <p className="text-xs text-gray-500">AI automatically detects CCTV, transit care, theme parks, NPRA vaccines & traditional claims.</p>
                  <label className="cursor-pointer inline-block">
                    <div className="px-6 py-2.5 rounded-xl bg-pink-600 text-white font-bold text-xs hover:bg-pink-500 transition inline-flex items-center gap-2"><Upload className="w-4 h-4" /> Choose Receipt Photo</div>
                    <input type="file" accept="image/*" onChange={handleOCRUpload} className="hidden" />
                  </label>
                </div>
                <button onClick={closeScan} className="w-full py-2.5 rounded-xl bg-gray-100 text-gray-700 font-bold text-xs">Fill Manually Instead</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add / Edit Receipt Modal */}
      {showReceipt && (
        <div className="fixed inset-0 z-[60] bg-gray-900/60 backdrop-blur-sm overflow-y-auto p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 mx-auto my-8">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <h3 className="font-bold text-base flex items-center gap-2"><Plus className="w-4 h-4 text-pink-600" />{editId ? "Edit Receipt" : `Add Receipt (YA ${form.taxYear || taxYear})`}</h3>
              <button onClick={closeReceiptModal}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            {!editId && (
              <button
                onClick={() => isPro ? (() => { setShowReceipt(false); openScan(() => setShowReceipt(true)); })() : (() => { setShowReceipt(false); openPaywall("AI Receipt Scanner", "Snap a receipt and let AI fill in merchant, amount, date and category for you.", () => setShowReceipt(true)); })()}
                className="w-full py-2.5 rounded-xl bg-gray-50 hover:bg-gray-100 border border-dashed border-gray-300 text-gray-700 font-bold text-xs flex items-center justify-center gap-2 transition"
              >
                {isPro ? <Zap className="w-4 h-4 text-pink-500" /> : <Lock className="w-3.5 h-3.5 text-amber-500" />} Scan with AI instead {!isPro && <Crown className="w-3 h-3 text-amber-500" />}
              </button>
            )}
            <div className="space-y-3 text-xs">
              <div><label className="font-bold text-gray-700 block mb-1">Merchant / Vendor *</label><input type="text" value={form.merchant} onChange={e => setForm(f => ({ ...f, merchant: e.target.value }))} placeholder="e.g. Popular Bookstore, Dahua CCTV, Sunway Lagoon" className="w-full p-3 rounded-xl border border-gray-200 font-semibold outline-none focus:ring-2 focus:ring-pink-400" /></div>
              <div>
                <label className="font-bold text-gray-700 block mb-1">LHDN Category *</label>
                <button onClick={() => { setShowReceipt(false); setShowCatPick(true); }} className="w-full p-3 rounded-xl border border-gray-200 bg-white font-semibold text-gray-800 flex items-center justify-between hover:bg-gray-50">
                  <span>{form.category ? `${getCat(form.category)?.name} (max RM ${getCatLimit(getCat(form.category)).toLocaleString()})` : "Select category…"}</span>
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                </button>
                {form.category && (() => { const { rem } = getStats(form.category); const orig = editId ? (receipts.find(r => r.id === editId)?.amount || 0) : 0; const max = rem + orig; return max > 0 ? <p className="text-[11px] text-pink-600 mt-1">RM {max.toLocaleString()} available to claim</p> : null; })()}
                {form.category && getCat(form.category)?.note && (
                  <p className="text-[11px] text-gray-400 mt-1 leading-snug">ℹ️ {getCat(form.category).note}</p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="font-bold text-gray-700 block mb-1">Date</label><input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="w-full p-2.5 rounded-xl border border-gray-200 font-semibold outline-none focus:ring-2 focus:ring-pink-400" /></div>
                <div><label className="font-bold text-gray-700 block mb-1">Amount (RM) *</label><input type="number" value={form.amount} onChange={e => handleAmountChange(e.target.value)} placeholder="0.00" className="w-full p-2.5 rounded-xl border border-gray-200 font-bold outline-none focus:ring-2 focus:ring-pink-400" /></div>
              </div>
              {hasSpouse && isPro && (
                <div>
                  <label className="font-bold text-gray-700 block mb-1 flex items-center gap-1"><Crown className="w-3 h-3 text-amber-500" /> Whose claim is this?</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[["mine", "Mine"], ["spouse", "Spouse"], ["joint", "Joint"]].map(([v, l]) => (
                      <button key={v} type="button" onClick={() => setForm(f => ({ ...f, owner: v }))} className={`py-2 rounded-xl border font-bold text-[11px] ${form.owner === v ? "bg-rose-50 border-rose-300 text-rose-700" : "bg-white border-gray-200 text-gray-500"}`}>{l}</button>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <label className="font-bold text-gray-700 block mb-1">Receipt Photo <span className="font-normal text-gray-400">(7-year audit proof, max 600KB)</span></label>
                <label className="cursor-pointer block">
                  <div className="w-full p-3 border-2 border-dashed border-gray-300 rounded-xl flex items-center justify-center gap-2 bg-gray-50 hover:border-pink-400 transition"><Upload className="w-4 h-4 text-gray-400" /><span className="text-gray-500 text-xs">Tap to attach receipt image</span></div>
                  <input type="file" accept="image/*" onChange={handleImage} className="hidden" />
                </label>
                {form.image && (
                  <button type="button" onClick={() => setPreviewImage({ src: form.image, merchant: form.merchant || "Receipt" })}>
                    <img src={form.image} alt="Preview" className="mt-2 max-h-32 rounded-xl border" />
                  </button>
                )}
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={closeReceiptModal} className="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-700 font-bold">Cancel</button>
                <button onClick={editId ? handleUpdate : handleSave} className="flex-1 py-2.5 rounded-xl bg-pink-600 text-white font-bold hover:bg-pink-500">{editId ? "Update" : "Vault Receipt"}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Category Selection Modal */}
      {showCatPick && (
        <div className="fixed inset-0 z-[70] bg-gray-900/70 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-md w-full p-5 shadow-2xl space-y-2 mx-auto my-8">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3 sticky top-0 bg-white"><h3 className="font-bold text-base flex items-center gap-2"><Tag className="w-4 h-4 text-pink-600" /> Select LHDN Category</h3><button onClick={() => { setShowCatPick(false); setShowReceipt(true); }}><X className="w-5 h-5 text-gray-400" /></button></div>
            {GROUPS.map(g => (
              <div key={g}>
                <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider px-2 py-1">{g}</p>
                {CATS.filter(c => c.g === g).map(c => (
                  <button key={c.id} onClick={() => { setForm(f => ({ ...f, category: c.id, amount: "" })); setShowCatPick(false); setShowReceipt(true); }} className={`w-full text-left px-4 py-3 rounded-2xl text-xs font-bold flex items-center justify-between transition mb-1 ${form.category === c.id ? "bg-pink-50 text-pink-800 border border-pink-200" : "text-gray-700 hover:bg-gray-50"}`}>
                    <div><p className="font-bold">{c.emoji} {c.name}</p><p className="text-[10px] text-gray-400 font-normal">Max RM {getCatLimit(c).toLocaleString()}</p></div>
                    {form.category === c.id && <Check className="w-4 h-4 text-pink-600" />}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Vault filter-by-category picker — same custom style as Select LHDN Category, not the phone's native dropdown */}
      {showFilterPick && (
        <div className="fixed inset-0 z-[75] bg-gray-900/70 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-md w-full p-5 shadow-2xl space-y-2 mx-auto my-8">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3 sticky top-0 bg-white"><h3 className="font-bold text-base flex items-center gap-2"><Tag className="w-4 h-4 text-pink-600" /> Filter by Category</h3><button onClick={() => { setShowFilterPick(false); setShowVault(true); }}><X className="w-5 h-5 text-gray-400" /></button></div>
            <button onClick={() => { setRcptCatF("all"); setShowFilterPick(false); setShowVault(true); }} className={`w-full text-left px-4 py-3 rounded-2xl text-xs font-bold flex items-center justify-between transition mb-1 ${rcptCatF === "all" ? "bg-pink-50 text-pink-800 border border-pink-200" : "text-gray-700 hover:bg-gray-50"}`}>
              <span>All Categories</span>
              {rcptCatF === "all" && <Check className="w-4 h-4 text-pink-600" />}
            </button>
            {GROUPS.map(g => (
              <div key={g}>
                <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider px-2 py-1">{g}</p>
                {CATS.filter(c => c.g === g).map(c => (
                  <button key={c.id} onClick={() => { setRcptCatF(c.id); setShowFilterPick(false); setShowVault(true); }} className={`w-full text-left px-4 py-3 rounded-2xl text-xs font-bold flex items-center justify-between transition mb-1 ${rcptCatF === c.id ? "bg-pink-50 text-pink-800 border border-pink-200" : "text-gray-700 hover:bg-gray-50"}`}>
                    <div><p className="font-bold">{c.emoji} {c.name}</p><p className="text-[10px] text-gray-400 font-normal">Max RM {getCatLimit(c).toLocaleString()}</p></div>
                    {rcptCatF === c.id && <Check className="w-4 h-4 text-pink-600" />}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Full-size Receipt Image Lightbox — tap any receipt thumbnail to open. High z-index
          so it layers on top of the Vault list or the Add/Edit Receipt form it was opened from. */}
      {previewImage && (
        <div className="fixed inset-0 z-[95] bg-gray-900/90 backdrop-blur-sm flex flex-col" onClick={() => setPreviewImage(null)}>
          <div className="flex justify-between items-center p-4 shrink-0">
            <p className="text-white text-sm font-bold truncate pr-3">{previewImage.merchant}</p>
            <button onClick={() => setPreviewImage(null)} className="p-2 rounded-full bg-white/10 hover:bg-white/20 shrink-0"><X className="w-5 h-5 text-white" /></button>
          </div>
          <div className="flex-1 flex items-center justify-center p-4 overflow-auto" onClick={(e) => e.stopPropagation()}>
            <img src={previewImage.src} alt={previewImage.merchant} className="max-w-full max-h-full rounded-xl object-contain shadow-2xl" />
          </div>
        </div>
      )}
    </div>
  );
}