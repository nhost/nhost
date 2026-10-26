export default function DeploymentRollbackNotes() {
  return (
    <ul className="list-disc space-y-1 pl-5 text-muted-foreground text-sm">
      <li>
        This commit's metadata, settings and functions replace the current ones.
      </li>
      <li>
        <strong className="text-foreground">
          Database migrations are not rolled back.
        </strong>
      </li>
    </ul>
  );
}
