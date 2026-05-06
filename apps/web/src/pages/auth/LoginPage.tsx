import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { Button } from '@museumquest/ui';

export default function LoginPage() {
  const { t } = useTranslation();

  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <div className="w-full max-w-sm space-y-6">
        <h1 className="text-2xl font-bold">{t('auth.login')}</h1>
        <p className="text-muted-foreground text-sm">
          {t('auth.noAccount')}{' '}
          <Link to="/register" className="text-primary underline underline-offset-4">
            {t('auth.register')}
          </Link>
        </p>
        <Button className="w-full" disabled>
          {t('auth.login')}
        </Button>
      </div>
    </main>
  );
}
