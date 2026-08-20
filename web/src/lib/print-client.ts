/**
 * Print a self-printing `/html` receipt route with NO visible tab or preview.
 *
 * The self-printing HTML receipt routes render the receipt and call
 * window.print() themselves on load. We host them in a tiny hidden iframe, so clicking
 * "print" fires the print dialog immediately with nothing else on screen.
 * (For a fully silent, no-dialog flow, run the browser with kiosk-printing and a
 * default thermal printer — then this prints instantly.)
 */
export function printSilent(url: string) {
  document.getElementById("print-frame")?.remove();

  const iframe = document.createElement("iframe");
  iframe.id = "print-frame";
  iframe.setAttribute("aria-hidden", "true");
  Object.assign(iframe.style, {
    position: "fixed",
    right: "0",
    bottom: "0",
    width: "1px",
    height: "1px",
    border: "0",
    opacity: "0",
    pointerEvents: "none",
  });

  iframe.onload = () => {
    try {
      iframe.contentWindow?.focus();
    } catch {
      /* the route triggers its own window.print() */
    }
  };

  iframe.src = url;
  document.body.appendChild(iframe);
  // tidy up well after printing
  window.setTimeout(() => iframe.remove(), 120000);
}
