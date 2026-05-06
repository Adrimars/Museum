import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { Button } from '@museumquest/ui';

export default function RegisterPage() {
  const { t } = useTranslation();

  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <div className="w-full max-w-sm space-y-6">
        <h1 className="text-2xl font-bold">{t('auth.register')}</h1>
        <p className="text-muted-foreground text-sm">
          {t('auth.hasAccount')}{' '}
          <Link to="/login" className="text-primary underline underline-offset-4">
            {t('auth.login')}
          </Link>
        </p>
        <Button className="w-full" disabled>
          {t('auth.register')}
        </Button>
      </div>
    </main>
  );
}
