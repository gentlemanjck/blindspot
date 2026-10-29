// Hash routing, so every route works on static hosting without rewrites (SPEC §7).

export type Route =
  | { name: 'map' }
  | { name: 'lesson'; stage: number; exercise: number }
  | { name: 'test' }
  | { name: 'stats' }
  | { name: 'settings' };

/** `exercise` is 0-based in code and 1-based in the URL. */
export function parseHash(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  switch (parts[0]) {
    case 'lesson': {
      const stage = Number(parts[1]);
      const exercise = Number(parts[2] ?? 1) - 1;
      if (Number.isInteger(stage) && Number.isInteger(exercise) && exercise >= 0) {
        return { name: 'lesson', stage, exercise };
      }
      return { name: 'map' };
    }
    case 'test':
      return { name: 'test' };
    case 'stats':
      return { name: 'stats' };
    case 'settings':
      return { name: 'settings' };
    default:
      return { name: 'map' };
  }
}

export function href(route: Route): string {
  switch (route.name) {
    case 'map':
      return '#/';
    case 'lesson':
      return `#/lesson/${route.stage}/${route.exercise + 1}`;
    default:
      return `#/${route.name}`;
  }
}

export function navigate(route: Route): void {
  location.hash = href(route);
}

export function startRouter(onRoute: (route: Route) => void): void {
  window.addEventListener('hashchange', () => onRoute(parseHash(location.hash)));
  onRoute(parseHash(location.hash));
}
