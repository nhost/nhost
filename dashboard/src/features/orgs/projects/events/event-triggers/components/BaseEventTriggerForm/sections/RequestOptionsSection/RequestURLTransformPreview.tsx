export default function RequestURLTransformPreview() {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-medium">URL transform preview</h3>
      <p className="max-w-lg rounded-md bg-muted-foreground/20 p-2 font-mono text-sm text-muted-foreground dark:bg-muted">
        https://example.com/api/v1/users?name=John&age=30
      </p>
    </div>
  );
}
