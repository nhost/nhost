import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default function Home() {
  return (
    <div className="mx-auto max-w-md">
      <Card>
        <CardHeader>
          <CardTitle>Nhost + Next.js</CardTitle>
          <CardDescription>An auth starter powered by Nhost.</CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
