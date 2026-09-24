// merge.ts — fill a designed (HTML) announcement for one recipient.
// {name} -> their escaped first name, {{button_url}} -> their personal early link,
// {{unsub_url}} -> their one-click leave link. A designed email that forgot the leave link
// gets the standard footer appended: nothing ever goes out without a way to leave the list.
export const HTML_MAX = 100_000;

const escHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

export function unsubFooter(unsubUrl: string, listName: string): string {
  return `<p style="margin:16px 8px 24px;text-align:center;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:#94a3b8">You are on the ${escHtml(listName)} list at taylormadeacademy.com/agent. <a href="${escHtml(unsubUrl)}" style="color:#94a3b8">Leave the list</a>.</p>`;
}

export function mergeHtml(html: string, v: { firstName: string; buttonUrl: string; unsubUrl: string; listName: string }): string {
  const hasUnsub = html.includes("{{unsub_url}}");
  let out = html
    .split("{name}").join(escHtml(v.firstName))
    .split("{{button_url}}").join(escHtml(v.buttonUrl))
    .split("{{unsub_url}}").join(escHtml(v.unsubUrl));
  if (!hasUnsub) {
    const foot = unsubFooter(v.unsubUrl, v.listName);
    out = /<\/body>/i.test(out) ? out.replace(/<\/body>/i, foot + "</body>") : out + foot;
  }
  return out;
}
