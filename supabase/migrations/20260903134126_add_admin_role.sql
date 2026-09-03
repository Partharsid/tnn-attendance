-- Create policy to allow admin to view all logs
create policy "Admin can view all logs" on attendance_logs
  for select using (
    auth.jwt() ->> 'email' = 'parth.25bcd7027@vitapstudent.ac.in'
  );

-- Create policy to allow admin to delete logs
create policy "Admin can delete logs" on attendance_logs
  for delete using (
    auth.jwt() ->> 'email' = 'parth.25bcd7027@vitapstudent.ac.in'
  );
  
-- Create policy to allow admin to update logs
create policy "Admin can update logs" on attendance_logs
  for update using (
    auth.jwt() ->> 'email' = 'parth.25bcd7027@vitapstudent.ac.in'
  );
