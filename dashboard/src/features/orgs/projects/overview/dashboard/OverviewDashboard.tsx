import { useState } from 'react';
import { Container } from '@/components/layout/Container';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { OverviewTopBar } from '@/features/orgs/projects/overview/components/OverviewTopBar';
import AddWidgetDialog from '@/features/orgs/projects/overview/dashboard/AddWidgetDialog';
import CustomizeControls from '@/features/orgs/projects/overview/dashboard/CustomizeControls';
import DashboardGrid from '@/features/orgs/projects/overview/dashboard/DashboardGrid';
import EditModeBar from '@/features/orgs/projects/overview/dashboard/EditModeBar';
import FirstTimeRibbon from '@/features/orgs/projects/overview/dashboard/FirstTimeRibbon';
import TemplatesDialog from '@/features/orgs/projects/overview/dashboard/TemplatesDialog';
import { useDashboardLayout } from '@/features/orgs/projects/overview/dashboard/useDashboardLayout';

export default function OverviewDashboard() {
  const { project } = useProject();
  const [addOpen, setAddOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);

  const {
    layout,
    editing,
    dirty,
    hasSavedLayout,
    firstTimeDismissed,
    setLayout,
    startEditing,
    save,
    discard,
    applyTemplate,
    addWidget,
    removeWidget,
    updateWidgetConfig,
    dismissFirstTime,
  } = useDashboardLayout(project?.subdomain);

  if (!project) {
    return null;
  }

  const showFirstTimeRibbon =
    !hasSavedLayout && !firstTimeDismissed && !editing;

  return (
    <Container>
      <OverviewTopBar
        rightSlot={
          <CustomizeControls
            editing={editing}
            dirty={dirty}
            onStartEditing={startEditing}
            onAddWidget={() => setAddOpen(true)}
            onOpenTemplates={() => setTemplatesOpen(true)}
            onDiscard={discard}
            onSave={save}
          />
        }
      />

      {showFirstTimeRibbon ? (
        <FirstTimeRibbon
          onCustomize={() => {
            startEditing();
            dismissFirstTime();
          }}
          onDismiss={dismissFirstTime}
        />
      ) : null}

      <DashboardGrid
        layout={layout}
        editing={editing}
        onChange={setLayout}
        onRemove={removeWidget}
        onUpdateConfig={updateWidgetConfig}
      />

      {editing ? (
        <EditModeBar
          widgetCount={layout.length}
          dirty={dirty}
          onDiscard={discard}
          onSave={save}
        />
      ) : null}

      <AddWidgetDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        existingTypes={layout.map((it) => it.type)}
        onAdd={(entry) => {
          addWidget(entry);
          setAddOpen(false);
        }}
      />

      <TemplatesDialog
        open={templatesOpen}
        onOpenChange={setTemplatesOpen}
        currentLayout={layout}
        onApply={(next) => {
          applyTemplate(next);
          setTemplatesOpen(false);
        }}
      />
    </Container>
  );
}
