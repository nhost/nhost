import { Router } from 'express';

import github from './github';
import google from './google';
import facebook from './facebook';
import twitter from './twitter';
import apple from './apple';
import windowslive from './windowslive';
import linkedin from './linkedin';
import spotify from './spotify';
import strava from './strava';
import gitlab from './gitlab';
import bitbucket from './bitbucket';
import discord from './discord';
import twitch from './twitch';

const router = Router();

github(router);
google(router);
facebook(router);
twitter(router);
apple(router);
windowslive(router);
linkedin(router);
spotify(router);
strava(router);
gitlab(router);
bitbucket(router);
discord(router);
twitch(router);

export default (parentRouter: Router) => {
  /**
   * GET /signin/provider/{provider}
   * @summary
   * @param {string} provider.path.required - name param description - enum:github,google,facebook,twitter,apple,windowslive,linkedin,spotify,strava,gitlab,bitbucket
   * @param {string} redirectUrl.query.required -
   * @tags Authentication
   */

  /**
   * GET /signin/provider/{provider}/callback
   * @summary Oauth callback url, that will be used by the Oauth provider, to redirect to the client application. Attention: all providers are using a GET operation, except Apple that uses POST
   * @param {string} provider.path.required - name param description - enum:github,google,facebook,twitter,apple,windowslive,linkedin,spotify,strava,gitlab,bitbucket
   * @param {string} redirectUrl.query.required
   * @return {string} 302 - Redirect to the initial url given as a query parameter in /signin/provider/{provider}
   * @tags Authentication
   */
  parentRouter.use('/signin/provider', router);
};
