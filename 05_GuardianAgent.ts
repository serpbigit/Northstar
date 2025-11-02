// ---------------------------------------------------------------------------------
// FILE: 05_GuardianAgent.ts
// PURPOSE: Implements the Guardian Agent's policy logic using the UserAccess sheet.
// ---------------------------------------------------------------------------------

const POLICY_SHEET_NAME = "UserAccess"; // Matches your new sheet name
const ADMIN_EMAIL_POLICY = "ADMIN";
const ADMIN_HANDLER_WILDCARD = "*";

/**
 * Guardian Agent: Retrieves user policy record from the UserAccess sheet.
 * NOTE: This function requires readTable_ from 01_ConfigAndUtils.ts
 */
function Guardian_getUserPolicy_(userEmail) {
    try {
        // Assume CFG_ is available from 01_ConfigAndUtils.ts
        const tbl = readTable_(POLICY_SHEET_NAME); // Reads the new UserAccess sheet
        if (!tbl.ok) return { accessLevel: 'FREE', allowedHandlers: [] };

        const userRow = tbl.rows.find((r) => r.User_Email === userEmail);
        
        if (!userRow) {
             return { accessLevel: 'FREE', allowedHandlers: [] };
        }
        
        // Parse handlers from JSON string in the sheet cell
        const handlers = JSON.parse(userRow.Allowed_Handlers || '[]');

        return { 
            accessLevel: userRow.Access_Level || 'FREE', 
            allowedHandlers: handlers
        };

    } catch (e) {
        log_('ERROR', 'Guardian_getUserPolicy_', { err: e.message });
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
function Guardian_checkAccess_(userEmail, handlerKey) {
    const policy = Guardian_getUserPolicy_(userEmail);

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
