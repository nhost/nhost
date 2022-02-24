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
  parentRouter.use('/signin/provider', router);
};
