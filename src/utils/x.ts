import { TwitterApi } from 'twitter-api-v2';
import { PublicKey } from '@solana/web3.js';
import { X_BEARER } from '../core/config/env';
import { logLogger } from './logger';

export const checkXAccount = async (username: string) => {
  const client = new TwitterApi(X_BEARER); // Replace with your API Bearer Token
  const readOnlyClient = client.readOnly;

  try {
    // Fetch user details by username
    const user = await readOnlyClient.v2.userByUsername(username, {
      'user.fields': 'description,public_metrics'
    });

    if (user) {
      // const isVerified = user.data.verified; // Check the verified status
      const description = user.data.description || ''; // Retrieve bio (description field)
      const followersCount = user.data.public_metrics?.followers_count; // Retrieve follower count
      const tweetCount = user.data.public_metrics?.tweet_count; // Retrieve follower count

      //  return null if tweets and follwers are too small
      if ((tweetCount && tweetCount < 5) || (followersCount && followersCount < 50)) {
        logLogger.log("too small - tweetCount:", tweetCount, "followersCount:", followersCount);
        return null;
      }

      const publicKeyRegex = /[A-Za-z0-9]{32,44}/;
      const match = description.match(publicKeyRegex);

      if (match && match[0]) {
        try {
          const ca = match[0];

          // logLogger.log('Verified:', isVerified);
          return new PublicKey(ca);
        } catch (e: any) {
          //   logLogger.error('failed to parse public key:', e);
        }
      }
    }
  } catch (e: any) {
    logLogger.error("can not get ca:", e as string);
  }

  return null;
};
