CREATE OR REPLACE FUNCTION public.get_department_manager(department_id UUID)
  RETURNS public.user_departments
  LANGUAGE sql
  STABLE
  AS $$
    SELECT *
    FROM public.user_departments
    WHERE department_id = department_id
      AND role = 'manager'
    LIMIT 1;
  $$;

