-- OUTLIER v0.7: durable, replay-safe Stripe payment state.
-- Webhook signatures are verified in the Edge Function BEFORE this service-only RPC.
alter table public.entitlements
  add column if not exists stripe_payment_intent_id text,
  add column if not exists refunded_at timestamptz;
create unique index if not exists entitlement_payment_intent_idx
  on public.entitlements(stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;

create table if not exists private.stripe_billing_events (
  event_id text primary key check (event_id ~ '^evt_[A-Za-z0-9_]+$'),
  kind text not null check (kind in ('paid','refunded','disputed')),
  user_id uuid,
  stripe_session_id text,
  stripe_payment_intent_id text not null,
  amount integer not null,
  currency text not null,
  processed_at timestamptz not null default clock_timestamp()
);
revoke all on private.stripe_billing_events from public,anon,authenticated;
create index if not exists billing_events_intent_idx
  on private.stripe_billing_events(stripe_payment_intent_id,kind);

create or replace function public.outlier_apply_billing_event(
  p_event text, p_kind text, p_user uuid, p_session text,
  p_intent text, p_amount integer, p_currency text
) returns jsonb language plpgsql security definer
set search_path=public,private,pg_temp as $$
declare
  v_recorded text;
  v_reversed boolean;
begin
  if p_event !~ '^evt_[A-Za-z0-9_]+$'
    or p_kind not in ('paid','refunded','disputed')
    or p_intent !~ '^pi_[A-Za-z0-9_]+$'
    or p_amount is null or p_amount<0 or lower(p_currency)<>'usd' then
    raise exception 'invalid_billing_event';
  end if;
  if p_kind='paid' and (p_user is null or
      p_session !~ '^cs_[A-Za-z0-9_]+$' or p_amount<>499) then
    raise exception 'invalid_paid_session';
  end if;
  -- Serialize events for the same PaymentIntent. Stripe can retry and reorder.
  perform pg_advisory_xact_lock(hashtext('outlier:'||p_intent));
  insert into private.stripe_billing_events(
    event_id,kind,user_id,stripe_session_id,stripe_payment_intent_id,amount,currency)
    values(p_event,p_kind,p_user,p_session,p_intent,p_amount,'usd')
    on conflict do nothing returning event_id into v_recorded;
  if v_recorded is null then return jsonb_build_object('duplicate',true); end if;
  if p_kind='paid' then
    select exists(select 1 from private.stripe_billing_events
      where stripe_payment_intent_id=p_intent
      and (kind='disputed' or (kind='refunded' and amount>=499)))
      into v_reversed;
    insert into public.entitlements(
      user_id,unlimited,stripe_session_id,stripe_payment_intent_id,
      purchased_at,refunded_at)
      values(p_user,not v_reversed,p_session,p_intent,clock_timestamp(),
        case when v_reversed then clock_timestamp() else null end)
    on conflict(user_id) do update set
      unlimited=excluded.unlimited,
      stripe_session_id=excluded.stripe_session_id,
      stripe_payment_intent_id=excluded.stripe_payment_intent_id,
      purchased_at=excluded.purchased_at,
      refunded_at=excluded.refunded_at;
  elsif p_kind='disputed' or (p_kind='refunded' and p_amount>=499) then
    update public.entitlements set unlimited=false,refunded_at=clock_timestamp()
      where stripe_payment_intent_id=p_intent;
  end if;
  return jsonb_build_object('duplicate',false,'kind',p_kind);
end $$;
revoke all on function public.outlier_apply_billing_event(
  text,text,uuid,text,text,integer,text) from public,anon,authenticated;
grant execute on function public.outlier_apply_billing_event(
  text,text,uuid,text,text,integer,text) to service_role;
