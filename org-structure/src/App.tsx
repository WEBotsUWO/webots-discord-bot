import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type WheelEvent } from "react";
import { stratify, tree, type HierarchyPointNode } from "d3-hierarchy";
import {
  Briefcase,
  Crown,
  Download,
  Minus,
  Palette,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  Users,
} from "lucide-react";

type Level = "L1" | "L2" | "L3" | "L4" | "L5" | "L6";
type ChartView = "webots" | "chrc";

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

type PeopleByView = Record<ChartView, Person[]>;
type CollapsedByView = Record<ChartView, Set<string>>;
type SelectedByView = Record<ChartView, string>;

const LEVELS: Level[] = ["L6", "L5", "L4", "L3", "L2", "L1"];
const CARD_WIDTH = 286;
const CARD_HEIGHT = 152;
const NODE_GAP_X = 330;
const NODE_GAP_Y = 206;
const CANVAS_MARGIN = 110;
const MIN_ZOOM = 0.42;
const MAX_ZOOM = 1.6;
const ZOOM_BUTTON_STEP = 0.1;
const STORAGE_KEY = "webots-org-structure-state-v4";

const CHART_VIEWS: { id: ChartView; label: string; description: string }[] = [
  {
    id: "webots",
    label: "WeBots",
    description: "Project JOSH + WeBots CHRC team",
  },
  {
    id: "chrc",
    label: "CHRC",
    description: "Competition planning + logistics",
  },
];

const initialTeams: Team[] = [
  { id: "governance", name: "Leadership", color: "#ffb84d" },
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

const initialPeopleByView: PeopleByView = {
  webots: [
    {
      id: "webots-president",
      name: "WeBots President",
      role: "Vision, priorities, university relationships, final decisions",
      teamId: "governance",
      level: "L6",
      hiring: false,
      seniorLeadership: true,
    },
    {
      id: "vp-operations-people",
      name: "VP Operations & People",
      role: "Club cadence, onboarding, rooms, records, member health",
      teamId: "webots-ops",
      level: "L5",
      managerId: "webots-president",
      hiring: true,
      seniorLeadership: true,
    },
    {
      id: "vp-external-affairs",
      name: "VP External Affairs",
      role: "Sponsors, marketing, recruitment, public-facing relationships",
      teamId: "webots-business",
      level: "L5",
      managerId: "webots-president",
      hiring: true,
      seniorLeadership: true,
    },
    {
      id: "director-engineering-programs",
      name: "Director of Engineering & Programs",
      role: "Project priorities, PM support, technical review cadence",
      teamId: "governance",
      level: "L5",
      managerId: "webots-president",
      hiring: true,
      seniorLeadership: true,
    },
    {
      id: "ops-admin-coordinators",
      name: "Operations / Admin Coordinators",
      role: "Rooms, agendas, meeting records, action follow-up",
      teamId: "webots-ops",
      level: "L4",
      managerId: "vp-operations-people",
      hiring: true,
      seniorLeadership: false,
    },
    {
      id: "recruitment-support",
      name: "Recruitment & Member Support",
      role: "Onboarding, attendance, retention, member care",
      teamId: "webots-ops",
      level: "L4",
      managerId: "vp-operations-people",
      hiring: true,
      seniorLeadership: false,
    },
    {
      id: "business-partnerships-lead",
      name: "Business & Partnerships Lead",
      role: "Sponsor pipeline, grants, budget tracking, purchases",
      teamId: "webots-business",
      level: "L4",
      managerId: "vp-external-affairs",
      hiring: true,
      seniorLeadership: false,
    },
    {
      id: "marketing-communications-lead",
      name: "Marketing & Communications Lead",
      role: "WeBots brand, social calendar, recruiting media",
      teamId: "webots-marketing",
      level: "L4",
      managerId: "vp-external-affairs",
      hiring: true,
      seniorLeadership: false,
    },
    {
      id: "project-josh-pm",
      name: "Project JOSH Project Manager",
      role: "Long-term humanoid roadmap, milestones, reviews",
      teamId: "project-josh",
      level: "L4",
      managerId: "director-engineering-programs",
      hiring: true,
      seniorLeadership: true,
    },
    {
      id: "webots-chrc-team-pm",
      name: "WeBots CHRC Team Project Manager",
      role: "Competition robot scope, build plan, readiness",
      teamId: "webots-chrc-team",
      level: "L4",
      managerId: "director-engineering-programs",
      hiring: true,
      seniorLeadership: true,
    },
    {
      id: "engineering-operations-lead",
      name: "Shared Engineering Operations Lead",
      role: "Build standards, lab process, shared tools, part flow",
      teamId: "governance",
      level: "L4",
      managerId: "director-engineering-programs",
      hiring: true,
      seniorLeadership: false,
    },
    {
      id: "sponsorship-grants",
      name: "Sponsorship / Grants Lead",
      role: "Sponsor proposals, outreach, deliverables",
      teamId: "webots-business",
      level: "L3",
      managerId: "business-partnerships-lead",
      hiring: true,
      seniorLeadership: false,
    },
    {
      id: "finance-purchasing",
      name: "Finance / Purchasing Support",
      role: "Budget tracking, purchases, reimbursements",
      teamId: "webots-business",
      level: "L3",
      managerId: "business-partnerships-lead",
      hiring: true,
      seniorLeadership: false,
    },
    {
      id: "webots-social-media",
      name: "Social Media Lead",
      role: "WeBots channels, posting cadence, project updates",
      teamId: "webots-marketing",
      level: "L3",
      managerId: "marketing-communications-lead",
      hiring: true,
      seniorLeadership: false,
    },
    {
      id: "webots-content-design",
      name: "Content / Design Lead",
      role: "Graphics, photo/video, story assets",
      teamId: "webots-marketing",
      level: "L3",
      managerId: "marketing-communications-lead",
      hiring: true,
      seniorLeadership: false,
    },
    {
      id: "web-recruitment-media",
      name: "Website / Recruitment Media",
      role: "Website content, recruiting pages, media library",
      teamId: "webots-marketing",
      level: "L3",
      managerId: "marketing-communications-lead",
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
      name: "Competition Mechanical Lead",
      role: "Robot mechanisms, packaging, repairability",
      teamId: "webots-chrc-team",
      level: "L3",
      managerId: "webots-chrc-team-pm",
      hiring: true,
      seniorLeadership: false,
    },
    {
      id: "comp-electrical",
      name: "Competition Electrical Lead",
      role: "Competition electrical system and field reliability",
      teamId: "webots-chrc-team",
      level: "L3",
      managerId: "webots-chrc-team-pm",
      hiring: true,
      seniorLeadership: false,
    },
    {
      id: "comp-software-controls",
      name: "Competition Software & Controls Lead",
      role: "Competition software, controls, perception, tooling",
      teamId: "webots-chrc-team",
      level: "L3",
      managerId: "webots-chrc-team-pm",
      hiring: true,
      seniorLeadership: false,
    },
    {
      id: "comp-systems-test",
      name: "Competition Integration & Test Lead",
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
      id: "lab-safety-process",
      name: "Safety & Lab Process Coordinator",
      role: "Shop safety, build procedures, member access",
      teamId: "governance",
      level: "L3",
      managerId: "engineering-operations-lead",
      hiring: true,
      seniorLeadership: false,
    },
    {
      id: "parts-fabrication",
      name: "Parts & Fabrication Coordinator",
      role: "Part orders, fabrication queue, inventory",
      teamId: "governance",
      level: "L3",
      managerId: "engineering-operations-lead",
      hiring: true,
      seniorLeadership: false,
    },
  ],
  chrc: [
    {
      id: "chrc-executive-director",
      name: "Executive Director / Commissioner",
      role: "Competition execution, budget, staffing, calendar",
      teamId: "governance",
      level: "L6",
      hiring: true,
      seniorLeadership: true,
    },
    {
      id: "chrc-founder",
      name: "Founder",
      role: "Advisory, mission continuity, introductions only",
      teamId: "governance",
      level: "L5",
      managerId: "chrc-executive-director",
      hiring: false,
      seniorLeadership: true,
    },
    {
      id: "chrc-delivery-director",
      name: "Deputy Director, Competition Delivery",
      role: "Event operations, technical rules, field execution",
      teamId: "chrc-operations",
      level: "L5",
      managerId: "chrc-executive-director",
      hiring: true,
      seniorLeadership: true,
    },
    {
      id: "chrc-outreach-business-director",
      name: "Deputy Director, Outreach & Business",
      role: "Teams, partnerships, finance, marketing, communications",
      teamId: "chrc-finance",
      level: "L5",
      managerId: "chrc-executive-director",
      hiring: true,
      seniorLeadership: true,
    },
    {
      id: "chrc-appeals-integrity",
      name: "Independent Appeals & Integrity Panel",
      role: "Event-period fairness, conflicts, appeals",
      teamId: "integrity",
      level: "L5",
      managerId: "chrc-executive-director",
      hiring: true,
      seniorLeadership: false,
    },
    {
      id: "chrc-ops-pm",
      name: "Competition Operations PM",
      role: "Venue, event flow, volunteers, run-of-show",
      teamId: "chrc-operations",
      level: "L4",
      managerId: "chrc-delivery-director",
      hiring: true,
      seniorLeadership: true,
    },
    {
      id: "chrc-rules-pm",
      name: "Technical & Rules PM",
      role: "Rulebook, safety, inspection, scoring process",
      teamId: "chrc-rules",
      level: "L4",
      managerId: "chrc-delivery-director",
      hiring: true,
      seniorLeadership: true,
    },
    {
      id: "chrc-relations-pm",
      name: "Team Relations PM",
      role: "University outreach, registration, competitor support",
      teamId: "chrc-relations",
      level: "L4",
      managerId: "chrc-outreach-business-director",
      hiring: true,
      seniorLeadership: true,
    },
    {
      id: "chrc-finance-pm",
      name: "Partnerships & Finance PM",
      role: "Sponsors, grants, budget, partner deliverables",
      teamId: "chrc-finance",
      level: "L4",
      managerId: "chrc-outreach-business-director",
      hiring: true,
      seniorLeadership: true,
    },
    {
      id: "chrc-media-pm",
      name: "Marketing & Media PM",
      role: "Brand, social channels, site, announcements",
      teamId: "chrc-media",
      level: "L4",
      managerId: "chrc-outreach-business-director",
      hiring: true,
      seniorLeadership: true,
    },
    {
      id: "chrc-venue-logistics",
      name: "Venue & Logistics Lead",
      role: "Venue, equipment, setup/teardown, event flow",
      teamId: "chrc-operations",
      level: "L3",
      managerId: "chrc-ops-pm",
      hiring: true,
      seniorLeadership: false,
    },
    {
      id: "chrc-volunteers",
      name: "Volunteers & Staffing Lead",
      role: "Volunteer recruiting, assignments, training",
      teamId: "chrc-operations",
      level: "L3",
      managerId: "chrc-ops-pm",
      hiring: true,
      seniorLeadership: false,
    },
    {
      id: "chrc-field-ops",
      name: "Event Schedule / Field Operations Lead",
      role: "Run schedule, field flow, on-site execution",
      teamId: "chrc-operations",
      level: "L3",
      managerId: "chrc-ops-pm",
      hiring: true,
      seniorLeadership: false,
    },
    {
      id: "chrc-rules-lead",
      name: "Rules Lead",
      role: "Rulebook process and official clarifications",
      teamId: "chrc-rules",
      level: "L3",
      managerId: "chrc-rules-pm",
      hiring: true,
      seniorLeadership: false,
    },
    {
      id: "chrc-safety-inspection",
      name: "Safety & Technical Inspection Lead",
      role: "Safety standards, inspection process, readiness",
      teamId: "chrc-rules",
      level: "L3",
      managerId: "chrc-rules-pm",
      hiring: true,
      seniorLeadership: false,
    },
    {
      id: "chrc-judging-scoring",
      name: "Judging & Scoring Lead",
      role: "Scoring system, judge preparation, judging flow",
      teamId: "chrc-rules",
      level: "L3",
      managerId: "chrc-rules-pm",
      hiring: true,
      seniorLeadership: false,
    },
    {
      id: "chrc-university-outreach",
      name: "University Outreach Lead",
      role: "Recruit universities through neutral channels",
      teamId: "chrc-relations",
      level: "L3",
      managerId: "chrc-relations-pm",
      hiring: true,
      seniorLeadership: false,
    },
    {
      id: "chrc-registration-support",
      name: "Registration & Team Support Lead",
      role: "Registration, FAQs, deadlines, team communication",
      teamId: "chrc-relations",
      level: "L3",
      managerId: "chrc-relations-pm",
      hiring: true,
      seniorLeadership: false,
    },
    {
      id: "chrc-sponsorship",
      name: "Sponsorship Lead",
      role: "Sponsor pipeline and deliverables",
      teamId: "chrc-finance",
      level: "L3",
      managerId: "chrc-finance-pm",
      hiring: true,
      seniorLeadership: false,
    },
    {
      id: "chrc-finance-grants",
      name: "Finance / Grants Lead",
      role: "Budget, payments, grants, records",
      teamId: "chrc-finance",
      level: "L3",
      managerId: "chrc-finance-pm",
      hiring: true,
      seniorLeadership: false,
    },
    {
      id: "chrc-social-media",
      name: "Social Media Lead",
      role: "Neutral channels and competition updates",
      teamId: "chrc-media",
      level: "L3",
      managerId: "chrc-media-pm",
      hiring: true,
      seniorLeadership: false,
    },
    {
      id: "chrc-brand-design",
      name: "Brand / Design Lead",
      role: "Identity, graphics, event collateral",
      teamId: "chrc-media",
      level: "L3",
      managerId: "chrc-media-pm",
      hiring: true,
      seniorLeadership: false,
    },
    {
      id: "chrc-web-content",
      name: "Web / Content Lead",
      role: "Competition site, docs, announcements, media",
      teamId: "chrc-media",
      level: "L3",
      managerId: "chrc-media-pm",
      hiring: true,
      seniorLeadership: false,
    },
  ],
};

const nextTeamColors = ["#f7d154", "#39c0ff", "#ff8a5b", "#a6e35f", "#f271ff"];

function levelValue(level: Level) {
  return Number(level.slice(1));
}

function levelBelow(level: Level): Level {
  const next = Math.max(1, levelValue(level) - 1);
  return `L${next}` as Level;
}

function clampZoom(value: number) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
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

function getRootId(people: Person[]) {
  return people.find((person) => !person.managerId)?.id ?? people[0]?.id ?? "";
}

function getInitialSelectedByView(peopleByView: PeopleByView): SelectedByView {
  return {
    webots: getRootId(peopleByView.webots),
    chrc: getRootId(peopleByView.chrc),
  };
}

function getChildMap(people: Person[]) {
  const childMap = new Map<string, Person[]>();
  people.forEach((person) => {
    if (!person.managerId) return;
    const siblings = childMap.get(person.managerId) ?? [];
    siblings.push(person);
    childMap.set(person.managerId, siblings);
  });
  return childMap;
}

function getInitialCollapsed(people: Person[]) {
  const rootId = getRootId(people);
  return new Set([...getChildMap(people).keys()].filter((personId) => personId !== rootId));
}

function getInitialCollapsedByView(peopleByView: PeopleByView): CollapsedByView {
  return {
    webots: getInitialCollapsed(peopleByView.webots),
    chrc: getInitialCollapsed(peopleByView.chrc),
  };
}

function getDescendantIds(people: Person[], personId: string) {
  const descendants = new Set<string>();
  const childMap = getChildMap(people);
  const walk = (managerId: string) => {
    (childMap.get(managerId) ?? []).forEach((person) => {
      descendants.add(person.id);
      walk(person.id);
    });
  };
  walk(personId);
  return descendants;
}

function getAncestorIds(people: Person[], personId: string) {
  const ancestors = new Set<string>();
  const personById = new Map(people.map((person) => [person.id, person]));
  let managerId = personById.get(personId)?.managerId;

  while (managerId) {
    ancestors.add(managerId);
    managerId = personById.get(managerId)?.managerId;
  }

  return ancestors;
}

function matchesSearch(person: Person, searchTerm: string) {
  const query = searchTerm.trim().toLowerCase();
  if (!query) return false;
  return person.name.toLowerCase().includes(query) || person.role.toLowerCase().includes(query);
}

function getSearchMatchIds(people: Person[], searchTerm: string) {
  const query = searchTerm.trim();
  if (!query) return new Set<string>();
  return new Set(people.filter((person) => matchesSearch(person, query)).map((person) => person.id));
}

function getVisiblePeople(people: Person[], collapsedIds: Set<string>, searchTerm: string) {
  const query = searchTerm.trim();
  if (query) {
    const includedIds = new Set<string>();
    const matchingIds = getSearchMatchIds(people, query);

    matchingIds.forEach((personId) => {
      includedIds.add(personId);
      getAncestorIds(people, personId).forEach((ancestorId) => includedIds.add(ancestorId));
      getDescendantIds(people, personId).forEach((descendantId) => includedIds.add(descendantId));
    });

    return people.filter((person) => includedIds.has(person.id));
  }

  const personById = new Map(people.map((person) => [person.id, person]));

  return people.filter((person) => {
    let managerId = person.managerId;
    while (managerId) {
      if (collapsedIds.has(managerId)) return false;
      managerId = personById.get(managerId)?.managerId;
    }
    return true;
  });
}

function loadSavedState() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      teams?: Team[];
      peopleByView?: PeopleByView;
      selectedByView?: SelectedByView;
    };
    if (!Array.isArray(parsed.teams) || !parsed.peopleByView) return null;
    if (!Array.isArray(parsed.peopleByView.webots) || !Array.isArray(parsed.peopleByView.chrc)) return null;
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

function exportState(teams: Team[], peopleByView: PeopleByView) {
  const payload = JSON.stringify({ teams, peopleByView }, null, 2);
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
  const defaultZoom = isEmbedMode ? 0.72 : isPublicView ? 0.66 : 0.92;
  const savedState = useMemo(() => (isPublicView ? null : loadSavedState()), [isPublicView]);
  const [teams, setTeams] = useState<Team[]>(savedState?.teams ?? initialTeams);
  const [peopleByView, setPeopleByView] = useState<PeopleByView>(savedState?.peopleByView ?? initialPeopleByView);
  const [selectedByView, setSelectedByView] = useState<SelectedByView>(
    savedState?.selectedByView ?? getInitialSelectedByView(savedState?.peopleByView ?? initialPeopleByView),
  );
  const [collapsedByView, setCollapsedByView] = useState<CollapsedByView>(() =>
    getInitialCollapsedByView(savedState?.peopleByView ?? initialPeopleByView),
  );
  const [activeView, setActiveView] = useState<ChartView>("webots");
  const [searchTerm, setSearchTerm] = useState("");
  const [zoom, setZoom] = useState(defaultZoom);
  const chartScrollRef = useRef<HTMLDivElement>(null);
  const hasCenteredChart = useRef(false);

  const people = peopleByView[activeView];
  const selectedId = selectedByView[activeView];
  const selectedPerson = people.find((person) => person.id === selectedId) ?? people[0];
  const collapsedIds = collapsedByView[activeView] ?? new Set<string>();
  const visiblePeople = useMemo(() => getVisiblePeople(people, collapsedIds, searchTerm), [people, collapsedIds, searchTerm]);
  const matchingIds = useMemo(() => getSearchMatchIds(people, searchTerm), [people, searchTerm]);
  const activeViewConfig = CHART_VIEWS.find((view) => view.id === activeView) ?? CHART_VIEWS[0];

  const teamById = useMemo(() => new Map(teams.map((team) => [team.id, team])), [teams]);
  const childMap = useMemo(() => getChildMap(people), [people]);
  const chart = useMemo(() => buildChart(visiblePeople), [visiblePeople]);
  const nodes = chart.descendants();
  const links = chart.links();
  const minX = Math.min(...nodes.map((node) => node.x));
  const maxX = Math.max(...nodes.map((node) => node.x));
  const maxY = Math.max(...nodes.map((node) => node.y));
  const canvasWidth = Math.max(980, maxX - minX + CANVAS_MARGIN * 2 + CARD_WIDTH);
  const canvasHeight = Math.max(660, maxY + CANVAS_MARGIN * 2 + CARD_HEIGHT);
  const seniorCount = people.filter((person) => person.seniorLeadership).length;
  const hiringCount = people.filter((person) => person.hiring).length;
  const activeTeamCount = new Set(people.map((person) => person.teamId)).size;

  useEffect(() => {
    if (isPublicView) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ teams, peopleByView, selectedByView }));
  }, [isPublicView, teams, peopleByView, selectedByView]);

  useEffect(() => {
    if (hasCenteredChart.current || !chartScrollRef.current) return;
    const rootCenterX = (CANVAS_MARGIN - minX + CARD_WIDTH / 2 + chart.x) * zoom;
    chartScrollRef.current.scrollLeft = Math.max(0, rootCenterX - chartScrollRef.current.clientWidth / 2);
    chartScrollRef.current.scrollTop = 0;
    hasCenteredChart.current = true;
  }, [activeView, chart.x, minX, searchTerm, zoom]);

  function switchView(viewId: ChartView) {
    setActiveView(viewId);
    setSearchTerm("");
    hasCenteredChart.current = false;
  }

  function zoomAtClientPoint(getNextZoom: (currentZoom: number) => number, clientX: number, clientY: number) {
    const scroller = chartScrollRef.current;

    setZoom((currentZoom) => {
      const nextZoom = clampZoom(getNextZoom(currentZoom));
      if (!scroller || nextZoom === currentZoom) return nextZoom;

      const rect = scroller.getBoundingClientRect();
      const offsetX = clientX - rect.left;
      const offsetY = clientY - rect.top;
      const worldX = (scroller.scrollLeft + offsetX) / currentZoom;
      const worldY = (scroller.scrollTop + offsetY) / currentZoom;

      window.requestAnimationFrame(() => {
        scroller.scrollLeft = Math.max(0, worldX * nextZoom - offsetX);
        scroller.scrollTop = Math.max(0, worldY * nextZoom - offsetY);
      });

      return nextZoom;
    });
  }

  function zoomFromCenter(delta: number) {
    const scroller = chartScrollRef.current;
    if (!scroller) {
      setZoom((currentZoom) => clampZoom(currentZoom + delta));
      return;
    }

    const rect = scroller.getBoundingClientRect();
    zoomAtClientPoint((currentZoom) => currentZoom + delta, rect.left + rect.width / 2, rect.top + rect.height / 2);
  }

  function handleWheelZoom(event: WheelEvent<HTMLDivElement>) {
    event.preventDefault();
    const factor = Math.exp(-event.deltaY * 0.001);
    zoomAtClientPoint((currentZoom) => currentZoom * factor, event.clientX, event.clientY);
  }

  function updateActivePeople(updater: (current: Person[]) => Person[]) {
    setPeopleByView((current) => ({
      ...current,
      [activeView]: updater(current[activeView]),
    }));
  }

  function setSelectedId(personId: string) {
    setSelectedByView((current) => ({ ...current, [activeView]: personId }));
  }

  function updatePerson(personId: string, patch: Partial<Person>) {
    updateActivePeople((current) =>
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
    updateActivePeople((current) => [...current, person]);
    setSelectedId(person.id);
    setCollapsedByView((current) => {
      const next = new Set(current[activeView]);
      next.delete(manager.id);
      return { ...current, [activeView]: next };
    });
  }

  function removeSelected() {
    if (!selectedPerson.managerId) return;
    const replacementManager = selectedPerson.managerId;
    updateActivePeople((current) =>
      current
        .filter((person) => person.id !== selectedPerson.id)
        .map((person) => (person.managerId === selectedPerson.id ? { ...person, managerId: replacementManager } : person)),
    );
    setCollapsedByView((current) => {
      const next = new Set(current[activeView]);
      next.delete(selectedPerson.id);
      return { ...current, [activeView]: next };
    });
    setSelectedId(replacementManager);
  }

  function toggleCollapsed(personId: string) {
    setCollapsedByView((current) => {
      const next = new Set(current[activeView]);
      if (next.has(personId)) {
        next.delete(personId);
      } else {
        next.add(personId);
      }
      return { ...current, [activeView]: next };
    });
  }

  function resetState() {
    setTeams(initialTeams);
    setPeopleByView(initialPeopleByView);
    setSelectedByView(getInitialSelectedByView(initialPeopleByView));
    setCollapsedByView(getInitialCollapsedByView(initialPeopleByView));
    setSearchTerm("");
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
              <span>{activeTeamCount}</span>
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
            {!isPublicView && (
              <>
                <button className="icon-button" type="button" onClick={() => exportState(teams, peopleByView)} title="Export JSON">
                  <Download size={18} />
                </button>
                <button className="icon-button" type="button" onClick={resetState} title="Reset">
                  <RotateCcw size={18} />
                </button>
              </>
            )}
          </div>
        </section>
      )}

      <section className="workspace">
        <section className="chart-stage" aria-label="Organizational structure tree">
          <div className="chart-toolbar">
            <div className="toolbar-title">
              <Crown size={17} />
              <span>{activeViewConfig.description}</span>
            </div>

            <div className="view-tabs" role="tablist" aria-label="Org chart section">
              {CHART_VIEWS.map((view) => (
                <button
                  key={view.id}
                  type="button"
                  role="tab"
                  aria-selected={activeView === view.id}
                  className={`tab-button ${activeView === view.id ? "is-active" : ""}`}
                  onClick={() => switchView(view.id)}
                >
                  <span>{view.label}</span>
                  <small>{view.description}</small>
                </button>
              ))}
            </div>

            <label className="search-control">
              <Search size={16} />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search name or role"
                aria-label="Search by name or role"
              />
              {searchTerm && (
                <button type="button" onClick={() => setSearchTerm("")} aria-label="Clear search">
                  Clear
                </button>
              )}
            </label>

            {searchTerm && (
              <span className="match-count" aria-live="polite">
                {matchingIds.size} {matchingIds.size === 1 ? "match" : "matches"}
              </span>
            )}

            {isEmbedMode && (
              <div className="embed-stat-strip" aria-label="Organization statistics">
                <span>{people.length} Roles</span>
                <span>{hiringCount} Open</span>
                <span>{seniorCount} Core</span>
              </div>
            )}

            <div className="zoom-control" aria-label="Zoom">
              <button type="button" onClick={() => zoomFromCenter(-ZOOM_BUTTON_STEP)}>
                -
              </button>
              <span>{Math.round(zoom * 100)}%</span>
              <button type="button" onClick={() => zoomFromCenter(ZOOM_BUTTON_STEP)}>
                +
              </button>
            </div>
          </div>

          <div className="chart-scroll" ref={chartScrollRef} onWheel={handleWheelZoom}>
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
                  const reports = childMap.get(node.data.id)?.length ?? 0;
                  const isCollapsed = !searchTerm && collapsedIds.has(node.data.id);
                  return (
                    <OrgNode
                      key={node.id}
                      node={node}
                      team={team}
                      selected={!isPublicView && node.data.id === selectedPerson?.id}
                      reports={reports}
                      canExpand={reports > 0}
                      collapsed={isCollapsed}
                      searchMatch={matchingIds.has(node.data.id)}
                      isPublicView={isPublicView}
                      onSelect={() => {
                        if (!isPublicView) setSelectedId(node.data.id);
                      }}
                      onToggle={() => toggleCollapsed(node.data.id)}
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
  canExpand,
  collapsed,
  searchMatch,
  isPublicView,
  onSelect,
  onToggle,
}: {
  node: HierarchyPointNode<Person>;
  team: Team;
  selected: boolean;
  reports: number;
  canExpand: boolean;
  collapsed: boolean;
  searchMatch: boolean;
  isPublicView: boolean;
  onSelect: () => void;
  onToggle: () => void;
}) {
  const person = node.data;
  const teamColor = team.color;
  const rgb = hexToRgb(teamColor);

  function handleCardKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (isPublicView) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect();
    }
  }

  return (
    <foreignObject x={node.x - CARD_WIDTH / 2} y={node.y - CARD_HEIGHT / 2} width={CARD_WIDTH} height={CARD_HEIGHT}>
      <div
        className={`person-card ${selected ? "is-selected" : ""} ${person.seniorLeadership ? "is-senior-leadership" : ""} ${
          canExpand ? "has-children" : ""
        } ${collapsed ? "is-collapsed" : ""} ${searchMatch ? "is-search-match" : ""}`}
        style={
          {
            "--team-color": teamColor,
            "--team-rgb": rgb,
          } as CSSProperties
        }
        role={isPublicView ? undefined : "button"}
        tabIndex={isPublicView ? undefined : 0}
        onClick={onSelect}
        onKeyDown={handleCardKeyDown}
      >
        <div className="card-badge-row">
          <span className="team-pill">
            <span />
            {team.name}
          </span>
          {person.seniorLeadership && (
            <span className="senior-badge" title="Core leadership">
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

        {canExpand && (
          <button
            className="expand-toggle"
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onToggle();
            }}
            aria-label={`${collapsed ? "Expand" : "Collapse"} ${person.name} branch`}
            title={`${collapsed ? "Expand" : "Collapse"} branch`}
          >
            {collapsed ? <Plus size={16} /> : <Minus size={16} />}
          </button>
        )}
      </div>
    </foreignObject>
  );
}
