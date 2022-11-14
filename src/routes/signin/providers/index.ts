import { Router } from 'express';

import apple from './apple';
import windowslive from './windowslive';

const router = Router();

apple(router);
windowslive(router);

export default (parentRouter: Router) => {
  /**
   * GET /signin/provider/{provider}
   * @summary
   * @param {string} provider.path.required - name param description - enum:github,google,facebook,twitter,apple,azuread,windowslive,linkedin,spotify,strava,gitlab,bitbucket,twitch
   * @param {string} redirectUrl.query.required -
   * @return {string} 302 - Redirect to the provider's authentication page
   * @tags Authentication
   */

  /**
   * GET /signin/provider/{provider}/callback
   * @summary Oauth callback url, that will be used by the Oauth provider, to redirect to the client application. Attention: all providers are using a GET operation, except Apple and Azure AD that use POST
   * @param {string} provider.path.required - name param description - enum:github,google,facebook,twitter,apple,azuread,windowslive,linkedin,spotify,strava,gitlab,bitbucket,twitch
   * @param {string} redirectUrl.query.required
   * @return {string} 302 - Redirect to the initial url given as a query parameter in /signin/provider/{provider}
   * @tags Authentication
   */
  parentRouter.use('/signin/provider', router);
};
