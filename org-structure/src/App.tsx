import { useEffect, useMemo, useRef, useState } from "react";
import { stratify, tree, type HierarchyPointNode } from "d3-hierarchy";
import {
  Briefcase,
  Crown,
  Download,
  Palette,
  Plus,
  RotateCcw,
  Trash2,
  Users,
} from "lucide-react";

type Level = "L1" | "L2" | "L3" | "L4" | "L5" | "L6";

type Team = {
  id: string;
  name: string;
  color: string;
};

type Person = {
  id: string;
  name: string;
  role: string;
  teamId: string;
  level: Level;
  managerId?: string;
  hiring: boolean;
  seniorLeadership: boolean;
};

const LEVELS: Level[] = ["L6", "L5", "L4", "L3", "L2", "L1"];
const CARD_WIDTH = 286;
const CARD_HEIGHT = 152;
const NODE_GAP_X = 330;
const NODE_GAP_Y = 206;
const CANVAS_MARGIN = 110;
const STORAGE_KEY = "webots-org-structure-state-v2";
const initialTeams: Team[] = [
  { id: "governance", name: "Governance", color: "#ffb84d" },
  { id: "webots-ops", name: "Ops & People", color: "#67e8d1" },
  { id: "webots-business", name: "Business", color: "#80d66b" },
  { id: "webots-marketing", name: "Marketing", color: "#7aa7ff" },
  { id: "project-josh", name: "Project JOSH", color: "#39c0ff" },
  { id: "webots-chrc-team", name: "WeBots CHRC Team", color: "#ff8a5b" },
  { id: "chrc-operations", name: "CHRC Operations", color: "#a6e35f" },
  { id: "chrc-rules", name: "CHRC Rules", color: "#f271ff" },
  { id: "chrc-relations", name: "Team Relations", color: "#f7d154" },
  { id: "chrc-finance", name: "CHRC Finance", color: "#ff6f91" },
  { id: "chrc-media", name: "CHRC Media", color: "#b794f4" },
  { id: "integrity", name: "Integrity", color: "#cbd5e1" },
];

const initialPeople: Person[] = [
  {
    id: "ecosystem",
    name: "WeBots + CHRC Ecosystem",
    role: "One club family, two separate operating chains",
    teamId: "governance",
    level: "L6",
    hiring: false,
    seniorLeadership: true,
  },
  {
    id: "webots-president",
    name: "WeBots President",
    role: "Vision, appointments, university relationships, priorities",
    teamId: "governance",
    level: "L5",
    managerId: "ecosystem",
    hiring: false,
    seniorLeadership: true,
  },
  {
    id: "chrc-organization",
    name: "CHRC Organization",
    role: "Separate competition brand and operating structure",
    teamId: "governance",
    level: "L5",
    managerId: "ecosystem",
    hiring: true,
    seniorLeadership: true,
  },
  {
    id: "vp-operations-people",
    name: "VP Operations & People",
    role: "Cadence, rooms, docs, onboarding, member health",
    teamId: "webots-ops",
    level: "L4",
    managerId: "webots-president",
    hiring: true,
    seniorLeadership: true,
  },
  {
    id: "vp-business-partnerships",
    name: "VP Business & Partnerships",
    role: "Sponsors, grants, purchasing, partner management",
    teamId: "webots-business",
    level: "L4",
    managerId: "webots-president",
    hiring: true,
    seniorLeadership: true,
  },
  {
    id: "vp-marketing-communications",
    name: "VP Marketing & Communications",
    role: "WeBots brand, recruitment media, social calendar",
    teamId: "webots-marketing",
    level: "L4",
    managerId: "webots-president",
    hiring: true,
    seniorLeadership: true,
  },
  {
    id: "project-josh-pm",
    name: "Project JOSH Project Manager",
    role: "Scope, milestones, risk, integration, reviews",
    teamId: "project-josh",
    level: "L4",
    managerId: "webots-president",
    hiring: true,
    seniorLeadership: true,
  },
  {
    id: "webots-chrc-team-pm",
    name: "WeBots CHRC Team Project Manager",
    role: "Competition robot roadmap, build, testing, compliance",
    teamId: "webots-chrc-team",
    level: "L4",
    managerId: "webots-president",
    hiring: true,
    seniorLeadership: true,
  },
  {
    id: "vp-programs-phase-2",
    name: "VP Programs / Director of Engineering",
    role: "Phase 2 layer when PM arbitration becomes frequent",
    teamId: "governance",
    level: "L4",
    managerId: "webots-president",
    hiring: true,
    seniorLeadership: false,
  },
  {
    id: "ops-admin-coordinators",
    name: "Operations / Admin Coordinators",
    role: "Rooms, agendas, meeting records, action follow-up",
    teamId: "webots-ops",
    level: "L3",
    managerId: "vp-operations-people",
    hiring: true,
    seniorLeadership: false,
  },
  {
    id: "recruitment-support",
    name: "Recruitment & Member Support",
    role: "Onboarding, attendance, retention, member care",
    teamId: "webots-ops",
    level: "L3",
    managerId: "vp-operations-people",
    hiring: true,
    seniorLeadership: false,
  },
  {
    id: "sponsorship-grants",
    name: "Sponsorship / Grants",
    role: "Sponsor pipeline, proposals, deliverables",
    teamId: "webots-business",
    level: "L3",
    managerId: "vp-business-partnerships",
    hiring: true,
    seniorLeadership: false,
  },
  {
    id: "finance-purchasing",
    name: "Finance / Purchasing Support",
    role: "Budget tracking, purchases, reimbursements",
    teamId: "webots-business",
    level: "L3",
    managerId: "vp-business-partnerships",
    hiring: true,
    seniorLeadership: false,
  },
  {
    id: "webots-social-media",
    name: "Social Media Lead",
    role: "WeBots channels, posting cadence, project updates",
    teamId: "webots-marketing",
    level: "L3",
    managerId: "vp-marketing-communications",
    hiring: true,
    seniorLeadership: false,
  },
  {
    id: "webots-content-design",
    name: "Content / Design Lead",
    role: "Graphics, photo/video, story assets",
    teamId: "webots-marketing",
    level: "L3",
    managerId: "vp-marketing-communications",
    hiring: true,
    seniorLeadership: false,
  },
  {
    id: "web-recruitment-media",
    name: "Website / Recruitment Media",
    role: "Website content, recruiting pages, media library",
    teamId: "webots-marketing",
    level: "L3",
    managerId: "vp-marketing-communications",
    hiring: true,
    seniorLeadership: false,
  },
  {
    id: "josh-mechanical",
    name: "Mechanical Lead",
    role: "Structure, CAD, actuator integration, manufacturing",
    teamId: "project-josh",
    level: "L3",
    managerId: "project-josh-pm",
    hiring: true,
    seniorLeadership: false,
  },
  {
    id: "josh-electrical",
    name: "Electrical Lead",
    role: "Power, batteries, wiring, sensors, safety circuits",
    teamId: "project-josh",
    level: "L3",
    managerId: "project-josh-pm",
    hiring: true,
    seniorLeadership: false,
  },
  {
    id: "josh-software-controls",
    name: "Software & Controls Lead",
    role: "Controls, simulation, ROS/software architecture",
    teamId: "project-josh",
    level: "L3",
    managerId: "project-josh-pm",
    hiring: true,
    seniorLeadership: false,
  },
  {
    id: "josh-systems-test",
    name: "Systems Integration & Test Lead",
    role: "Interfaces, requirements, test plans, verification",
    teamId: "project-josh",
    level: "L3",
    managerId: "project-josh-pm",
    hiring: true,
    seniorLeadership: false,
  },
  {
    id: "comp-mechanical",
    name: "Mechanical Lead",
    role: "Competition robot mechanisms, packaging, repairability",
    teamId: "webots-chrc-team",
    level: "L3",
    managerId: "webots-chrc-team-pm",
    hiring: true,
    seniorLeadership: false,
  },
  {
    id: "comp-electrical",
    name: "Electrical Lead",
    role: "Competition electrical system and field reliability",
    teamId: "webots-chrc-team",
    level: "L3",
    managerId: "webots-chrc-team-pm",
    hiring: true,
    seniorLeadership: false,
  },
  {
    id: "comp-software-controls",
    name: "Software & Controls Lead",
    role: "Competition software, controls, perception, tooling",
    teamId: "webots-chrc-team",
    level: "L3",
    managerId: "webots-chrc-team-pm",
    hiring: true,
    seniorLeadership: false,
  },
  {
    id: "comp-systems-test",
    name: "Systems Integration & Test Lead",
    role: "Acceptance tests, spares, readiness checklists",
    teamId: "webots-chrc-team",
    level: "L3",
    managerId: "webots-chrc-team-pm",
    hiring: true,
    seniorLeadership: false,
  },
  {
    id: "comp-strategy-compliance",
    name: "Competition Strategy & Compliance Lead",
    role: "Rules matrix, scoring strategy, published clarifications",
    teamId: "webots-chrc-team",
    level: "L3",
    managerId: "webots-chrc-team-pm",
    hiring: true,
    seniorLeadership: false,
  },
  {
    id: "chrc-founder",
    name: "Founder",
    role: "Advisory, mission continuity, introductions only",
    teamId: "governance",
    level: "L4",
    managerId: "chrc-organization",
    hiring: false,
    seniorLeadership: true,
  },
  {
    id: "chrc-executive-director",
    name: "Executive Director / Commissioner",
    role: "CHRC execution, budget, staffing, calendar",
    teamId: "governance",
    level: "L4",
    managerId: "chrc-organization",
    hiring: true,
    seniorLeadership: true,
  },
  {
    id: "chrc-appeals-integrity",
    name: "Independent Appeals & Integrity Panel",
    role: "Event-period fairness, conflicts, appeals",
    teamId: "integrity",
    level: "L4",
    managerId: "chrc-organization",
    hiring: true,
    seniorLeadership: false,
  },
  {
    id: "chrc-ops-pm",
    name: "Competition Operations PM",
    role: "Venue, event flow, volunteers, run-of-show",
    teamId: "chrc-operations",
    level: "L3",
    managerId: "chrc-executive-director",
    hiring: true,
    seniorLeadership: false,
  },
  {
    id: "chrc-rules-pm",
    name: "Technical & Rules PM",
    role: "Rulebook, safety, inspection, scoring process",
    teamId: "chrc-rules",
    level: "L3",
    managerId: "chrc-executive-director",
    hiring: true,
    seniorLeadership: false,
  },
  {
    id: "chrc-relations-pm",
    name: "Team Relations PM",
    role: "University outreach, registration, competitor support",
    teamId: "chrc-relations",
    level: "L3",
    managerId: "chrc-executive-director",
    hiring: true,
    seniorLeadership: false,
  },
  {
    id: "chrc-finance-pm",
    name: "Partnerships & Finance PM",
    role: "CHRC sponsors, grants, budget, partner deliverables",
    teamId: "chrc-finance",
    level: "L3",
    managerId: "chrc-executive-director",
    hiring: true,
    seniorLeadership: false,
  },
  {
    id: "chrc-media-pm",
    name: "Marketing & Media PM",
    role: "CHRC brand, social channels, site, announcements",
    teamId: "chrc-media",
    level: "L3",
    managerId: "chrc-executive-director",
    hiring: true,
    seniorLeadership: false,
  },
  {
    id: "chrc-venue-logistics",
    name: "Venue & Logistics Lead",
    role: "Venue, equipment, setup/teardown, event flow",
    teamId: "chrc-operations",
    level: "L2",
    managerId: "chrc-ops-pm",
    hiring: true,
    seniorLeadership: false,
  },
  {
    id: "chrc-volunteers",
    name: "Volunteers & Staffing Lead",
    role: "Volunteer recruiting, assignments, training",
    teamId: "chrc-operations",
    level: "L2",
    managerId: "chrc-ops-pm",
    hiring: true,
    seniorLeadership: false,
  },
  {
    id: "chrc-field-ops",
    name: "Event Schedule / Field Operations Lead",
    role: "Run schedule, field flow, on-site execution",
    teamId: "chrc-operations",
    level: "L2",
    managerId: "chrc-ops-pm",
    hiring: true,
    seniorLeadership: false,
  },
  {
    id: "chrc-rules-lead",
    name: "Rules Lead",
    role: "Rulebook process and official clarifications",
    teamId: "chrc-rules",
    level: "L2",
    managerId: "chrc-rules-pm",
    hiring: true,
    seniorLeadership: false,
  },
  {
    id: "chrc-safety-inspection",
    name: "Safety & Technical Inspection Lead",
    role: "Safety standards, inspection process, readiness",
    teamId: "chrc-rules",
    level: "L2",
    managerId: "chrc-rules-pm",
    hiring: true,
    seniorLeadership: false,
  },
  {
    id: "chrc-judging-scoring",
    name: "Judging & Scoring Lead",
    role: "Scoring system, judge preparation, judging flow",
    teamId: "chrc-rules",
    level: "L2",
    managerId: "chrc-rules-pm",
    hiring: true,
    seniorLeadership: false,
  },
  {
    id: "chrc-university-outreach",
    name: "University Outreach Lead",
    role: "Recruit universities through neutral channels",
    teamId: "chrc-relations",
    level: "L2",
    managerId: "chrc-relations-pm",
    hiring: true,
    seniorLeadership: false,
  },
  {
    id: "chrc-registration-support",
    name: "Registration & Team Support Lead",
    role: "Registration, FAQs, deadlines, team communication",
    teamId: "chrc-relations",
    level: "L2",
    managerId: "chrc-relations-pm",
    hiring: true,
    seniorLeadership: false,
  },
  {
    id: "chrc-sponsorship",
    name: "Sponsorship Lead",
    role: "CHRC sponsor pipeline and deliverables",
    teamId: "chrc-finance",
    level: "L2",
    managerId: "chrc-finance-pm",
    hiring: true,
    seniorLeadership: false,
  },
  {
    id: "chrc-finance-grants",
    name: "Finance / Grants Lead",
    role: "CHRC budget, payments, grants, records",
    teamId: "chrc-finance",
    level: "L2",
    managerId: "chrc-finance-pm",
    hiring: true,
    seniorLeadership: false,
  },
  {
    id: "chrc-social-media",
    name: "Social Media Lead",
    role: "Neutral CHRC social channels and updates",
    teamId: "chrc-media",
    level: "L2",
    managerId: "chrc-media-pm",
    hiring: true,
    seniorLeadership: false,
  },
  {
    id: "chrc-brand-design",
    name: "Brand / Design Lead",
    role: "CHRC identity, graphics, event collateral",
    teamId: "chrc-media",
    level: "L2",
    managerId: "chrc-media-pm",
    hiring: true,
    seniorLeadership: false,
  },
  {
    id: "chrc-web-content",
    name: "Web / Content Lead",
    role: "Competition site, docs, announcements, media",
    teamId: "chrc-media",
    level: "L2",
    managerId: "chrc-media-pm",
    hiring: true,
    seniorLeadership: false,
  },
];

const nextTeamColors = ["#f7d154", "#39c0ff", "#ff8a5b", "#a6e35f", "#f271ff"];

function levelValue(level: Level) {
  return Number(level.slice(1));
}

function levelBelow(level: Level): Level {
  const next = Math.max(1, levelValue(level) - 1);
  return `L${next}` as Level;
}

function hexToRgb(hex: string) {
  const clean = hex.replace("#", "");
  const bigint = parseInt(clean.length === 3 ? clean.split("").map((x) => x + x).join("") : clean, 16);
  const red = (bigint >> 16) & 255;
  const green = (bigint >> 8) & 255;
  const blue = bigint & 255;
  return `${red}, ${green}, ${blue}`;
}

function createId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

function getDescendantIds(people: Person[], personId: string) {
  const descendants = new Set<string>();
  const walk = (managerId: string) => {
    people
      .filter((person) => person.managerId === managerId)
      .forEach((person) => {
        descendants.add(person.id);
        walk(person.id);
      });
  };
  walk(personId);
  return descendants;
}

function loadSavedState() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { teams: Team[]; people: Person[] };
    if (!Array.isArray(parsed.teams) || !Array.isArray(parsed.people)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function buildChart(people: Person[]) {
  const rootCandidates = people.filter((person) => !person.managerId);
  const normalized =
    rootCandidates.length === 1
      ? people
      : people.map((person, index) => ({
          ...person,
          managerId: index === 0 ? undefined : person.managerId || people[0]?.id,
        }));

  const root = stratify<Person>()
    .id((person) => person.id)
    .parentId((person) => person.managerId ?? null)(normalized);

  return tree<Person>().nodeSize([NODE_GAP_X, NODE_GAP_Y]).separation((a, b) => (a.parent === b.parent ? 1 : 1.16))(root);
}

function exportState(teams: Team[], people: Person[]) {
  const payload = JSON.stringify({ teams, people }, null, 2);
  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "org-structure.json";
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function App() {
  const urlMode = useMemo(() => new URLSearchParams(window.location.search), []);
  const isEmbedMode = urlMode.get("embed") === "1" || urlMode.get("mode") === "embed";
  const isPublicView = isEmbedMode || urlMode.get("view") === "1" || urlMode.get("readonly") === "1";
  const defaultZoom = isEmbedMode ? 0.62 : isPublicView ? 0.58 : 0.92;
  const savedState = useMemo(() => (isPublicView ? null : loadSavedState()), [isPublicView]);
  const [teams, setTeams] = useState<Team[]>(savedState?.teams ?? initialTeams);
  const [people, setPeople] = useState<Person[]>(savedState?.people ?? initialPeople);
  const [selectedId, setSelectedId] = useState(savedState?.people?.[0]?.id ?? initialPeople[0].id);
  const [zoom, setZoom] = useState(defaultZoom);
  const chartScrollRef = useRef<HTMLDivElement>(null);
  const hasCenteredChart = useRef(false);

  const teamById = useMemo(() => new Map(teams.map((team) => [team.id, team])), [teams]);
  const selectedPerson = people.find((person) => person.id === selectedId) ?? people[0];

  const chart = useMemo(() => buildChart(people), [people]);
  const nodes = chart.descendants();
  const links = chart.links();
  const minX = Math.min(...nodes.map((node) => node.x));
  const maxX = Math.max(...nodes.map((node) => node.x));
  const maxY = Math.max(...nodes.map((node) => node.y));
  const canvasWidth = Math.max(980, maxX - minX + CANVAS_MARGIN * 2 + CARD_WIDTH);
  const canvasHeight = Math.max(660, maxY + CANVAS_MARGIN * 2 + CARD_HEIGHT);
  const seniorCount = people.filter((person) => person.seniorLeadership).length;
  const hiringCount = people.filter((person) => person.hiring).length;

  useEffect(() => {
    if (isPublicView) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ teams, people }));
  }, [isPublicView, teams, people]);

  useEffect(() => {
    if (hasCenteredChart.current || !chartScrollRef.current) return;
    const rootCenterX = (CANVAS_MARGIN - minX + CARD_WIDTH / 2 + chart.x) * zoom;
    chartScrollRef.current.scrollLeft = Math.max(0, rootCenterX - chartScrollRef.current.clientWidth / 2);
    chartScrollRef.current.scrollTop = 0;
    hasCenteredChart.current = true;
  }, [chart.x, minX, zoom]);

  function updatePerson(personId: string, patch: Partial<Person>) {
    setPeople((current) =>
      current.map((person) => {
        if (person.id !== personId) return person;
        return { ...person, ...patch };
      }),
    );
  }

  function updatePersonLevel(level: Level) {
    const manager = people.find((person) => person.id === selectedPerson.managerId);
    updatePerson(selectedPerson.id, {
      level,
      managerId: manager && levelValue(manager.level) > levelValue(level) ? manager.id : undefined,
    });
  }

  function updateTeam(teamId: string, patch: Partial<Team>) {
    setTeams((current) => current.map((team) => (team.id === teamId ? { ...team, ...patch } : team)));
  }

  function updateTeamColor(teamId: string, value: string) {
    const normalized = value.trim().toLowerCase();
    if (!/^#[0-9a-f]{6}$/.test(normalized)) return;
    updateTeam(teamId, { color: normalized });
  }

  function addTeam() {
    const teamNumber = teams.length + 1;
    const team: Team = {
      id: createId("team"),
      name: `Team ${teamNumber}`,
      color: nextTeamColors[teams.length % nextTeamColors.length],
    };
    setTeams((current) => [...current, team]);
  }

  function addReport(managerId = selectedPerson.id) {
    const manager = people.find((person) => person.id === managerId) ?? people[0];
    const person: Person = {
      id: createId("person"),
      name: "New Role",
      role: "Ownership area",
      teamId: manager.teamId,
      level: levelBelow(manager.level),
      managerId: manager.id,
      hiring: true,
      seniorLeadership: false,
    };
    setPeople((current) => [...current, person]);
    setSelectedId(person.id);
  }

  function removeSelected() {
    if (!selectedPerson.managerId) return;
    const replacementManager = selectedPerson.managerId;
    setPeople((current) =>
      current
        .filter((person) => person.id !== selectedPerson.id)
        .map((person) => (person.managerId === selectedPerson.id ? { ...person, managerId: replacementManager } : person)),
    );
    setSelectedId(replacementManager);
  }

  function resetState() {
    setTeams(initialTeams);
    setPeople(initialPeople);
    setSelectedId(initialPeople[0].id);
    setZoom(defaultZoom);
    hasCenteredChart.current = false;
  }

  const descendants = selectedPerson ? getDescendantIds(people, selectedPerson.id) : new Set<string>();
  const managerOptions = people.filter(
    (person) =>
      selectedPerson &&
      person.id !== selectedPerson.id &&
      !descendants.has(person.id) &&
      levelValue(person.level) > levelValue(selectedPerson.level),
  );

  return (
    <main className={`app-shell ${isEmbedMode ? "is-embed" : ""} ${isPublicView ? "is-public-view" : ""}`}>
      {!isEmbedMode && (
        <section className="topbar" aria-label="Org chart summary">
          <div className="brand-lockup">
            <div className="brand-mark">
              <Users size={22} />
            </div>
            <div>
              <p className="eyebrow">WeBots / CHRC</p>
              <h1>Operating Structure</h1>
            </div>
          </div>

          <div className="stat-strip" aria-label="Organization statistics">
            <div>
              <span>{people.length}</span>
              <small>Roles</small>
            </div>
            <div>
              <span>{teams.length}</span>
              <small>Teams</small>
            </div>
            <div>
              <span>{hiringCount}</span>
              <small>Open</small>
            </div>
            <div>
              <span>{seniorCount}</span>
              <small>Core</small>
            </div>
          </div>

          <div className="topbar-actions">
            <button className="icon-button" type="button" onClick={() => exportState(teams, people)} title="Export JSON">
              <Download size={18} />
            </button>
            <button className="icon-button" type="button" onClick={resetState} title="Reset">
              <RotateCcw size={18} />
            </button>
          </div>
        </section>
      )}

      <section className="workspace">
        <section className="chart-stage" aria-label="Organizational structure tree">
          <div className="chart-toolbar">
            <div className="toolbar-title">
              <Crown size={17} />
              <span>WeBots umbrella + separate CHRC operating chain</span>
            </div>

            {isEmbedMode && (
              <div className="embed-stat-strip" aria-label="Organization statistics">
                <span>{people.length} Roles</span>
                <span>{hiringCount} Open</span>
                <span>{seniorCount} Core</span>
              </div>
            )}

            <div className="zoom-control" aria-label="Zoom">
              <button type="button" onClick={() => setZoom((value) => Math.max(0.42, value - 0.08))}>
                -
              </button>
              <span>{Math.round(zoom * 100)}%</span>
              <button type="button" onClick={() => setZoom((value) => Math.min(1.16, value + 0.08))}>
                +
              </button>
            </div>
          </div>

          <div className="chart-scroll" ref={chartScrollRef}>
            <svg
              className="org-svg"
              width={canvasWidth * zoom}
              height={canvasHeight * zoom}
              viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
              role="img"
              aria-label="Org chart"
            >
              <g transform={`translate(${CANVAS_MARGIN - minX + CARD_WIDTH / 2}, ${CANVAS_MARGIN})`}>
                {links.map((link) => (
                  <OrgLink key={`${link.source.id}-${link.target.id}`} link={link} />
                ))}
                {nodes.map((node) => {
                  const team = teamById.get(node.data.teamId) ?? teams[0];
                  return (
                    <OrgNode
                      key={node.id}
                      node={node}
                      team={team}
                      selected={!isPublicView && node.data.id === selectedPerson?.id}
                      reports={people.filter((person) => person.managerId === node.data.id).length}
                      onSelect={() => {
                        if (!isPublicView) setSelectedId(node.data.id);
                      }}
                    />
                  );
                })}
              </g>
            </svg>
          </div>
        </section>

        {!isPublicView && (
          <aside className="inspector" aria-label="Org chart editor">
            <section className="inspector-section">
              <div className="section-heading">
                <Briefcase size={17} />
                <h2>Role</h2>
              </div>

              <label>
                <span>Name</span>
                <input value={selectedPerson.name} onChange={(event) => updatePerson(selectedPerson.id, { name: event.target.value })} />
              </label>

              <label>
                <span>Role</span>
                <input value={selectedPerson.role} onChange={(event) => updatePerson(selectedPerson.id, { role: event.target.value })} />
              </label>

              <div className="two-column-fields">
                <label>
                  <span>Team</span>
                  <select value={selectedPerson.teamId} onChange={(event) => updatePerson(selectedPerson.id, { teamId: event.target.value })}>
                    {teams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>Level</span>
                  <select value={selectedPerson.level} onChange={(event) => updatePersonLevel(event.target.value as Level)}>
                    {LEVELS.map((level) => (
                      <option key={level} value={level}>
                        {level}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label>
                <span>Reports / Accountable To</span>
                <select
                  value={selectedPerson.managerId ?? ""}
                  onChange={(event) => updatePerson(selectedPerson.id, { managerId: event.target.value || undefined })}
                  disabled={selectedPerson.level === "L6"}
                >
                  <option value="">None</option>
                  {managerOptions.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.name} - {person.level}
                    </option>
                  ))}
                </select>
              </label>

              <div className="toggle-grid">
                <label className="switch-row">
                  <input
                    type="checkbox"
                    checked={selectedPerson.hiring}
                    onChange={(event) => updatePerson(selectedPerson.id, { hiring: event.target.checked })}
                  />
                  <span>Open / Phase 2</span>
                </label>

                <label className="switch-row">
                  <input
                    type="checkbox"
                    checked={selectedPerson.seniorLeadership}
                    onChange={(event) => updatePerson(selectedPerson.id, { seniorLeadership: event.target.checked })}
                  />
                  <span>Core leadership</span>
                </label>
              </div>

              <div className="button-row">
                <button className="primary-action" type="button" onClick={() => addReport()}>
                  <Plus size={17} />
                  Add Role
                </button>
                <button className="danger-action" type="button" onClick={removeSelected} disabled={!selectedPerson.managerId}>
                  <Trash2 size={17} />
                  Remove
                </button>
              </div>
            </section>

            <section className="inspector-section">
              <div className="section-heading">
                <Palette size={17} />
                <h2>Teams</h2>
              </div>

            <div className="team-list">
              {teams.map((team) => (
                  <div className="team-row" key={team.id}>
                    <input
                      className="team-name-input"
                      value={team.name}
                      onChange={(event) => updateTeam(team.id, { name: event.target.value })}
                      aria-label={`${team.name} name`}
                    />
                    <input
                      className="color-input"
                      type="color"
                      value={team.color}
                      onChange={(event) => updateTeam(team.id, { color: event.target.value })}
                      aria-label={`${team.name} color`}
                    />
                    <input
                      className="hex-input"
                      value={team.color.toUpperCase()}
                      maxLength={7}
                      onChange={(event) => updateTeamColor(team.id, event.target.value)}
                      aria-label={`${team.name} hex color`}
                    />
                  </div>
                ))}
              </div>

              <button className="secondary-action" type="button" onClick={addTeam}>
                <Plus size={17} />
                Add Team
              </button>
            </section>
          </aside>
        )}
      </section>
    </main>
  );
}

function OrgLink({ link }: { link: { source: HierarchyPointNode<Person>; target: HierarchyPointNode<Person> } }) {
  const sourceX = link.source.x;
  const sourceY = link.source.y + CARD_HEIGHT / 2;
  const targetX = link.target.x;
  const targetY = link.target.y - CARD_HEIGHT / 2;
  const midY = sourceY + (targetY - sourceY) / 2;

  return <path className="org-link" d={`M ${sourceX} ${sourceY} C ${sourceX} ${midY}, ${targetX} ${midY}, ${targetX} ${targetY}`} />;
}

function OrgNode({
  node,
  team,
  selected,
  reports,
  onSelect,
}: {
  node: HierarchyPointNode<Person>;
  team: Team;
  selected: boolean;
  reports: number;
  onSelect: () => void;
}) {
  const person = node.data;
  const teamColor = team.color;
  const rgb = hexToRgb(teamColor);

  return (
    <foreignObject x={node.x - CARD_WIDTH / 2} y={node.y - CARD_HEIGHT / 2} width={CARD_WIDTH} height={CARD_HEIGHT}>
      <button
        className={`person-card ${selected ? "is-selected" : ""} ${person.seniorLeadership ? "is-senior-leadership" : ""}`}
        style={
          {
            "--team-color": teamColor,
            "--team-rgb": rgb,
          } as React.CSSProperties
        }
        type="button"
        onClick={onSelect}
      >
        <div className="card-badge-row">
          <span className="team-pill">
            <span />
            {team.name}
          </span>
          {person.seniorLeadership && (
            <span className="senior-badge" title="Senior leadership">
              Core
            </span>
          )}
        </div>

        <div className="person-main">
          <h3>{person.name}</h3>
          <p>{person.role}</p>
        </div>

        <div className="person-meta">
          <span className="level-pill">{person.level}</span>
          <span>{reports} roles</span>
          {person.hiring && <strong>Open</strong>}
        </div>
      </button>
    </foreignObject>
  );
}
