import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { CookieOptions } from 'express';
import { Request, Response } from 'express';

import { Public } from '../../common/decorators/public.decorator';
import { ThrottleGroup } from '../../common/decorators/throttle-group.decorator';

import { AuthService } from './auth.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

const COOKIE_NAME = 'refreshToken';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  private readonly cookieOptions: CookieOptions;

  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {
    this.cookieOptions = {
      httpOnly: true,
      secure: this.config.get<string>('app.nodeEnv') === 'production',
      sameSite: 'strict',
      path: '/api/v1/auth',
    };
  }

  // ── Register ──────────────────────────────────────────────────────────────

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ThrottleGroup('auth')
  @ApiOperation({ summary: 'Register a new visitor account' })
  @ApiResponse({ status: 201, description: 'Account created, tokens issued.' })
  @ApiResponse({ status: 409, description: 'Email already exists.' })
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.authService.register(dto, req.headers['user-agent']);
    this.setRefreshCookie(res, tokens.refreshToken);
    return { accessToken: tokens.accessToken, expiresAt: tokens.expiresAt };
  }

  // ── Login ─────────────────────────────────────────────────────────────────

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ThrottleGroup('auth')
  @ApiOperation({ summary: 'Authenticate with email and password' })
  @ApiResponse({ status: 200, description: 'Authenticated.' })
  @ApiResponse({ status: 401, description: 'Invalid credentials.' })
  @ApiResponse({ status: 429, description: 'Account locked.' })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(dto, req.headers['user-agent']);
    this.setRefreshCookie(res, result.refreshToken);
    return {
      accessToken: result.accessToken,
      expiresAt: result.expiresAt,
      accountScheduledForDeletion: result.deletedAt !== null,
      deletionDate: result.deletedAt,
    };
  }

  // ── Token Refresh ─────────────────────────────────────────────────────────

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate refresh token and issue new access token' })
  @ApiResponse({ status: 200, description: 'Tokens rotated.' })
  @ApiResponse({ status: 401, description: 'Refresh token invalid or expired.' })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const rawRefreshToken = req.cookies[COOKIE_NAME] as string | undefined;
    if (!rawRefreshToken) {
      return res.status(HttpStatus.UNAUTHORIZED).json({
        statusCode: 401,
        message: 'No refresh token provided.',
        errorCode: 'AUTH_TOKEN_INVALID',
      });
    }

    const tokens = await this.authService.refreshTokens(rawRefreshToken, req.headers['user-agent']);
    this.setRefreshCookie(res, tokens.refreshToken);
    return { accessToken: tokens.accessToken, expiresAt: tokens.expiresAt };
  }

  // ── Logout ────────────────────────────────────────────────────────────────

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke refresh token and clear cookie' })
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const rawRefreshToken = req.cookies[COOKIE_NAME] as string | undefined;
    if (rawRefreshToken) {
      await this.authService.logout(rawRefreshToken);
    }
    this.clearRefreshCookie(res);
    return { message: 'Logged out successfully.' };
  }

  // ── Forgot Password ───────────────────────────────────────────────────────

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ThrottleGroup('auth')
  @ApiOperation({ summary: 'Request a password reset email' })
  @ApiResponse({ status: 200, description: 'Email sent if account exists (always 200).' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.authService.forgotPassword(dto);
    return { message: 'If an account with that email exists, a reset link has been sent.' };
  }

  // ── Reset Password ────────────────────────────────────────────────────────

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Execute password reset using token from email' })
  @ApiResponse({ status: 200, description: 'Password updated.' })
  @ApiResponse({ status: 400, description: 'Token invalid or expired.' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto);
    return { message: 'Password has been reset. Please log in with your new password.' };
  }

  // ── Google OAuth2 ─────────────────────────────────────────────────────────

  @Public()
  @Get('google')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Initiate Google OAuth2 flow' })
  googleAuth() {
    // Passport redirects to Google — body never reached
  }

  @Public()
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Google OAuth2 callback' })
  async googleCallback(
    @Req() req: Request & { user: { email: string; displayName: string; googleId: string } },
    @Res() res: Response,
  ) {
    const tokens = await this.authService.handleGoogleCallback(
      req.user,
      req.headers['user-agent'],
    );

    // Refresh token goes into httpOnly cookie — same as every other auth flow.
    // The access token is NOT placed in the redirect URL (prevents exposure in logs,
    // browser history, and Referer headers). The frontend /auth/callback page must
    // call POST /api/v1/auth/refresh (cookie sent automatically) to obtain the
    // access token from the JSON response body.
    this.setRefreshCookie(res, tokens.refreshToken);

    const frontendUrl = this.config.get<string>('auth.frontendUrl', 'http://localhost:5173');
    res.redirect(`${frontendUrl}/auth/callback`);
  }

  // ── Cookie helpers ────────────────────────────────────────────────────────

  private setRefreshCookie(res: Response, rawToken: string): void {
    res.cookie(COOKIE_NAME, rawToken, {
      ...this.cookieOptions,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }

  private clearRefreshCookie(res: Response): void {
    res.clearCookie(COOKIE_NAME, this.cookieOptions);
  }
}
