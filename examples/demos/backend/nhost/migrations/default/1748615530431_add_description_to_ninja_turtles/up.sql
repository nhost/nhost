ALTER TABLE public.ninja_turtles ADD COLUMN description TEXT;
UPDATE public.ninja_turtles SET description = 'Leader of the team who wears a blue mask and uses twin katana blades. Known for his strategic mind and unwavering discipline.' WHERE name = 'Leonardo';
UPDATE public.ninja_turtles SET description = 'Hot-headed member who wears a red mask and fights with twin sai. Known for his strength, aggression, and intense loyalty to his family.' WHERE name = 'Raphael';
UPDATE public.ninja_turtles SET description = 'Technical genius who wears a purple mask and wields a bo staff. Known for his intelligence, inventions, and problem-solving abilities.' WHERE name = 'Donatello';
UPDATE public.ninja_turtles SET description = 'Fun-loving member who wears an orange mask and uses nunchaku. Known for his optimism, sense of humor, and love for pizza.' WHERE name = 'Michelangelo';
