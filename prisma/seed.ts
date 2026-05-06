import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const DEFAULT_MUSEUM_SETTINGS = {
  theme: {
    primaryColor: '#1E40AF',
    secondaryColor: '#F59E0B',
    logoUrl: null,
  },
  ai_config: {
    personaName: 'Museum Guide',
    systemPromptOverride: null,
    isEnabled: true,
  },
  modules: {
    quizEnabled: true,
    treasureHuntEnabled: true,
    aiAssistantEnabled: true,
  },
  limits: {
    maxAnswerAttemptsPerClue: 3,
    hintsPerClue: 1,
    hintRevealOnAttempt: 2,
    gameSessionTimeoutHours: 4,
    quizTimerSeconds: 30,
    maxAiTurnsPerSession: 5,
    aiRateLimitPerMinute: 3,
    questionsPerQuizByDifficulty: {
      easy: 10,
      medium: 15,
      hard: 20,
    },
    pointsPerCorrectByDifficulty: {
      easy: 10,
      medium: 20,
      hard: 30,
    },
    gameClueTimerSeconds: 60,
    timeBonusEnabled: true,
    timeBonusMax: 10,
    maxFinalCodeAttempts: 5,
  },
};

async function main() {
  console.log('🌱  Starting database seed...');

  // ── Super Admin ──────────────────────────────────────────────────────────
  const superAdminEmail = process.env['SUPER_ADMIN_EMAIL'] ?? 'admin@museumquest.app';
  const superAdminPassword = process.env['SUPER_ADMIN_PASSWORD'] ?? 'Admin@12345!';

  const passwordHash = await bcrypt.hash(superAdminPassword, 12);

  const superAdmin = await prisma.user.upsert({
    where: { email: superAdminEmail },
    update: {},
    create: {
      email: superAdminEmail,
      passwordHash,
      displayName: 'Super Admin',
      role: UserRole.super_admin,
      dateOfBirth: new Date('1990-01-01'),
      preferences: {
        language: 'en',
        preferredDifficulty: 'medium',
        accessibility: { reducedMotion: false, highContrast: false },
      },
    },
  });

  console.log(`✅  Super admin created/found: ${superAdmin.email}`);

  // ── Demo Museum (for development only) ──────────────────────────────────
  if (process.env['NODE_ENV'] !== 'production') {
    const demoMuseum = await prisma.museum.upsert({
      where: { slug: 'demo-museum' },
      update: {},
      create: {
        name: 'Demo Museum',
        slug: 'demo-museum',
        description: 'A demonstration museum for development and testing.',
        address: {
          street: '123 Museum Street',
          city: 'Istanbul',
          country: 'Turkey',
          lat: 41.0082,
          lng: 28.9784,
        },
        settings: DEFAULT_MUSEUM_SETTINGS,
        isActive: true,
      },
    });

    console.log(`✅  Demo museum created/found: ${demoMuseum.name} (id: ${demoMuseum.id})`);

    // Demo museum_admin account
    const museumAdminEmail = process.env['DEMO_MUSEUM_ADMIN_EMAIL'] ?? 'museumadmin@museumquest.app';
    const museumAdminPassword = process.env['DEMO_MUSEUM_ADMIN_PASSWORD'] ?? 'MuseumAdmin@12345!';
    const museumAdminHash = await bcrypt.hash(museumAdminPassword, 12);

    const museumAdmin = await prisma.user.upsert({
      where: { email: museumAdminEmail },
      update: {},
      create: {
        email: museumAdminEmail,
        passwordHash: museumAdminHash,
        displayName: 'Demo Museum Admin',
        role: UserRole.museum_admin,
        museumId: demoMuseum.id,
        dateOfBirth: new Date('1985-06-15'),
        preferences: {
          language: 'tr',
          preferredDifficulty: 'medium',
          accessibility: { reducedMotion: false, highContrast: false },
        },
      },
    });

    console.log(`✅  Demo museum admin created/found: ${museumAdmin.email}`);
  }

  console.log('🌱  Seed complete.');
}

main()
  .catch((err) => {
    console.error('❌  Seed failed:', err);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
