import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { Button } from '@museumquest/ui';

export default function HomePage() {
  const { t } = useTranslation();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-4xl font-bold tracking-tight">{t('app.name')}</h1>
      <p className="text-muted-foreground text-center max-w-md">{t('app.tagline')}</p>
      <div className="flex gap-4">
        <Button asChild>
          <Link to="/login">{t('auth.login')}</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link to="/register">{t('auth.register')}</Link>
        </Button>
      </div>
    </main>
  );
}
