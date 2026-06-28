import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Custom decorator to extract the authenticated user from the request.
 * Usage: @CurrentUser() userId: string — returns the userId
 * Usage: @CurrentUser('email') email: string — returns specific field
 *
 * Eliminates repetitive `req.user.userId` access in controllers.
 */
export const CurrentUser = createParamDecorator(
  (field: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    if (!user) return null;

    return field ? user[field] : user.userId;
  },
);
