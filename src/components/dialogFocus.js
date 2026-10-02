export function trapDialogFocus(event) {
  if (event.key !== "Tab") return;
  const dialog = event.currentTarget;
  const controls = [...dialog.querySelectorAll('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), a[href], [tabindex="0"]')].filter((element) => element.getClientRects().length);
  const first = controls[0], last = controls.at(-1), active = document.activeElement;
  if (!first) { event.preventDefault(); dialog.focus(); }
  else if (event.shiftKey && (active === first || !controls.includes(active))) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && (active === last || !controls.includes(active))) { event.preventDefault(); first.focus(); }
}
