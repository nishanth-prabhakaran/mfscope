/**
 * Records every outbound call to the rate-limited market-index provider so the
 * owner dashboard can show today's usage against the daily quota.
 */
export async function logApiCall(
  provider: string,
  resource: string,
  ok: boolean,
  statusCode?: number,
): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("api_usage_log")
      .insert({ provider, resource, ok, status_code: statusCode ?? null });
  } catch {
    // Usage logging must never break a data fetch.
  }
}
