// Centralized role permissions matrix for MedVigyaan
export const DEFAULT_PERMISSIONS = {
  member: {
    pages: ['feed', 'chat', 'threads', 'assignments', 'blogs', 'calendar', 'messages'],
    actions: {
      feed: ['view'],
      chat: ['view', 'create', 'delete_own'],
      threads: ['view', 'create', 'delete_own'],
      assignments: ['view', 'submit'],
      blogs: ['view'],
      calendar: ['view'],
      tasks: [],
      messages: ['view', 'create', 'delete_own']
    }
  },
  core: {
    pages: ['feed', 'chat', 'threads', 'assignments', 'blogs', 'calendar', 'tasks', 'messages'],
    actions: {
      feed: ['view', 'create', 'delete_own'],
      chat: ['view', 'create', 'delete_own'],
      threads: ['view', 'create', 'delete_own'],
      assignments: ['view', 'create', 'submit'],
      blogs: ['view', 'create', 'delete_own'],
      calendar: ['view', 'create', 'delete_own'],
      tasks: ['view', 'create', 'edit', 'delete_own'],
      messages: ['view', 'create', 'delete_own']
    }
  },
  admin: {
    pages: ['feed', 'chat', 'threads', 'assignments', 'blogs', 'calendar', 'tasks', 'messages', 'admin'],
    actions: {
      feed: ['view', 'create', 'delete_any'],
      chat: ['view', 'create', 'delete_any'],
      threads: ['view', 'create', 'delete_any'],
      assignments: ['view', 'create', 'submit', 'delete_any'],
      blogs: ['view', 'create', 'edit', 'delete_any'],
      calendar: ['view', 'create', 'edit', 'delete_any'],
      tasks: ['view', 'create', 'edit', 'delete_any'],
      messages: ['view', 'create', 'delete_any'],
      admin: ['full_access']
    }
  }
};

export const ALL_PAGES = [
  { id: 'feed', label: 'Feed' },
  { id: 'chat', label: 'General Chat' },
  { id: 'threads', label: 'Threads' },
  { id: 'assignments', label: 'Assignments' },
  { id: 'blogs', label: 'Blogs' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'messages', label: 'Direct Messages' },
  { id: 'admin', label: 'Admin Panel' }
];

export const ALL_ACTIONS = [
  { id: 'view', label: 'View' },
  { id: 'create', label: 'Create' },
  { id: 'edit', label: 'Edit' },
  { id: 'submit', label: 'Submit (Assignments)' },
  { id: 'delete_own', label: 'Delete Own' },
  { id: 'delete_any', label: 'Delete Any' }
];

export const hasPermission = (rolePermissions, role = 'member', page, action = 'view') => {
  const currentRole = role === 'team_lead' ? 'core' : role;
  const permissions = rolePermissions?.[currentRole] || DEFAULT_PERMISSIONS[currentRole] || DEFAULT_PERMISSIONS.member;
  
  if (action === 'page') {
    return permissions.pages?.includes(page) || false;
  }
  
  const pageActions = permissions.actions?.[page] || [];
  return pageActions.includes(action) || pageActions.includes('full_access');
};
