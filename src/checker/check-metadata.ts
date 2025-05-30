import { X_BLACKLIST } from "../core/constants";
import { errorLogger } from "../utils/logger";
import { Socials } from "../utils/types";

//    check and return X link
export const checkMetadata = async (uri: string): Promise<{ code: number; link: string; }> => {
    try {
        //  check if any social inclues one of the keywords
        const jsonData = await (await fetch(uri)).json();

        const socials = getSocialLinks(jsonData);

        //  return X link
        const xHandle = extractTwitterHandle(socials.twitter) || socials.tweetCreatorUsername;

        if (!xHandle) {
            if (!socials.website)
                return { code: -1, link: "" };
            else
                return { code: 2, link: socials.website };
        }

        //  check xHandle is in the blacklist
        if (X_BLACKLIST.includes(xHandle))
            return { code: -2, link: "" };

        return { code: 1, link: xHandle };
    } catch (e) {
        errorLogger.log("Error during parse uri", e as string);
        errorLogger.log("uri:", uri);
    }
    return { code: -3, link: "" };
}

// Function to get values if they exist
const getSocialLinks = (data: any): Socials => {
    // Function to deeply search for the keys
    const findKeyDeep = (obj: any, key: string): string | undefined => {
        if (typeof obj !== "object" || obj === null) {
            return undefined;
        }

        if (key in obj && typeof obj[key] === "string") {
            return obj[key];
        }

        for (const k in obj) {
            if (obj.hasOwnProperty(k)) {
                const result = findKeyDeep(obj[k], key);
                if (result) {
                    return result;
                }
            }
        }

        return undefined;
    };

    // Use the helper to search for values
    return {
        website: findKeyDeep(data, "website"),
        twitter: findKeyDeep(data, "twitter"),
        telegram: findKeyDeep(data, "telegram"),
        tweetCreatorUsername: findKeyDeep(data, "tweetCreatorUsername")
        // description: findKeyDeep(data, "description"),
    };
}

const extractTwitterHandle = (url: string | undefined) => {
    if (!url) return null; // If no URL is provided, return null.

    // Regular expression to extract the handle from valid Twitter or X profile URLs.
    const match = url.match(/^https?:\/\/(www\.)?(twitter\.com|x\.com)\/@?(?<handle>[a-zA-Z0-9_]+)$/);

    // If a match is found, return the handle with an '@'. Otherwise, return null.
    return match?.groups?.handle ? `${match.groups.handle}` : null;
}

const allHaveThreeOrFewerDigits = (socials: Socials): boolean => {
    // Iterate over the values of the Socials object
    return Object.values(socials).every(value => {
        if (value === undefined)
            return true; // Skip undefined properties

        // Count the number of numerical digits in the string using a regular expression
        const digitCount = (value.match(/\d/g) || []).length;
        return digitCount <= 3; // Ensure the number of digits is 3 or fewer
    });
}
