// app/setup/page.tsx
//
// GateGuard Infrastructure Hub — Setup & Configuration Page
//
// Layout:
//   Left panel (w-64)  → Connected Accounts tree (expandable → zones)
//   Right panel (flex) → Empty state | Setup Wizard (5 steps) | Zone Detail (tabbed)
//
// Zone Detail tabs:
//   Overview    — monitoring toggle, meta grid, camera list + EEN re-sync
//   Schedule    — per-day shifts (up to 3 per day) + holiday overrides
//   Contacts    — personnel directory (emergency, reporting, EMS, guard, janitorial…)
//   Procedures  — custom SOPs per event type (placeholder for next release)
//   Site Info   — property/customer info, guard service, camera directory, notes
//
// Key fixes vs previous version:
//   ✓ Zone upsert uses onConflict: "account_id,een_tag" — no more string-composite IDs
//   ✓ Step 3 includes "All Cameras — Single Site (No Tag)" as first selectable option
//   ✓ Contacts use existing `contacts` table (zone_id, name, role, phone, email, priority)
//   ✓ Site info / schedule stored as JSONB on zones (requires Migration 001d)

"use client";

import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { eagleEyeService } from "@/services/eagleEyeService";

// ─── SVG Icon Primitive ───────────────────────────────────────────────────────
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
  trash:    "M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0",
  edit:     "M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125",
  user:     "M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z",
  list:     "M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z",
  info:     "M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z",
};

// ─── Types ────────────────────────────────────────────────────────────────────
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
  site_info?: Record<string, any>;
  weekly_schedule?: Record<string, any>;
  holiday_schedule?: Record<string, any>;
}

interface Camera {
  id: string;
  zone_id: string;
  name: string;
  is_monitored: boolean;
}

interface Contact {
  id?: string;
  zone_id: string;
  name: string;
  role: string;
  phone: string;
  email: string;
  priority: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
type Day = typeof DAYS[number];

const DAY_LABELS: Record<Day, string> = {
  monday: "MON", tuesday: "TUE", wednesday: "WED", thursday: "THU",
  friday: "FRI", saturday: "SAT", sunday: "SUN",
};

const HOLIDAYS = [
  { key: "new_years",     label: "New Year's Day" },
  { key: "mlk",          label: "MLK Day" },
  { key: "presidents",   label: "President's Day" },
  { key: "memorial",     label: "Memorial Day" },
  { key: "juneteenth",   label: "Juneteenth" },
  { key: "independence", label: "Independence Day" },
  { key: "labor",        label: "Labor Day" },
  { key: "columbus",     label: "Columbus Day" },
  { key: "veterans",     label: "Veteran's Day" },
  { key: "thanksgiving", label: "Thanksgiving" },
  { key: "christmas",    label: "Christmas Day" },
];

const CONTACT_ROLES = [
  "Emergency Contact",
  "Reporting Contact",
  "Authorized After-Hours Employee",
  "Police Department",
  "Fire Department",
  "EMS",
  "Janitorial Company",
];

const TIMEZONES = [
  "America/New_York", "America/Chicago", "America/Denver",
  "America/Los_Angeles", "America/Phoenix", "Pacific/Honolulu", "America/Anchorage",
];

// ─── Default state factories ──────────────────────────────────────────────────
const defaultShift = () => ({ start: "18:00", end: "23:00", concierge: false });

const defaultDaySchedule = () => ({
  operating: false as boolean,
  shift1: defaultShift() as ReturnType<typeof defaultShift>,
  shift2: null as null | ReturnType<typeof defaultShift>,
  shift3: null as null | ReturnType<typeof defaultShift>,
});

const defaultWeeklySchedule = (): Record<string, ReturnType<typeof defaultDaySchedule>> =>
  Object.fromEntries(DAYS.map((d) => [d, defaultDaySchedule()]));

const defaultHolidaySchedule = (): Record<string, { schedule: string; is_247: boolean }> =>
  Object.fromEntries(HOLIDAYS.map((h) => [h.key, { schedule: "", is_247: false }]));

const defaultSiteInfo = () => ({
  property: "",
  customer_name: "",
  service_address: "",
  phone: "",
  email: "",
  guard_on_site: false,
  guard_company: "",
  guard_phone: "",
  camera_directory: "",
  expected_activity: "",
  special_notes: "",
});

// "__UNSET__" = user hasn't chosen yet; "" = single-site (no tag); "TagName" = specific tag
const defaultWizard = {
  step: 1 as 1 | 2 | 3 | 4 | 5,
  accountId: null as string | null,
  accountName: "",
  apiKey: "",        // EEN API Key — unique per customer account (x-api-key header)
  discoveredTags: [] as string[],
  selectedTag: "__UNSET__" as string,
  timezone: "America/New_York",
  scheduleStart: "18:00",
  scheduleEnd: "06:00",
  isMonitored: true,
  harvestedZoneId: null as string | null,
  harvestedCameras: [] as Camera[],
  isLoading: false,
  error: "",
};

// ─── Shared UI Primitives ─────────────────────────────────────────────────────
const inputCls =
  "w-full bg-black/20 border border-white/[0.08] hover:border-white/[0.14] " +
  "focus:border-indigo-500/60 focus:bg-black/30 rounded px-3 py-2 " +
  "text-sm text-white placeholder-slate-600 outline-none transition-all";

const inputMonoCls = inputCls + " font-mono";

const inputSmCls =
  "bg-black/20 border border-white/[0.07] rounded px-2 py-1 text-[11px] text-slate-300 " +
  "outline-none focus:border-indigo-500/50 transition-all";

function Field({
  label, help, children,
}: {
  label: string; help?: string; children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">
          {label}
        </label>
        {help && (
          <span className="text-slate-700 cursor-help text-xs" title={help}>?</span>
        )}
      </div>
      {children}
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`relative w-9 h-5 rounded-full transition-all shrink-0 ${
        checked ? "bg-indigo-600" : "bg-white/[0.08]"
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

const WIZARD_STEPS = ["Credentials", "Authenticate", "Discovery", "Configure", "Complete"];

function StepBar({ current }: { current: number }) {
  return (
    <div className="flex items-center mb-8">
      {WIZARD_STEPS.map((label, i) => {
        const n = i + 1;
        const done = n < current;
        const active = n === current;
        return (
          <React.Fragment key={label}>
            <div className="flex flex-col items-center">
              <div
                className={`w-6 h-6 flex items-center justify-center text-[11px] font-bold border transition-all ${
                  done
                    ? "bg-indigo-600 border-indigo-600 text-white"
                    : active
                    ? "border-indigo-500 text-indigo-400 bg-indigo-500/10"
                    : "border-white/[0.08] text-slate-700"
                }`}
              >
                {done ? <Ic d={I.check} className="w-3 h-3" /> : n}
              </div>
              <span
                className={`text-[9px] mt-1 font-semibold uppercase tracking-wider whitespace-nowrap ${
                  active ? "text-indigo-400" : done ? "text-slate-400" : "text-slate-700"
                }`}
              >
                {label}
              </span>
            </div>
            {i < WIZARD_STEPS.length - 1 && (
              <div
                className={`flex-1 h-px mt-[-10px] mx-1 ${
                  done ? "bg-indigo-600" : "bg-white/[0.06]"
                }`}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div className="mb-4 flex items-start gap-2.5 bg-red-500/[0.08] border border-red-500/20 rounded p-3">
      <Ic d={I.excl} className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
      <p className="text-xs text-red-400">{message}</p>
    </div>
  );
}

function SectionDivider({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <p className="text-[9px] font-bold uppercase tracking-widest text-slate-600 whitespace-nowrap">
        {children}
      </p>
      <div className="flex-1 h-px bg-white/[0.04]" />
    </div>
  );
}

function SaveBar({
  onSave, saving, label = "Save Changes",
}: {
  onSave: () => void; saving: boolean; label?: string;
}) {
  return (
    <div className="flex justify-end pt-4 border-t border-white/[0.05] mt-2">
      <button
        onClick={onSave}
        disabled={saving}
        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded transition-all"
      >
        {saving ? (
          <>
            <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Saving…
          </>
        ) : (
          label
        )}
      </button>
    </div>
  );
}

// ─── Delete Confirmation Modal ────────────────────────────────────────────────
// Requires the user to type "DELETE" before the destructive action fires.
// Used for both zone deletion and full account removal.
interface DeleteTarget {
  type: "zone" | "account";
  id: string;
  name: string;
  /** Extra detail shown under the name (e.g., camera count) */
  detail?: string;
}

function DeleteConfirmModal({
  target,
  onConfirm,
  onCancel,
}: {
  target: DeleteTarget;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [input, setInput] = useState("");
  const confirmed = input === "DELETE";

  const consequences =
    target.type === "zone"
      ? "All cameras and contacts linked to this zone will be permanently removed."
      : "All zones, cameras, and contacts for this account will be permanently removed. The account itself (credentials) will also be deleted.";

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 px-4"
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div className="bg-[#0d0f14] border border-red-500/25 rounded-lg p-6 w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-start gap-3 mb-5">
          <div className="w-8 h-8 bg-red-500/10 border border-red-500/20 rounded flex items-center justify-center shrink-0 mt-0.5">
            <Ic d={I.excl} className="w-4 h-4 text-red-400" />
          </div>
          <div>
            <p className="text-[10px] text-red-400 uppercase tracking-widest font-bold">
              Permanent Deletion
            </p>
            <h3 className="text-sm font-semibold text-white mt-0.5">
              Delete {target.type === "zone" ? "Zone" : "Account"}
            </h3>
          </div>
        </div>

        {/* What's being deleted */}
        <div className="bg-white/[0.02] border border-white/[0.06] rounded px-4 py-3 mb-4">
          <p className="text-sm font-medium text-white">{target.name}</p>
          {target.detail && (
            <p className="text-[11px] text-slate-500 mt-0.5">{target.detail}</p>
          )}
        </div>

        <p className="text-xs text-slate-400 mb-4 leading-relaxed">{consequences}</p>

        {/* Confirmation input */}
        <div className="mb-4">
          <label className="text-[10px] text-slate-500 uppercase tracking-widest font-bold block mb-1.5">
            Type DELETE to confirm
          </label>
          <input
            className={
              "w-full bg-black/30 border rounded px-3 py-2 text-sm font-mono outline-none transition-all " +
              (confirmed
                ? "border-red-500/50 text-red-300"
                : "border-white/[0.08] text-white focus:border-white/20")
            }
            placeholder="DELETE"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            autoFocus
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-xs text-slate-400 hover:text-slate-200 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!confirmed}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-30 disabled:cursor-not-allowed text-white text-xs font-bold rounded uppercase tracking-wide transition-all"
          >
            <Ic d={I.trash} className="w-3.5 h-3.5" />
            Delete {target.type === "zone" ? "Zone" : "Account"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function SetupPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [zoneCameras, setZoneCameras] = useState<Record<string, Camera[]>>({});
  const [zoneContacts, setZoneContacts] = useState<Record<string, Contact[]>>({});
  const [loading, setLoading] = useState(true);

  // Panel state
  const [expandedAccountId, setExpandedAccountId] = useState<string | null>(null);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [rightView, setRightView] = useState<"empty" | "wizard" | "zone-detail">("empty");
  const [detailTab, setDetailTab] = useState<
    "overview" | "schedule" | "contacts" | "procedures" | "site-info"
  >("overview");

  // Wizard state
  const [wiz, setWiz] = useState({ ...defaultWizard });
  const wizSet = (patch: Partial<typeof defaultWizard>) =>
    setWiz((prev) => ({ ...prev, ...patch }));

  // Zone detail editable state (loaded from zone on selection)
  const [siteInfo, setSiteInfo] = useState<Record<string, any>>(defaultSiteInfo());
  const [weeklySchedule, setWeeklySchedule] = useState<Record<string, any>>(
    defaultWeeklySchedule()
  );
  const [holidaySchedule, setHolidaySchedule] = useState<Record<string, any>>(
    defaultHolidaySchedule()
  );
  const [saving, setSaving] = useState(false);

  // Contact editing
  const [editContact, setEditContact] = useState<Contact | null>(null);

  // Deletion modal
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);

  // ── Data loading ─────────────────────────────────────────────────────────
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
        setWiz({
          ...defaultWizard, ...state,
          step: 3, isLoading: false, error: "",
          selectedTag: "__UNSET__",
        });
        setRightView("wizard");
        sessionStorage.removeItem("gg_wizard");
      } catch (_) {
        sessionStorage.removeItem("gg_wizard");
      }
    }
  }, [fetchData]);

  const loadZoneCameras = useCallback(async (zoneId: string) => {
    const { data } = await supabase
      .from("cameras")
      .select("*")
      .eq("zone_id", zoneId)
      .order("name");
    if (data) setZoneCameras((p) => ({ ...p, [zoneId]: data }));
  }, []);

  const loadZoneContacts = useCallback(async (zoneId: string) => {
    const { data } = await supabase
      .from("contacts")
      .select("*")
      .eq("zone_id", zoneId)
      .order("priority");
    if (data) setZoneContacts((p) => ({ ...p, [zoneId]: data }));
  }, []);

  const handleSelectZone = (zone: Zone) => {
    setSelectedZoneId(zone.id);
    setRightView("zone-detail");
    setDetailTab("overview");
    setEditContact(null);
    // Populate editable fields from zone data
    setSiteInfo({ ...defaultSiteInfo(), ...(zone.site_info ?? {}) });
    setWeeklySchedule({ ...defaultWeeklySchedule(), ...(zone.weekly_schedule ?? {}) });
    setHolidaySchedule({ ...defaultHolidaySchedule(), ...(zone.holiday_schedule ?? {}) });
    loadZoneCameras(zone.id);
    loadZoneContacts(zone.id);
  };

  // ── Toggles ──────────────────────────────────────────────────────────────
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

  // ── Save handlers ─────────────────────────────────────────────────────────
  const saveSiteInfo = async (zoneId: string) => {
    setSaving(true);
    await supabase.from("zones").update({ site_info: siteInfo }).eq("id", zoneId);
    setSaving(false);
  };

  const saveSchedule = async (zoneId: string) => {
    setSaving(true);
    await supabase
      .from("zones")
      .update({ weekly_schedule: weeklySchedule, holiday_schedule: holidaySchedule })
      .eq("id", zoneId);
    setSaving(false);
  };

  // ── Contact CRUD ──────────────────────────────────────────────────────────
  const saveContact = async (contact: Contact) => {
    if (contact.id) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id, zone_id, ...updates } = contact;
      await supabase.from("contacts").update(updates).eq("id", id);
    } else {
      await supabase.from("contacts").insert([contact]);
    }
    loadZoneContacts(contact.zone_id);
    setEditContact(null);
  };

  const deleteContact = async (contactId: string, zoneId: string) => {
    await supabase.from("contacts").delete().eq("id", contactId);
    loadZoneContacts(zoneId);
  };

  // ── Harvest cameras ───────────────────────────────────────────────────────
  const harvestCameras = async (zoneId: string) => {
    setSaving(true);
    try {
      const res = await fetch("/api/een/sync-hardware", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zoneId }),
      });
      const result = await res.json();
      if (result.success) await loadZoneCameras(zoneId);
    } finally {
      setSaving(false);
    }
  };

  // ── Delete camera (individual — re-syncable from EEN) ────────────────────
  const deleteCamera = async (camId: string, zoneId: string) => {
    await supabase.from("cameras").delete().eq("id", camId);
    setZoneCameras((p) => ({
      ...p,
      [zoneId]: (p[zoneId] ?? []).filter((c) => c.id !== camId),
    }));
  };

  // ── Delete zone (requires modal confirmation) ─────────────────────────────
  const confirmDeleteZone = (zone: Zone, camCount: number) => {
    setDeleteTarget({
      type:   "zone",
      id:     zone.id,
      name:   zone.name,
      detail: `${camCount} camera${camCount !== 1 ? "s" : ""} · EEN tag: ${zone.een_tag || "single site"}`,
    });
  };

  const executeDeleteZone = async () => {
    if (!deleteTarget || deleteTarget.type !== "zone") return;
    const zoneId = deleteTarget.id;
    // Delete child records first (cameras have ON DELETE SET NULL, not CASCADE)
    await supabase.from("cameras").delete().eq("zone_id", zoneId);
    await supabase.from("contacts").delete().eq("zone_id", zoneId);
    await supabase.from("zones").delete().eq("id", zoneId);
    setDeleteTarget(null);
    setSelectedZoneId(null);
    setRightView("empty");
    fetchData();
  };

  // ── Delete account + all children ────────────────────────────────────────
  const confirmDeleteAccount = (account: Account, zoneCount: number) => {
    setDeleteTarget({
      type:   "account",
      id:     account.id,
      name:   account.name,
      detail: `${zoneCount} zone${zoneCount !== 1 ? "s" : ""} and all associated cameras and contacts`,
    });
  };

  const executeDeleteAccount = async () => {
    if (!deleteTarget || deleteTarget.type !== "account") return;
    const accountId = deleteTarget.id;
    const { data: accountZones } = await supabase
      .from("zones")
      .select("id")
      .eq("account_id", accountId);
    const zoneIds = (accountZones ?? []).map((z: any) => z.id);
    if (zoneIds.length > 0) {
      await supabase.from("cameras").delete().in("zone_id", zoneIds);
      await supabase.from("contacts").delete().in("zone_id", zoneIds);
      await supabase.from("zones").delete().in("id", zoneIds);
    }
    await supabase.from("accounts").delete().eq("id", accountId);
    setDeleteTarget(null);
    if (expandedAccountId === accountId) setExpandedAccountId(null);
    setSelectedZoneId(null);
    setRightView("empty");
    fetchData();
  };

  // ══════════════════════════════════════════════════════════════════════════
  // WIZARD ACTIONS
  // ══════════════════════════════════════════════════════════════════════════

  const wizStep1Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wiz.accountName || !wiz.apiKey) {
      wizSet({ error: "Account name and EEN API Key are required." });
      return;
    }
    wizSet({ isLoading: true, error: "" });
    try {
      const { data, error } = await supabase
        .from("accounts")
        .insert([
          {
            name:        wiz.accountName.trim(),
            een_api_key: wiz.apiKey.trim(),
          },
        ])
        .select()
        .single();

      if (error) throw new Error(error.message);

      sessionStorage.setItem(
        "gg_wizard",
        JSON.stringify({ accountId: data.id, accountName: wiz.accountName.trim() })
      );

      eagleEyeService.login(wiz.accountName.trim());
    } catch (err: any) {
      wizSet({ isLoading: false, error: err.message });
    }
  };

  const wizScanTags = async () => {
    wizSet({ isLoading: true, error: "", discoveredTags: [], selectedTag: "__UNSET__" });
    try {
      const res = await fetch("/api/een/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId: wiz.accountId }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      wizSet({ isLoading: false, discoveredTags: data.tags ?? [] });
    } catch (err: any) {
      wizSet({ isLoading: false, error: err.message });
    }
  };

  const wizStep3Next = () => {
    if (wiz.selectedTag === "__UNSET__") {
      wizSet({ error: 'Select "All Cameras — Single Site" or a specific property tag.' });
      return;
    }
    wizSet({ step: 4, error: "" });
  };

  // ── Step 4 → 5: Upsert zone (UUID-safe) and sync cameras ─────────────────
  const wizStep4Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    wizSet({ isLoading: true, error: "" });
    try {
      // selectedTag === '' means single-site (no tag filter)
      const tagValue = wiz.selectedTag === "__UNSET__" ? "" : wiz.selectedTag;
      const zoneName = tagValue || wiz.accountName || "Default Zone";

      // Use onConflict natural key — Supabase assigns a proper UUID
      const { data: zoneData, error: zoneErr } = await supabase
        .from("zones")
        .upsert(
          [
            {
              account_id:     wiz.accountId,
              name:           zoneName,
              een_tag:        tagValue,
              is_monitored:   wiz.isMonitored,
              timezone:       wiz.timezone,
              schedule_start: wiz.scheduleStart,
              schedule_end:   wiz.scheduleEnd,
            },
          ],
          { onConflict: "account_id,een_tag" }
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
      if (!result.success) throw new Error(result.error ?? "Camera sync failed.");

      const { data: cams } = await supabase
        .from("cameras")
        .select("*")
        .eq("zone_id", zoneData.id)
        .order("name");

      wizSet({
        step: 5,
        isLoading: false,
        harvestedZoneId: zoneData.id,
        harvestedCameras: cams ?? [],
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

  // ── Add zone to an existing account (skips credentials + OAuth) ──────────
  const startAddZoneForAccount = (account: Account) => {
    setWiz({
      ...defaultWizard,
      accountId:   account.id,
      accountName: account.name,
      step:        3,   // jump straight to tag discovery
    });
    setSelectedZoneId(null);
    setRightView("wizard");
    setExpandedAccountId(account.id);
  };

  const wizFinish = () => {
    // Navigate to the newly created zone's detail view
    const harvestedId = wiz.harvestedZoneId;
    setWiz({ ...defaultWizard });
    fetchData().then(() => {
      if (harvestedId) {
        const zone = zones.find((z) => z.id === harvestedId);
        if (zone) handleSelectZone(zone);
        else setRightView("empty");
      } else {
        setRightView("empty");
      }
    });
  };

  // ══════════════════════════════════════════════════════════════════════════
  // WIZARD RENDER
  // ══════════════════════════════════════════════════════════════════════════
  const renderWizard = () => (
    <div className="max-w-xl w-full flex flex-col h-full">
      {/* Wizard header */}
      <div className="mb-6">
        <p className="text-[9px] text-slate-600 uppercase tracking-widest font-bold mb-1">
          {wiz.step >= 3 && wiz.accountName ? wiz.accountName : "New Account"}
        </p>
        <h2 className="text-base font-semibold text-white tracking-tight">
          {wiz.step >= 3 && wiz.accountName ? "Add Property Zone" : "EEN Account Setup Wizard"}
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          {wiz.step >= 3 && wiz.accountName
            ? "Select a tag to provision as a monitored zone under this account."
            : "Connect an Eagle Eye Networks account and provision its property zones."}
        </p>
      </div>

      <StepBar current={wiz.step} />
      <ErrorBanner message={wiz.error} />

      {/* ── Step 1: Credentials ──────────────────────────────────────────── */}
      {wiz.step === 1 && (
        <form onSubmit={wizStep1Submit} className="flex flex-col gap-5 flex-1">
          <Field
            label="Account Name"
            help="Internal label for this EEN parent account (e.g., Pegasus Residential)"
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
            label="EEN API Key"
            help="The per-account API key from the customer's EEN portal — used to authenticate camera requests"
          >
            <input
              className={inputMonoCls}
              placeholder="Paste API Key…"
              value={wiz.apiKey}
              onChange={(e) => wizSet({ apiKey: e.target.value })}
            />
          </Field>

          <details className="bg-indigo-950/20 border border-indigo-500/[0.15] rounded">
            <summary className="flex items-center gap-2 px-4 py-2.5 cursor-pointer text-[11px] text-indigo-400 font-semibold uppercase tracking-widest select-none list-none">
              <Ic d={I.key} className="w-3 h-3" />
              How to generate the EEN API Key
            </summary>
            <ol className="px-5 pb-4 pt-2 text-xs text-slate-400 space-y-1.5 list-decimal list-inside leading-relaxed border-t border-indigo-500/10">
              <li>Log in to your <strong className="text-slate-300">Reseller account</strong> in EEN.</li>
              <li>Click the <strong className="text-slate-300">eye icon</strong> to switch into the target customer sub-account.</li>
              <li>Navigate to <strong className="text-slate-300">Account Settings → Control</strong>.</li>
              <li>Click <strong className="text-slate-300">Create API Key → Generate new API key</strong>.</li>
              <li>Name it <code className="bg-black/40 px-1 text-emerald-400">GateGuard - [site name]</code>.</li>
              <li>Copy the <strong className="text-slate-300">API Key</strong> value and paste it above.</li>
            </ol>
          </details>

          <div className="mt-auto pt-4 border-t border-white/[0.05] flex justify-end">
            <button
              type="submit"
              disabled={wiz.isLoading}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded transition-all"
            >
              {wiz.isLoading ? (
                "Saving…"
              ) : (
                <>Save & Authenticate <Ic d={I.arrowR} className="w-4 h-4" /></>
              )}
            </button>
          </div>
        </form>
      )}

      {/* ── Step 2: Redirect spinner ─────────────────────────────────────── */}
      {wiz.step === 2 && (
        <div className="flex flex-col items-center justify-center flex-1 gap-4 text-center">
          <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <div>
            <p className="text-sm text-slate-300 font-medium">
              Redirecting to Eagle Eye Networks…
            </p>
            <p className="text-xs text-slate-600 mt-1">
              Complete the OAuth flow — you'll be returned here automatically.
            </p>
          </div>
        </div>
      )}

      {/* ── Step 3: Discovery ────────────────────────────────────────────── */}
      {wiz.step === 3 && (
        <div className="flex flex-col gap-5 flex-1">
          <div className="flex items-center gap-2.5 bg-emerald-500/[0.08] border border-emerald-500/20 rounded p-3">
            <Ic d={I.check} className="w-4 h-4 text-emerald-400 shrink-0" />
            <p className="text-xs text-emerald-400 font-medium">
              Eagle Eye authentication successful — account is now connected.
            </p>
          </div>

          {/* Tag scan */}
          <div className="bg-white/[0.02] border border-white/[0.05] rounded p-4">
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-2">
              Multi-Site Tag Scan
            </p>
            <p className="text-xs text-slate-500 mb-3 leading-relaxed">
              For multi-site EEN accounts, scan to retrieve configured property tags.
              Single-site accounts can skip the scan — select "All Cameras" below.
            </p>
            <button
              type="button"
              onClick={wizScanTags}
              disabled={wiz.isLoading}
              className="flex items-center gap-1.5 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.10] text-slate-300 text-xs font-medium px-4 py-2 rounded transition-all disabled:opacity-50"
            >
              <Ic d={I.search} className="w-3.5 h-3.5" />
              {wiz.isLoading ? "Scanning EEN…" : "Scan for Property Tags"}
            </button>
          </div>

          {/* Zone selection */}
          <Field label="Select Property Zone">
            <div className="flex flex-col gap-1.5 max-h-64 overflow-y-auto pr-0.5">
              {/* Single-site option — always shown first */}
              <label
                className={`flex items-center gap-3 px-3 py-3 rounded border cursor-pointer transition-all ${
                  wiz.selectedTag === ""
                    ? "bg-indigo-600/15 border-indigo-500/40 text-white"
                    : "bg-white/[0.02] border-white/[0.05] text-slate-400 hover:bg-white/[0.04]"
                }`}
              >
                <input
                  type="radio"
                  name="zone-tag"
                  value=""
                  checked={wiz.selectedTag === ""}
                  onChange={() => wizSet({ selectedTag: "" })}
                  className="accent-indigo-500 shrink-0"
                />
                <Ic d={I.building} className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <div>
                  <span className="text-sm font-medium">All Cameras — Single Site</span>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    No tag filter — syncs all cameras on this EEN account
                  </p>
                </div>
              </label>

              {/* Discovered tags */}
              {wiz.discoveredTags.map((tag) => (
                <label
                  key={tag}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded border cursor-pointer transition-all ${
                    wiz.selectedTag === tag
                      ? "bg-indigo-600/15 border-indigo-500/40 text-white"
                      : "bg-white/[0.02] border-white/[0.05] text-slate-400 hover:bg-white/[0.04]"
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

              {wiz.discoveredTags.length === 0 && !wiz.isLoading && (
                <p className="text-[11px] text-slate-700 py-2 px-3 italic">
                  Run a scan above to discover tags, or select "All Cameras" for single-site.
                </p>
              )}
            </div>
          </Field>

          <div className="mt-auto pt-4 border-t border-white/[0.05] flex justify-end">
            <button
              type="button"
              onClick={wizStep3Next}
              disabled={wiz.selectedTag === "__UNSET__"}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm font-medium px-5 py-2 rounded transition-all"
            >
              Configure Zone <Ic d={I.arrowR} className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Step 4: Configure ────────────────────────────────────────────── */}
      {wiz.step === 4 && (
        <form onSubmit={wizStep4Submit} className="flex flex-col gap-5 flex-1">
          {/* Selected zone badge */}
          <div className="bg-white/[0.02] border border-white/[0.05] rounded px-4 py-3">
            <p className="text-[9px] text-slate-600 uppercase tracking-widest font-bold">
              Selected Zone
            </p>
            <p className="text-sm text-white font-medium mt-0.5">
              {wiz.selectedTag === "" ? "All Cameras — Single Site" : wiz.selectedTag}
            </p>
          </div>

          <Field label="Timezone">
            <select
              className={inputCls + " cursor-pointer"}
              value={wiz.timezone}
              onChange={(e) => wizSet({ timezone: e.target.value })}
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz} className="bg-[#0a0c11]">{tz}</option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Default Window Start" help="Default monitoring start time (24h)">
              <input
                className={inputCls}
                type="time"
                value={wiz.scheduleStart}
                onChange={(e) => wizSet({ scheduleStart: e.target.value })}
              />
            </Field>
            <Field label="Default Window End" help="Default monitoring end time (24h)">
              <input
                className={inputCls}
                type="time"
                value={wiz.scheduleEnd}
                onChange={(e) => wizSet({ scheduleEnd: e.target.value })}
              />
            </Field>
          </div>

          <div
            className="flex items-center gap-4 px-4 py-3 bg-white/[0.02] border border-white/[0.05] rounded cursor-pointer hover:bg-white/[0.04] transition-all"
            onClick={() => wizSet({ isMonitored: !wiz.isMonitored })}
          >
            <Toggle
              checked={wiz.isMonitored}
              onChange={() => wizSet({ isMonitored: !wiz.isMonitored })}
            />
            <div>
              <p className="text-sm text-white font-medium">Enable SOC Monitoring</p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Arms this zone — alarms will surface in the Dispatch Station
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2 bg-indigo-950/20 border border-indigo-500/[0.12] rounded p-3">
            <Ic d={I.info} className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Detailed scheduling, contacts, procedures, and site information can be configured
              in the zone detail view after setup completes.
            </p>
          </div>

          <div className="mt-auto pt-4 border-t border-white/[0.05] flex justify-end">
            <button
              type="submit"
              disabled={wiz.isLoading}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded transition-all"
            >
              {wiz.isLoading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving & Syncing…
                </>
              ) : (
                <>Save & Sync Cameras <Ic d={I.arrowR} className="w-4 h-4" /></>
              )}
            </button>
          </div>
        </form>
      )}

      {/* ── Step 5: Complete ─────────────────────────────────────────────── */}
      {wiz.step === 5 && (
        <div className="flex flex-col gap-5 flex-1">
          <div className="bg-emerald-500/[0.08] border border-emerald-500/20 rounded p-4">
            <div className="flex items-center gap-2 mb-1">
              <Ic d={I.check} className="w-4 h-4 text-emerald-400" />
              <p className="text-sm font-semibold text-emerald-400">Setup Complete</p>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              <span className="text-white">{wiz.harvestedCameras.length}</span> camera
              {wiz.harvestedCameras.length !== 1 ? "s" : ""} synced
              {wiz.selectedTag ? (
                <> under tag <span className="text-white">"{wiz.selectedTag}"</span></>
              ) : (
                " (all cameras — single site)"
              )}.
              Toggle per-device monitoring below, then click Finish.
            </p>
          </div>

          <div>
            <SectionDivider>Hardware Nodes</SectionDivider>
            <div className="border border-white/[0.05] rounded overflow-hidden">
              {wiz.harvestedCameras.length === 0 && (
                <p className="text-xs text-slate-600 py-4 text-center">
                  No cameras returned by EEN sync.
                </p>
              )}
              {wiz.harvestedCameras.map((cam, idx) => (
                <div
                  key={cam.id}
                  className={`flex items-center justify-between px-3 py-2.5 ${
                    idx < wiz.harvestedCameras.length - 1
                      ? "border-b border-white/[0.04]"
                      : ""
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-1.5 h-1.5 rounded-full ${
                        cam.is_monitored ? "bg-emerald-400" : "bg-slate-700"
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

          <div className="mt-auto pt-4 border-t border-white/[0.05] flex items-center justify-between gap-4">
            <p className="text-[11px] text-slate-600">
              Configure contacts, procedures & full schedule in the zone detail view.
            </p>
            <button
              onClick={wizFinish}
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-5 py-2 rounded transition-all whitespace-nowrap"
            >
              Finish & View Zone
            </button>
          </div>
        </div>
      )}
    </div>
  );

  // ══════════════════════════════════════════════════════════════════════════
  // ZONE DETAIL RENDER
  // ══════════════════════════════════════════════════════════════════════════
  const renderZoneDetail = () => {
    const zone = zones.find((z) => z.id === selectedZoneId);
    if (!zone) return null;

    const cams = zoneCameras[zone.id] ?? [];
    const contacts = zoneContacts[zone.id] ?? [];

    const TABS = [
      { key: "overview",   label: "Overview" },
      { key: "schedule",   label: "Schedule" },
      { key: "contacts",   label: contacts.length ? `Contacts (${contacts.length})` : "Contacts" },
      { key: "procedures", label: "Procedures" },
      { key: "site-info",  label: "Site Info" },
    ] as const;

    return (
      <div className="flex flex-col h-full overflow-hidden">
        {/* Zone header */}
        <div className="flex items-start justify-between mb-5 shrink-0">
          <div>
            <p className="text-[9px] text-slate-600 uppercase tracking-widest font-bold">
              Property Zone
            </p>
            <h2 className="text-base font-semibold text-white mt-0.5">{zone.name}</h2>
            {zone.een_tag && (
              <p className="text-[11px] text-slate-600 font-mono mt-0.5">
                EEN Tag: {zone.een_tag}
              </p>
            )}
            {!zone.een_tag && (
              <p className="text-[11px] text-slate-700 mt-0.5">Single Site — All Cameras</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest border ${
                zone.is_monitored
                  ? "bg-emerald-500/[0.08] border-emerald-500/20 text-emerald-400"
                  : "bg-white/[0.02] border-white/[0.06] text-slate-600"
              }`}
            >
              <div
                className={`w-1.5 h-1.5 rounded-full ${
                  zone.is_monitored ? "bg-emerald-400" : "bg-slate-700"
                }`}
              />
              {zone.is_monitored ? "SOC Armed" : "Unmonitored"}
            </div>
            {/* Delete zone */}
            <button
              onClick={() => confirmDeleteZone(zone, cams.length)}
              title="Delete this zone"
              className="p-1.5 text-slate-700 hover:text-red-400 hover:bg-red-500/10 rounded transition-all"
            >
              <Ic d={I.trash} className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex border-b border-white/[0.06] mb-6 shrink-0 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setDetailTab(tab.key as any)}
              className={`px-4 py-2.5 text-[11px] font-bold tracking-widest uppercase whitespace-nowrap border-b-2 transition-all ${
                detailTab === tab.key
                  ? "border-indigo-500 text-indigo-400"
                  : "border-transparent text-slate-600 hover:text-slate-400"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto">

          {/* ────────────────── OVERVIEW TAB ────────────────── */}
          {detailTab === "overview" && (
            <div className="flex flex-col gap-5 max-w-xl">
              {/* Meta grid */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  {
                    label: "Tag",
                    value: zone.een_tag || "— Single Site",
                    icon: I.tag,
                  },
                  {
                    label: "Schedule",
                    value: zone.schedule_start
                      ? `${zone.schedule_start} – ${zone.schedule_end}`
                      : "Not configured",
                    icon: I.clock,
                  },
                  {
                    label: "Timezone",
                    value: zone.timezone || "Not set",
                    icon: I.signal,
                  },
                ].map(({ label, value, icon }) => (
                  <div
                    key={label}
                    className="bg-white/[0.02] border border-white/[0.05] rounded px-3 py-2.5"
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <Ic d={icon} className="w-3 h-3 text-slate-600" />
                      <p className="text-[9px] text-slate-600 uppercase tracking-widest">
                        {label}
                      </p>
                    </div>
                    <p className="text-xs text-slate-300 font-mono truncate">{value}</p>
                  </div>
                ))}
              </div>

              {/* Monitoring toggle */}
              <div
                className="flex items-center gap-4 px-4 py-3 bg-white/[0.02] border border-white/[0.05] rounded cursor-pointer hover:bg-white/[0.04] transition-all"
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
                    {zone.is_monitored ? "" : "not "}
                    appear in the Dispatch Station
                  </p>
                </div>
              </div>

              {/* Camera list */}
              <div>
                <div className="flex items-center mb-3">
                  <SectionDivider>Hardware Nodes ({cams.length})</SectionDivider>
                  <button
                    onClick={() => harvestCameras(zone.id)}
                    disabled={saving}
                    className="flex items-center gap-1.5 text-[10px] text-slate-600 hover:text-slate-300 transition-all disabled:opacity-50 ml-3 shrink-0 whitespace-nowrap"
                  >
                    <Ic d={I.refresh} className="w-3 h-3" />
                    {saving ? "Syncing…" : "Re-Sync EEN"}
                  </button>
                </div>

                {cams.length === 0 ? (
                  <div className="flex items-center justify-center h-16 border border-white/[0.05] rounded text-[11px] text-slate-700 uppercase tracking-wider">
                    No cameras — click Re-Sync EEN to populate
                  </div>
                ) : (
                  <div className="border border-white/[0.05] rounded overflow-hidden">
                    {cams.map((cam, idx) => (
                      <div
                        key={cam.id}
                        className={`flex items-center gap-2 px-3 py-2.5 hover:bg-white/[0.03] transition-all group ${
                          idx < cams.length - 1 ? "border-b border-white/[0.04]" : ""
                        }`}
                      >
                        <div className="flex items-center gap-2.5 flex-1 min-w-0">
                          <div
                            className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                              cam.is_monitored ? "bg-emerald-400" : "bg-slate-700"
                            }`}
                          />
                          <span className="text-sm text-slate-300 truncate">{cam.name}</span>
                        </div>
                        <Toggle
                          checked={cam.is_monitored}
                          onChange={() => toggleCamera(cam)}
                        />
                        <button
                          onClick={() => deleteCamera(cam.id, cam.zone_id)}
                          title="Remove camera (re-syncable from EEN)"
                          className="opacity-0 group-hover:opacity-100 p-1 text-slate-700 hover:text-red-400 transition-all shrink-0"
                        >
                          <Ic d={I.trash} className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ────────────────── SCHEDULE TAB ────────────────── */}
          {detailTab === "schedule" && (
            <div className="flex flex-col gap-6 max-w-2xl">
              <div>
                <SectionDivider>Weekly Monitoring Schedule</SectionDivider>
                <div className="border border-white/[0.05] rounded overflow-hidden">
                  {/* Table header */}
                  <div className="grid grid-cols-[64px_72px_1fr_1fr_1fr] bg-white/[0.02] border-b border-white/[0.05] px-3 py-2 gap-2">
                    {["Day", "Active", "Shift 1", "Shift 2", "Shift 3"].map((h) => (
                      <p
                        key={h}
                        className="text-[9px] text-slate-600 uppercase tracking-widest font-bold"
                      >
                        {h}
                      </p>
                    ))}
                  </div>

                  {DAYS.map((day, rowIdx) => {
                    const ds = weeklySchedule[day] ?? defaultDaySchedule();
                    const setDs = (patch: Partial<typeof ds>) =>
                      setWeeklySchedule((prev) => ({
                        ...prev,
                        [day]: { ...prev[day], ...patch },
                      }));
                    const setShift = (
                      s: "shift1" | "shift2" | "shift3",
                      patch: Partial<ReturnType<typeof defaultShift>>
                    ) =>
                      setDs({
                        [s]: { ...(ds[s] ?? defaultShift()), ...patch },
                      });
                    const toggleShift = (s: "shift2" | "shift3") =>
                      setDs({ [s]: ds[s] ? null : defaultShift() });

                    const ShiftCell = ({
                      shiftKey,
                    }: {
                      shiftKey: "shift1" | "shift2" | "shift3";
                    }) => {
                      if (!ds.operating) return <p className="text-[10px] text-slate-800">—</p>;
                      const shift = ds[shiftKey];
                      if (!shift && shiftKey !== "shift1") {
                        return (
                          <button
                            type="button"
                            onClick={() => toggleShift(shiftKey as "shift2" | "shift3")}
                            className="text-[10px] text-slate-700 hover:text-indigo-400 transition-all text-left"
                          >
                            + Add shift
                          </button>
                        );
                      }
                      if (!shift) return null;
                      return (
                        <div className="flex flex-col gap-1">
                          <div className="flex gap-1">
                            <input
                              type="time"
                              value={shift.start}
                              onChange={(e) => setShift(shiftKey, { start: e.target.value })}
                              className={inputSmCls + " w-20"}
                            />
                            <input
                              type="time"
                              value={shift.end}
                              onChange={(e) => setShift(shiftKey, { end: e.target.value })}
                              className={inputSmCls + " w-20"}
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <label className="flex items-center gap-1.5 text-[10px] text-slate-600 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={shift.concierge}
                                onChange={(e) =>
                                  setShift(shiftKey, { concierge: e.target.checked })
                                }
                                className="accent-indigo-500 w-3 h-3"
                              />
                              Concierge
                            </label>
                            {shiftKey !== "shift1" && (
                              <button
                                type="button"
                                onClick={() =>
                                  toggleShift(shiftKey as "shift2" | "shift3")
                                }
                                className="text-[10px] text-red-500/50 hover:text-red-400 transition-all"
                              >
                                Remove
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    };

                    return (
                      <div
                        key={day}
                        className={`grid grid-cols-[64px_72px_1fr_1fr_1fr] items-start gap-2 px-3 py-3 ${
                          rowIdx < DAYS.length - 1 ? "border-b border-white/[0.04]" : ""
                        } hover:bg-white/[0.02] transition-all`}
                      >
                        <p className="text-xs font-bold text-slate-400 pt-1">
                          {DAY_LABELS[day]}
                        </p>
                        <div className="pt-0.5">
                          <Toggle
                            checked={ds.operating}
                            onChange={() => setDs({ operating: !ds.operating })}
                          />
                        </div>
                        <ShiftCell shiftKey="shift1" />
                        <ShiftCell shiftKey="shift2" />
                        <ShiftCell shiftKey="shift3" />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Holidays */}
              <div>
                <SectionDivider>Holidays & Special Hours</SectionDivider>
                <div className="border border-white/[0.05] rounded overflow-hidden">
                  <div className="grid grid-cols-[160px_1fr_72px] bg-white/[0.02] border-b border-white/[0.05] px-3 py-2 gap-3">
                    {["Holiday", "Schedule / Notes", "24 / 7"].map((h) => (
                      <p
                        key={h}
                        className="text-[9px] text-slate-600 uppercase tracking-widest font-bold"
                      >
                        {h}
                      </p>
                    ))}
                  </div>
                  {HOLIDAYS.map(({ key, label }, idx) => {
                    const hs = holidaySchedule[key] ?? { schedule: "", is_247: false };
                    return (
                      <div
                        key={key}
                        className={`grid grid-cols-[160px_1fr_72px] items-center gap-3 px-3 py-2 ${
                          idx < HOLIDAYS.length - 1 ? "border-b border-white/[0.04]" : ""
                        }`}
                      >
                        <p className="text-xs text-slate-400">{label}</p>
                        <input
                          className={inputSmCls + " w-full"}
                          placeholder="e.g., 18:00–02:00 or Closed"
                          value={hs.schedule}
                          onChange={(e) =>
                            setHolidaySchedule((p) => ({
                              ...p,
                              [key]: { ...p[key], schedule: e.target.value },
                            }))
                          }
                        />
                        <div className="flex justify-center">
                          <Toggle
                            checked={hs.is_247}
                            onChange={() =>
                              setHolidaySchedule((p) => ({
                                ...p,
                                [key]: { ...p[key], is_247: !p[key]?.is_247 },
                              }))
                            }
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <SaveBar onSave={() => saveSchedule(zone.id)} saving={saving} label="Save Schedule" />
            </div>
          )}

          {/* ────────────────── CONTACTS TAB ────────────────── */}
          {detailTab === "contacts" && (
            <div className="flex flex-col gap-4 max-w-xl">
              <div className="flex items-center">
                <SectionDivider>Personnel &amp; Emergency Contacts</SectionDivider>
                <button
                  onClick={() =>
                    setEditContact({
                      zone_id: zone.id,
                      name: "",
                      role: "Emergency Contact",
                      phone: "",
                      email: "",
                      priority: contacts.length,
                    })
                  }
                  className="flex items-center gap-1.5 text-[11px] text-indigo-400 hover:text-indigo-300 transition-all ml-3 shrink-0"
                >
                  <Ic d={I.plus} className="w-3 h-3" />
                  Add Contact
                </button>
              </div>

              {/* Inline add/edit form */}
              {editContact && (
                <div className="bg-white/[0.02] border border-indigo-500/20 rounded p-4 flex flex-col gap-3">
                  <p className="text-[9px] text-indigo-400 uppercase tracking-widest font-bold">
                    {editContact.id ? "Edit Contact" : "New Contact"}
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Name">
                      <input
                        className={inputCls}
                        placeholder="Full name"
                        value={editContact.name}
                        onChange={(e) =>
                          setEditContact((c) => c && { ...c, name: e.target.value })
                        }
                      />
                    </Field>
                    <Field label="Role">
                      <select
                        className={inputCls + " cursor-pointer"}
                        value={editContact.role}
                        onChange={(e) =>
                          setEditContact((c) => c && { ...c, role: e.target.value })
                        }
                      >
                        {CONTACT_ROLES.map((r) => (
                          <option key={r} value={r} className="bg-[#0a0c11]">{r}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Phone">
                      <input
                        className={inputCls}
                        type="tel"
                        placeholder="(404) 555-0100"
                        value={editContact.phone}
                        onChange={(e) =>
                          setEditContact((c) => c && { ...c, phone: e.target.value })
                        }
                      />
                    </Field>
                    <Field label="Email">
                      <input
                        className={inputCls}
                        type="email"
                        placeholder="name@company.com"
                        value={editContact.email}
                        onChange={(e) =>
                          setEditContact((c) => c && { ...c, email: e.target.value })
                        }
                      />
                    </Field>
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setEditContact(null)}
                      className="text-xs text-slate-500 hover:text-slate-300 px-3 py-1.5 transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => editContact && saveContact(editContact)}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium px-4 py-1.5 rounded transition-all"
                    >
                      {editContact.id ? "Save Changes" : "Add Contact"}
                    </button>
                  </div>
                </div>
              )}

              {contacts.length === 0 && !editContact ? (
                <div className="flex flex-col items-center justify-center h-20 border border-white/[0.05] rounded text-[11px] text-slate-700 uppercase tracking-wider gap-1">
                  No contacts configured for this zone
                </div>
              ) : (
                <div className="border border-white/[0.05] rounded overflow-hidden">
                  {contacts.map((contact, idx) => (
                    <div
                      key={contact.id}
                      className={`flex items-center gap-3 px-3 py-3 group hover:bg-white/[0.02] transition-all ${
                        idx < contacts.length - 1 ? "border-b border-white/[0.04]" : ""
                      }`}
                    >
                      {/* Avatar */}
                      <div className="w-7 h-7 bg-white/[0.03] border border-white/[0.06] rounded flex items-center justify-center shrink-0">
                        <Ic d={I.user} className="w-3.5 h-3.5 text-slate-600" />
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-200 font-medium truncate">
                          {contact.name}
                        </p>
                        <p className="text-[9px] text-slate-600 uppercase tracking-widest mt-0.5">
                          {contact.role}
                        </p>
                      </div>

                      {/* Phone / email */}
                      <div className="text-right hidden sm:block mr-2">
                        {contact.phone && (
                          <p className="text-xs text-slate-400 font-mono">{contact.phone}</p>
                        )}
                        {contact.email && (
                          <p className="text-[11px] text-slate-600">{contact.email}</p>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all shrink-0">
                        <button
                          onClick={() => setEditContact(contact)}
                          className="p-1.5 hover:bg-white/[0.06] rounded text-slate-600 hover:text-slate-300 transition-all"
                        >
                          <Ic d={I.edit} className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => contact.id && deleteContact(contact.id, zone.id)}
                          className="p-1.5 hover:bg-red-500/10 rounded text-slate-700 hover:text-red-400 transition-all"
                        >
                          <Ic d={I.trash} className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Role key */}
              <div className="bg-white/[0.01] border border-white/[0.04] rounded p-3 mt-1">
                <p className="text-[9px] text-slate-700 uppercase tracking-widest font-bold mb-2">
                  Available Roles
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {CONTACT_ROLES.map((r) => (
                    <span
                      key={r}
                      className="text-[10px] text-slate-600 bg-white/[0.03] border border-white/[0.05] px-2 py-0.5 rounded"
                    >
                      {r}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ────────────────── PROCEDURES TAB ────────────────── */}
          {detailTab === "procedures" && (
            <div className="flex flex-col gap-4 max-w-xl">
              <SectionDivider>Custom Response Procedures</SectionDivider>
              <p className="text-xs text-slate-500 leading-relaxed">
                Define event-specific SOPs for operators responding to alarms at this zone.
                Procedures appear in the Dispatch Station during active alarm handling.
              </p>
              <div className="flex flex-col items-center justify-center h-28 border border-dashed border-white/[0.06] rounded text-[11px] text-slate-700 gap-2">
                <Ic d={I.list} className="w-5 h-5 text-slate-700" />
                Procedure editor — available in the next platform release
              </div>
            </div>
          )}

          {/* ────────────────── SITE INFO TAB ────────────────── */}
          {detailTab === "site-info" && (
            <div className="flex flex-col gap-6 max-w-xl">
              {/* Property & Customer */}
              <div>
                <SectionDivider>Property &amp; Customer Information</SectionDivider>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Property Name">
                    <input
                      className={inputCls}
                      placeholder="e.g., Willow Creek Apartments"
                      value={siteInfo.property ?? ""}
                      onChange={(e) =>
                        setSiteInfo((p) => ({ ...p, property: e.target.value }))
                      }
                    />
                  </Field>
                  <Field label="Customer Name">
                    <input
                      className={inputCls}
                      placeholder="e.g., Pegasus Residential"
                      value={siteInfo.customer_name ?? ""}
                      onChange={(e) =>
                        setSiteInfo((p) => ({ ...p, customer_name: e.target.value }))
                      }
                    />
                  </Field>
                  <div className="col-span-2">
                    <Field label="Service Address">
                      <input
                        className={inputCls}
                        placeholder="123 Main St, Atlanta, GA 30301"
                        value={siteInfo.service_address ?? ""}
                        onChange={(e) =>
                          setSiteInfo((p) => ({ ...p, service_address: e.target.value }))
                        }
                      />
                    </Field>
                  </div>
                  <Field label="Phone">
                    <input
                      className={inputCls}
                      type="tel"
                      placeholder="(404) 555-0100"
                      value={siteInfo.phone ?? ""}
                      onChange={(e) =>
                        setSiteInfo((p) => ({ ...p, phone: e.target.value }))
                      }
                    />
                  </Field>
                  <Field label="Email">
                    <input
                      className={inputCls}
                      type="email"
                      placeholder="manager@property.com"
                      value={siteInfo.email ?? ""}
                      onChange={(e) =>
                        setSiteInfo((p) => ({ ...p, email: e.target.value }))
                      }
                    />
                  </Field>
                </div>
              </div>

              {/* Guard & Security */}
              <div>
                <SectionDivider>Guard Service &amp; Security</SectionDivider>
                <div className="flex flex-col gap-3">
                  <div
                    className="flex items-center gap-4 px-4 py-3 bg-white/[0.02] border border-white/[0.05] rounded cursor-pointer hover:bg-white/[0.04] transition-all"
                    onClick={() =>
                      setSiteInfo((p) => ({ ...p, guard_on_site: !p.guard_on_site }))
                    }
                  >
                    <Toggle
                      checked={siteInfo.guard_on_site ?? false}
                      onChange={() =>
                        setSiteInfo((p) => ({ ...p, guard_on_site: !p.guard_on_site }))
                      }
                    />
                    <div>
                      <p className="text-sm text-white font-medium">Guard Service On Site</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        A physical security guard is stationed at this property
                      </p>
                    </div>
                  </div>

                  {siteInfo.guard_on_site && (
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Guard Company">
                        <input
                          className={inputCls}
                          placeholder="e.g., Allied Universal"
                          value={siteInfo.guard_company ?? ""}
                          onChange={(e) =>
                            setSiteInfo((p) => ({ ...p, guard_company: e.target.value }))
                          }
                        />
                      </Field>
                      <Field label="Guard Company Phone">
                        <input
                          className={inputCls}
                          type="tel"
                          placeholder="(404) 555-0200"
                          value={siteInfo.guard_phone ?? ""}
                          onChange={(e) =>
                            setSiteInfo((p) => ({ ...p, guard_phone: e.target.value }))
                          }
                        />
                      </Field>
                    </div>
                  )}
                </div>
              </div>

              {/* Cameras & Operations */}
              <div>
                <SectionDivider>Camera Directory &amp; Operations</SectionDivider>
                <div className="flex flex-col gap-3">
                  <Field
                    label="Camera Directory / Layout Notes"
                    help="Describe each camera's name, location, and coverage area"
                  >
                    <textarea
                      className={inputCls + " resize-none"}
                      rows={4}
                      placeholder={
                        "Cam 1 — Main entrance, faces parking lot\n" +
                        "Cam 2 — Parking Lot A, NW corner\n" +
                        "Cam 3 — Pool deck entrance"
                      }
                      value={siteInfo.camera_directory ?? ""}
                      onChange={(e) =>
                        setSiteInfo((p) => ({ ...p, camera_directory: e.target.value }))
                      }
                    />
                  </Field>

                  <Field
                    label="Expected Activity"
                    help="What is normal at this site during monitoring hours?"
                  >
                    <textarea
                      className={inputCls + " resize-none"}
                      rows={2}
                      placeholder="Residents may enter/exit at all hours. Delivery vehicles 7am–9pm…"
                      value={siteInfo.expected_activity ?? ""}
                      onChange={(e) =>
                        setSiteInfo((p) => ({ ...p, expected_activity: e.target.value }))
                      }
                    />
                  </Field>
                </div>
              </div>

              {/* Special Notes */}
              <div>
                <SectionDivider>Special Notes</SectionDivider>
                <textarea
                  className={inputCls + " resize-none"}
                  rows={3}
                  placeholder="Additional notes for operators — parking waivers, known issues, after-hours protocols…"
                  value={siteInfo.special_notes ?? ""}
                  onChange={(e) =>
                    setSiteInfo((p) => ({ ...p, special_notes: e.target.value }))
                  }
                />
              </div>

              <SaveBar
                onSave={() => saveSiteInfo(zone.id)}
                saving={saving}
                label="Save Site Info"
              />
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
      {/* ── Page header ───────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-8 py-4 border-b border-white/[0.06] shrink-0">
        <div>
          <h1 className="text-sm font-bold text-white tracking-tight uppercase">
            Infrastructure Hub
          </h1>
          <p className="text-[11px] text-slate-600 mt-0.5">
            Provision accounts · Discover property zones · Manage hardware nodes
          </p>
        </div>
        <button
          onClick={() => {
            setWiz({ ...defaultWizard });
            setRightView("wizard");
            setSelectedZoneId(null);
          }}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-4 py-2 rounded uppercase tracking-wide transition-all"
        >
          <Ic d={I.plus} className="w-3.5 h-3.5" />
          Add Account
        </button>
      </div>

      {/* ── Body ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Account tree */}
        <div className="w-64 shrink-0 border-r border-white/[0.06] flex flex-col overflow-hidden">
          <div className="px-4 py-2.5 border-b border-white/[0.04]">
            <p className="text-[9px] text-slate-700 uppercase tracking-widest font-bold">
              Connected Accounts
            </p>
          </div>

          <div className="flex-1 overflow-y-auto py-1">
            {loading && (
              <div className="flex items-center justify-center h-16 text-[10px] text-slate-700 uppercase tracking-widest">
                Loading…
              </div>
            )}

            {!loading && accounts.length === 0 && (
              <div className="flex flex-col items-center justify-center h-28 gap-2 px-4 text-center">
                <Ic d={I.building} className="w-5 h-5 text-slate-700" />
                <p className="text-[11px] text-slate-600">No accounts provisioned yet.</p>
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
                  {/* Account row */}
                  <div className={`flex items-center group transition-all hover:bg-white/[0.04] ${isExpanded ? "bg-white/[0.02]" : ""}`}>
                    <button
                      onClick={() =>
                        setExpandedAccountId(isExpanded ? null : account.id)
                      }
                      className="flex-1 flex items-center gap-2 px-3 py-2.5 text-left min-w-0"
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
                      <span className="text-xs text-slate-300 truncate flex-1">
                        {account.name}
                      </span>
                      <span className="text-[10px] text-slate-700 shrink-0 font-mono">
                        {accountZones.length}
                      </span>
                    </button>
                    {/* Add Zone button — visible on hover */}
                    <button
                      onClick={() => startAddZoneForAccount(account)}
                      title="Add zone to this account"
                      className="opacity-0 group-hover:opacity-100 transition-all px-2 py-2.5 text-slate-600 hover:text-indigo-400"
                    >
                      <Ic d={I.plus} className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Zone sub-rows */}
                  {isExpanded && (
                    <div className="border-l border-white/[0.04] ml-[22px]">
                      {accountZones.length === 0 && (
                        <p className="px-4 py-2 text-[10px] text-slate-700">
                          No zones configured
                        </p>
                      )}
                      {accountZones.map((zone) => (
                        <button
                          key={zone.id}
                          onClick={() => handleSelectZone(zone)}
                          className={`w-full flex items-center gap-2 px-4 py-1.5 text-left transition-all hover:bg-white/[0.04] ${
                            selectedZoneId === zone.id && rightView === "zone-detail"
                              ? "bg-indigo-600/[0.08]"
                              : ""
                          }`}
                        >
                          <div
                            className={`w-1 h-1 rounded-full shrink-0 ${
                              zone.is_monitored ? "bg-emerald-400" : "bg-slate-700"
                            }`}
                          />
                          <span
                            className={`text-[11px] truncate ${
                              selectedZoneId === zone.id && rightView === "zone-detail"
                                ? "text-indigo-400"
                                : "text-slate-500"
                            }`}
                          >
                            {zone.name}
                          </span>
                        </button>
                      ))}
                      {/* Delete account — shown at bottom of expanded list */}
                      <button
                        onClick={() => confirmDeleteAccount(account, accountZones.length)}
                        className="w-full flex items-center gap-1.5 px-4 py-2 text-left text-[10px] text-slate-700 hover:text-red-400 hover:bg-red-500/[0.06] transition-all border-t border-white/[0.03] mt-1"
                      >
                        <Ic d={I.trash} className="w-3 h-3" />
                        Delete Account
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Detail panel */}
        <div className="flex-1 overflow-y-auto p-8">
          {rightView === "empty" && (
            <div className="h-full flex flex-col items-center justify-center gap-3 text-center">
              <div className="w-10 h-10 border border-white/[0.06] bg-white/[0.02] flex items-center justify-center">
                <Ic d={I.shield} className="w-5 h-5 text-slate-700" />
              </div>
              <p className="text-sm text-slate-500">
                Select a zone to view its configuration,
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

      {/* ── Delete confirmation modal ──────────────────────────────────────── */}
      {deleteTarget && (
        <DeleteConfirmModal
          target={deleteTarget}
          onConfirm={
            deleteTarget.type === "zone" ? executeDeleteZone : executeDeleteAccount
          }
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
