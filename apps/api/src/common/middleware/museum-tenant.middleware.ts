import { ForbiddenException, Injectable, NestMiddleware, NotFoundException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

import { PrismaService } from '../../prisma/prisma.service';
import type { JwtPayload } from '../decorators/current-user.decorator';
import { ErrorCode } from '../errors/error-codes';

export interface TenantRequest extends Request {
  museumId?: string;
  user?: JwtPayload;
}

@Injectable()
export class MuseumTenantMiddleware implements NestMiddleware {
  constructor(private readonly prisma: PrismaService) {}

  async use(req: TenantRequest, _res: Response, next: NextFunction): Promise<void> {
    // Resolution priority: route param → query param → JWT payload
    const museumId: string | undefined =
      (req.params['museumId'] as string | undefined) ??
      (req.query['museum_id'] as string | undefined) ??
      req.user?.museumId ?? undefined;

    if (!museumId) {
      return next();
    }

    const museum = await this.prisma.museum.findFirst({
      where: { id: museumId, deletedAt: null },
      select: { id: true, isActive: true },
    });

    if (!museum) {
      throw new NotFoundException({
        message: 'Museum not found.',
        errorCode: ErrorCode.MUSEUM_NOT_FOUND,
      });
    }

    if (!museum.isActive) {
      throw new ForbiddenException({
        message: 'This museum is currently inactive.',
        errorCode: ErrorCode.MUSEUM_INACTIVE,
      });
    }

    req.museumId = museum.id;
    next();
  }
}
