ALTER TABLE public.todos ADD "createdAt" timestamptz DEFAULT now() NOT NULL;
ALTER TABLE public.todos ADD "updatedAt" timestamptz DEFAULT now() NOT NULL;
