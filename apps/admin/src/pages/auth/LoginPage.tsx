import { Button } from '@museumquest/ui';

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <div className="w-full max-w-sm space-y-6">
        <h1 className="text-2xl font-bold">MuseumQuest Admin</h1>
        <p className="text-muted-foreground text-sm">Sign in to manage your museum.</p>
        <Button className="w-full" disabled>
          Sign In
        </Button>
      </div>
    </main>
  );
}
