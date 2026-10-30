import { Alert, AlertDescription } from '@/components/ui/v3/alert';

function RestoreRecommendationNote() {
  return (
    <Alert>
      <AlertDescription>
        <p className="!leading-[1.5]">
          We recommend importing the backup to a different project first to
          ensure everything works as expected before applying it to this
          project.
        </p>
      </AlertDescription>
    </Alert>
  );
}

export default RestoreRecommendationNote;
