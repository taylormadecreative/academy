/* Browser-local orientation only. Visiting a guide destination never changes campus records. */
const VERSION = 1;
const PREFIX = 'ht-hub-onboarding:v1:';
const STATUSES = new Set(['new', 'active', 'dismissed', 'complete']);
const MAX_RECORD_LENGTH = 4096;
const STEPS = {
  student: [
    { id: 'courses', title: 'Start with your courses', description: 'Find your lessons, assignments, due dates, and published grades in one course workspace.', action: 'Open my courses', view: 'courses', hint: 'Open a course, then choose Assignments to find your next task. Your grades and feedback are private.' },
    { id: 'live', title: 'Find your classroom', description: 'Your cohort has its own classroom. Campus live events have a separate place here, too.', action: 'Explore classrooms', view: 'live', hint: 'Choose your classroom to see its scheduled sessions. Enter a session when you are ready to join.' },
    { id: 'community', title: 'Meet your campus community', description: 'Catch up on campus conversations and find a channel that interests you.', action: 'Explore community', view: 'community', hint: 'Choose a channel, read a conversation, and reply when you have something to share.' },
    { id: 'people', title: 'Find people and messages', description: 'Use the campus directory to find someone and open your private conversations.', action: 'Open messages', view: 'people', hint: 'Choose New message, search the campus directory, and select Message beside the person you want to reach.' },
    { id: 'events', title: 'Make room for campus life', description: 'See upcoming events, open the details, and keep track of what you want to attend.', action: 'Explore events', view: 'events', hint: 'Open an event to check its time, location, and details before choosing to RSVP.' },
    { id: 'support', title: 'Know where to get help', description: 'Find campus support and keep your requests together when you need a hand.', action: 'Find student support', view: 'support', hint: 'Choose the kind of help you need. Review your request before submitting it.' },
    { id: 'spaces', title: 'Find your way around campus', description: 'Explore campus offices and resources, including careers, alumni, and student services.', action: 'Explore campus', view: 'spaces', hint: 'Search Around campus for an office or resource. Return to Guide for the full site map.' },
  ],
  staff: [
    { id: 'courses', title: 'Open your teaching workspace', description: 'Manage assignments, review student work, and publish grades in the course sections you teach.', action: 'Open my courses', view: 'courses', hint: 'Open an assigned section to review its assignments. Draft grades and feedback stay private until you publish them; teaching tools require an assigned instructor or administrator.' },
    { id: 'live', title: 'Organize your classrooms', description: 'Find cohort classrooms and scheduled sessions alongside campus live events.', action: 'Explore classrooms', view: 'live', hint: 'Open a classroom to see its roster and sessions. Assigned instructors and administrators can manage their classrooms.' },
    { id: 'staff', title: 'Find your publishing tools', description: 'The staff workspace brings announcements, events, learning pathways, and campus management together.', action: 'Open staff workspace', view: 'staff', hint: 'Choose Announcements, Events, Learning, or Review work for your task. Open Settings to manage Ada’s welcome video and support contact.' },
    { id: 'community', title: 'Stay connected to campus', description: 'Follow campus conversations and use community channels to connect with students and colleagues.', action: 'Explore community', view: 'community', hint: 'Choose a channel, read the latest conversation, and reply or share an update when you are ready.' },
    { id: 'people', title: 'Find people and messages', description: 'Use the directory and your private inbox to keep individual conversations easy to find.', action: 'Open messages', view: 'people', hint: 'Choose New message, search the campus directory, and select Message beside the person you want to reach.' },
    { id: 'support', title: 'Follow through on support', description: 'Find support requests and the staff tools available to help students get a response.', action: 'Open student support', view: 'support', hint: 'Open a request available to your role, review its details, and choose its next step when you are ready.' },
    { id: 'insights', title: 'See the bigger picture', description: 'Review the campus activity and learning summaries available to your role.', action: 'Explore campus insights', view: 'insights', hint: 'Check a summary to see where attention may be needed. Return to Guide for the full site map, or use Campus to find an office or resource.' },
  ],
  leadership: [
    { id: 'insights', title: 'Start with campus insights', description: 'Review campus participation and learning summaries to see where the Hub is being used.', action: 'Open campus insights', view: 'insights', hint: 'Review the available summaries. Leadership access does not include private student submissions, grades, or messages.' },
    { id: 'community', title: 'Connect with campus life', description: 'Explore community conversations and see the spaces where campus members connect.', action: 'Explore community', view: 'community', hint: 'Choose a community channel, read a conversation, and explore the topics campus members are discussing.' },
    { id: 'spaces', title: 'Explore campus offices', description: 'Find campus offices and resources in Around campus.', action: 'Explore campus', view: 'spaces', hint: 'Search Around campus for an office or resource. Return to Guide for the full site map.' },
  ],
};

function identity(state) {
  if (!state || !['live', 'demo'].includes(state.mode) || !state.user || !state.member || state.member.active !== true) return null;
  const id = state.user.id;
  const actualRole = state.member.role;
  if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(id) || state.member.user_id !== id || !['student', 'staff', 'admin', 'leadership'].includes(actualRole)) return null;
  return { role: actualRole === 'admin' ? 'staff' : actualRole, key: `${PREFIX}${state.mode}:${actualRole}:${id}` };
}

export function getOnboardingRole(state) {
  return identity(state)?.role || null;
}

export function onboardingSteps(role) {
  return (Object.prototype.hasOwnProperty.call(STEPS, role) ? STEPS[role] : []).map(step => ({ ...step }));
}

const initial = () => ({ version: VERSION, status: 'new', visited: [], activeStep: null });
const copy = record => ({ ...record, visited: [...record.visited] });

function validated(raw, role) {
  if (typeof raw !== 'string' || raw.length > MAX_RECORD_LENGTH) return null;
  try {
    const value = JSON.parse(raw);
    const known = STEPS[role].map(step => step.id);
    if (!value || typeof value !== 'object' || Array.isArray(value) || value.version !== VERSION || !STATUSES.has(value.status) || !Array.isArray(value.visited) || value.visited.length > known.length) return null;
    if (value.visited.some(id => typeof id !== 'string' || !known.includes(id)) || new Set(value.visited).size !== value.visited.length) return null;
    if (value.activeStep !== null && !known.includes(value.activeStep)) return null;
    if (value.status === 'new' && (value.visited.length || value.activeStep !== null)) return null;
    if (value.status === 'complete' && value.visited.length !== known.length) return null;
    return { version: VERSION, status: value.status, visited: [...value.visited], activeStep: value.activeStep };
  } catch { return null; }
}

export function createOnboardingProgress(options = {}) {
  const memory = new Map();
  const corruptKeys = new Set();
  let storage = null;
  let unavailable = false;
  let destroyed = false;
  try {
    storage = Object.prototype.hasOwnProperty.call(options, 'storage') ? options.storage : globalThis.localStorage;
    if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function') unavailable = true;
  } catch { unavailable = true; }

  function load(current) {
    let record = memory.get(current.key) || initial();
    if (!unavailable && !corruptKeys.has(current.key)) {
      try {
        const raw = storage.getItem(current.key);
        if (raw === null) record = initial();
        else {
          const stored = validated(raw, current.role);
          if (stored) record = stored;
          else corruptKeys.add(current.key);
        }
      } catch { unavailable = true; }
    }
    memory.set(current.key, copy(record));
    return copy(record);
  }

  function result(current, record) {
    return { role: current.role, status: record.status, visited: [...record.visited], activeStep: record.activeStep, persistent: !unavailable && !corruptKeys.has(current.key) };
  }

  function read(state) {
    const current = !destroyed && identity(state);
    return current ? result(current, load(current)) : { role: null, status: 'new', visited: [], activeStep: null, persistent: false };
  }

  function change(state, update) {
    const current = !destroyed && identity(state);
    if (!current) return read(state);
    const record = load(current);
    if (!update(record, STEPS[current.role].map(step => step.id))) return result(current, record);
    memory.set(current.key, copy(record));
    if (!unavailable && !corruptKeys.has(current.key)) {
      try { storage.setItem(current.key, JSON.stringify(record)); }
      catch { unavailable = true; }
    }
    return result(current, record);
  }

  return {
    read,
    start: state => change(state, (record, ids) => {
      if (record.status === 'complete') return false;
      record.status = 'active';
      record.activeStep = ids.find(id => !record.visited.includes(id)) || ids[0];
      return true;
    }),
    visit: (state, stepId) => change(state, (record, ids) => {
      if (!ids.includes(stepId) || record.status === 'complete') return false;
      record.status = 'active';
      record.activeStep = stepId;
      if (!record.visited.includes(stepId)) record.visited.push(stepId);
      return true;
    }),
    dismiss: state => change(state, record => {
      if (record.status === 'complete' || record.status === 'dismissed') return false;
      record.status = 'dismissed';
      return true;
    }),
    complete: state => change(state, (record, ids) => {
      if (record.status === 'complete' || !ids.every(id => record.visited.includes(id))) return false;
      record.status = 'complete';
      record.activeStep = null;
      return true;
    }),
    restart: state => change(state, (record, ids) => {
      record.status = 'active';
      record.visited = [];
      record.activeStep = ids[0];
      return true;
    }),
    destroy() {
      destroyed = true;
      memory.clear();
      corruptKeys.clear();
      storage = null;
    },
  };
}
