/**
 * site-core.js — the minimum script every page needs.
 *
 * Kept separate from site.js so content pages load ~2KB instead of ~30KB.
 * Responsibilities:
 *   - Mark the document as scripted (`.js`) so CSS can enable enhancements.
 *   - Mobile navigation: open/close, focus trap, Escape to dismiss, `inert`
 *     on background content, and focus returned to the trigger on close.
 *   - Scroll reveals via IntersectionObserver, with staggered delays.
 *   - Respect `prefers-reduced-motion`, reacting to live changes: if the user
 *     enables it mid-session, everything is revealed immediately.
 *   - Footer year.
 *
 * No dependencies, no module system — loaded as a classic script.
 */

const root = document.documentElement;
root.classList.add("js");
const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [
  ...scope.querySelectorAll(selector),
];
const menu = $("#menu"),
  nav = $("#primary-nav"),
  mobileNav = window.matchMedia("(max-width:980px)");
function setBackgroundInert(value) {
  $$("main,.site-footer").forEach((element) => {
    element.inert = value;
  });
}
function closeNav(returnFocus = false) {
  if (!nav || !menu) return;
  nav.classList.remove("open");
  document.body.classList.remove("nav-open");
  menu.setAttribute("aria-expanded", "false");
  menu.setAttribute("aria-label", "Open navigation");
  menu.textContent = "☰";
  setBackgroundInert(false);
  if (returnFocus) menu.focus();
}
if (menu && nav) {
  menu.addEventListener("click", () => {
    const open = !nav.classList.contains("open");
    if (!open) {
      closeNav();
      return;
    }
    nav.classList.add("open");
    document.body.classList.add("nav-open");
    menu.setAttribute("aria-expanded", "true");
    menu.setAttribute("aria-label", "Close navigation");
    menu.textContent = "×";
    setBackgroundInert(true);
    requestAnimationFrame(() => nav.querySelector("a")?.focus());
  });
  nav
    .querySelectorAll("a")
    .forEach((a) => a.addEventListener("click", () => closeNav()));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && nav.classList.contains("open")) {
      closeNav(true);
      return;
    }
    if (event.key === "Tab" && nav.classList.contains("open")) {
      const items = [...nav.querySelectorAll("a"), menu],
        first = items[0],
        last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });
  const resetNav = (event) => {
    if (!event.matches) closeNav();
  };
  if (mobileNav.addEventListener)
    mobileNav.addEventListener("change", resetNav);
  else mobileNav.addListener(resetNav);
}
const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
let reduced = motionQuery.matches;
const revealAll = () =>
  $$(".reveal").forEach((element) => element.classList.add("visible"));
$$(".reveal").forEach((element, index) =>
  element.style.setProperty("--delay", `${Math.min(index % 5, 4) * 65}ms`),
);
if (!reduced && "IntersectionObserver" in window) {
  const observer = new IntersectionObserver(
    (entries) =>
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        }
      }),
    { threshold: 0.1 },
  );
  $$(".reveal").forEach((element) => observer.observe(element));
} else revealAll();
const handleMotionChange = (event) => {
  reduced = event.matches;
  if (reduced) revealAll();
};
if (motionQuery.addEventListener)
  motionQuery.addEventListener("change", handleMotionChange);
else motionQuery.addListener(handleMotionChange);
const year = $("#current-year");
if (year) year.textContent = String(new Date().getFullYear());
