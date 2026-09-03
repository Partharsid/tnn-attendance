-- Drop old policies
drop policy "Admins can view all logs" on attendance_logs;
drop policy "Admins can delete logs" on attendance_logs;
drop policy "Admins can update logs" on attendance_logs;

-- Create new policies
create policy "Admins can view all logs" on attendance_logs
  for select using (
    auth.jwt() ->> 'email' in (
      'parth.25bcd7027@vitapstudent.ac.in', 
      'arnav.25bce7180@vitapstudent.ac.in', 
      'fazal.25bce7625@vitapstudent.ac.in',
      'utkarsh.24bcd7092@vitapstudent.ac.in'
    )
  );

create policy "Admins can delete logs" on attendance_logs
  for delete using (
    auth.jwt() ->> 'email' in (
      'parth.25bcd7027@vitapstudent.ac.in', 
      'arnav.25bce7180@vitapstudent.ac.in', 
      'fazal.25bce7625@vitapstudent.ac.in',
      'utkarsh.24bcd7092@vitapstudent.ac.in'
    )
  );
  
create policy "Admins can update logs" on attendance_logs
  for update using (
    auth.jwt() ->> 'email' in (
      'parth.25bcd7027@vitapstudent.ac.in', 
      'arnav.25bce7180@vitapstudent.ac.in', 
      'fazal.25bce7625@vitapstudent.ac.in',
      'utkarsh.24bcd7092@vitapstudent.ac.in'
    )
  );
