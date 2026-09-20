-- Docket database schema (PostgreSQL / Neon). Safe to run more than once.

create table if not exists users (
  id            serial primary key,
  name          text not null,
  email         text not null unique,
  password_hash text not null,
  recovery_hash text,
  token_version int  not null default 0,
  timezone      text not null default 'Asia/Kolkata',
  currency      text not null default '₹',
  modules       jsonb not null default '{"tasks":true,"diet":true,"money":true,"gym":true}',
  created_at    timestamptz not null default now()
);

create table if not exists categories (
  id         serial primary key,
  user_id    int  not null references users(id) on delete cascade,
  name       text not null,
  color      text not null default '#2B4BDB',
  icon       text not null default '📌',
  sort       int  not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists categories_user_idx on categories(user_id);

create table if not exists tasks (
  id               serial primary key,
  user_id          int  not null references users(id) on delete cascade,
  category_id      int  references categories(id) on delete set null,
  title            text not null,
  notes            text not null default '',
  start_date       date not null,
  end_date         date,
  repeat           text not null default 'none' check (repeat in ('none','daily','weekdays','weekly')),
  days             int[] not null default '{}',
  time             text,                       -- 'HH:MM' (24h) or null
  remind           boolean not null default false,
  remind_before    int  not null default 0,    -- minutes
  priority         text not null default 'normal' check (priority in ('low','normal','high')),
  last_notified_on date,
  created_at       timestamptz not null default now()
);
create index if not exists tasks_user_idx on tasks(user_id);
create index if not exists tasks_remind_idx on tasks(remind) where remind = true;

create table if not exists task_logs (
  task_id  int  not null references tasks(id) on delete cascade,
  date     date not null,
  done_at  timestamptz not null default now(),
  primary key (task_id, date)
);

create table if not exists diet_profiles (
  user_id          int primary key references users(id) on delete cascade,
  sex              text not null default 'male',
  age              int  not null,
  height_cm        numeric not null,
  weight_kg        numeric not null,
  goal_weight_kg   numeric not null,
  activity         text not null default 'light',
  goal             text not null default 'lose',
  weekly_rate      numeric not null default 0.5,
  bmr              int not null,
  maintenance      int not null,
  target_calories  int not null,
  protein_g        int not null,
  carbs_g          int not null,
  fat_g            int not null,
  updated_at       timestamptz not null default now()
);

create table if not exists weight_logs (
  id        serial primary key,
  user_id   int  not null references users(id) on delete cascade,
  date      date not null,
  weight_kg numeric not null,
  unique (user_id, date)
);

create table if not exists meals (
  id         serial primary key,
  user_id    int  not null references users(id) on delete cascade,
  date       date not null,
  meal_type  text not null default 'snack' check (meal_type in ('breakfast','lunch','snack','dinner')),
  name       text not null,
  servings   numeric not null default 1,
  calories   int  not null default 0,
  protein    numeric not null default 0,
  carbs      numeric not null default 0,
  fat        numeric not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists meals_user_date_idx on meals(user_id, date);

create table if not exists foods (
  id       serial primary key,
  user_id  int  not null references users(id) on delete cascade,
  name     text not null,
  serving  text not null default '1 serving',
  calories int  not null,
  protein  numeric not null default 0,
  carbs    numeric not null default 0,
  fat      numeric not null default 0
);
create index if not exists foods_user_idx on foods(user_id);

create table if not exists transactions (
  id         serial primary key,
  user_id    int  not null references users(id) on delete cascade,
  date       date not null,
  type       text not null check (type in ('income','expense')),
  amount     numeric(12,2) not null check (amount >= 0),
  category   text not null default 'Other',
  note       text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists transactions_user_date_idx on transactions(user_id, date);

create table if not exists workouts (
  id           serial primary key,
  user_id      int  not null references users(id) on delete cascade,
  date         date not null,
  name         text not null,
  duration_min int  not null default 0,
  notes        text not null default '',
  exercises    jsonb not null default '[]',
  created_at   timestamptz not null default now()
);
create index if not exists workouts_user_date_idx on workouts(user_id, date);

create table if not exists push_subscriptions (
  id         serial primary key,
  user_id    int  not null references users(id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);
create index if not exists push_user_idx on push_subscriptions(user_id);
