-- Edge Function alternatifi (pg_net yerine tercihıcı).
-- Deploy: supabase functions deploy push-on-notification
-- Sonra Database Webhook: notifications INSERT → bu function

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

type NotificationRow = {
  id: string;
  user_id: string;
  actor_id: string | null;
  type: string;
  title: string;
  body: string | null;
  data: Record<string, unknown> | null;
};

Deno.serve(async (req) => {
  try {
    const payload = await req.json();
    const row = (payload.record ?? payload) as NotificationRow;
    if (!row?.user_id || !row?.title) {
      return new Response(JSON.stringify({ ok: false, error: "invalid payload" }), {
        status: 400,
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const tokensRes = await fetch(
      `${supabaseUrl}/rest/v1/push_tokens?user_id=eq.${row.user_id}&select=token`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
      },
    );
    const tokens = (await tokensRes.json()) as { token: string }[];
    if (!Array.isArray(tokens) || tokens.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0 }));
    }

    const messages = tokens.map((t) => ({
      to: t.token,
      title: row.title,
      body: row.body ?? "",
      sound: "default",
      priority: "high",
      channelId: "carpm_default",
      data: {
        ...(row.data ?? {}),
        notification_id: row.id,
        type: row.type,
        actor_id: row.actor_id,
      },
    }));

    const pushRes = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(messages),
    });

    const result = await pushRes.json();
    return new Response(JSON.stringify({ ok: true, result }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }),
      { status: 500 },
    );
  }
});
