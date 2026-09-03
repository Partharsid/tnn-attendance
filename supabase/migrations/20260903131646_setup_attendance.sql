create table attendance_logs (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid not null references auth.users(id),
  email text not null,
  name text not null,
  slot_day text not null,
  slot_time text not null,
  action_type text not null,
  latitude float not null,
  longitude float not null,
  photo_url text not null,
  timestamp timestamptz default now()
);

-- Enable RLS
alter table attendance_logs enable row level security;

-- Create policy to allow authenticated users to insert their own logs
create policy "Users can insert their own logs" on attendance_logs
  for insert with check (auth.uid() = user_id);

-- Create policy to allow authenticated users to view their own logs
create policy "Users can view their own logs" on attendance_logs
  for select using (auth.uid() = user_id);

-- Create storage bucket
insert into storage.buckets (id, name, public) 
values ('attendance-photos', 'attendance-photos', true);

-- Enable RLS on bucket
create policy "Allow authenticated uploads" on storage.objects
  for insert with check (
    bucket_id = 'attendance-photos' AND 
    auth.role() = 'authenticated'
  );

create policy "Allow public viewing" on storage.objects
  for select using (bucket_id = 'attendance-photos');
