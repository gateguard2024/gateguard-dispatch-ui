'use client';

// app/training/page.tsx
// GateGuard OS — Agent Training Reference
// Comprehensive in-app training guide for SOC call center agents.

import React, { useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────
type TopicId =
  | 'getting-started'
  | 'dashboard'
  | 'alarms'
  | 'cameras'
  | 'patrol'
  | 'comms'
  | 'reports'
  | 'ideas';

interface Topic {
  id: TopicId;
  label: string;
  icon: string;
  color: string;
}

// ─── Topic definitions ────────────────────────────────────────────────────────
const TOPICS: Topic[] = [
  {
    id: 'getting-started',
    label: 'Getting Started',
    icon: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    color: '#6366f1',
  },
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z',
    color: '#10b981',
  },
  {
    id: 'alarms',
    label: 'Alarms',
    icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9',
    color: '#ef4444',
  },
  {
    id: 'cameras',
    label: 'Cameras',
    icon: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z',
    color: '#f59e0b',
  },
  {
    id: 'patrol',
    label: 'Patrol',
    icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
    color: '#10b981',
  },
  {
    id: 'comms',
    label: 'Comms / Dialer',
    icon: 'M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 6.75z',
    color: '#6366f1',
  },
  {
    id: 'reports',
    label: 'Reports',
    icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
    color: '#64748b',
  },
  {
    id: 'ideas',
    label: 'Ideas',
    icon: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z',
    color: '#f59e0b',
  },
];

// ─── Shared sub-components ────────────────────────────────────────────────────

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-black tracking-widest uppercase mb-3"
      style={{ color: '#64748b' }}>
      {children}
    </p>
  );
}

function QuickRef({ color, items }: { color: string; items: string[] }) {
  return (
    <div
      className="rounded-2xl p-4 mb-6 border"
      style={{
        background: `${color}12`,
        borderColor: `${color}30`,
        borderLeftWidth: 3,
        borderLeftColor: color,
      }}
    >
      <p className="text-[10px] font-black tracking-widest uppercase mb-3"
        style={{ color }}>
        Quick Reference
      </p>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-sm" style={{ color: '#e2e8f0' }}>
            <span className="mt-0.5 shrink-0 font-bold" style={{ color }}>›</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function StepList({ steps }: { steps: string[] }) {
  const COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#6366f1', '#f59e0b', '#10b981', '#ef4444'];
  return (
    <ol className="space-y-3 mb-6">
      {steps.map((step, i) => (
        <li key={i} className="flex items-start gap-3">
          <span
            className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-black text-white"
            style={{ background: COLORS[i % COLORS.length] }}
          >
            {i + 1}
          </span>
          <span className="text-sm leading-relaxed" style={{ color: '#e2e8f0' }}>{step}</span>
        </li>
      ))}
    </ol>
  );
}

function BulletList({ items, color = '#10b981' }: { items: string[]; color?: string }) {
  return (
    <ul className="space-y-2 mb-6">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2 text-sm" style={{ color: '#e2e8f0' }}>
          <span className="mt-0.5 shrink-0" style={{ color }}>✓</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function WarningBox({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl p-4 mb-6 border text-sm"
      style={{
        background: '#f59e0b12',
        borderColor: '#f59e0b30',
        borderLeftWidth: 3,
        borderLeftColor: '#f59e0b',
        color: '#fcd34d',
      }}
    >
      <span className="font-bold">Note: </span>
      {children}
    </div>
  );
}

function DangerBox({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl p-4 mb-6 border text-sm"
      style={{
        background: '#ef444412',
        borderColor: '#ef444430',
        borderLeftWidth: 3,
        borderLeftColor: '#ef4444',
        color: '#fca5a5',
      }}
    >
      <span className="font-bold">Important: </span>
      {children}
    </div>
  );
}

function InfoBox({ children, color = '#6366f1' }: { children: React.ReactNode; color?: string }) {
  return (
    <div
      className="rounded-2xl p-4 mb-6 border text-sm"
      style={{
        background: `${color}12`,
        borderColor: `${color}30`,
        borderLeftWidth: 3,
        borderLeftColor: color,
        color: '#e2e8f0',
      }}
    >
      {children}
    </div>
  );
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-sm font-bold mb-2 mt-5" style={{ color: '#e2e8f0' }}>
      {children}
    </h3>
  );
}

function BadgeRow({ badges }: { badges: { label: string; color: string }[] }) {
  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {badges.map((b, i) => (
        <span
          key={i}
          className="px-2.5 py-1 rounded-lg text-xs font-bold"
          style={{ background: `${b.color}20`, color: b.color, border: `1px solid ${b.color}40` }}
        >
          {b.label}
        </span>
      ))}
    </div>
  );
}

// ─── Section content components ───────────────────────────────────────────────

function GettingStarted() {
  return (
    <div>
      <QuickRef
        color="#6366f1"
        items={[
          'Four main pages: Alarms, Cameras, Patrol, Reports.',
          'Your primary job: monitor alarms, run patrols, communicate with site contacts.',
          'Always check Dashboard at shift start to see what is active.',
        ]}
      />

      <SectionHeader>What is GateGuard OS?</SectionHeader>
      <p className="text-sm leading-relaxed mb-6" style={{ color: '#94a3b8' }}>
        GateGuard OS is the remote monitoring platform for multifamily properties. It connects
        every camera, gate, alarm, and contact across all monitored sites into a single operations
        interface. As a SOC agent, you are the eyes and ears for properties that cannot have full-time
        on-site security.
      </p>

      <SectionHeader>Your Core Responsibilities</SectionHeader>
      <BulletList
        items={[
          'Monitor the Alarms queue and process every incoming alarm before it ages.',
          'Run scheduled patrols (9 PM, Midnight, 3 AM, 6 AM) by checking camera feeds site-by-site.',
          'Communicate with site contacts — property managers, courtesy officers, residents — via the browser phone or email.',
          'Log everything. Every call, email, and note becomes part of the incident record.',
          'Escalate when you cannot resolve: law enforcement for active threats, Gate Service for hardware failures.',
        ]}
      />

      <SectionHeader>The Four Main Pages</SectionHeader>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
        {[
          { label: 'ALARMS', desc: 'Incoming alarm queue. Your #1 priority. Process, investigate, resolve.', color: '#ef4444' },
          { label: 'CAMERAS', desc: 'Live camera feeds across all sites. View by zone or individual camera.', color: '#f59e0b' },
          { label: 'PATROL', desc: 'Scheduled and spot-check rounds. Confirm all sites are clear.', color: '#10b981' },
          { label: 'REPORTS', desc: 'Historical record of incidents, patrols, gate status, and all comms.', color: '#6366f1' },
        ].map((p) => (
          <div
            key={p.label}
            className="rounded-2xl p-4 border"
            style={{ background: '#0a0c10', borderColor: 'rgba(255,255,255,0.05)', borderLeftWidth: 3, borderLeftColor: p.color }}
          >
            <p className="text-xs font-black tracking-widest mb-1" style={{ color: p.color }}>{p.label}</p>
            <p className="text-sm" style={{ color: '#94a3b8' }}>{p.desc}</p>
          </div>
        ))}
      </div>

      <SectionHeader>Support Pages</SectionHeader>
      <BulletList
        color="#6366f1"
        items={[
          'DASHBOARD — KPI overview. Check at shift start.',
          'COMMS — Full communications desk: phone, email, log.',
          'IDEAS — Submit platform improvement ideas to engineering.',
        ]}
      />

      <SectionHeader>Shift Handoff Checklist</SectionHeader>
      <StepList
        steps={[
          'Open Dashboard. Note open alarms, gate issues, and any active patrol flags.',
          'Check the Alarms queue for anything in "Processing" state left by the outgoing agent — pick it up or resolve it.',
          'Review Reports > Open Issues for any unresolved patrol findings.',
          'Confirm your browser phone (COMMS) is registered and connected before your first call.',
          'You are now on duty. Begin monitoring.',
        ]}
      />
    </div>
  );
}

function DashboardSection() {
  return (
    <div>
      <QuickRef
        color="#10b981"
        items={[
          'Check Dashboard at shift start — it tells you what is hot and what needs attention.',
          'Gate Status panel is the fastest way to spot a hardware failure across all sites.',
          'Recent Calls widget shows what other operators have been handling.',
        ]}
      />

      <SectionHeader>Live KPIs</SectionHeader>
      <p className="text-sm leading-relaxed mb-4" style={{ color: '#94a3b8' }}>
        The top row shows real-time statistics pulled from the last 24 hours unless otherwise labeled.
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        {[
          { label: 'Open Alarms', desc: 'Alarms currently unresolved. Should trend toward zero during your shift.', color: '#ef4444' },
          { label: 'Critical Today', desc: 'Alarms flagged high-priority in the last 24 hours.', color: '#f59e0b' },
          { label: 'Resolved Today', desc: 'Total closed alarms. Good indicator of throughput.', color: '#10b981' },
          { label: 'Armed Sites', desc: 'Sites currently in an armed monitoring state.', color: '#6366f1' },
          { label: 'Cameras Monitored', desc: 'Active camera count across all connected sites.', color: '#64748b' },
          { label: 'Resolution Rate', desc: 'Percentage of alarms resolved vs. opened. Target: above 90%.', color: '#10b981' },
        ].map((k) => (
          <div
            key={k.label}
            className="rounded-2xl p-3 border"
            style={{ background: '#0a0c10', borderColor: 'rgba(255,255,255,0.05)' }}
          >
            <p className="text-xs font-bold mb-1" style={{ color: k.color }}>{k.label}</p>
            <p className="text-xs" style={{ color: '#64748b' }}>{k.desc}</p>
          </div>
        ))}
      </div>

      <SectionHeader>Gate Status Panel</SectionHeader>
      <BulletList
        items={[
          'Lists every gate across all monitored sites with its current status.',
          '"Operational" = green. Gate is functioning normally.',
          '"Needs Service" = amber. A tech or agent has flagged this gate for repair. Avoid dispatching visitors to that gate.',
          'Status is set manually from the Alarms page (Gate Service Needed resolution) or the Reports > Gates tab.',
          'If you see a gate flip to Needs Service during your shift, make sure the automated email has gone out — check the Comms log.',
        ]}
      />

      <SectionHeader>Recent Calls Widget</SectionHeader>
      <BulletList
        items={[
          'Shows the last 5 calls logged by any operator platform-wide.',
          'Use it to stay aware of active situations another agent may have started.',
          'Click a call entry to jump to the linked alarm record.',
        ]}
      />

      <WarningBox>
        The Dashboard does not auto-refresh on every browser. If it looks stale, press Cmd+R (Mac) or Ctrl+R (Windows) to reload the page.
      </WarningBox>
    </div>
  );
}

function AlarmsSection() {
  return (
    <div>
      <QuickRef
        color="#ef4444"
        items={[
          'Always click Process to lock an alarm before investigating — prevents double-handling.',
          '"Gate Service Needed" automatically emails site + ops. No manual email required.',
          'AI Triage gives a starting point — you make the final call.',
        ]}
      />

      <SectionHeader>Alarm Lifecycle — Step by Step</SectionHeader>
      <StepList
        steps={[
          'Alarm appears in the queue with its priority label (CRITICAL / HIGH / MEDIUM / LOW) and the site name.',
          'Click the alarm card to open the detail view.',
          'Review the AI Triage panel on the right side. It shows the event description, suggested priority, and recommended first action.',
          'Click Process to lock the alarm to your name. This prevents another agent from working the same alarm.',
          'Open the camera feed if one is linked to this site — check the live view for visual confirmation.',
          'Take action using the Comms tab: call a contact, send an email, or add a manual log note.',
          'Select the appropriate resolution from the dropdown.',
          'Click Resolve to close the alarm and stamp the record with your name and timestamp.',
        ]}
      />

      <SectionHeader>Resolution Types</SectionHeader>
      <div className="space-y-2 mb-6">
        {[
          { label: 'All Clear', color: '#10b981', desc: 'Investigated — no threat or issue found. Everything normal.' },
          { label: 'Law Enforcement Notified', color: '#ef4444', desc: 'Police or other authority contacted. Include case/call number in the log.' },
          { label: 'Owner / Tenant Notified', color: '#f59e0b', desc: 'Called or emailed the responsible party at the property.' },
          { label: 'No Action Required', color: '#64748b', desc: 'Event is known/expected (e.g., scheduled delivery, routine activity).' },
          { label: 'Gate Service Needed', color: '#f59e0b', desc: 'Hardware failure or gate malfunction. Auto-flags the gate AND sends two emails.' },
          { label: 'Door / Access Service Needed', color: '#f59e0b', desc: 'Pedestrian door or access reader requires repair. Similar workflow to Gate Service.' },
          { label: 'Other', color: '#6366f1', desc: 'None of the above apply. Add a detailed note in the log.' },
        ].map((r) => (
          <div
            key={r.label}
            className="rounded-xl p-3 border flex items-start gap-3"
            style={{ background: '#0a0c10', borderColor: 'rgba(255,255,255,0.05)' }}
          >
            <span
              className="shrink-0 px-2 py-0.5 rounded-lg text-xs font-bold mt-0.5"
              style={{ background: `${r.color}20`, color: r.color, border: `1px solid ${r.color}40` }}
            >
              {r.label}
            </span>
            <p className="text-sm" style={{ color: '#94a3b8' }}>{r.desc}</p>
          </div>
        ))}
      </div>

      <SectionHeader>Gate / Door Service Needed — What Happens Automatically</SectionHeader>
      <InfoBox color="#f59e0b">
        <p className="font-bold mb-2" style={{ color: '#fcd34d' }}>When you select "Gate Service Needed" or "Door / Access Service Needed":</p>
        <ol className="space-y-1 text-sm" style={{ color: '#e2e8f0' }}>
          <li>1. The gate or door record in the system is automatically flagged as "Needs Service."</li>
          <li>2. An email is sent to the site contact (property manager).</li>
          <li>3. A second email is sent to GateGuard operations for follow-up.</li>
          <li className="font-semibold pt-1" style={{ color: '#fcd34d' }}>You do not need to send any additional emails. The system handles it.</li>
        </ol>
      </InfoBox>

      <SectionHeader>AI Triage Panel</SectionHeader>
      <BulletList
        items={[
          'Claude reads the incoming event description and camera context.',
          'It suggests a priority level (CRITICAL / HIGH / MEDIUM / LOW) based on the event type and site history.',
          'It recommends a first action (e.g., "Check camera feed," "Call courtesy officer," "Dispatch police").',
          'This is a starting point, not a final decision. You are the agent — use your judgment.',
          'If AI triage says MEDIUM but the live camera shows an active break-in, override it and escalate immediately.',
        ]}
      />

      <SectionHeader>Comms Tab (Inside an Alarm)</SectionHeader>
      <SubHeading>Dial</SubHeading>
      <BulletList
        color="#6366f1"
        items={[
          'Pick a saved contact from the site contact list, or type a number manually.',
          'Call goes through the browser phone — recipient sees the GateGuard 844 number.',
          'After the call ends, an AI summary auto-generates in 5–10 seconds.',
          'Review the summary and save it to attach to the alarm record.',
        ]}
      />
      <SubHeading>Email</SubHeading>
      <BulletList
        color="#6366f1"
        items={[
          'Pick from 5 templates or write a custom message.',
          'Review the pre-filled fields before sending.',
          'All emails come from soc@gateguard.co and auto-CC ops unless you uncheck.',
        ]}
      />
      <SubHeading>Log</SubHeading>
      <BulletList
        color="#6366f1"
        items={[
          'Add a free-text note to the incident record at any time.',
          'Notes are timestamped and attributed to your account.',
          'Visible to all supervisors and other agents on the alarm.',
        ]}
      />

      <DangerBox>
        Never leave an alarm in "Processing" state without resolving it before your shift ends. If you cannot resolve it, add a detailed log note and notify your supervisor so another agent can pick it up.
      </DangerBox>
    </div>
  );
}

function CamerasSection() {
  return (
    <div>
      <QuickRef
        color="#f59e0b"
        items={[
          'Click a site tile to open its camera wall. Click a camera to go full single view.',
          'Star icon sets the primary camera thumbnail for a site tile — saves permanently.',
          '"Clearing stream lock…" = system is auto-retrying. Wait 10–30 seconds before refreshing.',
        ]}
      />

      <SectionHeader>Main Camera Grid</SectionHeader>
      <BulletList
        items={[
          'The grid shows one tile per zone or site (e.g., Marbella Place, Elevate Greene).',
          'The subtitle on each tile shows the ownership group (e.g., Pegasus Properties).',
          'The thumbnail image is the primary camera for that site.',
          'A colored dot in the corner indicates the live status of the feed (green = live, gray = offline).',
        ]}
      />

      <SectionHeader>Navigating to a Camera</SectionHeader>
      <StepList
        steps={[
          'Click a site tile to open the camera wall for that site. You will see all cameras at that location.',
          'Click any individual camera thumbnail to enter single camera view.',
          'In single camera view, the stream loads and a timeline appears below for recorded playback.',
          'Use the back arrow to return to the camera wall, and again to return to the main grid.',
        ]}
      />

      <SectionHeader>Setting the Primary Camera</SectionHeader>
      <BulletList
        items={[
          'In the camera wall for a site, find the camera you want to use as the tile thumbnail.',
          'Click the star (☆) icon on that camera.',
          'The star fills and the grid thumbnail updates immediately.',
          'This setting saves permanently — it will persist after you log out and for all other agents.',
        ]}
      />

      <SectionHeader>Stream Locks</SectionHeader>
      <InfoBox color="#f59e0b">
        <p className="font-bold mb-1" style={{ color: '#fcd34d' }}>If you see "Clearing stream lock…"</p>
        <p className="text-sm" style={{ color: '#e2e8f0' }}>
          The camera was being accessed and was not properly released. The system is automatically clearing it.
          Wait 10–30 seconds. Do not refresh immediately — that can restart the timer.
          If it does not clear after 60 seconds, reload the page and try again.
        </p>
      </InfoBox>

      <SectionHeader>Recorded Footage</SectionHeader>
      <StepList
        steps={[
          'In single camera view, set the start and end time in the timeline controls below the stream.',
          'Click "Load Clip" to fetch the recorded segment.',
          'Use the segment navigator (arrow buttons) to jump between footage segments within your window.',
          'Binary search method: to find when an incident started, check the midpoint of your time window first. If the event is present, move the start time to the midpoint. If not, move the end time. Repeat until you have isolated the exact start time.',
        ]}
      />

      <SectionHeader>Patrol Use of Cameras</SectionHeader>
      <BulletList
        items={[
          'During a patrol, click into a site and visually check each zone before marking checklist items.',
          'If a camera is offline or the feed will not load, do NOT check the "Cameras operational" checklist item — leave it unchecked and describe the issue in the notes field.',
          'Offline cameras are a patrol Issue Found, not a skip.',
        ]}
      />
    </div>
  );
}

function PatrolSection() {
  return (
    <div>
      <QuickRef
        color="#10b981"
        items={[
          'Always acknowledge open gate issues before starting a new patrol.',
          'If cameras are down at a site, uncheck "Cameras operational" and note it — do not mark Clear.',
          'Violent or active threat: 911 immediately. No exceptions.',
        ]}
      />

      <SectionHeader>Starting a Patrol</SectionHeader>
      <StepList
        steps={[
          'Click "Start Patrol" on the Patrol page.',
          'Select the patrol type from the dropdown: 9 PM Start of Shift, Midnight Check, 3 AM Check, 6 AM End of Shift, or Spot Check. Spot Check logs with the actual current time.',
          'The system will show any open gate issues. Acknowledge each one before proceeding.',
          'The site list loads. Work through each site in order.',
          'For each site: open the camera feed, visually inspect the zone, then tick each checklist item.',
          'Mark the site as Clear (all good) or Issue Found (something needs attention).',
          'If Issue Found: type a description of what you observed. You can optionally raise a formal alarm from here.',
          'Continue through all sites. Click "Complete Patrol" when done.',
        ]}
      />

      <SectionHeader>Patrol Checklist (6 Items)</SectionHeader>
      <div className="space-y-2 mb-6">
        {[
          { label: 'Gates opening and closing normally', note: null },
          { label: 'No unauthorized persons at entry/exit points', note: null },
          { label: 'Common areas clear (pool, mailroom, leasing office)', note: null },
          { label: 'No loitering near dumpsters or main gate', note: null },
          { label: 'No trash / dumping violations visible', note: null },
          {
            label: 'Cameras operational / video feed available',
            note: 'If cameras were down or video could not load — leave this UNCHECKED and note it in the issue detail.',
          },
        ].map((item, i) => (
          <div
            key={i}
            className="rounded-xl p-3 border"
            style={{ background: '#0a0c10', borderColor: 'rgba(255,255,255,0.05)' }}
          >
            <div className="flex items-start gap-2">
              <span style={{ color: '#10b981' }} className="mt-0.5">✓</span>
              <p className="text-sm font-medium" style={{ color: '#e2e8f0' }}>{item.label}</p>
            </div>
            {item.note && (
              <p className="text-xs mt-1.5 ml-5" style={{ color: '#f59e0b' }}>
                {item.note}
              </p>
            )}
          </div>
        ))}
      </div>

      <SectionHeader>Patrol Types</SectionHeader>
      <BadgeRow
        badges={[
          { label: '9 PM — Start of Shift', color: '#6366f1' },
          { label: 'Midnight Check', color: '#10b981' },
          { label: '3 AM Check', color: '#f59e0b' },
          { label: '6 AM — End of Shift', color: '#ef4444' },
          { label: 'Spot Check', color: '#64748b' },
        ]}
      />
      <p className="text-sm mb-6" style={{ color: '#94a3b8' }}>
        Spot Check logs the patrol with the actual current timestamp rather than a scheduled time slot. Use it for unscheduled mid-shift checks when something warrants a second look.
      </p>

      <SectionHeader>Courtesy Officer Protocol</SectionHeader>
      <p className="text-sm mb-3" style={{ color: '#94a3b8' }}>
        Some sites have a Courtesy Officer (CO) on site during certain hours. Your protocol depends on whether a CO is available.
      </p>
      <div className="rounded-2xl overflow-hidden border mb-6" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: '#0a0c10', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <th className="text-left p-3 text-xs font-black tracking-widest uppercase" style={{ color: '#64748b' }}>Situation</th>
              <th className="text-left p-3 text-xs font-black tracking-widest uppercase" style={{ color: '#64748b' }}>CO on Site?</th>
              <th className="text-left p-3 text-xs font-black tracking-widest uppercase" style={{ color: '#64748b' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {[
              { situation: 'Pool violation / loitering', co: 'Yes', action: 'Call CO first, then file incident report', color: '#f59e0b' },
              { situation: 'Pool violation / loitering', co: 'No', action: 'Incident report only', color: '#64748b' },
              { situation: 'Trespassing / vandalism', co: 'Yes', action: 'Call CO first, escalate if needed', color: '#f59e0b' },
              { situation: 'Trespassing / vandalism', co: 'No', action: 'Call police + incident report', color: '#ef4444' },
              { situation: 'Violent / active threat', co: 'Either', action: '911 immediately — no exceptions', color: '#ef4444' },
            ].map((row, i) => (
              <tr
                key={i}
                style={{
                  background: i % 2 === 0 ? '#0a0c10' : '#0d0f14',
                  borderBottom: '1px solid rgba(255,255,255,0.03)',
                }}
              >
                <td className="p-3" style={{ color: '#e2e8f0' }}>{row.situation}</td>
                <td className="p-3">
                  <span
                    className="px-2 py-0.5 rounded text-xs font-bold"
                    style={{
                      background: row.co === 'Yes' ? '#10b98120' : row.co === 'No' ? '#ef444420' : '#f59e0b20',
                      color: row.co === 'Yes' ? '#10b981' : row.co === 'No' ? '#ef4444' : '#f59e0b',
                    }}
                  >
                    {row.co}
                  </span>
                </td>
                <td className="p-3 font-medium" style={{ color: row.color }}>{row.action}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <DangerBox>
        Violent or active threat situations skip all other protocols. Call 911 first. Do not attempt to contact the CO or property manager before police are dispatched.
      </DangerBox>
    </div>
  );
}

function CommsSection() {
  return (
    <div>
      <QuickRef
        color="#6366f1"
        items={[
          'All calls go through Twilio — the recipient sees GateGuard\'s 844 number, not yours.',
          'AI call summary auto-generates 5–10 seconds after a call ends. Review and save it.',
          'All emails from soc@gateguard.co auto-CC ops unless you uncheck the box.',
        ]}
      />

      <SectionHeader>Where to Find Comms</SectionHeader>
      <BulletList
        color="#6366f1"
        items={[
          'COMMS page in the sidebar — full communications desk for standalone use.',
          'Comms tab inside any open Alarm — available after you click Process.',
          'Comms tab inside any Patrol site — available while working through a patrol round.',
        ]}
      />

      <SectionHeader>Browser Phone</SectionHeader>
      <StepList
        steps={[
          'Ensure your browser microphone permission is granted for ggsoc.com. (First-time prompt on initial use.)',
          'On the Comms page or Comms tab, open the Dial panel.',
          'Pick a saved site contact from the dropdown, or type a phone number manually.',
          'Click "Call." The browser phone dials through Twilio.',
          'The recipient sees the GateGuard 844 number — not your personal or browser number.',
          'Speak clearly. When done, click "End Call."',
          'Wait 5–10 seconds. The AI summary will auto-generate below the call log.',
          'Review the summary for accuracy. Click "Save" to attach it to the alarm or patrol record.',
        ]}
      />

      <WarningBox>
        If the browser phone shows "Unregistered" or fails to connect, refresh the COMMS page. If it still fails, try a hard reload (Shift+Cmd+R / Shift+Ctrl+R). Contact your supervisor if the issue persists — do not use a personal phone as a primary fallback without logging the call manually.
      </WarningBox>

      <SectionHeader>Email Templates</SectionHeader>
      <div className="space-y-2 mb-6">
        {[
          { label: 'Incident Report', desc: 'Summarizes the alarm event, actions taken, and resolution. Used for most resolved alarms.' },
          { label: 'Gate / Door Service Needed', desc: 'Auto-generated when you select that resolution. You can also trigger it manually here.' },
          { label: 'Patrol Check-In', desc: 'Sends a summary of a completed patrol to the site contact.' },
          { label: 'All Clear', desc: 'Short notification that the site was checked and found clear.' },
          { label: 'Custom', desc: 'Free-form. Write your own subject and body. All other fields auto-fill.' },
        ].map((t, i) => (
          <div
            key={i}
            className="rounded-xl p-3 border"
            style={{ background: '#0a0c10', borderColor: 'rgba(255,255,255,0.05)' }}
          >
            <p className="text-sm font-bold mb-0.5" style={{ color: '#6366f1' }}>{t.label}</p>
            <p className="text-sm" style={{ color: '#94a3b8' }}>{t.desc}</p>
          </div>
        ))}
      </div>

      <SectionHeader>Log Notes</SectionHeader>
      <BulletList
        items={[
          'Use the Log tab to add a manual free-text note at any time during an alarm or patrol.',
          'Notes are timestamped to the second and attributed to your account name.',
          'Visible to all supervisors and other agents with access to that record.',
          'Use logs to document anything you observed, any calls you were unable to complete, or any decisions you made.',
          'Good log practice: brief, factual, first-person. "Checked camera at gate 1, no activity visible. Resolved All Clear."',
        ]}
      />

      <SectionHeader>AI Call Summary</SectionHeader>
      <InfoBox color="#6366f1">
        <p className="font-bold mb-1" style={{ color: '#a5b4fc' }}>How it works</p>
        <p className="text-sm" style={{ color: '#e2e8f0' }}>
          After every call ends, the system transcribes the audio and sends it to Claude. Claude generates
          a structured summary: who was called, what was discussed, what action was agreed on, and any follow-up items.
          This summary is appended to the alarm or patrol record automatically once you click Save.
          If the summary is inaccurate, you can edit it before saving.
        </p>
      </InfoBox>
    </div>
  );
}

function ReportsSection() {
  return (
    <div>
      <QuickRef
        color="#64748b"
        items={[
          'Open Issues tab: unresolved patrol issues and gate flags — supervisors close these.',
          'Gates tab: current status of every gate. Flag Needs Service or mark Operational.',
          'Comms tab: full call and email log from all operators.',
        ]}
      />

      <SectionHeader>Reports Overview</SectionHeader>
      <p className="text-sm leading-relaxed mb-6" style={{ color: '#94a3b8' }}>
        The Reports page is the historical record of everything that has happened on the platform.
        Agents use it to review past patrols and confirm previous comms. Supervisors use it to close
        open issues and manage gate status.
      </p>

      <SectionHeader>Open Issues Tab</SectionHeader>
      <BulletList
        items={[
          'Shows all patrol issues marked "Issue Found" that have not been closed.',
          'Also shows gate service flags that have not been resolved by a technician.',
          'Agents: review this at shift start to see what was left unresolved.',
          'Supervisors: acknowledge and close issues once they have been addressed (gate repaired, issue resolved, etc.).',
          'Each row shows: site name, issue description, the agent who logged it, and the timestamp.',
        ]}
      />

      <SectionHeader>Gates Tab</SectionHeader>
      <BulletList
        items={[
          'Lists every gate across all monitored sites.',
          'Status column: "Operational" (green) or "Needs Service" (amber).',
          'Use this tab to manually update a gate\'s status after a tech confirms repair.',
          'You can flag a gate as Needs Service from here if a patrol visual reveals a hardware problem.',
          'Each entry shows: gate name, site, last status change, and who changed it.',
        ]}
      />

      <SectionHeader>Comms Tab</SectionHeader>
      <BulletList
        items={[
          'Full log of every call and email sent from all operators across all shifts.',
          'Filter by date range, operator name, or site.',
          'Each call entry shows: number dialed, duration, operator, site, and the AI call summary.',
          'Each email entry shows: template used, recipient, sender, and timestamp.',
          'Use this tab to verify that an email was sent after a Gate Service alarm.',
        ]}
      />

      <SectionHeader>Patrol History</SectionHeader>
      <StepList
        steps={[
          'Click the "Patrol History" tab or section on the Reports page.',
          'A list of past patrols appears, sorted by most recent.',
          'Click any patrol entry to expand it and see the site-by-site results.',
          'Each site row shows: checklist item results (checked/unchecked), Clear or Issue status, and any notes.',
          'Use this to review what was seen on a previous round, verify a CO was called, or audit a reported incident.',
        ]}
      />

      <InfoBox color="#6366f1">
        <p className="font-bold mb-1" style={{ color: '#a5b4fc' }}>Supervisor Note</p>
        <p className="text-sm" style={{ color: '#e2e8f0' }}>
          Only supervisors and admins can close Open Issues. If you are an agent and you see an issue
          that you believe has been resolved (e.g., the gate is back online), add a log note to that
          effect and notify your supervisor to officially close it in the system.
        </p>
      </InfoBox>
    </div>
  );
}

function IdeasSection() {
  return (
    <div>
      <QuickRef
        color="#f59e0b"
        items={[
          'IDEAS is in the sidebar (the lightbulb icon).',
          'Engineering reviews the queue weekly — your ideas are actually read.',
          '"My Ideas" tab shows the status of everything you have submitted.',
        ]}
      />

      <SectionHeader>How to Submit an Idea</SectionHeader>
      <StepList
        steps={[
          'Click IDEAS in the sidebar.',
          'Click "New Idea."',
          'Enter a short, clear title (e.g., "Add keyboard shortcut to mark alarm All Clear").',
          'Write a description explaining the problem you are running into and how you think it should work.',
          'Select a category: Patrol / Alarms / UI / Comms / Reports / Other.',
          'Set a priority: Low / Medium / High (be honest — everything is not High).',
          'Click Submit. Your idea appears in the admin queue immediately.',
        ]}
      />

      <SectionHeader>What Happens Next</SectionHeader>
      <BulletList
        items={[
          'Engineering reviews the queue every week.',
          'Ideas may be tagged as: Under Review / Planned / In Progress / Shipped / Declined.',
          'If an idea is Declined, there is usually a note explaining why (e.g., conflicts with a planned feature, out of scope).',
          'Declined does not mean ignored — it means it was considered.',
          'Check "My Ideas" tab to track status without digging through the full queue.',
        ]}
      />

      <SectionHeader>What Makes a Good Idea</SectionHeader>
      <BulletList
        color="#f59e0b"
        items={[
          'Describes a real pain point you hit during a shift — not a hypothetical.',
          'Explains the problem, not just the solution. ("I have to click 4 times to log a note" is better than "Add a quick-log button.")',
          'Is specific enough that an engineer can scope it.',
          'Is not a duplicate of something already in the queue — scroll through existing ideas first.',
        ]}
      />

      <InfoBox color="#f59e0b">
        <p className="text-sm" style={{ color: '#e2e8f0' }}>
          The IDEAS page was built specifically because agents see things in production that engineers miss.
          If something feels broken, slow, or backwards — submit it. The platform improves because of feedback
          from agents running actual shifts, not from internal guesses.
        </p>
      </InfoBox>
    </div>
  );
}

// ─── Section renderer ─────────────────────────────────────────────────────────
function renderSection(topicId: TopicId) {
  switch (topicId) {
    case 'getting-started': return <GettingStarted />;
    case 'dashboard':       return <DashboardSection />;
    case 'alarms':          return <AlarmsSection />;
    case 'cameras':         return <CamerasSection />;
    case 'patrol':          return <PatrolSection />;
    case 'comms':           return <CommsSection />;
    case 'reports':         return <ReportsSection />;
    case 'ideas':           return <IdeasSection />;
  }
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function TrainingPage() {
  const [activeTopic, setActiveTopic] = useState<TopicId>('getting-started');
  const topic = TOPICS.find((t) => t.id === activeTopic)!;

  return (
    <div className="h-full flex overflow-hidden">

      {/* Left sidebar */}
      <aside
        className="w-56 shrink-0 h-full flex flex-col py-6 px-3 border-r overflow-y-auto"
        style={{ background: '#0a0c10', borderColor: 'rgba(255,255,255,0.05)' }}
      >
        <div className="mb-6 px-2">
          <p className="text-[10px] font-black tracking-widest uppercase mb-0.5" style={{ color: '#64748b' }}>
            GateGuard OS
          </p>
          <h1 className="text-base font-black" style={{ color: '#e2e8f0' }}>Agent Training</h1>
          <p className="text-xs mt-1" style={{ color: '#64748b' }}>
            Reference guide for SOC operators
          </p>
        </div>

        <nav className="space-y-1 flex-1">
          {TOPICS.map((t) => {
            const isActive = t.id === activeTopic;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTopic(t.id)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all"
                style={{
                  background: isActive ? `${t.color}18` : 'transparent',
                  border: isActive ? `1px solid ${t.color}35` : '1px solid transparent',
                }}
              >
                <span
                  className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center"
                  style={{
                    background: isActive ? `${t.color}30` : 'rgba(255,255,255,0.04)',
                  }}
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    style={{ color: isActive ? t.color : '#64748b' }}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={t.icon} />
                  </svg>
                </span>
                <span
                  className="text-sm font-semibold"
                  style={{ color: isActive ? t.color : '#64748b' }}
                >
                  {t.label}
                </span>
              </button>
            );
          })}
        </nav>

        <div className="mt-6 px-2">
          <div
            className="rounded-xl p-3 text-xs"
            style={{ background: '#6366f112', border: '1px solid #6366f130', color: '#94a3b8' }}
          >
            <p className="font-bold mb-1" style={{ color: '#6366f1' }}>Need help?</p>
            Contact your supervisor or submit an idea via the IDEAS page.
          </div>
        </div>
      </aside>

      {/* Right content */}
      <div className="flex-1 h-full overflow-y-auto">
        <div className="max-w-3xl mx-auto px-8 py-8">

          {/* Page header */}
          <div
            className="rounded-2xl p-5 mb-8 border flex items-center gap-4"
            style={{
              background: '#0a0c10',
              borderColor: 'rgba(255,255,255,0.05)',
              borderLeftWidth: 4,
              borderLeftColor: topic.color,
            }}
          >
            <span
              className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
              style={{ background: `${topic.color}20` }}
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                style={{ color: topic.color }}
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={topic.icon} />
              </svg>
            </span>
            <div>
              <p
                className="text-[10px] font-black tracking-widest uppercase mb-0.5"
                style={{ color: topic.color }}
              >
                Training Guide
              </p>
              <h2 className="text-xl font-black" style={{ color: '#e2e8f0' }}>
                {topic.label}
              </h2>
            </div>
          </div>

          {/* Section content */}
          {renderSection(activeTopic)}

          {/* Footer */}
          <div
            className="mt-10 pt-6 border-t text-xs text-center"
            style={{ borderColor: 'rgba(255,255,255,0.05)', color: '#475569' }}
          >
            GateGuard SOC Training Reference &mdash; Internal Use Only &mdash; soc@gateguard.co
          </div>
        </div>
      </div>

    </div>
  );
}
