// Minimal structural type for the Next.js router (AppRouterInstance is not
// exported from 'next/navigation', but useRouter()'s return value matches
// this shape).
export interface RouterLike {
  push: (href: string) => void;
}

// Keys + event names shared between the navbar and portal pages so that
// header quick actions work whether the user is already on the target page
// (direct scroll / custom event) or navigating to it fresh (sessionStorage
// flag consumed by the freshly-mounted page).
export const SCROLL_KEY = 'fsai:scroll-to';
export const DONATE_KEY = 'fsai:donate';
export const DONATE_EVENT = 'fsai:donate';

// Keys + event names for tabbed pages (e.g. the volunteer portal's
// Open Tasks / Delivery Map / My Impact views).
export const VIEW_KEY = 'fsai:view-switch';
export const VIEW_EVENT = 'fsai:view-switch';

/**
 * Navigate to a portal page and optionally smooth-scroll to a section within
 * it. When the user is already on the target page the scroll happens
 * immediately; otherwise the target is stashed in sessionStorage so the page
 * can perform it after mounting.
 */
export function navigateToAction(
  router: RouterLike,
  currentPath: string,
  href: string,
  scrollId?: string
): void {
  if (currentPath === href) {
    if (scrollId) {
      document
        .getElementById(scrollId)
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    return;
  }
  if (scrollId) sessionStorage.setItem(SCROLL_KEY, scrollId);
  router.push(href);
}

/** Portal pages call this on mount to perform a requested smooth scroll. */
export function consumeScrollAction(): void {
  if (typeof window === 'undefined') return;
  const target = sessionStorage.getItem(SCROLL_KEY);
  if (!target) return;
  sessionStorage.removeItem(SCROLL_KEY);
  requestAnimationFrame(() => {
    document
      .getElementById(target)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

/**
 * "+ Post Food": opens the food donation modal from any page. If the user is
 * already on the donor portal, dispatch an event the page listens for;
 * otherwise flag the intent and navigate so the freshly-mounted page opens
 * the modal itself.
 */
export function openDonationModal(
  router: RouterLike,
  currentPath: string
): void {
  if (currentPath === '/donor') {
    window.dispatchEvent(new CustomEvent(DONATE_EVENT));
    return;
  }
  sessionStorage.setItem(DONATE_KEY, '1');
  router.push('/donor');
}

/**
 * Switch a tabbed view (e.g. volunteer portal tabs) from the header. When the
 * user is already on the target page the event fires immediately; otherwise
 * the target view is stashed in sessionStorage so the page can apply it after
 * mounting.
 */
export function switchView(
  router: RouterLike,
  currentPath: string,
  href: string,
  view: string
): void {
  if (currentPath === href) {
    window.dispatchEvent(new CustomEvent(VIEW_EVENT, { detail: { view } }));
    return;
  }
  sessionStorage.setItem(VIEW_KEY, view);
  router.push(href);
}

/** Donor portal: returns true when the navbar requested the modal to open. */
export function consumeDonationModalRequest(): boolean {
  if (typeof window === 'undefined') return false;
  if (sessionStorage.getItem(DONATE_KEY) === '1') {
    sessionStorage.removeItem(DONATE_KEY);
    return true;
  }
  return false;
}
