// ---------------------------------------------------------------------------------
// FILE: 05_GuardianAgent.ts
// PURPOSE: Implements the Guardian Agent's policy logic using the UserAccess sheet.
// ---------------------------------------------------------------------------------

const POLICY_SHEET_NAME: string = "UserAccess"; // Matches your new sheet name
const ADMIN_EMAIL_POLICY: string = "ADMIN";
const ADMIN_HANDLER_WILDCARD: string = "*";

interface Policy {
    accessLevel: string;
    allowedHandlers: string[];
}

/**
 * Guardian Agent: Retrieves user policy record from the UserAccess sheet.
 */
function Guardian_getUserPolicy_(userEmail: string): Policy {
    try {
        // Assume CFG_ and readTable_ are available globally
        const tbl: any = readTable_(POLICY_SHEET_NAME); // Reads the new UserAccess sheet
        if (!tbl.ok) return { accessLevel: 'FREE', allowedHandlers: [] };

        // Cast to an array of objects where we expect User_Email and Allowed_Handlers
        const userRow: any = tbl.rows.find((r: any) => r.User_Email === userEmail); 
        
        if (!userRow) {
             return { accessLevel: 'FREE', allowedHandlers: [] };
        }
        
        // Parse handlers from JSON string in the sheet cell
        const handlers: string[] = JSON.parse(userRow.Allowed_Handlers || '[]');

        return { 
            accessLevel: userRow.Access_Level || 'FREE', 
            allowedHandlers: handlers
        };

    } catch (e: unknown) { // Use unknown for safety, then cast to Error
        log_('ERROR', 'Guardian_getUserPolicy_', { err: (e as Error).message });
        // Fail open for the admin developer during testing if sheet fails
        if (userEmail === 'reuven007@gmail.com') {
             return { accessLevel: ADMIN_EMAIL_POLICY, allowedHandlers: [ADMIN_HANDLER_WILDCARD] };
        }
        return { accessLevel: 'FREE', allowedHandlers: [] };
    }
}

/**
 * Guardian Agent: Main function to check user access before running a handler.
 * @returns {object} {ok: boolean, message?: string}
 */
function Guardian_checkAccess_(userEmail: string, handlerKey: string): {ok: boolean, message?: string} {
    const policy: Policy = Guardian_getUserPolicy_(userEmail);

    if (policy.accessLevel === ADMIN_EMAIL_POLICY || policy.allowedHandlers.includes(ADMIN_HANDLER_WILDCARD)) {
        return { ok: true };
    }
    
    if (policy.allowedHandlers.includes(handlerKey)) {
        return { ok: true };
    }

    return { 
        ok: false, 
        message: `Access Denied: The handler '${handlerKey}' requires a subscription upgrade.` 
    };
}
