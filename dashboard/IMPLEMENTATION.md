Implementation Summary

  New Files Created:

  1. useTableRelatedObjectsQuery hook (/hooks/useTableRelatedObjectsQuery/)
    - fetchTableRelatedObjects.ts - Fetches constraints, triggers, and indexes for a
  table using PostgreSQL system catalogs
    - useTableRelatedObjectsQuery.ts - React Query wrapper hook
    - index.ts - Exports
  2. TableInfoView component (/components/TableInfoView/)
    - Displays table information in an accordion layout with:
        - Constraints section: Primary keys, foreign keys, unique constraints, check
  constraints, exclusion constraints
      - Triggers section: Shows trigger name, timing (BEFORE/AFTER), events
  (INSERT/UPDATE/DELETE), and linked function
      - Indexes section: Non-constraint indexes with column information

  Modified Files:

  1. TableActions.tsx - Added "View Info" menu item with Info icon
  2. useDataBrowserActions.tsx - Added handleViewTableInfoClick function and dynamic
  import for TableInfoView
  3. DataBrowserSidebar.tsx - Wired up the new onViewInfo handler

  UX Design Decisions:

- Placement: Added "View Info" as the first menu item in the table context menu
  (accessible by clicking the "..." button on any table)
- Layout: Uses accordion pattern (consistent with existing EditTableSettingsForm) for
  collapsible sections
- Visual Design:
  - Color-coded icons for different constraint types (yellow for PK, blue for FK,
  purple for unique, green for check)
  - Badge indicators for trigger timing and events
  - Shows trigger function links
  - Consistent with existing dashboard patterns (cards, badges, accordions)
