/** Read a JSON body even when sendBeacon sends it as text/plain. */
export async function parseJsonRequestBody(req: Request): Promise<unknown> {
  const raw = (await req.text()).trim();
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    const contentType = req.headers.get('content-type') ?? '';
    if (!contentType.includes('application/x-www-form-urlencoded')) return null;
    const params = new URLSearchParams(raw);
    const obj: Record<string, string> = {};
    for (const [key, value] of params.entries()) {
      obj[key] = value;
    }
    return Object.keys(obj).length ? obj : null;
  }
}
