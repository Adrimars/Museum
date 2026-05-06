import { SetMetadata } from '@nestjs/common';

export const THROTTLE_GROUP_KEY = 'throttle_group';

export type ThrottleGroupName = 'auth' | 'public' | 'authenticated';

export const ThrottleGroup = (group: ThrottleGroupName) =>
  SetMetadata(THROTTLE_GROUP_KEY, group);
