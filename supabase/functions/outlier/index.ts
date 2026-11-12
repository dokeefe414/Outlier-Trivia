// OUTLIER optional hosted multiplayer API, Supabase Edge Functions (Deno 2).
// Public function endpoint: /functions/v1/outlier?action=<action>
// Deploy with --no-verify-jwt so Stripe can call the webhook. Every private
// route verifies the Supabase Auth access token against /auth/v1/user.
// Service role and Stripe secrets NEVER leave this Edge Function.
type Json = Record<string, unknown>;
type User = { id: string; email?: string };

const projectUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const siteUrl = Deno.env.get("SITE_URL") ?? "";
const stripeKey = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const stripeWebhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";
const stripeMode = Deno.env.get("STRIPE_MODE") ?? "test";
const adminToken = Deno.env.get("OUTLIER_ADMIN_TOKEN") ?? "";
const allowLiveCheckout = Deno.env.get("OUTLIER_ENABLE_LIVE_CHECKOUT") === "true";
function billingConfiguration() {
  const mode = stripeMode==="live"?"live":stripeMode==="test"?"test":"disabled";
  let safeSite=false;
  try {const u=new URL(siteUrl);
    safeSite=u.protocol==="https:" ||
      (mode==="test" && u.protocol==="http:" && ["localhost","127.0.0.1"].includes(u.hostname));
  } catch {}
  const validKey=(mode==="test"&&stripeKey.startsWith("sk_test_")) ||
    (mode==="live"&&stripeKey.startsWith("sk_live_"));
  const configured=mode!=="disabled" && safeSite && validKey &&
    stripeWebhookSecret.startsWith("whsec_") && (mode!=="live"||allowLiveCheckout);
  return {ready:configured,mode:configured?mode:"disabled"};
}

class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
function safeStr(value: unknown, maxLength = 100): string {
  return typeof value === "string" ? value.slice(0, maxLength) : "";
}
function ensureUuid(value: unknown): string {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    throw new ApiError(400, "invalid_game_id");
  }
  return value;
}
function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return true; // curl, Stripe webhooks
  let siteOrigin = "";
  try { if (siteUrl) siteOrigin = new URL(siteUrl).origin; } catch {}
  const allowed = [
    siteOrigin,
    ...((Deno.env.get("ALLOWED_ORIGINS") ?? "").split(",").map(x => x.trim())),
    "http://localhost:8000",
    "http://127.0.0.1:8000"
  ].filter(Boolean);
  return allowed.includes(origin);
}
function corsHeaders(origin: string | null): HeadersInit {
  return {
    ...(origin && isAllowedOrigin(origin) ? {"Access-Control-Allow-Origin": origin} : {}),
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-outlier-admin-token",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
    "Access-Control-Max-Age": "600",
    "Vary": "Origin"
  };
}
function json(data: unknown, status = 200, origin: string | null = null) {
  return new Response(JSON.stringify(data), {
    status,
    headers:{
      "Content-Type":"application/json; charset=utf-8",
      "Cache-Control":"no-store",
      "X-Content-Type-Options":"nosniff",
      ...corsHeaders(origin)
    }
  });
}
function parseError(message: string): ApiError {
  if (message.includes("payment_required")) return new ApiError(402,"payment_required");
  if (message.includes("private_question_bank_not_configured")) return new ApiError(503,"private_question_bank_not_configured");
  if (message.includes("game_already_finished")) return new ApiError(409,"game_already_finished");
  if (message.includes("incorrect_question_index")) return new ApiError(409,"incorrect_question_index");
  if (message.includes("game_not_found")) return new ApiError(404,"game_not_found");
  if (message.includes("not_a_league_member")) return new ApiError(403,"not_a_league_member");
  if (message.includes("league_is_full") || message.includes("league_limit_reached") ||
      message.includes("league_membership_limit") || message.includes("review_already_processed"))
    return new ApiError(409,message.slice(0,70));
  if (message.includes("review_rate_limit")) return new ApiError(429,"review_rate_limit");
  if (message.includes("invalid_review_filter") || message.includes("invalid_review_decision")) return new ApiError(400,"invalid_review_request");
  if (message.includes("review_not_found")) return new ApiError(404,"review_not_found");
  if (message.includes("invalid_league_name") || message.includes("invalid_invite_code") ||
      message.includes("invalid_period") || message.includes("review_reason_too_short") ||
      message.includes("review_requires_invalid_answer")) return new ApiError(400,message.slice(0,70));
  if (message.includes("invalid_game_mode") || message.includes("invalid_question_index")) return new ApiError(400,"invalid_request");
  return new ApiError(500,"server_error");
}
async function database(path: string, method = "GET", body?: Json | Json[]) {
  if (!projectUrl || !serviceKey) throw new ApiError(503,"backend_not_configured");
  const response = await fetch(projectUrl + "/rest/v1" + path, {
    method,
    headers:{
      "Authorization": "Bearer " + serviceKey,
      "apikey": serviceKey,
      "Content-Type":"application/json",
      "Prefer":"return=representation,resolution=merge-duplicates"
    },
    ...(body === undefined ? {} : {body:JSON.stringify(body)})
  });
  const raw = await response.text();
  let payload: unknown;
  try { payload = JSON.parse(raw); } catch { payload = raw; }
  if (!response.ok) {
    console.error("OUTLIER database operation failed:",response.status,typeof payload==="object" && payload && "code" in payload ? (payload as {code:string}).code : "unknown");
    const message = typeof payload === "object" && payload && "message" in payload ? String((payload as {message:string}).message) : "";
    throw parseError(message);
  }
  return payload;
}
async function rpc(name: string, args: Json): Promise<unknown> {
  return database("/rpc/" + name, "POST", args);
}
async function currentUser(req: Request): Promise<User> {
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i,"");
  if (!token || token === serviceKey) throw new ApiError(401,"login_required");
  if (!projectUrl || !serviceKey) throw new ApiError(503,"backend_not_configured");
  const response = await fetch(projectUrl + "/auth/v1/user", {
    headers:{apikey:serviceKey,Authorization:"Bearer " + token}
  });
  if (!response.ok) throw new ApiError(401,"invalid_or_expired_session");
  const user = await response.json();
  if (!user?.id || typeof user.id !== "string") throw new ApiError(401,"login_required");
  return {id:user.id,email:user.email};
}
async function bodyJson(req: Request): Promise<Json> {
  const length = Number(req.headers.get("content-length") || 0);
  if (length > 8000) throw new ApiError(413,"request_too_large");
  const data = await req.json().catch(()=>null);
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new ApiError(400,"invalid_json");
  return data as Json;
}
async function entitlement(userId: string): Promise<boolean> {
  const rows = await database("/entitlements?user_id=eq." + encodeURIComponent(userId) + "&select=unlimited&limit=1");
  return Array.isArray(rows) && rows[0]?.unlimited === true;
}
async function enforceBudget(userId: string, action: string) {
  const limits: Record<string,[number,number]> = {
    "start":[20,3600],"answer":[240,3600],"advance":[45,3600],
    "league-create":[5,86400],"league-join":[12,3600],
    "review":[5,86400],"checkout":[5,3600],"name":[8,3600]
  };
  const [max,windowSeconds] = limits[action] ?? [20,3600];
  const permitted=await rpc("outlier_request_budget",{
    p_user:userId,p_action:action,p_max:max,p_window_seconds:windowSeconds
  });
  if(permitted !== true) throw new ApiError(429,"too_many_requests");
}
function adminAuthorized(req: Request): boolean {
  const token=req.headers.get("X-Outlier-Admin-Token")??"";
  return adminToken.length>=32 && token.length>=32 && constantTimeMatch(token,adminToken);
}
async function profile(user: User) {
  const [stats,people,paid,history] = await Promise.all([
    rpc("outlier_player_stats",{p_user:user.id}),
    database("/profiles?user_id=eq." + encodeURIComponent(user.id) + "&select=display_name&limit=1"),
    entitlement(user.id),
    rpc("outlier_player_history",{p_user:user.id,p_limit:35})
  ]);
  const reviews=await rpc("outlier_review_my_tickets",{p_user:user.id,p_limit:20});
  return {userId:user.id,email:user.email,name:Array.isArray(people) ? people[0]?.display_name : "",
    stats,history,reviews,unlimited:paid};
}
async function stripeCheckout(user: User): Promise<string> {
  if(!billingConfiguration().ready)throw new ApiError(503,"checkout_not_configured");
  const readiness=await rpc("outlier_launch_readiness",{}) as {ready?:boolean};
  if(readiness?.ready!==true)throw new ApiError(503,"private_question_bank_not_configured");
  if (await entitlement(user.id)) throw new ApiError(409,"already_unlocked");
  const params = new URLSearchParams();
  params.set("mode","payment");
  // Card payments settle synchronously; delayed methods are not enabled.
  params.set("payment_method_types[0]","card");
  params.set("line_items[0][price_data][currency]","usd");
  params.set("line_items[0][price_data][unit_amount]","499");
  params.set("line_items[0][price_data][product_data][name]","OUTLIER Unlimited — Lifetime");
  params.set("line_items[0][quantity]","1");
  params.set("success_url",siteUrl + (siteUrl.includes("?")?"&":"?") + "online=1&checkout=success");
  params.set("cancel_url",siteUrl + (siteUrl.includes("?")?"&":"?") + "online=1&checkout=cancel");
  params.set("client_reference_id",user.id);
  params.set("metadata[user_id]",user.id);
  if (user.email) params.set("customer_email",user.email);
  const response = await fetch("https://api.stripe.com/v1/checkout/sessions",{
    method:"POST",
    headers:{"Authorization":"Bearer " + stripeKey,"Content-Type":"application/x-www-form-urlencoded"},
    body:params
  });
  const result = await response.json();
  if (!response.ok || typeof result?.url !== "string" || !result.url.startsWith("https://checkout.stripe.com/")) {
    console.error("Stripe checkout creation error",response.status);
    throw new ApiError(502,"checkout_unavailable");
  }
  return result.url;
}
function constantTimeMatch(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i=0;i<a.length;i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}
async function verifyStripeWebhook(raw: string, header: string | null) {
  if (!stripeWebhookSecret) throw new ApiError(503,"webhook_not_configured");
  const pieces = (header ?? "").split(",").map(x=>x.trim().split("="));
  const timestamp = Number(pieces.find(x=>x[0]==="t")?.[1] ?? 0);
  const signatures = pieces.filter(x=>x[0]==="v1").map(x=>x[1] ?? "");
  if (!Number.isFinite(timestamp) || Math.abs(Date.now()/1000-timestamp)>300 || !signatures.length) {
    throw new ApiError(400,"invalid_signature");
  }
  const key = await crypto.subtle.importKey("raw",new TextEncoder().encode(stripeWebhookSecret),
    {name:"HMAC",hash:"SHA-256"},false,["sign"]);
  const signed = await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(timestamp+"."+raw));
  const digest = [...new Uint8Array(signed)].map(x=>x.toString(16).padStart(2,"0")).join("");
  if (!signatures.some(sig => constantTimeMatch(sig,digest))) throw new ApiError(400,"invalid_signature");
}
async function processWebhook(req: Request) {
  const raw = await req.text();
  if(raw.length > 512000) throw new ApiError(413,"webhook_too_large");
  await verifyStripeWebhook(raw,req.headers.get("Stripe-Signature"));
  const event=JSON.parse(raw);
  if (!event?.id || typeof event.id !== "string" || typeof event.livemode !== "boolean" ||
      event.livemode !== (stripeMode === "live")) throw new ApiError(400,"stripe_mode_mismatch");
  const data=event.data?.object;
  let kind: "paid" | "refunded" | "disputed" | null = null;
  let userId: string | null = null;
  let sessionId: string | null = null;
  let intent: string | null = null;
  let amount: number = 0;
  let currency: string = "";
  if (event.type === "checkout.session.completed" ||
      event.type === "checkout.session.async_payment_succeeded") {
    // Only actual paid one-time purchases can grant an entitlement.
    if (data?.payment_status !== "paid" || data?.mode !== "payment" ||
        data?.amount_total !== 499 || data?.currency !== "usd" ||
        typeof data?.client_reference_id !== "string" ||
        data?.client_reference_id !== data?.metadata?.user_id ||
        typeof data?.payment_intent !== "string") throw new ApiError(400,"invalid_paid_session");
    kind="paid";
    userId=ensureUuid(data.metadata.user_id);
    sessionId=String(data.id);
    intent=data.payment_intent;
    amount=data.amount_total;
    currency=data.currency;
  } else if (event.type === "charge.refunded") {
    // Partial refunds do not revoke access. The DB records the event for audit.
    kind="refunded";
    intent=typeof data?.payment_intent==="string"?data.payment_intent:null;
    amount=Number(data?.amount_refunded);
    currency=String(data?.currency ?? "");
  } else if (event.type === "charge.dispute.created") {
    kind="disputed";
    intent=typeof data?.payment_intent==="string"?data.payment_intent:null;
    amount=Number(data?.amount);
    currency=String(data?.currency ?? "");
  } else {
    return {received:true,ignored:true};
  }
  if (!intent || !Number.isInteger(amount) || amount<0 ||
      currency!=="usd" || typeof event.id!=="string") {
    throw new ApiError(400,"unsupported_payment_event");
  }
  const result=await rpc("outlier_apply_billing_event",{
    p_event:event.id,p_kind:kind,p_user:userId,p_session:sessionId,
    p_intent:intent,p_amount:amount,p_currency:currency
  });
  return {received:true,result};
}

async function handle(req: Request): Promise<Response> {
  const origin = req.headers.get("Origin");
  if (!isAllowedOrigin(origin)) return json({error:"origin_not_allowed"},403,null);
  if (req.method==="OPTIONS") return new Response(null,{status:204,headers:corsHeaders(origin)});
  const url = new URL(req.url);
  const action = url.searchParams.get("action") ?? "";
  try {
    if (action === "webhook" && req.method === "POST") return json(await processWebhook(req),200,origin);
    if (action === "capabilities" && req.method === "GET") {
      const readiness=await rpc("outlier_launch_readiness",{});
      const info=readiness as {ready?:boolean;privateQuestions?:number};
      const billing=billingConfiguration();
      return json({rankedReady:info?.ready === true,
        paymentReady:info?.ready===true && billing.ready,
        paymentMode:info?.ready===true?billing.mode:"disabled",
        privateQuestionCount:info?.privateQuestions??0},200,origin);
    }
    if (action === "admin-metrics" && req.method === "GET") {
      if(!adminAuthorized(req))throw new ApiError(403,"admin_authorization_required");
      const [metrics,readiness,reviews,quality]=await Promise.all([
        rpc("outlier_beta_metrics",{}),rpc("outlier_launch_readiness",{}),
        rpc("outlier_admin_review_counts",{}),rpc("outlier_beta_quality_metrics",{})
      ]);
      return json({metrics,readiness,reviews,quality,
        paymentConfigured:billingConfiguration().ready,
        paymentMode:billingConfiguration().mode},200,origin);
    }
    if (action === "admin-review-queue" && req.method === "GET") {
      if(!adminAuthorized(req))throw new ApiError(403,"admin_authorization_required");
      const filter=url.searchParams.get("status")??"pending";
      if(!["pending","needs_more_info","approved","rejected","all"].includes(filter))
        throw new ApiError(400,"invalid_review_filter");
      const [reviews,counts]=await Promise.all([
        rpc("outlier_admin_review_queue",{p_status:filter,p_limit:50}),
        rpc("outlier_admin_review_counts",{})
      ]);
      return json({reviews,counts},200,origin);
    }
    if (action === "admin-review-decision" && req.method === "POST") {
      if(!adminAuthorized(req))throw new ApiError(403,"admin_authorization_required");
      const input=await bodyJson(req);
      const reviewId=ensureUuid(input.reviewId);
      const status=safeStr(input.status,32);
      const note=safeStr(input.note,750).trim();
      if(!["approved","rejected","needs_more_info"].includes(status)||note.length<12)
        throw new ApiError(400,"invalid_review_decision");
      const decision=await rpc("outlier_admin_review_decide",{
        p_review:reviewId,p_status:status,p_note:note
      });
      return json({decision},200,origin);
    }
    if (action === "leaderboard" && req.method === "GET") {
      const board = url.searchParams.get("board") ?? "daily";
      if (!["daily","week","average","total"].includes(board)) throw new ApiError(400,"invalid_board");
      const list = board==="week"
        ? await rpc("outlier_weekly_leaderboard",{p_limit:50})
        : await rpc("outlier_leaderboard",{p_board:board,p_limit:50});
      return json({board,players:list},200,origin);
    }
    const user = await currentUser(req);
    const mutationBudget: Record<string,string> = {
      "profile":"name","start":"start","answer":"answer","advance":"advance",
      "league-create":"league-create","league-join":"league-join",
      "review":"review","checkout":"checkout"
    };
    if ((req.method==="POST" || req.method==="PATCH") && mutationBudget[action]) {
      await enforceBudget(user.id,mutationBudget[action]);
    }
    if (action === "profile" && req.method === "GET") {
      return json(await profile(user),200,origin);
    }
    if (action === "profile" && req.method === "PATCH") {
      const input = await bodyJson(req);
      const name = safeStr(input.name,25).trim().replace(/\s+/g," ");
      if (name.length<2 || name.length>24 || !/^[\p{L}\p{N} ._-]+$/u.test(name)) throw new ApiError(400,"invalid_display_name");
      await database("/profiles?user_id=eq." + encodeURIComponent(user.id),"PATCH",{display_name:name});
      return json({name},200,origin);
    }
    if (action === "leagues" && req.method === "GET") {
      const leagues = await rpc("outlier_league_list",{p_user:user.id});
      return json({leagues},200,origin);
    }
    if (action === "league-create" && req.method === "POST") {
      const input=await bodyJson(req);
      const league=await rpc("outlier_league_create",{
        p_user:user.id,p_title:safeStr(input.title,80)
      });
      return json({league},200,origin);
    }
    if (action === "league-join" && req.method === "POST") {
      const input=await bodyJson(req);
      const league=await rpc("outlier_league_join",{
        p_user:user.id,p_code:safeStr(input.code,24)
      });
      return json({league},200,origin);
    }
    if (action === "league-standings" && req.method === "GET") {
      const leagueId=ensureUuid(url.searchParams.get("league"));
      const period=url.searchParams.get("period")??"week";
      if(!["today","week","last-week","all"].includes(period)) throw new ApiError(400,"invalid_period");
      const players=await rpc("outlier_league_standings",{
        p_user:user.id,p_league:leagueId,p_period:period
      });
      return json({players,period,leagueId},200,origin);
    }
    if (action === "review" && req.method === "POST") {
      const input=await bodyJson(req);
      const ticket=await rpc("outlier_review_submit",{
        p_user:user.id,p_attempt:ensureUuid(input.game),
        p_question:safeStr(input.questionId,100),p_reason:safeStr(input.reason,500)
      });
      return json({ticket},200,origin);
    }
    if (action === "start" && req.method === "POST") {
      const input = await bodyJson(req);
      const mode = input.mode === "practice" ? "practice" : "daily";
      const gameId = await rpc("outlier_start",{p_user:user.id,p_mode:mode});
      return json({game:await rpc("outlier_state",{p_user:user.id,p_game:gameId})},200,origin);
    }
    if (action === "state" && req.method === "GET") {
      const gameId = ensureUuid(url.searchParams.get("game"));
      return json({game:await rpc("outlier_state",{p_user:user.id,p_game:gameId})},200,origin);
    }
    if (action === "advance" && req.method === "POST") {
      const input = await bodyJson(req);
      const gameId = ensureUuid(input.game);
      const index = Number(input.index);
      if (!Number.isInteger(index) || index < 1 || index > 6) throw new ApiError(400,"invalid_index");
      return json({game:await rpc("outlier_advance",{p_user:user.id,p_game:gameId,p_index:index})},200,origin);
    }
    if (action === "answer" && req.method === "POST") {
      const input = await bodyJson(req);
      const gameId = ensureUuid(input.game);
      const index = Number(input.index);
      if (!Number.isInteger(index) || index < 0 || index > 6) throw new ApiError(400,"invalid_index");
      const response = input.response === null || input.response === undefined ? null : safeStr(input.response);
      const result = await rpc("outlier_answer",{
        p_user:user.id,p_game:gameId,p_index:index,p_response:response
      });
      const payload=result as Json;
      const feedback=payload?.feedback as Json | undefined;
      // Historical frequency data is only returned after the user submits.
      // Prior-day responses are suppressed until 30 completed samples exist.
      if (feedback?.type==="rare" && typeof feedback.questionId==="string") {
        payload.history=await rpc("outlier_past_answer_rarity",{
          p_question:feedback.questionId
        });
      }
      return json(payload,200,origin);
    }
    if (action === "purchase-status" && req.method === "GET") {
      const [paid,profileData]=await Promise.all([
        entitlement(user.id),
        database("/entitlements?user_id=eq."+encodeURIComponent(user.id)+
          "&select=purchased_at,refunded_at&limit=1")
      ]);
      const own=Array.isArray(profileData)?profileData[0]:null;
      return json({unlimited:paid,
        purchasedAt:own?.purchased_at??null,
        refundedAt:own?.refunded_at??null,
        paymentMode:billingConfiguration().mode},200,origin);
    }
    if (action === "checkout" && req.method === "POST") {
      return json({url:await stripeCheckout(user)},200,origin);
    }
    throw new ApiError(404,"endpoint_not_found");
  } catch (error) {
    if (error instanceof ApiError) return json({error:error.message},error.status,origin);
    console.error("OUTLIER unexpected function failure",error);
    return json({error:"server_error"},500,origin);
  }
}

Deno.serve(handle);
