Current Problem

  The dropdown menu is getting crowded, and "View Info" feels hidden. Users shouldn't
  have to dig through menus to see fundamental table metadata.

  Alternative Placements

  Option 1: Tabbed Interface (Recommended)

  Add tabs above the data grid, similar to professional database tools:

  ┌─────────────────────────────────────────────────────────┐
  │  📋 products                                            │
  ├──────────┬──────────────┬────────────┬─────────────────┤
  │  Data    │  Structure   │  Relations │  Triggers       │
  ├──────────┴──────────────┴────────────┴─────────────────┤
  │                                                         │
  │  [Current data grid / or tab content]                   │
  │                                                         │
  └─────────────────────────────────────────────────────────┘

  Pros: Familiar pattern (phpMyAdmin, DBeaver, DataGrip), easy discovery, clean
  separation
  Cons: Takes vertical space, needs more significant refactoring

  ---
  Option 2: Collapsible Bottom Panel

  A slide-up panel at the bottom of the data grid (like browser DevTools):

  ┌─────────────────────────────────────────────────────────┐
  │  [Data Grid as usual]                                   │
  │                                                         │
  │                                                         │
  ├─────────────────────────────────────────────────────────┤
  │  ▼ Table Info    [Constraints: 5] [Triggers: 3] [Idx: 2]│
  │  ┌─────────────────────────────────────────────────────┐│
  │  │ FK: category_id → categories.id                     ││
  │  │ CHECK: price >= 0                                   ││
  │  └─────────────────────────────────────────────────────┘│
  └─────────────────────────────────────────────────────────┘

  Pros: Data stays visible, non-intrusive, can be collapsed
  Cons: Reduces data grid height when open

  ---
  Option 3: Column-Level Indicators + Header Info

  Show constraint icons directly in the column headers, with a summary bar:

  ┌─────────────────────────────────────────────────────────┐
  │  📋 products  │ 🔑 1 PK  🔗 2 FK  ✓ 3 CHK  ⚡ 2 Triggers │
  ├───────────────┼─────────────┼───────────────┼───────────┤
  │  🔑 id        │  🔗 cat_id  │  ✓ price      │  name     │
  ├───────────────┼─────────────┼───────────────┼───────────┤
  │  1            │  5          │  29.99        │  Widget   │
  └───────────────┴─────────────┴───────────────┴───────────┘
           ↑              ↑            ↑
      Primary Key    Foreign Key   Has CHECK
      (click to      (click to     constraint
       see details)   see target)

  Pros: Immediate visibility, contextual, no extra space needed
  Cons: Can get cluttered with many constraints, triggers not column-specific

  ---
  Option 4: Info Icon in Grid Header (Lightweight)

  Add a small ⓘ button next to the table name that opens a popover/tooltip:

  ┌─────────────────────────────────────────────────────────┐
  │  📋 products  ⓘ                           [+ Add Row]   │
  │               ┌──────────────────────┐                  │
  │               │ 🔑 Primary Key: id   │                  │
  │               │ 🔗 Foreign Keys: 1   │                  │
  │               │ ✓ Check: 3           │                  │
  │               │ ⚡ Triggers: 2        │                  │
  │               │ [View Details →]     │                  │
  │               └──────────────────────┘                  │
  ├─────────────────────────────────────────────────────────┤

  Pros: Minimal UI change, quick access, doesn't take space
  Cons: Still somewhat hidden, popover can feel cramped

  ---
  My Recommendation

  I'd suggest Option 1 (Tabbed Interface) or Option 3 (Column Indicators + Header)
  depending on how much refactoring you want to do:

- For a quick win: Option 3 - Add constraint icons to column headers + a summary badge
  bar in the grid header. This provides immediate visibility without major UI changes.
- For a more complete solution: Option 1 - A tabbed interface is the industry standard
  for database tools and would make the dashboard feel more professional.

  What approach resonates with you? I can implement whichever direction you prefer.
