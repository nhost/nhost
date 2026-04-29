export default function MetadataRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex justify-between gap-2 text-sm">
      <span className="text-gray-600 dark:text-gray-400">{label}</span>
      <span className="font-mono text-gray-900 dark:text-gray-100">
        {value}
      </span>
    </div>
  );
}
