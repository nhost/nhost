CREATE TABLE public.user_departments (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY (user_id, department_id),
  CONSTRAINT fk_user_departments_role
    FOREIGN KEY (role) REFERENCES public.department_roles(value)
    ON DELETE RESTRICT ON UPDATE CASCADE
);
