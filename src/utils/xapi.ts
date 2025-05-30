import { PublicKey } from '@solana/web3.js';
import { envs } from '../core/config/env';
import { errorLogger, logLogger } from './logger';

export const getCa = async (username: string) => {
    const options = {
        method: 'GET',
        headers: {
            'X-API-Key': envs.XAPI_KEY,
        }
    };

    try {
        const response = await fetch(`${envs.XAPI_URL}/user/info/?userName=${username}`, options);

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data = (await response.json()).data;
        const postCount = data.statusesCount;
        const followerCount = data.followers;
        const followingCount = data.following;
        const description = data.description;
        const createdAt = new Date(data.createdAt).getTime();

        //  return 0 if tweets and follwers are too small
        if (postCount < 10 || followerCount < 50 || followingCount > followerCount / 2) {
            // logLogger.log("xxx - posts:", postCount, "followers:", followerCount, "following:", followingCount);
            return -1;
        }

        //  return -1 if there're too many followers
        if (followerCount > 50000) { //  50k
            // logLogger.log("too many followers - followerCount:", followerCount);
            return -1;
        }

        //  return -1 if the account is created more than a month ago
        const aMonth = 30 * 24 * 60 * 60 * 1000;
        if ((new Date().getTime()) - createdAt > aMonth) {
            // logLogger.log("account is created more than a month ago");
            return -1;
        }

        if (!description || description.length < 32) {
            // logLogger.log("has problem with description, x:", username);
            return 0;
        }

        const publicKeyRegex = /[A-Za-z0-9]{32,44}/;
        const match = description.match(publicKeyRegex);

        if (match && match[0]) {
            try {
                const ca = match[0];

                logLogger.log('ca:', ca);
                return new PublicKey(ca);
            } catch (e: any) {
                //   logLogger.error('failed to parse public key:', e);
            }
        }
    } catch (err) {
        errorLogger.error('can not get ca:', err as string);
    }


    return 0;
};

export const countUniquePosts = async (query: string): Promise<{ users: number, likes: number, views: number }> => {
    const options = {
        method: 'GET',
        headers: {
            'X-API-Key': envs.XAPI_KEY,
        }
    };

    return await fetch(`${envs.XAPI_URL}/tweet/advanced_search/?query=${query}`, options)
        .then(response => response.json())
        .then(response => {
            const uniqueUserNames = new Set<string>();
            let likeCount = 0;
            let viewCount = 0;
            const now = new Date();

            for (const tweet of response.tweets) {
                const author = tweet.author;
                const digitCount = (author.userName.match(/\d/g) || []).length;

                if (author.userName.length < 15
                    && digitCount <= 3
                    && author.followers > author.following * 2
                    && author.followers > 50
                    && (now.getTime() - new Date(author.createdAt).getTime()) > 30 * 24 * 60 * 60 * 1000
                    && !uniqueUserNames.has(author.userName)) {

                    uniqueUserNames.add(author.userName);
                    likeCount += tweet.likeCount;
                    viewCount += tweet.viewCount;
                }
            }

            return { users: uniqueUserNames.size, likes: likeCount, views: viewCount };
        })
        .catch(err => {
            errorLogger.log("failed to search x");
            errorLogger.log(err as string);
            return { users: 0, likes: 0, views: 0 };
        });
}
