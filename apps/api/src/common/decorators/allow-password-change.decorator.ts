import { SetMetadata } from "@nestjs/common";

export const ALLOW_WHILE_PASSWORD_CHANGE_REQUIRED = "allowWhilePasswordChangeRequired";

/**
 * Marks the few routes a user may call while they still have the temporary password the gym gave them
 * (who am I, change my password, sign out). Everything else is refused until the password is changed.
 */
export const AllowWhilePasswordChangeRequired = () => SetMetadata(ALLOW_WHILE_PASSWORD_CHANGE_REQUIRED, true);
