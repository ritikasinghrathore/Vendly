-- =====================================================================
--  Vendly - PostgreSQL schema (PostgreSQL 14+)
--  Applied by:  npm run migrate      (see src/db/migrate.ts)
--
--  Money rules
--    * money columns are NUMERIC(12,2), quantities NUMERIC(12,3)
--    * positive khata amount = customer owes the shop more
--    * bills, bill items, customer payments, khata rows and stock movements
--      can never be edited or deleted (triggers). Mistakes are fixed with an
--      adjustment row.
--  Tenancy rule
--    * every shop-owned table carries shop_id; the API always filters by it
--      after checking shop_members.
-- =====================================================================

create extension if not exists pg_trgm;

create type user_role               as enum ('customer', 'shopkeeper');
create type unit_type               as enum ('piece','packet','kg','gram','litre','ml','box','dozen');
create type list_status             as enum ('draft','submitted','viewed','completed','cancelled');
create type pay_status              as enum ('paid','unpaid','partially_paid');
create type txn_type                as enum ('bill','payment','adjustment','refund');
create type pay_method              as enum ('cash','upi','card','other');
create type subscription_status     as enum ('incomplete','trial','active','past_due','cancelled','expired');
create type platform_payment_status as enum ('created','authorized','captured','failed','refunded');

-- ---------------------------------------------------------------- identity
create table users (
  id            uuid primary key default gen_random_uuid(),
  email         text not null check (email = lower(email) and char_length(email) <= 254),
  password_hash text not null,
  name          text not null check (char_length(btrim(name)) between 2 and 80),
  phone         text check (phone is null or phone ~ '^[0-9+ ()-]{7,20}$'),
  role          user_role not null,
  is_active     boolean not null default true,
  failed_logins integer not null default 0,
  locked_until  timestamptz,
  last_login_at timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create unique index users_email_uq on users (email);

-- One row per signed-in device. Revoking a session logs that device out.
create table sessions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references users (id) on delete cascade,
  created_at   timestamptz not null default now(),
  last_used_at timestamptz not null default now(),
  expires_at   timestamptz not null,
  revoked_at   timestamptz,
  user_agent   text,
  ip           text
);
create index sessions_user_idx on sessions (user_id);

-- Refresh tokens are stored only as SHA-256 hashes and are rotated on every use.
create table refresh_tokens (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions (id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at    timestamptz,               -- set when it was exchanged for a new one
  created_at timestamptz not null default now()
);
create index refresh_tokens_session_idx on refresh_tokens (session_id);

create table images (
  id            uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references users (id) on delete cascade,
  mime          text not null check (mime in ('image/jpeg','image/png','image/webp')),
  size_bytes    integer not null check (size_bytes between 1 and 2097152),
  data          bytea not null,
  created_at    timestamptz not null default now()
);
create index images_owner_idx on images (owner_user_id);

-- ---------------------------------------------------------------- shops
create table shops (
  id               uuid primary key default gen_random_uuid(),
  owner_user_id    uuid not null references users (id) on delete restrict,
  name             text not null check (char_length(btrim(name)) between 2 and 80),
  owner_name       text not null check (char_length(btrim(owner_name)) between 2 and 80),
  tagline          text check (tagline is null or char_length(tagline) <= 140),
  description      text check (description is null or char_length(description) <= 1000),
  shop_type        text not null default 'grocery'
                     check (shop_type in ('grocery','puja','stationery','medical','dairy','vegetables','other')),
  phone            text not null check (phone ~ '^[0-9+ ()-]{7,20}$'),
  address_line     text not null check (char_length(btrim(address_line)) >= 3),
  area             text,
  city             text not null check (char_length(btrim(city)) >= 2),
  state            text not null check (char_length(btrim(state)) >= 2),
  pincode          text not null check (pincode ~ '^[0-9]{6}$'),
  logo_image_id    uuid references images (id) on delete set null,
  is_open          boolean not null default true,
  is_active        boolean not null default true,     -- platform kill switch (suspend a shop)
  is_verified      boolean not null default false,    -- platform badge
  next_bill_number bigint  not null default 1,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index shops_owner_idx on shops (owner_user_id);
create index shops_name_trgm on shops using gin (name gin_trgm_ops);
create index shops_city_idx  on shops (city);

create table shop_members (
  shop_id     uuid not null references shops (id) on delete cascade,
  user_id     uuid not null references users (id) on delete cascade,
  member_role text not null default 'owner' check (member_role in ('owner','manager')),
  created_at  timestamptz not null default now(),
  primary key (shop_id, user_id)
);
create index shop_members_user_idx on shop_members (user_id);

create table categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  name_hi    text,
  sort_order integer not null default 0
);

create table products (
  id           uuid primary key default gen_random_uuid(),
  shop_id      uuid not null references shops (id) on delete cascade,
  category_id  uuid references categories (id) on delete set null,
  name         text not null check (char_length(btrim(name)) between 1 and 120),
  name_hi      text check (name_hi is null or char_length(name_hi) <= 120),
  description  text,
  image_id     uuid references images (id) on delete set null,
  unit         unit_type not null default 'piece',
  price        numeric(12,2) not null check (price >= 0),
  is_available boolean not null default true,      -- owner's in-stock / out-of-stock switch
  is_active    boolean not null default true,      -- false = hidden ("deleted"); rows are never removed
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index products_shop_idx     on products (shop_id, is_active);
create index products_name_trgm    on products using gin (name gin_trgm_ops);
create index products_name_hi_trgm on products using gin (name_hi gin_trgm_ops);

create table inventory (
  product_id          uuid primary key references products (id) on delete cascade,
  shop_id             uuid not null references shops (id) on delete cascade,
  quantity            numeric(12,3) not null default 0 check (quantity >= 0),
  low_stock_threshold numeric(12,3) not null default 5 check (low_stock_threshold >= 0),
  updated_at          timestamptz not null default now()
);
create index inventory_shop_idx on inventory (shop_id);

create table product_price_history (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references products (id) on delete restrict,
  shop_id    uuid not null references shops (id) on delete restrict,
  old_price  numeric(12,2) not null,
  new_price  numeric(12,2) not null,
  changed_by uuid references users (id) on delete set null,
  changed_at timestamptz not null default now()
);

create table inventory_movements (
  id              uuid primary key default gen_random_uuid(),
  shop_id         uuid not null references shops (id) on delete restrict,
  product_id      uuid not null references products (id) on delete restrict,
  change_quantity numeric(12,3) not null,
  stock_after     numeric(12,3) not null check (stock_after >= 0),
  reason          text not null check (reason in ('opening','sale','restock','manual_set','correction','return')),
  bill_id         uuid,
  notes           text,
  created_by      uuid references users (id) on delete set null,
  created_at      timestamptz not null default now()
);
create index inv_movements_product_idx on inventory_movements (product_id, created_at desc);

-- ---------------------------------------------------------------- customers, lists
-- A shop's own record of a customer (may be a walk-in without an app account).
create table shop_customers (
  id         uuid primary key default gen_random_uuid(),
  shop_id    uuid not null references shops (id) on delete cascade,
  user_id    uuid references users (id) on delete set null,
  name       text not null check (char_length(btrim(name)) between 1 and 80),
  phone      text,
  notes      text,
  created_by uuid references users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (shop_id, user_id),
  unique (id, shop_id)
);
create index shop_customers_shop_idx  on shop_customers (shop_id);
create index shop_customers_user_idx  on shop_customers (user_id);
create index shop_customers_name_trgm on shop_customers using gin (name gin_trgm_ops);

create table shopping_lists (
  id               uuid primary key default gen_random_uuid(),
  shop_id          uuid not null references shops (id) on delete cascade,
  customer_user_id uuid not null references users (id) on delete cascade,
  shop_customer_id uuid references shop_customers (id) on delete set null,
  status           list_status not null default 'draft',
  notes            text check (notes is null or char_length(notes) <= 500),
  submitted_at     timestamptz,
  viewed_at        timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create unique index one_draft_list_per_shop on shopping_lists (shop_id, customer_user_id) where status = 'draft';
create index lists_shop_status_idx on shopping_lists (shop_id, status);
create index lists_customer_idx    on shopping_lists (customer_user_id);

create table shopping_list_items (
  id                    uuid primary key default gen_random_uuid(),
  shopping_list_id      uuid not null references shopping_lists (id) on delete cascade,
  product_id            uuid references products (id) on delete set null,
  product_name_snapshot text not null,
  quantity              numeric(12,3) not null check (quantity > 0),
  unit                  unit_type not null,
  created_at            timestamptz not null default now(),
  unique (shopping_list_id, product_id)
);
create index list_items_list_idx on shopping_list_items (shopping_list_id);

-- ---------------------------------------------------------------- billing & khata
create table bills (
  id               uuid primary key default gen_random_uuid(),
  shop_id          uuid not null references shops (id) on delete restrict,
  bill_number      bigint not null,
  shop_customer_id uuid not null,
  created_by       uuid not null references users (id) on delete restrict,
  shopping_list_id uuid references shopping_lists (id) on delete set null,
  request_id       uuid,                                   -- idempotency key from the app
  subtotal         numeric(12,2) not null check (subtotal >= 0),
  discount         numeric(12,2) not null default 0 check (discount >= 0),
  total_amount     numeric(12,2) not null check (total_amount >= 0),
  amount_paid      numeric(12,2) not null default 0 check (amount_paid >= 0),
  amount_due       numeric(12,2) not null check (amount_due >= 0),
  payment_status   pay_status not null,
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (shop_id, bill_number),
  foreign key (shop_customer_id, shop_id) references shop_customers (id, shop_id) on delete restrict,
  constraint bills_math check (
    total_amount = subtotal - discount
    and amount_due = total_amount - amount_paid
    and discount <= subtotal
  ),
  constraint bills_status check (
    payment_status = case
      when amount_due = 0  then 'paid'::pay_status
      when amount_paid = 0 then 'unpaid'::pay_status
      else 'partially_paid'::pay_status
    end
  )
);
create index bills_shop_created_idx  on bills (shop_id, created_at desc);
create index bills_customer_idx      on bills (shop_customer_id, created_at desc);
create unique index bills_request_uq on bills (request_id) where request_id is not null;

-- Prices are COPIED onto the bill, so later price changes never touch old bills.
create table bill_items (
  id                    uuid primary key default gen_random_uuid(),
  bill_id               uuid not null references bills (id) on delete restrict,
  product_id            uuid references products (id) on delete restrict,
  product_name_snapshot text not null,
  quantity              numeric(12,3) not null check (quantity > 0),
  unit                  unit_type not null,
  unit_price            numeric(12,2) not null check (unit_price >= 0),
  line_total            numeric(12,2) not null check (line_total >= 0),
  constraint bill_items_math check (line_total = round(quantity * unit_price, 2))
);
create index bill_items_bill_idx on bill_items (bill_id);

-- Money a customer hands to a shop (NOT the Vendly subscription: see "payments" below).
create table customer_payments (
  id               uuid primary key default gen_random_uuid(),
  shop_id          uuid not null references shops (id) on delete restrict,
  shop_customer_id uuid not null,
  request_id       uuid,
  amount           numeric(12,2) not null check (amount > 0),
  method           pay_method not null default 'cash',
  notes            text,
  created_by       uuid not null references users (id) on delete restrict,
  created_at       timestamptz not null default now(),
  foreign key (shop_customer_id, shop_id) references shop_customers (id, shop_id) on delete restrict
);
create index customer_payments_customer_idx     on customer_payments (shop_customer_id, created_at desc);
create unique index customer_payments_request_uq on customer_payments (request_id) where request_id is not null;

create table customer_payment_allocations (
  id         uuid primary key default gen_random_uuid(),
  payment_id uuid not null references customer_payments (id) on delete restrict,
  bill_id    uuid not null references bills (id) on delete restrict,
  amount     numeric(12,2) not null check (amount > 0)
);

-- The khata ledger. Balance = SUM(amount). Positive = customer owes the shop.
create table khata_transactions (
  id               uuid primary key default gen_random_uuid(),
  shop_id          uuid not null references shops (id) on delete restrict,
  shop_customer_id uuid not null,
  txn_type         txn_type not null,
  amount           numeric(12,2) not null,
  bill_id          uuid references bills (id) on delete restrict,
  payment_id       uuid references customer_payments (id) on delete restrict,
  notes            text,
  created_by       uuid not null references users (id) on delete restrict,
  created_at       timestamptz not null default now(),
  foreign key (shop_customer_id, shop_id) references shop_customers (id, shop_id) on delete restrict,
  constraint khata_sign check (
       (txn_type = 'bill' and amount > 0)
    or (txn_type in ('payment','refund') and amount < 0)
    or (txn_type = 'adjustment' and amount <> 0)
  )
);
create index khata_customer_idx on khata_transactions (shop_customer_id, created_at desc);
create index khata_shop_idx     on khata_transactions (shop_id);

-- ---------------------------------------------------------------- Vendly subscription (shopkeeper plan)
-- The SERVER is the only authority. Rows change only from verified payment-provider webhooks
-- (or the expiry job). The mobile app can never write here.
create table subscriptions (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null references users (id) on delete restrict,
  shop_id                  uuid not null references shops (id) on delete restrict,
  plan_code                text not null default 'vendly_shopkeeper_pro',
  status                   subscription_status not null default 'incomplete',
  provider                 text not null,
  provider_customer_id     text,
  provider_subscription_id text,
  checkout_url             text,
  checkout_created_at      timestamptz,
  started_at               timestamptz,
  current_period_start     timestamptz,
  current_period_end       timestamptz,          -- renewal date
  trial_ends_at            timestamptz,
  access_until             timestamptz,          -- shop management works while now() < access_until
  cancel_at_period_end     boolean not null default false,
  cancelled_at             timestamptz,
  last_event_at            timestamptz,          -- newest provider event applied (ignores late, out-of-order events)
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  unique (shop_id)
);
create unique index subscriptions_provider_sub_uq on subscriptions (provider, provider_subscription_id)
  where provider_subscription_id is not null;
create index subscriptions_access_idx on subscriptions (access_until);
create index subscriptions_status_idx on subscriptions (status);
create index subscriptions_user_idx   on subscriptions (user_id);

-- Payments made TO Vendly. No card, UPI or bank details are ever stored: the provider holds those.
create table payments (
  id                  uuid primary key default gen_random_uuid(),
  subscription_id     uuid references subscriptions (id) on delete restrict,
  user_id             uuid not null references users (id) on delete restrict,
  shop_id             uuid not null references shops (id) on delete restrict,
  provider            text not null,
  provider_payment_id text not null,
  amount_paise        integer not null check (amount_paise >= 0),
  currency            text not null default 'INR',
  status              platform_payment_status not null,
  method              text,
  failure_code        text,
  failure_reason      text,
  paid_at             timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (provider, provider_payment_id)
);
create index payments_subscription_idx on payments (subscription_id, created_at desc);
create index payments_shop_idx         on payments (shop_id, created_at desc);

-- Every webhook we accept (signature already verified). event_id makes processing idempotent.
create table payment_events (
  id           uuid primary key default gen_random_uuid(),
  provider     text not null,
  event_id     text not null,
  event_type   text not null,
  payload      jsonb not null,           -- card / UPI details are stripped before storing
  received_at  timestamptz not null default now(),
  processed_at timestamptz,
  unique (provider, event_id)
);
create index payment_events_type_idx on payment_events (event_type, received_at desc);

create table notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users (id) on delete cascade,
  type       text not null,
  title      text not null,
  body       text,
  data       jsonb not null default '{}'::jsonb,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on notifications (user_id, created_at desc);

-- ---------------------------------------------------------------- triggers
create or replace function touch_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger users_touch          before update on users           for each row execute function touch_updated_at();
create trigger shops_touch          before update on shops           for each row execute function touch_updated_at();
create trigger products_touch       before update on products        for each row execute function touch_updated_at();
create trigger inventory_touch      before update on inventory       for each row execute function touch_updated_at();
create trigger shop_customers_touch before update on shop_customers for each row execute function touch_updated_at();
create trigger lists_touch          before update on shopping_lists  for each row execute function touch_updated_at();
create trigger bills_touch          before update on bills           for each row execute function touch_updated_at();
create trigger subscriptions_touch  before update on subscriptions   for each row execute function touch_updated_at();
create trigger payments_touch       before update on payments        for each row execute function touch_updated_at();

-- Money records are permanent.
create or replace function forbid_change() returns trigger language plpgsql as $$
begin
  raise exception '% on % is not allowed: financial records are permanent. Record an adjustment instead.', tg_op, tg_table_name;
end $$;

create trigger bills_no_delete      before delete           on bills                         for each row execute function forbid_change();
create trigger bill_items_immutable before update or delete on bill_items                    for each row execute function forbid_change();
create trigger cust_pay_immutable   before update or delete on customer_payments             for each row execute function forbid_change();
create trigger cust_alloc_immutable before update or delete on customer_payment_allocations  for each row execute function forbid_change();
create trigger khata_immutable      before update or delete on khata_transactions            for each row execute function forbid_change();
create trigger inv_move_immutable   before update or delete on inventory_movements           for each row execute function forbid_change();
create trigger price_hist_immutable before update or delete on product_price_history         for each row execute function forbid_change();

-- Only the paid/due/status columns of a bill may ever change (when a later payment is applied).
create or replace function bills_guard() returns trigger language plpgsql as $$
begin
  if new.shop_id is distinct from old.shop_id
     or new.shop_customer_id is distinct from old.shop_customer_id
     or new.bill_number is distinct from old.bill_number
     or new.subtotal is distinct from old.subtotal
     or new.discount is distinct from old.discount
     or new.total_amount is distinct from old.total_amount
     or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at then
    raise exception 'A saved bill cannot be edited. Record an adjustment instead.';
  end if;
  return new;
end $$;
create trigger bills_guard_trg before update on bills for each row execute function bills_guard();
