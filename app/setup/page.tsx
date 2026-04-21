"use client";

import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { eagleEyeService } from "@/services/eagleEyeService";

// ─── Inline SVG Icon Primitive ───────────────────────────────────────────────
const Ic = ({ d, className = "w-4 h-4" }: { d: string; className?: string }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d={d} />
  </svg>
);

const I = {
  plus:     "M12 4.5v15m7.5-7.5h-15",
  chevR:    "M8.25 4.5l7.5 7.5-7.5 7.5",
  chevD:    "M19.5 8.25l-7.5 7.5-7.5-7.5",
  check:    "M4.5 12.75l6 6 9-13.5",
  shield:   "M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z",
  key:      "M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z",
  building: "M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21",
  camera:   "M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z",
  clock:    "M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z",
  signal:   "M8.288 15.038a5.25 5.25 0 017.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12.53 18.22l-.53.53-.53-.53a.75.75 0 011.06 0z",
  search:   "M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803 7.5 7.5 0 0016.803 15.803z",
  refresh:  "M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99",
  tag:      "M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L9.568 3zM6 6h.008v.008H6V6z",
  excl:     "M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z",
  arrowR:   "M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3",
  link:     "M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244",
};

// ─── Types ───────────────────────────────────────────────────────────────────
interface Account {
  id: string;
  name: string;
  een_refresh_token?: string;
  een_client_id?: string;
  created_at: string;
}

interface Zone {
  id: string;
  account_id: string;
  name: string;
  een_tag: string;
  is_monitored: boolean;
  timezone?: string;
  schedule_start?: string;
  schedule_end?: string;
}

interface Camera {
  id: string;
  zone_id: string;
  name: string;
  is_monitored: boolean;
}

// ─── Wizard default state ────────────────────────────────────────────────────
const defaultWizard = {
  step: 1 as 1 | 2 | 3 | 4 | 5,
  accountId: null as string | null,
  accountName: "",
  clientId: "",
  clientSecret: "",
  locationId: "",
  discoveredTags: [] as string[],
  selectedTag: "",
  timezone: "America/New_York",
  scheduleStart: "18:00",
  scheduleEnd: "06:00",
  isMonitored: true,
  harvestedZoneId: null as string | null,
  harvestedCameras: [] as Camera[],
  isLoading: false,
  error: "",
};

// ─── Shared UI primitives ────────────────────────────────────────────────────
const inputCls =
  "w-full bg-white/[0.04] border border-white/[0.08] hover:border-white/[0.14] " +
  "focus:border-indigo-500/60 focus:bg-white/[0.06] rounded-md px-3 py-2.5 " +
  "text-sm text-white placeholder-slate-600 outline-none transition-all font-mono";

function Field({
  label,
  help,
  children,
}: {
  label: string;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
          {label}
        </label>
        {help && (
          <span className="text-slate-600 cursor-help text-xs" title={help}>
            ?
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`relative w-9 h-5 rounded-full transition-all shrink-0 ${
        checked ? "bg-indigo-600" : "bg-white/10"
      }`}
    >
      <div
        className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${
          checked ? "left-4" : "left-0.5"
        }`}
      />
    </button>
  );
}

// ─── Step Progress Bar ───────────────────────────────────────────────────────
const WIZARD_STEPS = ["Credentials", "Authenticate", "Discovery", "Configure", "Complete"];

function StepBar({ current }: { current: number }) {
  return (
    <div className="flex items-center mb-8">
      {WIZARD_STEPS.map((label, i) => {
        const stepNum = i + 1;
        const done = stepNum < current;
        const active = stepNum === current;
        return (
          <React.Fragment key={label}>
            <div className="flex flex-col items-center">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold border transition-all ${
                  done
                    ? "bg-indigo-600 border-indigo-600 text-white"
                    : active
                    ? "border-indigo-500 text-indigo-400 bg-indigo-500/10"
                    : "border-white/10 text-slate-600"
                }`}
              >
                {done ? <Ic d={I.check} className="w-3.5 h-3.5" /> : stepNum}
              </div>
              <span
                className={`text-[10px] mt-1.5 font-medium whitespace-nowrap ${
                  active ? "text-indigo-400" : done ? "text-slate-400" : "text-slate-600"
                }`}
              >
                {label}
              </span>
            </div>
            {i < WIZARD_STEPS.length - 1 && (
              <div
                className={`flex-1 h-px mt-[-14px] mx-1 ${
                  done ? "bg-indigo-600" : "bg-white/[0.08]"
                }`}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ─── Error Banner ────────────────────────────────────────────────────────────
function ErrorBanner({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div className="mb-4 flex items-start gap-2.5 bg-red-500/10 border border-red-500/20 rounded-md p-3">
      <Ic d={I.excl} className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
      <p className="text-xs text-red-400">{message}</p>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function SetupPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [zoneCameras, setZoneCameras] = useState<{ [k: string]: Camera[] }>({});
  const [loading, setLoading] = useState(true);

  // Left-panel state
  const [expandedAccountId, setExpandedAccountId] = useState<string | null>(null);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);

  // Right-panel view
  const [rightView, setRightView] = useState<"empty" | "wizard" | "zone-detail">("empty");

  // Wizard state
  const [wiz, setWiz] = useState({ ...defaultWizard });
  const wizSet = (patch: Partial<typeof defaultWizard>) =>
    setWiz((prev) => ({ ...prev, ...patch }));

  // ── Data loading ────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    const [{ data: accts }, { data: zns }] = await Promise.all([
      supabase.from("accounts").select("*").order("created_at", { ascending: false }),
      supabase.from("zones").select("*").order("name"),
    ]);
    if (accts) setAccounts(accts);
    if (zns) setZones(zns);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
    // Restore wizard state after OAuth redirect
    const saved = sessionStorage.getItem("gg_wizard");
    if (saved) {
      try {
        const state = JSON.parse(saved);
        setWiz({ ...defaultWizard, ...state, step: 3, isLoading: false, error: "" });
        setRightView("wizard");
        sessionStorage.removeItem("gg_wizard");
      } catch (_) {
        sessionStorage.removeItem("gg_wizard");
      }
    }
  }, [fetchData]);

  // ── Zone camera loader ───────────────────────────────────────────────────
  const loadZoneCameras = useCallback(
    async (zoneId: string) => {
      const { data } = await supabase
        .from("cameras")
        .select("*")
        .eq("zone_id", zoneId)
        .order("name");
      if (data) setZoneCameras((p) => ({ ...p, [zoneId]: data }));
    },
    []
  );

  const handleSelectZone = (zone: Zone) => {
    setSelectedZoneId(zone.id);
    setRightView("zone-detail");
    loadZoneCameras(zone.id);
  };

  // ── Toggle helpers ───────────────────────────────────────────────────────
  const toggleCamera = async (cam: Camera) => {
    const next = !cam.is_monitored;
    setZoneCameras((p) => ({
      ...p,
      [cam.zone_id]: p[cam.zone_id].map((c) =>
        c.id === cam.id ? { ...c, is_monitored: next } : c
      ),
    }));
    await supabase.from("cameras").update({ is_monitored: next }).eq("id", cam.id);
  };

  const toggleZoneMonitoring = async (zone: Zone) => {
    const next = !zone.is_monitored;
    setZones((p) => p.map((z) => (z.id === zone.id ? { ...z, is_monitored: next } : z)));
    await supabase.from("zones").update({ is_monitored: next }).eq("id", zone.id);
  };

  // ══════════════════════════════════════════════════════════════════════════
  // WIZARD ACTIONS
  // ══════════════════════════════════════════════════════════════════════════

  // Step 1 → 2: Save credentials and redirect to EEN OAuth
  const wizStep1Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wiz.accountName || !wiz.clientId || !wiz.clientSecret) {
      wizSet({ error: "All three fields are required." });
      return;
    }
    wizSet({ isLoading: true, error: "" });
    try {
      const { data, error } = await supabase
        .from("accounts")
        .insert([
          {
            name: wiz.accountName.trim(),
            een_client_id: wiz.clientId.trim(),
            een_client_secret: wiz.clientSecret.trim(),
          },
        ])
        .select()
        .single();

      if (error) throw new Error(error.message);

      // Persist wizard state across the OAuth redirect
      sessionStorage.setItem(
        "gg_wizard",
        JSON.stringify({
          accountId: data.id,
          accountName: wiz.accountName.trim(),
        })
      );

      eagleEyeService.login(wiz.accountName.trim());
    } catch (err: any) {
      wizSet({ isLoading: false, error: err.message });
    }
  };

  // Step 3: Scan EEN for available property tags
  const wizScanTags = async () => {
    if (!wiz.locationId) {
      wizSet({ error: "Sub-Account ID is required to scan for zones." });
      return;
    }
    wizSet({ isLoading: true, error: "", discoveredTags: [], selectedTag: "" });
    try {
      const res = await fetch("/api/een/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId: wiz.accountId }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      wizSet({ isLoading: false, discoveredTags: data.tags });
    } catch (err: any) {
      wizSet({ isLoading: false, error: err.message });
    }
  };

  // Step 3 → 4: Confirm tag selection
  const wizStep3Next = () => {
    if (!wiz.selectedTag) {
      wizSet({ error: "Please select a property zone to continue." });
      return;
    }
    wizSet({ step: 4, error: "" });
  };

  // Step 4 → 5: Save zone config and harvest cameras
  const wizStep4Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    wizSet({ isLoading: true, error: "" });
    try {
      const zoneId = `${wiz.accountId}-${wiz.selectedTag
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "-")}`;

      const { data: zoneData, error: zoneErr } = await supabase
        .from("zones")
        .upsert(
          [
            {
              id: zoneId,
              account_id: wiz.accountId,
              name: wiz.selectedTag,
              een_tag: wiz.selectedTag,
              is_monitored: wiz.isMonitored,
              timezone: wiz.timezone,
              schedule_start: wiz.scheduleStart,
              schedule_end: wiz.scheduleEnd,
            },
          ],
          { onConflict: "id" }
        )
        .select()
        .single();

      if (zoneErr) throw new Error(zoneErr.message);

      const res = await fetch("/api/een/sync-hardware", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zoneId: zoneData.id }),
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error);

      const { data: cams } = await supabase
        .from("cameras")
        .select("*")
        .eq("zone_id", zoneData.id)
        .order("name");

      wizSet({
        step: 5,
        isLoading: false,
        harvestedZoneId: zoneData.id,
        harvestedCameras: cams || [],
      });
      fetchData();
    } catch (err: any) {
      wizSet({ isLoading: false, error: err.message });
    }
  };

  const wizToggleCamera = async (cam: Camera) => {
    const next = !cam.is_monitored;
    wizSet({
      harvestedCameras: wiz.harvestedCameras.map((c) =>
        c.id === cam.id ? { ...c, is_monitored: next } : c
      ),
    });
    await supabase.from("cameras").update({ is_monitored: next }).eq("id", cam.id);
  };

  const wizFinish = () => {
    setWiz({ ...defaultWizard });
    setRightView("empty");
    fetchData();
  };

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER: WIZARD
  // ══════════════════════════════════════════════════════════════════════════
  const renderWizard = () => (
    <div className="max-w-2xl flex flex-col h-full">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-white">New Account Setup</h2>
        <p className="text-xs text-slate-500 mt-1">
          Complete each step to connect a new Eagle Eye VMS account to GateGuard.
        </p>
      </div>

      <StepBar current={wiz.step} />
      <ErrorBanner message={wiz.error} />

      {/* ── Step 1: Credentials ─────────────────────────────────────────── */}
      {wiz.step === 1 && (
        <form onSubmit={wizStep1Submit} className="flex flex-col gap-5 flex-1">
          <Field
            label="Account Name"
            help="An internal label for this EEN parent account (e.g., Pegasus Residential)"
          >
            <input
              className={inputCls}
              style={{ fontFamily: "inherit" }}
              placeholder="e.g., Pegasus Residential"
              value={wiz.accountName}
              onChange={(e) => wizSet({ accountName: e.target.value })}
            />
          </Field>

          <Field
            label="Eagle Eye Client ID"
            help="Found under Account Settings → Control → API Keys in the EEN portal"
          >
            <input
              className={inputCls}
              placeholder="Paste Client ID..."
              value={wiz.clientId}
              onChange={(e) => wizSet({ clientId: e.target.value })}
            />
          </Field>

          <Field
            label="Eagle Eye Client Secret"
            help="Generated alongside the Client ID — store it securely"
          >
            <input
              className={inputCls}
              type="password"
              placeholder="Paste Client Secret..."
              value={wiz.clientSecret}
              onChange={(e) => wizSet({ clientSecret: e.target.value })}
            />
          </Field>

          {/* SOP Accordion */}
          <details className="group bg-indigo-950/30 border border-indigo-500/20 rounded-md">
            <summary className="flex items-center gap-2 px-4 py-3 cursor-pointer text-xs text-indigo-400 font-medium select-none list-none">
              <Ic d={I.key} className="w-3.5 h-3.5" />
              How to locate your EEN API credentials
            </summary>
            <ol className="px-5 pb-4 pt-1 text-xs text-slate-400 space-y-2 list-decimal list-inside leading-relaxed border-t border-indigo-500/10 mt-1">
              <li>
                Log in to your <strong className="text-slate-300">Reseller account</strong> in EEN.
              </li>
              <li>
                Click the <strong className="text-slate-300">eye icon</strong> to view the target
                sub-account.
              </li>
              <li>
                Navigate to{" "}
                <strong className="text-slate-300">Account Settings → Control</strong>.
              </li>
              <li>
                Click <strong className="text-slate-300">Create API Key</strong>, then{" "}
                <strong className="text-slate-300">Generate new API key</strong>.
              </li>
              <li>
                Name the key{" "}
                <code className="bg-black/50 px-1.5 py-0.5 rounded text-emerald-400">
                  GG Monitoring - [site name]
                </code>
                .
              </li>
              <li>
                Copy the generated <strong className="text-slate-300">API Key</strong> and{" "}
                <strong className="text-slate-300">API Secret</strong> above.
              </li>
            </ol>
          </details>

          <div className="mt-auto pt-4 border-t border-white/[0.06] flex justify-end">
            <button
              type="submit"
              disabled={wiz.isLoading}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium px-5 py-2.5 rounded-md transition-all"
            >
              {wiz.isLoading ? (
                "Saving..."
              ) : (
                <>
                  Save & Authenticate <Ic d={I.arrowR} className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* ── Step 2: Authenticate (transitional — redirect in progress) ──── */}
      {wiz.step === 2 && (
        <div className="flex flex-col items-center justify-center flex-1 gap-4 text-center">
          <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <div>
            <p className="text-sm text-slate-300 font-medium">
              Redirecting to Eagle Eye Networks
            </p>
            <p className="text-xs text-slate-600 mt-1">
              Complete authentication in the EEN portal — you'll be returned here automatically.
            </p>
          </div>
        </div>
      )}

      {/* ── Step 3: Discovery ───────────────────────────────────────────── */}
      {wiz.step === 3 && (
        <div className="flex flex-col gap-5 flex-1">
          <div className="flex items-center gap-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-md p-3">
            <Ic d={I.check} className="w-4 h-4 text-emerald-400 shrink-0" />
            <p className="text-xs text-emerald-400 font-medium">
              Eagle Eye authentication successful. Account is now connected.
            </p>
          </div>

          <Field
            label="Sub-Account ID"
            help="The 8-character ID visible in the EEN web URL for this account (e.g., 100bd80b)"
          >
            <div className="flex gap-2">
              <input
                className={inputCls + " flex-1"}
                placeholder="e.g., 100bd80b"
                value={wiz.locationId}
                onChange={(e) => wizSet({ locationId: e.target.value })}
              />
              <button
                type="button"
                onClick={wizScanTags}
                disabled={wiz.isLoading}
                className="flex items-center gap-1.5 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.10] text-slate-300 text-sm font-medium px-4 py-2.5 rounded-md transition-all disabled:opacity-50 whitespace-nowrap"
              >
                <Ic d={I.search} className="w-3.5 h-3.5" />
                {wiz.isLoading ? "Scanning..." : "Scan"}
              </button>
            </div>
          </Field>

          {wiz.discoveredTags.length > 0 && (
            <Field label={`Property Zones — ${wiz.discoveredTags.length} found`}>
              <div className="flex flex-col gap-1.5 max-h-56 overflow-y-auto custom-scrollbar pr-1">
                {wiz.discoveredTags.map((tag) => (
                  <label
                    key={tag}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-md border cursor-pointer transition-all ${
                      wiz.selectedTag === tag
                        ? "bg-indigo-600/15 border-indigo-500/40 text-white"
                        : "bg-white/[0.02] border-white/[0.06] text-slate-300 hover:bg-white/[0.05]"
                    }`}
                  >
                    <input
                      type="radio"
                      name="zone-tag"
                      value={tag}
                      checked={wiz.selectedTag === tag}
                      onChange={() => wizSet({ selectedTag: tag })}
                      className="accent-indigo-500 shrink-0"
                    />
                    <Ic d={I.tag} className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span className="text-sm">{tag}</span>
                  </label>
                ))}
              </div>
            </Field>
          )}

          <div className="mt-auto pt-4 border-t border-white/[0.06] flex justify-end">
            <button
              type="button"
              onClick={wizStep3Next}
              disabled={!wiz.selectedTag}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm font-medium px-5 py-2.5 rounded-md transition-all"
            >
              Configure Zone <Ic d={I.arrowR} className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Step 4: Configure ───────────────────────────────────────────── */}
      {wiz.step === 4 && (
        <form onSubmit={wizStep4Submit} className="flex flex-col gap-5 flex-1">
          {/* Selected zone summary */}
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-md px-4 py-3">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">Selected Zone</p>
            <p className="text-sm text-white font-medium mt-0.5">{wiz.selectedTag}</p>
          </div>

          <Field label="Timezone">
            <select
              className={inputCls + " cursor-pointer"}
              value={wiz.timezone}
              onChange={(e) => wizSet({ timezone: e.target.value })}
            >
              {[
                "America/New_York",
                "America/Chicago",
                "America/Denver",
                "America/Los_Angeles",
                "America/Phoenix",
                "Pacific/Honolulu",
                "America/Anchorage",
              ].map((tz) => (
                <option key={tz} value={tz} className="bg-[#0d0f14]">
                  {tz}
                </option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Schedule Start" help="Time the monitoring window begins (24h)">
              <input
                className={inputCls}
                type="time"
                value={wiz.scheduleStart}
                onChange={(e) => wizSet({ scheduleStart: e.target.value })}
              />
            </Field>
            <Field label="Schedule End" help="Time the monitoring window ends (24h)">
              <input
                className={inputCls}
                type="time"
                value={wiz.scheduleEnd}
                onChange={(e) => wizSet({ scheduleEnd: e.target.value })}
              />
            </Field>
          </div>

          <div
            className="flex items-center gap-4 px-4 py-3.5 bg-white/[0.02] border border-white/[0.06] rounded-md cursor-pointer hover:bg-white/[0.04] transition-all"
            onClick={() => wizSet({ isMonitored: !wiz.isMonitored })}
          >
            <Toggle checked={wiz.isMonitored} onChange={() => wizSet({ isMonitored: !wiz.isMonitored })} />
            <div>
              <p className="text-sm text-white font-medium">Enable SOC Monitoring</p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Arms this zone — alarms will surface in the Dispatch Station
              </p>
            </div>
          </div>

          <div className="mt-auto pt-4 border-t border-white/[0.06] flex justify-end">
            <button
              type="submit"
              disabled={wiz.isLoading}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium px-5 py-2.5 rounded-md transition-all"
            >
              {wiz.isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving & Harvesting...
                </>
              ) : (
                <>
                  Save & Harvest Cameras <Ic d={I.arrowR} className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* ── Step 5: Complete ────────────────────────────────────────────── */}
      {wiz.step === 5 && (
        <div className="flex flex-col gap-5 flex-1">
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-md p-4">
            <div className="flex items-center gap-2 mb-1">
              <Ic d={I.check} className="w-4 h-4 text-emerald-400" />
              <p className="text-sm font-semibold text-emerald-400">Setup Complete</p>
            </div>
            <p className="text-xs text-slate-400">
              <span className="text-white">{wiz.harvestedCameras.length}</span> camera
              {wiz.harvestedCameras.length !== 1 ? "s" : ""} discovered under{" "}
              <span className="text-white">{wiz.selectedTag}</span>. Toggle monitoring per
              device below, then click Finish.
            </p>
          </div>

          <div>
            <p className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold mb-2">
              Hardware Nodes
            </p>
            <div className="flex flex-col gap-1.5 max-h-64 overflow-y-auto custom-scrollbar">
              {wiz.harvestedCameras.length === 0 && (
                <p className="text-xs text-slate-600 py-4 text-center">No cameras returned by harvest.</p>
              )}
              {wiz.harvestedCameras.map((cam) => (
                <div
                  key={cam.id}
                  className="flex items-center justify-between px-3 py-2.5 bg-white/[0.02] border border-white/[0.06] rounded-md"
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-1.5 h-1.5 rounded-full ${
                        cam.is_monitored ? "bg-emerald-400" : "bg-slate-600"
                      }`}
                    />
                    <span className="text-sm text-slate-300">{cam.name}</span>
                  </div>
                  <Toggle
                    checked={cam.is_monitored}
                    onChange={() => wizToggleCamera(cam)}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="mt-auto pt-4 border-t border-white/[0.06] flex justify-end">
            <button
              onClick={wizFinish}
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-5 py-2.5 rounded-md transition-all"
            >
              Finish & View Accounts
            </button>
          </div>
        </div>
      )}
    </div>
  );

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER: ZONE DETAIL
  // ══════════════════════════════════════════════════════════════════════════
  const renderZoneDetail = () => {
    const zone = zones.find((z) => z.id === selectedZoneId);
    if (!zone) return null;
    const cams = zoneCameras[zone.id] || [];

    return (
      <div className="max-w-2xl flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[11px] text-slate-500 uppercase tracking-wider mb-1">
              Property Zone
            </p>
            <h2 className="text-lg font-semibold text-white">{zone.name}</h2>
          </div>
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-semibold border ${
              zone.is_monitored
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                : "bg-white/[0.04] border-white/[0.08] text-slate-500"
            }`}
          >
            <div
              className={`w-1.5 h-1.5 rounded-full ${
                zone.is_monitored ? "bg-emerald-400" : "bg-slate-600"
              }`}
            />
            {zone.is_monitored ? "SOC ARMED" : "UNMONITORED"}
          </div>
        </div>

        {/* Meta grid */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Tag", value: zone.een_tag || "—", icon: I.tag },
            {
              label: "Schedule",
              value:
                zone.schedule_start
                  ? `${zone.schedule_start} – ${zone.schedule_end}`
                  : "Not configured",
              icon: I.clock,
            },
            { label: "Timezone", value: zone.timezone || "Not set", icon: I.signal },
          ].map(({ label, value, icon }) => (
            <div
              key={label}
              className="bg-white/[0.02] border border-white/[0.06] rounded-md px-3 py-2.5"
            >
              <div className="flex items-center gap-1.5 mb-1">
                <Ic d={icon} className="w-3 h-3 text-slate-500" />
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</p>
              </div>
              <p className="text-xs text-slate-300 font-mono truncate">{value}</p>
            </div>
          ))}
        </div>

        {/* Monitoring toggle */}
        <div
          className="flex items-center gap-4 px-4 py-3.5 bg-white/[0.02] border border-white/[0.06] rounded-md cursor-pointer hover:bg-white/[0.04] transition-all"
          onClick={() => toggleZoneMonitoring(zone)}
        >
          <Toggle
            checked={zone.is_monitored}
            onChange={() => toggleZoneMonitoring(zone)}
          />
          <div>
            <p className="text-sm text-white font-medium">
              SOC Monitoring {zone.is_monitored ? "Enabled" : "Disabled"}
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Alarms from this zone will{" "}
              {zone.is_monitored ? "" : "not "}appear in the Dispatch Station
            </p>
          </div>
        </div>

        {/* Camera list */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">
              Hardware Nodes ({cams.length})
            </p>
            <button
              onClick={() => loadZoneCameras(zone.id)}
              className="flex items-center gap-1.5 text-[11px] text-slate-500 hover:text-slate-300 transition-all"
            >
              <Ic d={I.refresh} className="w-3 h-3" />
              Refresh
            </button>
          </div>

          {cams.length === 0 ? (
            <div className="flex items-center justify-center h-20 border border-white/[0.06] rounded-md text-[11px] text-slate-600 uppercase tracking-wider">
              No cameras — run a Harvest to populate
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {cams.map((cam) => (
                <div
                  key={cam.id}
                  className="flex items-center justify-between px-3 py-2.5 bg-white/[0.02] border border-white/[0.06] rounded-md hover:bg-white/[0.04] transition-all"
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-1.5 h-1.5 rounded-full ${
                        cam.is_monitored ? "bg-emerald-400" : "bg-slate-600"
                      }`}
                    />
                    <span className="text-sm text-slate-300">{cam.name}</span>
                  </div>
                  <Toggle
                    checked={cam.is_monitored}
                    onChange={() => toggleCamera(cam)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  // ══════════════════════════════════════════════════════════════════════════
  // MAIN RENDER
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="w-full h-full flex flex-col overflow-hidden">

      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-8 py-5 border-b border-white/[0.06] shrink-0">
        <div>
          <h1 className="text-xl font-semibold text-white tracking-tight">
            Infrastructure Hub
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Provision accounts, discover property zones, and manage hardware nodes
          </p>
        </div>
        <button
          onClick={() => {
            setWiz({ ...defaultWizard });
            setRightView("wizard");
          }}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-4 py-2 rounded-md transition-all"
        >
          <Ic d={I.plus} className="w-4 h-4" />
          Add Account
        </button>
      </div>

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* LEFT: Account Tree ───────────────────────────────────────────── */}
        <div className="w-72 shrink-0 border-r border-white/[0.06] flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-white/[0.04]">
            <p className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">
              Connected Accounts
            </p>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar py-2">
            {loading && (
              <div className="flex items-center justify-center h-20 text-[11px] text-slate-600 uppercase tracking-wider">
                Loading...
              </div>
            )}

            {!loading && accounts.length === 0 && (
              <div className="flex flex-col items-center justify-center h-32 gap-2 px-4 text-center">
                <Ic d={I.building} className="w-6 h-6 text-slate-700" />
                <p className="text-xs text-slate-600">No accounts provisioned yet.</p>
                <button
                  onClick={() => {
                    setWiz({ ...defaultWizard });
                    setRightView("wizard");
                  }}
                  className="text-[11px] text-indigo-500 hover:text-indigo-400 transition-all"
                >
                  + Add first account
                </button>
              </div>
            )}

            {accounts.map((account) => {
              const accountZones = zones.filter((z) => z.account_id === account.id);
              const isExpanded = expandedAccountId === account.id;
              const isConnected = !!account.een_refresh_token;

              return (
                <div key={account.id}>
                  {/* Account Row */}
                  <button
                    onClick={() =>
                      setExpandedAccountId(isExpanded ? null : account.id)
                    }
                    className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-left transition-all hover:bg-white/[0.04] ${
                      isExpanded ? "bg-white/[0.02]" : ""
                    }`}
                  >
                    <Ic
                      d={isExpanded ? I.chevD : I.chevR}
                      className="w-3 h-3 text-slate-600 shrink-0"
                    />
                    <div
                      className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                        isConnected ? "bg-emerald-400" : "bg-amber-400"
                      }`}
                    />
                    <span className="text-sm text-slate-300 truncate flex-1">
                      {account.name}
                    </span>
                    <span className="text-[10px] text-slate-600 shrink-0">
                      {accountZones.length}
                    </span>
                  </button>

                  {/* Zone Sub-rows */}
                  {isExpanded && (
                    <div className="pl-8">
                      {accountZones.length === 0 && (
                        <p className="px-4 py-2 text-[11px] text-slate-600">
                          No zones discovered
                        </p>
                      )}
                      {accountZones.map((zone) => (
                        <button
                          key={zone.id}
                          onClick={() => handleSelectZone(zone)}
                          className={`w-full flex items-center gap-2.5 px-4 py-2 text-left rounded transition-all hover:bg-white/[0.04] ${
                            selectedZoneId === zone.id && rightView === "zone-detail"
                              ? "bg-indigo-600/10"
                              : ""
                          }`}
                        >
                          <div
                            className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                              zone.is_monitored ? "bg-emerald-400" : "bg-slate-700"
                            }`}
                          />
                          <span
                            className={`text-xs truncate ${
                              selectedZoneId === zone.id && rightView === "zone-detail"
                                ? "text-indigo-400"
                                : "text-slate-400"
                            }`}
                          >
                            {zone.name}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT: Detail Panel ──────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-8">

          {rightView === "empty" && (
            <div className="h-full flex flex-col items-center justify-center gap-3 text-center">
              <div className="w-12 h-12 bg-white/[0.03] border border-white/[0.06] rounded-lg flex items-center justify-center">
                <Ic d={I.shield} className="w-5 h-5 text-slate-600" />
              </div>
              <p className="text-sm text-slate-500">
                Select a zone from the panel to view its details,
                <br />
                or add a new account to get started.
              </p>
              <button
                onClick={() => {
                  setWiz({ ...defaultWizard });
                  setRightView("wizard");
                }}
                className="mt-1 text-xs text-indigo-400 hover:text-indigo-300 transition-all"
              >
                + Add first account
              </button>
            </div>
          )}

          {rightView === "wizard" && renderWizard()}
          {rightView === "zone-detail" && renderZoneDetail()}
        </div>
      </div>
    </div>
  );
}
